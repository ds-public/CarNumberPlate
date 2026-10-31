"use strict" ;

const assert = require( "node:assert/strict" ) ;
const fs = require( "node:fs" ) ;
const { NumberPlateGame } = require( "../Game/game.js" ) ;
require( "../Game/questions.js" ) ;
require( "../Game/plate-data.js" ) ;
require( "../Game/bgm.js" ) ;
require( "../Game/version.js" ) ;

// ブラウザーの待機を使わず時間制限と正解演出を検証する時刻。
let clock = 1000 ;

// 正解演出後の遷移を明示的に進めるコールバック。
let transition = null ;
globalThis.performance = { now: () => clock } ;
globalThis.setTimeout = ( callback ) =>
{
	transition = callback ;
	return 1 ;
} ;
globalThis.clearTimeout = () =>
{
	transition = null ;
} ;
globalThis.requestAnimationFrame = () =>
{
} ;

/// <summary>描画結果とマウスイベントを確認する最小DOM要素を作ります。</summary>
/// <param name="tag">要素名。</param>
/// <returns>ゲームが利用するDOMの代替要素。</returns>
function CreateElement( tag = "div" )
{
	const element = {
		tagName: tag, id: "", className: "", dataset: {}, style: {}, children: [], listeners: {}, hidden: false, textContent: "", offsetWidth: 700,
		append: ( child ) =>
		{
			child.parent = element ;
			element.children.push( child ) ;
		},
		replaceChildren: () =>
		{
			element.children = [] ;
		},
		remove: () =>
		{
			if( element.parent )
			{
				element.parent.children = element.parent.children.filter( ( child ) => child !== element ) ;
			}
		},
		addEventListener: ( name, callback ) =>
		{
			element.listeners[ name ] = callback ;
		},
		setAttribute: ( name, value ) =>
		{
			element[ name ] = value ;
		},
		querySelectorAll: ( selector ) => Descendants( element ).filter( ( child ) => Matches( child, selector ) ),
		querySelector: ( selector ) => element.querySelectorAll( selector )[ 0 ] ?? null,
		closest: ( selector ) => Matches( element, selector ) ? element : element.parent?.closest( selector ) ?? null,
		getBoundingClientRect: () =>
		{
			if( element.id === "number-plate" )
			{
				return { left: 320, right: 900, top: 250, bottom: 440 } ;
			}
			if( element.dataset.paletteSymbol !== undefined )
			{
				const index = [ "+", "-", "*", "/", "(", ")", "√" ].indexOf( element.dataset.paletteSymbol ) ;
				const left = 300 + index * 65 ;
				return { left: left, right: left + 55, top: 530, bottom: 583 } ;
			}
			if( element.id === "expression-row" )
			{
				return { left: 360, right: 850, top: 300, bottom: 410 } ;
			}
			if( element.dataset.tokenId !== undefined )
			{
				const gap = element.parent ;
				const index = gap.children.indexOf( element ) ;
				const left = 392 + Number( gap.dataset.gap ) * 100 + index * 67 ;
				return { left: left, right: left + 55, top: 350, bottom: 403 } ;
			}
			const isGap = element.dataset.gap !== undefined ;
			const index = Number( isGap ? element.dataset.gap : element.dataset.digitIndex ?? 0 ) ;
			const left = 380 + index * 100 + ( isGap ? 0 : 20 ) ;
			return { left: left, right: left + ( isGap ? Math.max( 18, element.children.length * 67 + 12 ) : 62 ), top: 300, bottom: 410 } ;
		},
		getContext: () => ( { clearRect: () =>
		{
		} } )
	} ;
	Object.assign( element, {
		classList: {
			add: ( name ) =>
			{
				element.className += " " + name ;
			},
			remove: ( ...names ) =>
			{
				element.className = element.className.split( " " ).filter( ( name ) => ! names.includes( name ) ).join( " " ) ;
			},
			toggle: ( name, enabled ) =>
			{
				if( enabled )
				{
					element.classList.add( name ) ;
				}
				else
				{
					element.classList.remove( name ) ;
				}
			}
		}
	} ) ;
	return element ;
}

/// <summary>要素のすべての子孫を返します。</summary>
/// <param name="element">起点の要素。</param>
/// <returns>子孫要素の配列。</returns>
function Descendants( element )
{
	return element.children.flatMap( ( child ) => [ child, ...Descendants( child ) ] ) ;
}

