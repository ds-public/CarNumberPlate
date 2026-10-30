"use strict" ;

const assert = require( "node:assert/strict" ) ;
const fs = require( "node:fs" ) ;
const path = require( "node:path" ) ;
require( "../Game/plate-data.js" ) ;

// 検証対象のゲームロジック。
const { ExpressionParser, GetQuestionRange, CalculateIq, NumberPlateGame } = require( "../Game/game.js" ) ;

// リポジトリのルートパス。
const root = path.resolve( __dirname, ".." ) ;

/// <summary>画面依存の副作用を検証時だけ省略します。</summary>
function DoNothing()
{
}

/// <summary>文字列をゲームと同じトークン列で評価します。</summary>
/// <param name="expression">検証する式。</param>
/// <returns>ゲームによる評価結果。</returns>
function Evaluate( expression )
{
	const tokens = [ ...expression ].map( ( symbol, index ) =>
	{
		return /[0-9]/.test( symbol ) ? { digit: Number( symbol ) } : { symbol: symbol, id: index } ;
	} ) ;
	return new ExpressionParser( tokens ).Evaluate() ;
}

// 全問の難易度と解答式を照合するための元データ。
const rows = fs.readFileSync( path.join( root, "Game/Question.csv" ), "utf8" ).trim().split( /\r?\n/ ).map( ( line ) => line.split( "," ).map( Number ) ) ;

// 計算時に保存した、各出題値の最小難易度の解答例。
const witnesses = JSON.parse( fs.readFileSync( path.join( root, "Documents/難易度別解答例.json" ), "utf8" ) ) ;
assert.equal( rows.length, 8866 ) ;
assert.equal( new Set( rows.map( ( row ) => row[ 0 ] ) ).size, 8866 ) ;
for( let index = 0 ; index < rows.length ; index ++ )
{
	const [ number, difficulty ] = rows[ index ] ;
	assert( number >= 19 && number <= 9999 ) ;
	if( index > 0 )
	{
		const previous = rows[ index - 1 ] ;
		assert( difficulty > previous[ 1 ] || ( difficulty === previous[ 1 ] && number > previous[ 0 ] ) ) ;
	}
	const { expression } = witnesses[ number ] ;
	const result = Evaluate( expression ) ;
	assert.equal( result.error, null, `${ number }: ${ expression }` ) ;
	assert.equal( result.invalidRoots.length, 0 ) ;
	assert.equal( result.invalidDivisions.length, 0 ) ;
	assert.equal( result.value.m_numerator, 10n ) ;
	assert.equal( result.value.m_denominator, 1n ) ;
	const digits = expression.match( /[0-9]/g ) ;
	assert.equal( [ ...digits ].sort().join( "" ), [ ...String( number ) ].sort().join( "" ) ) ;
	let score = digits.length ;
	for( const symbol of expression.replace( /[0-9]/g, "" ) )
	{
		score += symbol === "√" ? 4 : symbol === "*" || symbol === "/" ? 2 : 1 ;
	}
	score += digits.filter( ( digit, position ) => digit !== String( number )[ position ] ).length ;
	assert.equal( score, difficulty ) ;
	for( const gap of expression.split( /[0-9]/ ).slice( 1, -1 ) )
	{
		assert( gap.replace( /[()]/g, "" ).length <= 2, `${ number }: 桁間記号数` ) ;
	}
}
require( "../Game/questions.js" ) ;
assert.deepEqual( globalThis.NumberPlateQuestionTable, rows ) ;