/// <summary>ゲームで利用するクラス・属性セレクターを照合します。</summary>
/// <param name="element">対象要素。</param>
/// <param name="selector">照合するセレクター。</param>
/// <returns>いずれかの条件に一致するとtrue。</returns>
function Matches( element, selector )
{
	return selector.split( "," ).some( ( condition ) =>
	{
		condition = condition.trim() ;
		if( condition.startsWith( "." ) )
		{
			return element.className.split( " " ).includes( condition.slice( 1 ) ) ;
		}
		const match = condition.match( /^\[data-([a-z-]+)(?:="([^"]+)")?\]$/ ) ;
		if( ! match )
		{
			return false ;
		}
		const key = match[ 1 ].replace( /-([a-z])/g, ( _, letter ) => letter.toUpperCase() ) ;
		return element.dataset[ key ] !== undefined && ( match[ 2 ] === undefined || String( element.dataset[ key ] ) === match[ 2 ] ) ;
	} ) ;
}

// HTML内の実際のIDを利用して、ゲームとテストの要素名のずれを検出する。
const body = CreateElement( "body" ) ;

// 初期HTMLから取得するID付き要素。
const elements = new Map() ;
for( const match of fs.readFileSync( require( "node:path" ).join( __dirname, "../Game/index.html" ), "utf8" ).matchAll( /id="([^"]+)"/g ) )
{
	const element = CreateElement() ;
	element.id = match[ 1 ] ;
	if( element.id.endsWith( "-screen" ) )
	{
		element.className = "screen" ;
	}
	elements.set( element.id, element ) ;
	body.append( element ) ;
}
for( const count of [ 10, 20, 50, 100 ] )
{
	const option = CreateElement( "button" ) ;
	option.dataset.questionCount = String( count ) ;
	body.append( option ) ;
}
global.document = {
	body: body,
	getElementById: ( id ) =>
	{
		assert( elements.has( id ), id ) ;
		return elements.get( id ) ;
	},
	querySelectorAll: ( selector ) => body.querySelectorAll( selector ),
	createElement: CreateElement,
	addEventListener: () =>
	{
	}
} ;
global.window = { innerWidth: 1280, innerHeight: 720, confirm: () => true, addEventListener: () =>
{
} } ;

// ローカルストレージの模擬。既存の検証ではTipsを表示済みとして始める。
const storage = new Map( [ [ "numberPlate.tutorialSeen", "1" ], [ "otherApp.key", "keep" ] ] ) ;
global.localStorage = {
	get length()
	{
		return storage.size ;
	},
	key: ( index ) => [ ...storage.keys() ][ index ] ?? null,
	getItem: ( key ) => storage.get( key ) ?? null,
	setItem: ( key, value ) => storage.set( key, String( value ) ),
	removeItem: ( key ) => storage.delete( key )
} ;

// 初期化から画面遷移まで実際のゲームクラスを利用する。
const game = new NumberPlateGame() ;
assert.equal( elements.get( "version-label" ).textContent, `Version ${ globalThis.NumberPlateVersion }`, "version.js の値をタイトルに表示する" ) ;

// 入力処理から発行される効果音の種類を、実際の音声処理を維持したまま記録する。
const effects = [] ;
game.PlaySoundEffect = ( kind ) =>
{
	effects.push( kind ) ;
	NumberPlateGame.prototype.PlaySoundEffect.call( game, kind ) ;
} ;
elements.get( "game" ).listeners.mousedown( { button: 2 } ) ;
assert.equal( effects.length, 0 ) ;
elements.get( "game" ).listeners.mousedown( { button: 0 } ) ;
assert.deepEqual( effects, [ "confirm" ] ) ;
assert.equal( game.m_bgm.m_desiredScene, "title" ) ;
assert.equal( elements.get( "symbol-palette" ).children.length, 7 ) ;
elements.get( "title-screen" ).listeners.click() ;
assert.equal( elements.get( "selection-modal" ).hidden, false ) ;
Math.random = () => 0 ;
document.querySelectorAll( "[data-question-count]" )[ 0 ].listeners.click() ;
assert.equal( game.m_phase, "play" ) ;
assert.equal( game.m_bgm.m_desiredScene, "play" ) ;
assert.equal( elements.get( "title-screen" ).hidden, true ) ;
assert.equal( elements.get( "play-screen" ).hidden, false ) ;
assert.equal( elements.get( "time-value" ).textContent, "30.0" ) ;
assert.equal( elements.get( "expression-row" ).querySelectorAll( ".empty-digit" ).length, 0, "空き桁は0の数字として表示する" ) ;
assert.equal( game.m_originalDigits.length, 4 ) ;

/// <summary>記号をパレットから実際のマウス処理で挿入します。</summary>
/// <param name="symbol">挿入する記号。</param>
/// <param name="gap">挿入先の桁間。</param>
function DragSymbol( symbol, gap )
{
	DragPaletteTo( symbol, 385 + gap * 100, 350 ) ;
}

/// <summary>パレットの記号を指定座標へドラッグします。</summary>
/// <param name="symbol">ドラッグする記号。</param>
/// <param name="x">ドロップ先の横座標。</param>
/// <param name="y">ドロップ先の縦座標。</param>
function DragPaletteTo( symbol, x, y )
{
	const target = document.querySelectorAll( "[data-palette-symbol]" ).find( ( element ) => element.dataset.paletteSymbol === symbol ) ;
	const event = { button: 0, target: target, clientX: 200, clientY: 550, preventDefault: () =>
	{
	} } ;
	game.BeginDrag( event ) ;
	game.MoveDrag( { clientX: x, clientY: y } ) ;
	assert.equal( game.m_drag.active, true ) ;
	game.EndDrag( { button: 0, clientX: x, clientY: y } ) ;
}

DragSymbol( "+", 1 ) ;
assert.equal( effects.at( -1 ), "place" ) ;
assert.equal( game.m_phase, "feedback" ) ;
assert.equal( game.m_correct, 1 ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "10" ) ;
clock += 850 ;
transition() ;
assert.equal( game.m_phase, "play" ) ;
assert.equal( elements.get( "question-number" ).textContent, "02" ) ;
assert( game.m_usedIndices.has( 200 ) ) ;
assert.equal( elements.get( "time-value" ).textContent, "30.0" ) ;

game.m_originalDigits = [ 1, 0, 8 ] ;
game.ResetExpression() ;
const originalDigit = document.querySelectorAll( ".digit" )[ 1 ] ;
game.BeginDrag( { button: 0, target: originalDigit, clientX: 520, clientY: 350, preventDefault: () =>
{
} } ) ;
game.MoveDrag( { clientX: 430, clientY: 350 } ) ;
game.EndDrag( { button: 0, clientX: 430, clientY: 350 } ) ;
assert.deepEqual( game.m_digits, [ 0, 1, 8 ] ) ;
assert.equal( document.querySelectorAll( ".digit" )[ 0 ].textContent, "・" ) ;
game.m_originalDigits = [ 2, 7 ] ;
game.ResetExpression() ;
DragSymbol( "√", 0 ) ;
assert.equal( document.querySelectorAll( ".invalid-root" ).length, 1 ) ;
const placed = document.querySelectorAll( "[data-token-id]" )[ 0 ] ;
game.DeleteSymbol( { target: placed, preventDefault: () =>
{
} } ) ;
assert.equal( game.m_gaps[ 0 ].length, 0 ) ;
assert.equal( effects.at( -1 ), "drop", "右クリックによる記号の削除でもドロップ音を鳴らす" ) ;

// 0除算の印が対象記号に付き、除数の変更と削除に追従することを確認する。
game.m_originalDigits = [ 5, 0, 4 ] ;
game.ResetExpression() ;
DragSymbol( "/", 1 ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "9" ) ;
assert.equal( elements.get( "tray-result-value" ).textContent, "9" ) ;
assert.equal( document.querySelectorAll( ".invalid-division" ).length, 1 ) ;
assert.equal( document.querySelectorAll( ".invalid-division" )[ 0 ].textContent, "÷" ) ;
game.m_digits = [ 5, 4, 0 ] ;
game.RenderExpression( false ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "1.25" ) ;
assert.equal( document.querySelectorAll( ".invalid-division" ).length, 0 ) ;
game.DeleteSymbol( { target: document.querySelectorAll( "[data-token-id]" )[ 0 ], preventDefault: () =>
{
} } ) ;
assert.equal( game.m_gaps[ 1 ].length, 0 ) ;
clock += 15000 ;
game.UpdateTime( clock ) ;
assert.equal( elements.get( "time-value" ).textContent, "15.0" ) ;
elements.get( "reset-button" ).listeners.click() ;
game.UpdateTime( clock ) ;
assert.equal( elements.get( "time-value" ).textContent, "15.0" ) ;
clock += 15000 ;
game.UpdateTime( clock ) ;
assert.equal( game.m_phase, "over" ) ;
assert.equal( game.m_bgm.m_desiredScene, "over" ) ;
assert.equal( elements.get( "result-title" ).textContent, "ゲームオーバー" ) ;
assert.equal( elements.get( "iq-value" ).textContent, 65 ) ;

elements.get( "retry-button" ).listeners.click() ;
game.m_correct = 9 ;
DragSymbol( "+", 1 ) ;
transition() ;
assert.equal( game.m_phase, "clear" ) ;
assert.equal( game.m_bgm.m_desiredScene, "clear" ) ;
assert.equal( elements.get( "result-title" ).textContent, "クリアおめでとう" ) ;
assert.equal( elements.get( "iq-value" ).textContent, 105 ) ;
elements.get( "title-button" ).listeners.click() ;
assert.equal( game.m_phase, "title" ) ;
assert.equal( game.m_bgm.m_desiredScene, "title" ) ;
window.innerWidth = 640 ;
window.innerHeight = 360 ;
game.Resize() ;
assert.equal( elements.get( "game" ).style.transform, "scale(0.5)" ) ;

/// <summary>配置済み記号を指定座標までマウスでドラッグします。</summary>
/// <param name="tokenId">移動する記号の識別子。</param>
/// <param name="x">移動先の横座標。</param>
/// <param name="y">移動先の縦座標。</param>
function DragPlacedSymbol( tokenId, x, y )
{
	const target = document.querySelectorAll( "[data-token-id]" ).find( ( element ) => Number( element.dataset.tokenId ) === tokenId ) ;
	assert( target ) ;
	game.BeginDrag( { button: 0, target: target, clientX: 430, clientY: 350, preventDefault: () =>
	{
	} } ) ;
	game.MoveDrag( { clientX: x, clientY: y } ) ;
	game.EndDrag( { button: 0, clientX: x, clientY: y } ) ;
}

// 枠外削除とパレットへの置き換えを、マウス処理と再計算まで通して確認する。
game.Start( 10 ) ;
game.m_originalDigits = [ 2, 3, 3 ] ;
game.ResetExpression() ;
DragSymbol( "+", 1 ) ;
DragSymbol( "+", 2 ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "8" ) ;
const deletedId = game.m_gaps[ 1 ][ 0 ].id ;
DragPlacedSymbol( deletedId, 100, 200 ) ;
assert.equal( effects.at( -1 ), "drop" ) ;
assert.equal( game.m_gaps[ 1 ].length, 0 ) ;
assert.equal( game.m_gaps[ 2 ].length, 1 ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "✕" ) ;
DragSymbol( "+", 1 ) ;
const replacementId = game.m_gaps[ 1 ][ 0 ].id ;
DragPlacedSymbol( replacementId, 457, 550 ) ;
assert.equal( game.m_gaps[ 1 ][ 0 ].id, replacementId ) ;
assert.equal( game.m_gaps[ 1 ][ 0 ].symbol, "*" ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "9" ) ;
assert.deepEqual( document.querySelectorAll( "[data-palette-symbol]" ).map( ( element ) => element.dataset.paletteSymbol ), [ "+", "-", "*", "/", "(", ")", "√" ] ) ;
DragPlacedSymbol( replacementId, 330, 270 ) ;
assert.equal( game.m_gaps[ 1 ][ 0 ].id, replacementId, "プレート下地内では削除しない" ) ;
assert.equal( document.querySelectorAll( ".palette-target" ).length, 0 ) ;

// 無効な置き換えでは元の記号を削除しない。
game.ResetExpression() ;
DragSymbol( "-", 0 ) ;
const prefixId = game.m_gaps[ 0 ][ 0 ].id ;
const beforeRejectedEffect = effects.length ;
DragPlacedSymbol( prefixId, 457, 550 ) ;
assert.equal( effects.length, beforeRejectedEffect ) ;
assert.equal( game.m_gaps[ 0 ][ 0 ].symbol, "-" ) ;
game.ResetExpression() ;
DragSymbol( "(", 1 ) ;
DragSymbol( "+", 1 ) ;
DragSymbol( "√", 1 ) ;
const bracketId = game.m_gaps[ 1 ].find( ( token ) => token.symbol === "(" ).id ;
DragPlacedSymbol( bracketId, 392, 550 ) ;
assert.equal( game.m_gaps[ 1 ].find( ( token ) => token.id === bracketId ).symbol, "(" ) ;
assert.equal( game.m_gaps[ 1 ].length, 3 ) ;

// パレットでの置き換えによって10になれば、通常どおり正解にする。
game.Start( 10 ) ;
game.m_originalDigits = [ 1, 9 ] ;
game.ResetExpression() ;
DragSymbol( "-", 1 ) ;
DragPlacedSymbol( game.m_gaps[ 1 ][ 0 ].id, 327, 550 ) ;
assert.equal( game.m_phase, "feedback" ) ;
assert.equal( game.m_correct, 1 ) ;
clock += 850 ;
transition() ;

// パレットからタイルの中央は置き換え、左右の余白は追加になることを確認する。
game.Start( 10 ) ;
game.m_originalDigits = [ 2, 3, 3 ] ;
game.ResetExpression() ;
DragSymbol( "-", 1 ) ;
DragSymbol( "+", 2 ) ;
const overwrittenId = game.m_gaps[ 1 ][ 0 ].id ;
DragPaletteTo( "*", 519, 377 ) ;
assert.equal( game.m_gaps[ 1 ].length, 1 ) ;
assert.equal( game.m_gaps[ 1 ][ 0 ].id, overwrittenId ) ;
assert.equal( game.m_gaps[ 1 ][ 0 ].symbol, "*" ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "9" ) ;
assert.equal( document.querySelectorAll( ".replace-target" ).length, 0 ) ;

// 追加カーソルは左側・右側の余白だけを囲み、対象変更時は古い表示を消す。
const previewSource = document.querySelectorAll( "[data-palette-symbol]" ).find( ( element ) => element.dataset.paletteSymbol === "√" ) ;
game.BeginDrag( { button: 0, target: previewSource, clientX: 200, clientY: 550, preventDefault: () =>
{
} } ) ;
game.MoveDrag( { clientX: 486, clientY: 377 } ) ;
assert.equal( game.m_insertionMarker.style.left, "480px" ) ;
assert.equal( game.m_insertionMarker.style.width, "12px" ) ;
assert.equal( document.querySelectorAll( ".drop-target" ).length, 0 ) ;
game.MoveDrag( { clientX: 552, clientY: 377 } ) ;
assert.equal( game.m_insertionMarker.style.left, "547px" ) ;
assert.equal( game.m_insertionMarker.style.width, "12px" ) ;
assert.equal( document.querySelectorAll( ".insertion-target" ).length, 1 ) ;
game.MoveDrag( { clientX: 519, clientY: 377 } ) ;
assert.equal( game.m_insertionMarker, null ) ;
assert.equal( document.querySelectorAll( ".replace-target" ).length, 1 ) ;
game.CancelDrag() ;
assert.equal( document.querySelectorAll( ".insertion-target" ).length, 0 ) ;
assert.equal( document.querySelectorAll( ".insertion-active" ).length, 0 ) ;

DragPaletteTo( "/", 519, 320 ) ;
assert.equal( game.m_gaps[ 1 ].length, 1, "タイル上方は左右の追加領域として扱わない" ) ;
assert.equal( game.m_gaps[ 1 ][ 0 ].symbol, "*" ) ;
DragPaletteTo( "√", 486, 377 ) ;
assert.deepEqual( game.m_gaps[ 1 ].map( ( item ) => item.symbol ), [ "√", "*" ] ) ;
game.ResetExpression() ;
DragSymbol( "*", 1 ) ;
DragPaletteTo( "-", 552, 377 ) ;
assert.deepEqual( game.m_gaps[ 1 ].map( ( item ) => item.symbol ), [ "*", "-" ] ) ;
DragPaletteTo( "+", 519, 377 ) ;
assert.deepEqual( game.m_gaps[ 1 ].map( ( item ) => item.symbol ), [ "+", "-" ], "上限2記号でも追加ではなく置き換える" ) ;
DragPaletteTo( "/", 486, 377 ) ;
assert.equal( game.m_gaps[ 1 ].length, 2, "左右への追加時は上限を守る" ) ;
game.ResetExpression() ;
DragSymbol( "-", 0 ) ;
DragPaletteTo( "*", 419, 377 ) ;
assert.equal( game.m_gaps[ 0 ][ 0 ].symbol, "-", "無効な置き換えで追加や削除をしない" ) ;
assert.equal( game.m_gaps[ 0 ].length, 1 ) ;

// 8−02は6としてプレイを継続し、8＋02に置き換えた場合だけ正解にする。
game.Start( 10 ) ;
game.m_originalDigits = [ 8, 0, 2 ] ;
game.ResetExpression() ;
DragSymbol( "-", 1 ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "6" ) ;
assert.equal( game.m_phase, "play" ) ;
assert.equal( game.m_correct, 0 ) ;
DragPaletteTo( "+", 519, 377 ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "10" ) ;
assert.equal( game.m_phase, "feedback" ) ;
assert.equal( game.m_correct, 1 ) ;
clock += 850 ;
transition() ;

// 0を挟んだ非0数字の間にも記号を要求し、1＋405の誤判定を防ぐ。
game.Start( 10 ) ;
game.m_originalDigits = [ 1, 4, 0, 5 ] ;
game.ResetExpression() ;
DragSymbol( "+", 1 ) ;
assert.equal( game.m_phase, "play" ) ;
assert.equal( game.m_correct, 0 ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "✕" ) ;
DragSymbol( "+", 3 ) ;
assert.equal( game.m_phase, "feedback" ) ;
assert.equal( game.m_correct, 1 ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "10" ) ;
clock += 850 ;
transition() ;

// 0以外の桁間に必要な記号が揃うまで、118を正解として扱わない。
game.Start( 10 ) ;
game.m_originalDigits = [ 1, 1, 8 ] ;
game.ResetExpression() ;
assert.equal( elements.get( "plate-result-value" ).textContent, "✕" ) ;
DragSymbol( "+", 1 ) ;
assert.equal( game.m_phase, "play" ) ;
assert.equal( game.m_correct, 0 ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "✕" ) ;
DragSymbol( "+", 2 ) ;
assert.equal( game.m_phase, "feedback" ) ;
assert.equal( game.m_correct, 1 ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "10" ) ;
clock += 850 ;
transition() ;

// 505の両方の桁間で、加算記号1つの挿入から正解・次問への遷移を確認する。
for( const gap of [ 1, 2 ] )
{
	game.Start( 10 ) ;
	game.m_originalDigits = [ 5, 0, 5 ] ;
	game.ResetExpression() ;
	assert.equal( elements.get( "plate-result-value" ).textContent, "✕" ) ;
	assert.equal( game.m_phase, "play" ) ;
	assert.equal( game.m_correct, 0 ) ;
	const digit = document.querySelectorAll( ".digit" )[ 0 ] ;
	game.BeginDrag( { button: 0, target: digit, clientX: 430, clientY: 350, preventDefault: () =>
	{
	} } ) ;
	game.EndDrag( { button: 0, clientX: 430, clientY: 350 } ) ;
	assert.equal( game.m_phase, "play", "クリックだけでは自動正解にしない" ) ;
	DragSymbol( "*", 0 ) ;
	assert.equal( game.m_phase, "play", "無効な挿入では自動正解にしない" ) ;
	DragSymbol( "+", gap ) ;
	assert.equal( game.m_phase, "feedback" ) ;
	assert.equal( game.m_correct, 1 ) ;
	clock += 850 ;
	transition() ;
	assert.equal( game.m_phase, "play" ) ;
	assert.equal( elements.get( "question-number" ).textContent, "02" ) ;
}

// 3桁の問題の「・」は0として並べ替え・計算し、途中へ移した0は「0」と表示する。
game.Start( 10 ) ;
game.m_originalDigits = [ 0, 3, 5, 5 ] ;
game.ResetExpression() ;
assert.deepEqual( document.querySelectorAll( ".digit" ).map( ( element ) => String( element.textContent ) ), [ "・", "3", "5", "5" ] ) ;
game.m_digits = [ 3, 0, 5, 5 ] ;
game.RenderExpression( false ) ;
assert.deepEqual( document.querySelectorAll( ".digit" ).map( ( element ) => String( element.textContent ) ), [ "3", "0", "5", "5" ] ) ;
game.m_digits = [ 0, 0, 1, 9 ] ;
game.RenderExpression( false ) ;
assert.deepEqual( document.querySelectorAll( ".digit" ).map( ( element ) => String( element.textContent ) ), [ "・", "・", "1", "9" ] ) ;
game.ResetExpression() ;
DragSymbol( "*", 1 ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "0" ) ;
DragSymbol( "+", 2 ) ;
assert.equal( game.m_phase, "play" ) ;
DragSymbol( "+", 3 ) ;
assert.equal( elements.get( "plate-result-value" ).textContent, "10" ) ;
assert.equal( game.m_phase, "feedback" ) ;
clock += 850 ;
transition() ;

// 初回プレイ時だけTipsで第1問の制限時間を止め、ゲーム開始で30秒から始める。
storage.delete( "numberPlate.tutorialSeen" ) ;
game.Start( 10 ) ;
assert.equal( game.m_phase, "tips" ) ;
assert.equal( elements.get( "tips-modal" ).hidden, false ) ;
clock += 5000 ;
game.BeginDrag( { button: 0, target: document.querySelectorAll( ".digit" )[ 0 ], clientX: 430, clientY: 350, preventDefault: () =>
{
} } ) ;
assert.equal( game.m_drag, null, "Tips表示中は操作できない" ) ;
elements.get( "tips-start-button" ).listeners.click() ;
assert.equal( game.m_phase, "play" ) ;
assert.equal( elements.get( "tips-modal" ).hidden, true ) ;
assert.equal( elements.get( "time-value" ).textContent, "30.0" ) ;
assert.equal( storage.get( "numberPlate.tutorialSeen" ), "1" ) ;
game.Start( 10 ) ;
assert.equal( game.m_phase, "play", "2回目以降はTipsを表示しない" ) ;

// データ削除はこのゲームのキーだけを消し、問題数選択を開かない。
game.ShowTitle() ;
let propagationStopped = false ;
elements.get( "data-delete-button" ).listeners.click( { stopPropagation: () =>
{
	propagationStopped = true ;
} } ) ;
assert( propagationStopped ) ;
assert.equal( storage.has( "numberPlate.tutorialSeen" ), false ) ;
assert.equal( storage.get( "otherApp.key" ), "keep" ) ;
assert.equal( elements.get( "data-delete-button" ).textContent, "削除しました" ) ;
transition() ;
assert.equal( elements.get( "data-delete-button" ).textContent, "データ削除" ) ;
game.Start( 10 ) ;
assert.equal( game.m_phase, "tips", "削除後は再びTipsを表示する" ) ;
elements.get( "tips-start-button" ).listeners.click() ;

// 4種類すべてのモードを、保存済みの式の入力と実際の正解遷移で完走する。
const solutions = JSON.parse( fs.readFileSync( require( "node:path" ).join( __dirname, "../Documents/難易度別解答例.json" ), "utf8" ) ) ;
for( const total of [ 10, 20, 50, 100 ] )
{
	game.Start( total ) ;
	for( let question = 1 ; question <= total ; question ++ )
	{
		const value = String( Number( game.m_originalDigits.join( "" ) ) ) ;
		const expression = solutions[ value ].expression ;
		game.m_digits = expression.match( /[0-9]/g ).map( Number ) ;
		game.m_gaps = Array.from( { length: game.m_digits.length + 1 }, () => [] ) ;
		let gapIndex = 0 ;
		for( const symbol of expression )
		{
			if( /[0-9]/.test( symbol ) )
			{
				gapIndex ++ ;
			}
			else
			{
				game.m_gaps[ gapIndex ].push( { symbol: symbol, id: game.m_nextTokenId ++ } ) ;
			}
		}
		game.RenderExpression() ;
		assert.equal( game.m_phase, "feedback", `${ total }問モードの第${ question }問` ) ;
		assert.equal( game.m_correct, question ) ;
		clock += 850 ;
		transition() ;
	}
	assert.equal( game.m_phase, "clear" ) ;
	assert.equal( game.m_usedIndices.size, total ) ;
}
console.log( "PASS: initialization, title popup, question selection, mouse symbol insertion, digit swap, leading zero, invalid sqrt, right-click deletion, timer/reset, next question, game over, clear, replay, title return, and 16:9 scaling (simulated DOM)." ) ;
console.log( "PASS: completed all 10/20/50/100-question modes through actual evaluation and screen transitions." ) ;