for( const [ expression, expected ] of [ [ "1+2*3", "7" ], [ "(1+1)*(1+4)", "10" ], [ "√9+7", "10" ], [ "√(9+7)+6", "10" ], [ "-1+9", "8" ], [ "+1+9", "10" ], [ "8/3*3+2", "10" ], [ "√√9+7", "10" ], [ "1--9", "10" ] ] )
{
	assert.equal( Evaluate( expression ).value.ToDisplayString(), expected, expression ) ;
}
for( const [ expression, expected ] of [ [ "1+40+5", "10" ], [ "1+4+05", "10" ], [ "4+006", "10" ], [ "5+05", "10" ], [ "50+5", "10" ], [ "1+1+8", "10" ], [ "1+0+9", "10" ], [ "1-0+9", "10" ], [ "5*0+5", "5" ], [ "5+0*5", "5" ], [ "5*05", "5" ], [ "0/5+1", "1" ], [ "100+9", "10" ], [ "50+05", "10" ] ] )
{
	assert.equal( Evaluate( expression ).value.ToDisplayString(), expected, expression ) ;
}
for( const expression of [ "1+405", "140+5", "505", "1009", "4006", "10√9", "10(9)", "118", "1+18", "11+8", "19", "12*3", "1*23", "1√9", "1(2+3)", "(1+2)(3+4)", "√(99)", "10+18", "(1+9", "1+9)", "*1+9", "/1+9", "()", "1+", "" ] )
{
	assert.notEqual( Evaluate( expression ).error, null, expression ) ;
}
assert.equal( Evaluate( "√2+8" ).value.ToDisplayString(), "10" ) ;
assert.equal( Evaluate( "√2+8" ).invalidRoots.length, 1 ) ;
assert.equal( Evaluate( "√(-1)+9" ).invalidRoots.length, 1 ) ;

// 0除算は直前までの乗除算の値を保持し、対象の除算記号だけを報告する。
for( const [ expression, expected, count ] of [ [ "1/0", "1", 1 ], [ "5/0+5", "10", 1 ], [ "5/0*2", "10", 1 ], [ "6*2/0", "12", 1 ], [ "8/0/2", "4", 1 ], [ "0/0+1", "1", 1 ], [ "9/(1-1)", "9", 1 ], [ "8/0/0", "8", 2 ], [ "8/2+0", "4", 0 ] ] )
{
	const result = Evaluate( expression ) ;
	assert.equal( result.error, null, expression ) ;
	assert.equal( result.value.ToDisplayString(), expected, expression ) ;
	assert.equal( result.invalidDivisions.length, count, expression ) ;
	for( const id of result.invalidDivisions )
	{
		assert.equal( expression[ id ], "/" ) ;
	}
}
assert.notEqual( Evaluate( "5/0+" ).error, null ) ;
assert.deepEqual( Evaluate( "5/0+" ).invalidDivisions, [ 1 ] ) ;

// 加減算の0を挟んでも符号を維持し、乗除算の0とは区別する。
for( const [ expression, expected ] of [ [ "8-02", "6" ], [ "8+02", "10" ], [ "80-2", "6" ], [ "8-002", "6" ], [ "8-+02", "6" ], [ "8--02", "10" ], [ "-02+8", "6" ], [ "8-0*2", "8" ], [ "8-0+2", "10" ], [ "8-(02)", "6" ], [ "8-0√4", "6" ] ] )
{
	const result = Evaluate( expression ) ;
	assert.equal( result.error, null, expression ) ;
	assert.equal( result.value.ToDisplayString(), expected, expression ) ;
}

for( const [ correct, iq ] of [ [ 0, 56 ], [ 1, 65 ], [ 2, 73 ], [ 3, 80 ], [ 4, 86 ], [ 5, 91 ], [ 6, 95 ], [ 7, 98 ], [ 8, 100 ], [ 9, 102 ], [ 10, 105 ], [ 11, 107 ], [ 12, 109 ], [ 13, 111 ], [ 14, 113 ], [ 15, 115 ], [ 16, 116 ], [ 17, 117 ], [ 18, 118 ], [ 19, 119 ], [ 20, 120 ], [ 21, 121 ], [ 35, 135 ], [ 50, 150 ], [ 75, 175 ], [ 100, 200 ] ] )
{
	assert.equal( CalculateIq( correct ), iq ) ;
}
for( let number = 1 ; number <= 100 ; number ++ )
{
	assert.deepEqual( GetQuestionRange( number ), number <= 20 ? [ ( number - 1 ) * 200, number * 200 - 1 ] : number <= 50 ? [ 4000, 5999 ] : [ 6000, 8865 ] ) ;
}
assert.deepEqual( GetQuestionRange( 51, 9000 ), [ 6000, 8999 ] ) ;

// DOMに依存する画面切り替えを置き換え、実際の進行メソッドを検証する。
const elements = new Map() ;
global.document = {
	getElementById: ( id ) =>
	{
		if( ! elements.has( id ) )
		{
			elements.set( id, { classList: { remove: DoNothing, toggle: DoNothing }, style: {}, setAttribute: DoNothing, getContext: () => ( { clearRect: DoNothing } ) } ) ;
		}
		return elements.get( id ) ;
	},
	querySelectorAll: () => []
} ;

// コンストラクターのイベント登録を使わず進行だけを検証するゲーム。
const game = Object.create( NumberPlateGame.prototype ) ;
Object.assign( game, { m_root: document.getElementById( "game" ), m_table: rows, m_usedIndices: new Set(), m_correct: 0, m_total: 100, m_particles: [], CancelDrag: DoNothing, ResetExpression: DoNothing, ShowScreen: DoNothing, PlayJingle: DoNothing } ) ;
for( let trial = 0 ; trial < 30 ; trial ++ )
{
	game.m_usedIndices.clear() ;
	for( let correct = 0 ; correct < 100 ; correct ++ )
	{
		game.m_correct = correct ;
		game.NextQuestion() ;
		const index = [ ...game.m_usedIndices ].at( -1 ) ;
		const [ start, end ] = GetQuestionRange( correct + 1 ) ;
		assert( index >= start && index <= end ) ;
		assert.equal( game.m_usedIndices.size, correct + 1 ) ;
		assert( game.m_deadline > performance.now() + 29000 ) ;
	}
}
game.m_correct = 7 ;
game.m_deadline = performance.now() - 1 ;
assert.equal( game.CheckTime(), false ) ;
assert.equal( game.m_phase, "over" ) ;
assert.equal( elements.get( "iq-value" ).textContent, 98 ) ;
game.m_correct = 100 ;
game.Finish( true ) ;
assert.equal( game.m_phase, "clear" ) ;
assert.equal( elements.get( "iq-value" ).textContent, 200 ) ;

// 記号上限・先頭の乗除算禁止・既存記号の移動を実メソッドで検証する。
game.m_digits = [ 1, 1, 1, 4 ] ;
game.m_gaps = [ [], [], [], [], [] ] ;
game.m_nextTokenId = 1 ;
game.PlaceSymbol( { dataset: { paletteSymbol: "*" } }, 0, null ) ;
assert.equal( game.m_gaps[ 0 ].length, 0 ) ;
for( const symbol of [ ")", "*", "(", "√" ] )
{
	game.PlaceSymbol( { dataset: { paletteSymbol: symbol } }, 2, null ) ;
}
assert.equal( game.m_gaps[ 2 ].length, 4 ) ;
game.PlaceSymbol( { dataset: { paletteSymbol: "+" } }, 2, null ) ;
assert.equal( game.m_gaps[ 2 ].length, 4 ) ;
game.PlaceSymbol( { dataset: { tokenId: "4" } }, 1, null ) ;
assert.equal( game.m_gaps[ 1 ][ 0 ].symbol, "√" ) ;
assert.equal( game.m_gaps[ 2 ].length, 3 ) ;

console.log( "PASS: 8,866 exact solutions, difficulty scores, CSV/JS parity, parser, sqrt, IQ, 3,000 question selections, deadlines, results, and symbol placement." ) ;
