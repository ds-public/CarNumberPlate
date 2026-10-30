"use strict" ;

/// <summary>非負整数の平方根の整数部分を厳密に求めます。</summary>
/// <param name="value">平方根を求める非負の整数。</param>
/// <returns>平方根の整数部分。</returns>
function IntegerSquareRoot( value )
{
	if( value < 0n )
	{
		throw new RangeError( "負数の平方根です。" ) ;
	}
	if( value < 2n )
	{
		return value ;
	}
	let current = value ;
	let next = ( current + 1n ) / 2n ;
	while( next < current )
	{
		current = next ;
		next = ( current + value / current ) / 2n ;
	}
	return current ;
}

/// <summary>浮動小数点の誤差を避けて四則演算を行う有理数です。</summary>
class Rational
{
	/// <summary>約分済みの分子。</summary>
	m_numerator ;

	/// <summary>正の分母。</summary>
	m_denominator ;

	/// <summary>分子と分母から約分済みの値を生成します。</summary>
	/// <param name="numerator">分子。</param>
	/// <param name="denominator">0以外の分母。</param>
	constructor( numerator, denominator = 1n )
	{
		numerator = BigInt( numerator ) ;
		denominator = BigInt( denominator ) ;
		if( denominator === 0n )
		{
			throw new RangeError( "0では割れません。" ) ;
		}
		if( denominator < 0n )
		{
			numerator = - numerator ;
			denominator = - denominator ;
		}
		let a = numerator < 0n ? - numerator : numerator ;
		let b = denominator ;
		while( b !== 0n )
		{
			[ a, b ] = [ b, a % b ] ;
		}
		this.m_numerator = numerator / a ;
		this.m_denominator = denominator / a ;
	}

	/// <summary>指定した演算を適用します。</summary>
	/// <param name="operator">四則演算の記号。</param>
	/// <param name="other">右辺の有理数。</param>
	/// <returns>演算結果の有理数。</returns>
	Calculate( operator, other )
	{
		const a = this.m_numerator ;
		const b = this.m_denominator ;
		const c = other.m_numerator ;
		const d = other.m_denominator ;
		switch( operator )
		{
			case "+": return new Rational( a * d + c * b, b * d ) ;
			case "-": return new Rational( a * d - c * b, b * d ) ;
			case "*": return new Rational( a * c, b * d ) ;
			case "/": return new Rational( a * d, b * c ) ;
			default: throw new Error( "不明な演算子です。" ) ;
		}
	}

	/// <summary>表示用の数値を返します。</summary>
	/// <returns>整数、または丸めた小数表記。</returns>
	ToDisplayString()
	{
		if( this.m_denominator === 1n )
		{
			return this.m_numerator.toString() ;
		}
		const value = Number( this.m_numerator ) / Number( this.m_denominator ) ;
		return Number( value.toPrecision( 6 ) ).toString() ;
	}
}

/// <summary>各桁を個別に扱い、0に隣接する境界だけ加算の省略を認めて式を評価します。</summary>
class ExpressionParser
{
	/// <summary>数字と記号のトークン列。</summary>
	m_tokens ;

	/// <summary>次に読み取る位置。</summary>
	m_position = 0 ;

	/// <summary>整数の平方根にならず無視した記号の識別子。</summary>
	m_invalidRoots = [] ;

	/// <summary>除数が0になり適用しなかった除算記号の識別子。</summary>
	m_invalidDivisions = [] ;

	/// <summary>評価するトークン列を設定します。</summary>
	/// <param name="tokens">数字または記号を持つトークン列。</param>
	constructor( tokens )
	{
		this.m_tokens = tokens ;
	}

	/// <summary>式全体を評価し、適用できなかった平方根と除算も報告します。</summary>
	/// <returns>計算結果、無視した記号の識別子、計算不能理由。</returns>
	Evaluate()
	{
		try
		{
			const value = this.ReadSum() ;
			this.ValidateSeparators() ;
			if( this.m_position !== this.m_tokens.length )
			{
				throw new Error( "記号の並びを確認してください。" ) ;
			}
			return { value: value, invalidRoots: this.m_invalidRoots, invalidDivisions: this.m_invalidDivisions, error: null } ;
		}
		catch( error )
		{
			return { value: null, invalidRoots: this.m_invalidRoots, invalidDivisions: this.m_invalidDivisions, error: error.message } ;
		}
	}

	/// <summary>0を挟む場合も、0以外の数字や部分式の間に演算記号があることを確認します。</summary>
	ValidateSeparators()
	{
		const operands = [ false ] ;
		for( const token of this.m_tokens )
		{
			const level = operands.length - 1 ;
			if( [ "+", "-", "*", "/" ].includes( token.symbol ) )
			{
				operands[ level ] = false ;
			}
			else if( token.symbol === ")" )
			{
				if( operands.length > 1 )
				{
					operands.pop() ;
				}
			}
			else if( token.symbol === "(" || ( token.digit !== undefined && token.digit !== 0 ) )
			{
				if( operands[ level ] )
				{
					throw new Error( "0を挟む場合も、数字の間には演算記号が必要です。" ) ;
				}
				operands[ level ] = true ;
				if( token.symbol === "(" )
				{
					operands.push( false ) ;
				}
			}
		}
	}

	/// <summary>現在位置のトークンが指定記号なら読み進めます。</summary>
	/// <param name="symbols">読み取る記号の配列。</param>
	/// <returns>読み取ったトークン、またはnull。</returns>
	Take( symbols )
	{
		const token = this.m_tokens[ this.m_position ] ;
		if( token && symbols.includes( token.symbol ) )
		{
			this.m_position ++ ;
			return token ;
		}
		return null ;
	}

	/// <summary>0の前後で省略された加算と、明示された加減算を左から評価します。</summary>
	/// <returns>加減算の結果。</returns>
	ReadSum()
	{
		let start = this.m_position ;
		let value = this.ReadProduct() ;
		let omittedSign = this.GetZeroContinuation( start, this.m_position, "+" ) ;
		while( this.m_position < this.m_tokens.length )
		{
			const token = this.Take( [ "+", "-" ] ) ;
			if( token )
			{
				start = this.m_position ;
				value = value.Calculate( token.symbol, this.ReadProduct() ) ;
				omittedSign = this.GetZeroContinuation( start, this.m_position, token.symbol ) ;
				continue ;
			}
			const next = this.m_tokens[ this.m_position ] ;
			if( next.digit === undefined && next.symbol !== "(" && next.symbol !== "√" )
			{
				break ;
			}
			const previous = this.m_tokens[ this.m_position - 1 ] ;
			if( previous.digit !== 0 && next.digit !== 0 )
			{
				throw new Error( "0以外の数字の間には演算記号が必要です。" ) ;
			}

			// 加減算の0を挟んでも符号を維持し、乗除算に使った0とは区別する。
			start = this.m_position ;
			value = value.Calculate( omittedSign, this.ReadProduct() ) ;
			omittedSign = this.GetZeroContinuation( start, this.m_position, omittedSign ) ;
		}
		return value ;
	}

	/// <summary>符号付きの0だけを読んだ場合、次の数字へ適用する加減算の符号を求めます。</summary>
	/// <param name="start">読み取った部分の開始位置。</param>
	/// <param name="end">読み取った部分の末尾の次の位置。</param>
	/// <param name="sign">0に適用された加減算記号。</param>
	/// <returns>0の後へ引き継ぐ符号。乗除算などを含む場合は加算。</returns>
	GetZeroContinuation( start, end, sign )
	{
		let hasZero = false ;
		for( let index = start ; index < end ; index ++ )
		{
			const token = this.m_tokens[ index ] ;
			if( token.digit === 0 )
			{
				hasZero = true ;
			}
			else if( token.symbol === "-" )
			{
				sign = sign === "+" ? "-" : "+" ;
			}
			else if( token.symbol !== "+" )
			{
				return "+" ;
			}
		}
		return hasZero ? sign : "+" ;
	}

	/// <summary>乗算と除算を左から評価します。</summary>
	/// <returns>乗除算の結果。</returns>
	ReadProduct()
	{
		let value = this.ReadUnary() ;
		let token ;
		while( ( token = this.Take( [ "*", "/" ] ) ) !== null )
		{
			const right = this.ReadUnary() ;
			if( token.symbol === "/" && right.m_numerator === 0n )
			{
				this.m_invalidDivisions.push( token.id ) ;
				continue ;
			}
			value = value.Calculate( token.symbol, right ) ;
		}
		return value ;
	}

	/// <summary>単項符号と整数になる平方根を評価します。</summary>
	/// <returns>単項演算の結果。</returns>
	ReadUnary()
	{
		const token = this.Take( [ "+", "-", "√" ] ) ;
		if( token === null )
		{
			return this.ReadPrimary() ;
		}
		const value = this.ReadUnary() ;
		if( token.symbol === "-" )
		{
			return new Rational( - value.m_numerator, value.m_denominator ) ;
		}
		if( token.symbol === "√" )
		{
			if( value.m_denominator === 1n && value.m_numerator >= 0n )
			{
				const root = IntegerSquareRoot( value.m_numerator ) ;
				if( root * root === value.m_numerator )
				{
					return new Rational( root ) ;
				}
			}
			this.m_invalidRoots.push( token.id ) ;
		}
		return value ;
	}

	/// <summary>1桁の数字または括弧内の式を読み取ります。</summary>
	/// <returns>数字または括弧内の値。</returns>
	ReadPrimary()
	{
		if( this.Take( [ "(" ] ) )
		{
			const value = this.ReadSum() ;
			if( ! this.Take( [ ")" ] ) )
			{
				throw new Error( "括弧が閉じていません。" ) ;
			}
			return value ;
		}
		const token = this.m_tokens[ this.m_position ] ;
		if( ! token || token.digit === undefined )
		{
			throw new Error( "式がまだ完成していません。" ) ;
		}
		this.m_position ++ ;
		return new Rational( token.digit ) ;
	}
}

/// <summary>問題番号に対応する問題テーブルの範囲を返します。</summary>
/// <param name="number">1から始まる問題番号。</param>
/// <param name="tableLength">問題テーブルの要素数。</param>
/// <returns>先頭と末尾のインデックス。</returns>
function GetQuestionRange( number, tableLength = 8866 )
{
	if( number <= 20 )
	{
		return [ ( number - 1 ) * 200, number * 200 - 1 ] ;
	}
	if( number <= 50 )
	{
		return [ 4000, 5999 ] ;
	}
	return [ 6000, tableLength - 1 ] ;
}

/// <summary>0～20問は指定のIQ表、21問以上は既定の区間の線形補間で評価します。</summary>
/// <param name="correct">正解した問題数。</param>
/// <returns>整数に丸めた評価値。</returns>
function CalculateIq( correct )
{
	const points = [
		[ 0, 56 ], [ 1, 65 ], [ 2, 73 ], [ 3, 80 ], [ 4, 86 ],
		[ 5, 91 ], [ 6, 95 ], [ 7, 98 ], [ 8, 100 ], [ 9, 102 ],
		[ 10, 105 ], [ 11, 107 ], [ 12, 109 ], [ 13, 111 ], [ 14, 113 ],
		[ 15, 115 ], [ 16, 116 ], [ 17, 117 ], [ 18, 118 ], [ 19, 119 ],
		[ 20, 120 ], [ 50, 150 ], [ 100, 200 ]
	] ;
	for( let index = 1 ; index < points.length ; index ++ )
	{
		const [ end, high ] = points[ index ] ;
		const [ start, low ] = points[ index - 1 ] ;
		if( correct <= end )
		{
			return Math.round( low + ( high - low ) * ( Math.max( 0, correct ) - start ) / ( end - start ) ) ;
		}
	}
	return 200 ;
}

/// <summary>マウス操作によるゲーム進行と描画を管理します。</summary>
class NumberPlateGame
{
	/// <summary>ゲーム全体の基準解像度を持つ要素。</summary>
	m_root = document.getElementById( "game" ) ;

	/// <summary>難易度順の出題テーブル。</summary>
	m_table = globalThis.NumberPlateQuestionTable ;

	/// <summary>現在の画面または正解演出の状態。</summary>
	m_phase = "title" ;

	/// <summary>選択した総問題数。</summary>
	m_total = 10 ;

	/// <summary>正解済みの問題数。</summary>
	m_correct = 0 ;

	/// <summary>既出問題のインデックス。</summary>
	m_usedIndices = new Set() ;

	/// <summary>出題時の数字の並び。</summary>
	m_originalDigits = [] ;

	/// <summary>現在の数字の並び。</summary>
	m_digits = [] ;

	/// <summary>各数字の前後に挿入された記号の配列。</summary>
	m_gaps = [] ;

	/// <summary>記号を一意に識別する連番。</summary>
	m_nextTokenId = 1 ;

	/// <summary>現在の問題の制限時刻。</summary>
	m_deadline = 0 ;

	/// <summary>次の問題へ進む演出のタイマー。</summary>
	m_transitionTimer = null ;

	/// <summary>ドラッグ開始位置と対象。</summary>
	m_drag = null ;

	/// <summary>マウスに追従する記号または数字の複製。</summary>
	m_ghost = null ;

	/// <summary>既存記号の左右の追加位置だけを示す強調表示。</summary>
	m_insertionMarker = null ;

	/// <summary>ジングルを鳴らす音声コンテキスト。</summary>
	m_audio = null ;

	/// <summary>画面別のBGMと消音状態を管理する再生器。</summary>
	m_bgm = null ;

	/// <summary>花火を構成する粒子。</summary>
	m_particles = [] ;

	/// <summary>次の花火を発生させる時刻。</summary>
	m_nextFirework = 0 ;

	/// <summary>前フレームの時刻。</summary>
	m_lastFrame = 0 ;

	/// <summary>表示とマウスイベントを初期化します。</summary>
	constructor()
	{
		this.BuildPalette() ;
		this.BuildTitleWave() ;
		this.m_bgm = new globalThis.NumberPlateBgm( ( error ) =>
		{
			document.getElementById( "sound-button" ).title = `音声を再生できませんでした：${ error.message }` ;
		} ) ;
		this.BindEvents() ;
		this.Resize() ;
		this.UpdatePlateHeader() ;
		this.ValidateTable() ;
		requestAnimationFrame( this.Tick.bind( this ) ) ;
	}

	/// <summary>読み込んだ問題テーブルの件数とソートを検証します。</summary>
	ValidateTable()
	{
		const valid = Array.isArray( this.m_table ) && this.m_table.length === 8866 && this.m_table.every( ( row, index ) =>
		{
			return Array.isArray( row ) && row.length === 2 && Number.isInteger( row[ 0 ] ) && row[ 0 ] >= 19 && row[ 0 ] <= 9999 && Number.isInteger( row[ 1 ] ) && row[ 1 ] > 0 && ( index === 0 || row[ 1 ] >= this.m_table[ index - 1 ][ 1 ] ) ;
		} ) ;
		if( ! valid )
		{
			const error = document.getElementById( "data-error" ) ;
			error.textContent = "問題データを読み込めませんでした。questions.js を確認してください。" ;
			error.hidden = false ;
			for( const button of document.querySelectorAll( "[data-question-count]" ) )
			{
				button.disabled = true ;
			}
		}
	}

	/// <summary>案内文を文字ごとに分け、文全体に4周期の波が並ぶ位相差を付けます。</summary>
	BuildTitleWave()
	{
		for( const element of document.querySelectorAll( ".wave-text" ) )
		{
			const characters = [ ...element.textContent ] ;
			element.replaceChildren() ;
			for( let index = 0 ; index < characters.length ; index ++ )
			{
				const character = document.createElement( /[0-9]/.test( characters[ index ] ) ? "strong" : "span" ) ;
				character.className = "wave-character" ;
				character.textContent = characters[ index ] ;
				character.style.animationDelay = `${ - index * .9 * 4 / characters.length }s` ;
				element.append( character ) ;
			}
		}
	}

	/// <summary>ドラッグ元になる記号の一覧を生成します。</summary>
	BuildPalette()
	{
		const palette = document.getElementById( "symbol-palette" ) ;
		for( const symbol of [ "+", "-", "*", "/", "(", ")", "√" ] )
		{
			const element = document.createElement( "div" ) ;
			element.className = "palette-symbol" ;
			element.dataset.paletteSymbol = symbol ;
			element.dataset.symbol = symbol ;
			element.textContent = this.DisplaySymbol( symbol ) ;
			element.title = "ドラッグして挿入" ;
			palette.append( element ) ;
		}
	}

	/// <summary>マウス操作と画面サイズ変更のイベントを登録します。</summary>
	BindEvents()
	{
		document.getElementById( "title-screen" ).addEventListener( "click", () =>
		{
			this.InitializeAudio() ;
			document.getElementById( "selection-modal" ).hidden = false ;
		} ) ;
		document.getElementById( "sound-button" ).addEventListener( "click", () =>
		{
			if( this.m_bgm.m_unlocked )
			{
				this.m_bgm.ToggleMute() ;
			}
			this.InitializeAudio() ;
		} ) ;
		document.getElementById( "close-modal" ).addEventListener( "click", () =>
		{
			document.getElementById( "selection-modal" ).hidden = true ;
		} ) ;
		for( const button of document.querySelectorAll( "[data-question-count]" ) )
		{
			button.addEventListener( "click", () => this.Start( Number( button.dataset.questionCount ) ) ) ;
		}
		document.getElementById( "retry-button" ).addEventListener( "click", () => this.Start( this.m_total ) ) ;
		document.getElementById( "title-button" ).addEventListener( "click", () => this.ShowTitle() ) ;
		document.getElementById( "reset-button" ).addEventListener( "click", () =>
		{
			if( this.m_phase === "play" && this.CheckTime() )
			{
				this.ResetExpression() ;
			}
		} ) ;
		this.m_root.addEventListener( "mousedown", ( event ) =>
		{
			if( event.button === 0 )
			{
				this.InitializeAudio() ;
				this.PlaySoundEffect( "confirm" ) ;
			}
			this.BeginDrag( event ) ;
		} ) ;
		document.addEventListener( "mousemove", this.MoveDrag.bind( this ) ) ;
		document.addEventListener( "mouseup", this.EndDrag.bind( this ) ) ;
		window.addEventListener( "blur", () => this.CancelDrag() ) ;
		window.addEventListener( "resize", () => this.Resize() ) ;
		this.m_root.addEventListener( "contextmenu", this.DeleteSymbol.bind( this ) ) ;
	}

	/// <summary>1280×720の比率を保ってウィンドウに収めます。</summary>
	Resize()
	{
		const scale = Math.min( window.innerWidth / 1280, window.innerHeight / 720 ) ;
		this.m_root.style.transform = `scale(${ scale })` ;
	}

	/// <summary>指定画面だけを表示します。</summary>
	/// <param name="name">title・play・resultの画面名。</param>
	ShowScreen( name )
	{
		for( const screen of document.querySelectorAll( ".screen" ) )
		{
			screen.hidden = screen.id !== `${ name }-screen` ;
		}
		document.getElementById( "selection-modal" ).hidden = true ;
		this.m_bgm?.SetScene( name === "result" ? ( this.m_phase === "clear" ? "clear" : "over" ) : name ) ;
	}

	/// <summary>タイトル画面へ戻ります。</summary>
	ShowTitle()
	{
		clearTimeout( this.m_transitionTimer ) ;
		this.CancelDrag() ;
		this.m_phase = "title" ;
		this.m_particles = [] ;
		this.UpdatePlateHeader() ;
		this.ShowScreen( "title" ) ;
	}

	/// <summary>指定問題数で新しいゲームを開始します。</summary>
	/// <param name="total">10・20・50・100のいずれか。</param>
	Start( total )
	{
		if( ! [ 10, 20, 50, 100 ].includes( total ) || ! this.m_table || this.m_table.length !== 8866 )
		{
			return ;
		}
		clearTimeout( this.m_transitionTimer ) ;
		this.CancelDrag() ;
		this.InitializeAudio() ;
		this.m_total = total ;
		this.m_correct = 0 ;
		this.m_usedIndices.clear() ;
		this.ShowScreen( "play" ) ;
		this.NextQuestion() ;
	}

	/// <summary>未出題の問題を指定範囲から一様に選びます。</summary>
	NextQuestion()
	{
		const [ start, end ] = GetQuestionRange( this.m_correct + 1, this.m_table.length ) ;
		const candidates = [] ;
		for( let index = start ; index <= end ; index ++ )
		{
			if( ! this.m_usedIndices.has( index ) )
			{
				candidates.push( index ) ;
			}
		}
		const selected = candidates[ Math.floor( Math.random() * candidates.length ) ] ;
		this.m_usedIndices.add( selected ) ;
		this.m_originalDigits = String( this.m_table[ selected ][ 0 ] ).split( "" ).map( Number ) ;
		this.m_phase = "play" ;
		this.m_deadline = performance.now() + 30000 ;
		this.m_root.classList.remove( "low-time" ) ;
		this.UpdatePlateHeader() ;
		document.getElementById( "question-number" ).textContent = String( this.m_correct + 1 ).padStart( 2, "0" ) ;
		document.getElementById( "question-total" ).textContent = `/ ${ this.m_total }` ;

		// 東北運輸局のかな文字一覧にある全用途のひらがなを対象にする。
		const letters = "あいうえかきくけこさすせそたちつてとなにぬねのはひふほまみむめもやゆよらりるれろわを" ;
		document.getElementById( "hiragana" ).textContent = letters[ Math.floor( Math.random() * letters.length ) ] ;
		this.ResetExpression() ;
		this.UpdateTime( performance.now() ) ;
	}

	/// <summary>地域名と分類番号を選び、タイトルとプレイ画面の上段表示に反映します。</summary>
	UpdatePlateHeader()
	{
		const header = globalThis.NumberPlateData.CreateRandomHeader() ;
		document.getElementById( "title-region" ).textContent = header ;
		document.getElementById( "region-name" ).textContent = header ;
	}

	/// <summary>制限時間を延ばさず式だけを出題時の状態へ戻します。</summary>
	ResetExpression()
	{
		this.CancelDrag() ;
		this.m_digits = [ ...this.m_originalDigits ] ;
		this.m_gaps = Array.from( { length: this.m_digits.length + 1 }, () => [] ) ;
		document.getElementById( "feedback" ).className = "feedback" ;
		document.getElementById( "feedback" ).textContent = "数字を並べ替えて、記号を差し込もう" ;
		this.RenderExpression( false ) ;
	}

	/// <summary>内部の演算記号を見た目の記号に変換します。</summary>
	/// <param name="symbol">内部で使用する記号。</param>
	/// <returns>表示する記号。</returns>
	DisplaySymbol( symbol )
	{
		return { "+": "＋", "-": "−", "*": "×", "/": "÷" }[ symbol ] ?? symbol ;
	}

	/// <summary>数字と挿入済み記号を評価用の列に変換します。</summary>
	/// <returns>式のトークン列。</returns>
	GetTokens()
	{
		const tokens = [] ;
		for( let index = 0 ; index < this.m_gaps.length ; index ++ )
		{
			tokens.push( ...this.m_gaps[ index ] ) ;
			if( index < this.m_digits.length )
			{
				tokens.push( { digit: this.m_digits[ index ] } ) ;
			}
		}
		return tokens ;
	}

	/// <summary>プレート上の式と2か所の計算結果を更新します。</summary>
	/// <param name="allowAnswer">操作による更新の場合に正解判定を許可するか。</param>
	RenderExpression( allowAnswer = true )
	{
		const row = document.getElementById( "expression-row" ) ;
		row.replaceChildren() ;
		const padding = 4 - this.m_digits.length ;
		for( let index = 0 ; index < padding ; index ++ )
		{
			const empty = document.createElement( "span" ) ;
			empty.className = "empty-digit" ;
			empty.textContent = "・" ;
			row.append( empty ) ;
		}
		for( let index = 0 ; index <= this.m_digits.length ; index ++ )
		{
			if( index + padding === 2 )
			{
				const dash = document.createElement( "span" ) ;
				dash.className = "number-dash" ;
				dash.textContent = "-" ;
				row.append( dash ) ;
			}
			const gap = document.createElement( "span" ) ;
			gap.className = "gap" ;
			gap.dataset.gap = index ;
			for( const token of this.m_gaps[ index ] )
			{
				const symbol = document.createElement( "span" ) ;
				symbol.className = "placed-symbol" ;
				symbol.dataset.tokenId = token.id ;
				symbol.dataset.symbol = token.symbol ;
				symbol.textContent = this.DisplaySymbol( token.symbol ) ;
				symbol.title = "ドラッグで移動 / 右クリックで削除" ;
				gap.append( symbol ) ;
			}
			row.append( gap ) ;
			if( index < this.m_digits.length )
			{
				const digit = document.createElement( "span" ) ;
				digit.className = "digit" ;
				digit.dataset.digitIndex = index ;
				digit.textContent = index === 0 && this.m_digits[ index ] === 0 ? "・" : this.m_digits[ index ] ;
				digit.title = "ドラッグして数字を交換" ;
				row.append( digit ) ;
			}
		}
		const result = new ExpressionParser( this.GetTokens() ).Evaluate() ;
		for( const id of result.invalidRoots )
		{
			row.querySelector( `[data-token-id="${ id }"]` )?.classList.add( "invalid-root" ) ;
		}
		for( const id of result.invalidDivisions )
		{
			const symbol = row.querySelector( `[data-token-id="${ id }"]` ) ;
			if( symbol )
			{
				symbol.classList.add( "invalid-division" ) ;
				symbol.title = "0では割れないため、割る前の値を使用します。" ;
			}
		}
		const solved = result.value !== null && result.value.m_numerator === 10n && result.value.m_denominator === 1n ;
		for( const id of [ "plate-result-value", "tray-result-value" ] )
		{
			const element = document.getElementById( id ) ;
			element.textContent = result.value === null ? "✕" : result.value.ToDisplayString() ;
			element.className = result.value === null ? "invalid-result" : solved ? "solved-result" : "" ;
			element.title = result.error ?? result.value.ToDisplayString() ;
		}
		const assembly = document.getElementById( "plate-assembly" ) ;
		assembly.style.transform = `scale(${ Math.min( 1, 1160 / assembly.offsetWidth ) })` ;
		if( allowAnswer && solved && this.m_phase === "play" && this.CheckTime() )
		{
			this.AnswerCorrect() ;
		}
	}

	/// <summary>マウス左ボタンからドラッグ候補を記録します。</summary>
	/// <param name="event">マウス押下イベント。</param>
	BeginDrag( event )
	{
		if( event.button !== 0 || this.m_phase !== "play" || ! this.CheckTime() )
		{
			return ;
		}
		const target = event.target.closest( "[data-digit-index], [data-palette-symbol], [data-token-id]" ) ;
		if( ! target )
		{
			return ;
		}
		event.preventDefault() ;
		this.m_drag = { target: target, startX: event.clientX, startY: event.clientY, active: false } ;
	}

	/// <summary>カーソルに追従し、配置候補を強調します。</summary>
	/// <param name="event">マウス移動イベント。</param>
	MoveDrag( event )
	{
		if( ! this.m_drag )
		{
			return ;
		}
		if( ! this.m_drag.active && Math.hypot( event.clientX - this.m_drag.startX, event.clientY - this.m_drag.startY ) < 4 )
		{
			return ;
		}
		if( ! this.m_drag.active )
		{
			this.m_drag.active = true ;
			this.m_ghost = document.createElement( "div" ) ;
			this.m_ghost.className = this.m_drag.target.dataset.digitIndex === undefined ? "drag-ghost symbol-ghost" : "drag-ghost" ;
			if( this.m_drag.target.dataset.digitIndex === undefined )
			{
				this.m_ghost.dataset.symbol = this.m_drag.target.dataset.symbol ;
			}
			this.m_ghost.textContent = this.m_drag.target.textContent ;
			document.body.append( this.m_ghost ) ;
			document.body.classList.add( "dragging" ) ;
		}
		this.m_ghost.style.left = `${ event.clientX }px` ;
		this.m_ghost.style.top = `${ event.clientY }px` ;
		this.ClearDropTargets() ;
		this.m_ghost.classList.remove( "delete-ghost" ) ;
		if( this.m_drag.target.dataset.paletteSymbol !== undefined )
		{
			const placed = this.FindPlacedSymbolTarget( event.clientX, event.clientY ) ;
			if( placed )
			{
				placed.classList.add( "replace-target" ) ;
				return ;
			}
		}
		if( this.m_drag.target.dataset.tokenId !== undefined )
		{
			const palette = this.FindPaletteTarget( event.clientX, event.clientY ) ;
			if( palette )
			{
				palette.classList.add( "palette-target" ) ;
				return ;
			}
			if( ! this.IsInsidePlate( event.clientX, event.clientY ) )
			{
				this.m_ghost.classList.add( "delete-ghost" ) ;
				return ;
			}
		}
		const candidate = this.FindDropTarget( event.clientX, event.clientY ) ;
		if( candidate )
		{
			if( this.m_drag.target.dataset.digitIndex !== undefined )
			{
				candidate.classList.add( "digit-target" ) ;
			}
			else if( candidate.querySelectorAll( "[data-token-id]" ).length === 0 )
			{
				candidate.classList.add( "drop-target" ) ;
			}
			else
			{
				candidate.classList.add( "insertion-active" ) ;
				const placement = this.GetInsertionPlacement( candidate, event.clientX ) ;
				this.m_insertionMarker = document.createElement( "div" ) ;
				this.m_insertionMarker.className = "insertion-target" ;
				this.m_insertionMarker.style.left = `${ placement.left }px` ;
				this.m_insertionMarker.style.top = `${ placement.top }px` ;
				this.m_insertionMarker.style.width = `${ Math.max( 0, placement.right - placement.left ) }px` ;
				this.m_insertionMarker.style.height = `${ placement.bottom - placement.top }px` ;
				document.body.append( this.m_insertionMarker ) ;
			}
		}
	}

	/// <summary>追加順序と、その位置に対応するタイル間の余白を求めます。</summary>
	/// <param name="gap">追加先の桁間要素。</param>
	/// <param name="x">画面上の横座標。</param>
	/// <returns>直後の記号の識別子と、追加位置を囲む画面座標。</returns>
	GetInsertionPlacement( gap, x )
	{
		const rect = gap.getBoundingClientRect() ;
		const symbols = [ ...gap.querySelectorAll( "[data-token-id]" ) ] ;
		let beforeIndex = symbols.findIndex( ( element ) =>
		{
			const tile = element.getBoundingClientRect() ;
			return x < ( tile.left + tile.right ) / 2 ;
		} ) ;
		if( beforeIndex < 0 )
		{
			beforeIndex = symbols.length ;
		}
		return {
			beforeId: beforeIndex < symbols.length ? Number( symbols[ beforeIndex ].dataset.tokenId ) : null,
			left: beforeIndex > 0 ? symbols[ beforeIndex - 1 ].getBoundingClientRect().right : rect.left,
			right: beforeIndex < symbols.length ? symbols[ beforeIndex ].getBoundingClientRect().left : rect.right,
			top: rect.top,
			bottom: rect.bottom
		} ;
	}

	/// <summary>カーソルが重なっている配置済み記号のタイルを探します。</summary>
	/// <param name="x">画面上の横座標。</param>
	/// <param name="y">画面上の縦座標。</param>
	/// <returns>重なったタイル。左右の追加用領域やタイル外ならnull。</returns>
	FindPlacedSymbolTarget( x, y )
	{
		for( const element of document.querySelectorAll( "[data-token-id]" ) )
		{
			const rect = element.getBoundingClientRect() ;
			if( x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom )
			{
				return element ;
			}
		}
		return null ;
	}

	/// <summary>カーソル位置にあるパレットの記号を探します。</summary>
	/// <param name="x">画面上の横座標。</param>
	/// <param name="y">画面上の縦座標。</param>
	/// <returns>記号の要素。記号上でなければnull。</returns>
	FindPaletteTarget( x, y )
	{
		for( const element of document.querySelectorAll( "[data-palette-symbol]" ) )
		{
			const rect = element.getBoundingClientRect() ;
			if( x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom )
			{
				return element ;
			}
		}
		return null ;
	}

	/// <summary>カーソルがプレート下地の内側にあるか確認します。</summary>
	/// <param name="x">画面上の横座標。</param>
	/// <param name="y">画面上の縦座標。</param>
	/// <returns>下地の内側ならtrue。</returns>
	IsInsidePlate( x, y )
	{
		const rect = document.getElementById( "number-plate" ).getBoundingClientRect() ;
		return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom ;
	}

	/// <summary>プレート内のカーソルに最も近い挿入先を探します。</summary>
	/// <param name="x">画面上の横座標。</param>
	/// <param name="y">画面上の縦座標。</param>
	/// <returns>数字または記号挿入先の要素。範囲外ならnull。</returns>
	FindDropTarget( x, y )
	{
		const plate = document.getElementById( "expression-row" ).getBoundingClientRect() ;
		if( x < plate.left - 18 || x > plate.right + 18 || y < plate.top - 12 || y > plate.bottom + 12 )
		{
			return null ;
		}
		const isDigit = this.m_drag.target.dataset.digitIndex !== undefined ;
		let best = null ;
		let distance = Infinity ;
		for( const element of document.querySelectorAll( isDigit ? ".digit" : ".gap" ) )
		{
			const rect = element.getBoundingClientRect() ;
			const current = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0 ;
			if( current < distance )
			{
				best = element ;
				distance = current ;
			}
		}
		if( distance > 42 || best === null )
		{
			return null ;
		}
		if( this.m_drag.target.dataset.paletteSymbol !== undefined )
		{
			const symbols = [ ...best.querySelectorAll( "[data-token-id]" ) ] ;
			if( symbols.length > 0 )
			{
				const rect = best.getBoundingClientRect() ;
				const overlapsTile = symbols.some( ( element ) =>
				{
					const tile = element.getBoundingClientRect() ;
					return x >= tile.left && x <= tile.right ;
				} ) ;

				// タイルの上下を追加領域にせず、左右の余白だけで挿入を受け付ける。
				if( overlapsTile || x < rect.left || x > rect.right )
				{
					return null ;
				}
			}
		}
		return best ;
	}

	/// <summary>数字の交換、記号の挿入・移動・置き換え・枠外への削除を行います。</summary>
	/// <param name="event">マウスを離したイベント。</param>
	EndDrag( event )
	{
		if( ! this.m_drag || event.button !== 0 )
		{
			return ;
		}
		let changed = false ;
		let effect = "place" ;
		if( this.m_drag.active && this.m_phase === "play" && this.CheckTime() )
		{
			const source = this.m_drag.target ;
			const destination = this.FindDropTarget( event.clientX, event.clientY ) ;
			const tokenId = source.dataset.tokenId === undefined ? null : Number( source.dataset.tokenId ) ;
			const palette = tokenId === null ? null : this.FindPaletteTarget( event.clientX, event.clientY ) ;
			const placed = source.dataset.paletteSymbol === undefined ? null : this.FindPlacedSymbolTarget( event.clientX, event.clientY ) ;
			if( placed )
			{
				changed = this.ReplaceSymbol( Number( placed.dataset.tokenId ), source.dataset.paletteSymbol ) ;
			}
			else if( palette )
			{
				changed = this.ReplaceSymbol( tokenId, palette.dataset.paletteSymbol ) ;
			}
			else if( tokenId !== null && ! this.IsInsidePlate( event.clientX, event.clientY ) )
			{
				changed = this.RemoveSymbol( tokenId ) ;
				effect = "drop" ;
			}
			else if( destination && source.dataset.digitIndex !== undefined )
			{
				const a = Number( source.dataset.digitIndex ) ;
				const b = Number( destination.dataset.digitIndex ) ;
				[ this.m_digits[ a ], this.m_digits[ b ] ] = [ this.m_digits[ b ], this.m_digits[ a ] ] ;
				changed = a !== b ;
			}
			else if( destination )
			{
				const gapIndex = Number( destination.dataset.gap ) ;
				const placement = this.GetInsertionPlacement( destination, event.clientX ) ;
				changed = this.PlaceSymbol( source, gapIndex, placement.beforeId ) ;
			}
			if( changed && source.dataset.digitIndex === undefined )
			{
				this.PlaySoundEffect( effect ) ;
			}
		}
		this.CancelDrag() ;
		if( this.m_phase === "play" )
		{
			this.RenderExpression( changed ) ;
		}
	}

	/// <summary>配置位置を保ち、桁間上限と先頭の禁止記号を守って記号を置き換えます。</summary>
	/// <param name="tokenId">置き換える記号の識別子。</param>
	/// <param name="symbol">パレットで選ばれた記号。</param>
	/// <returns>置き換えた場合はtrue。無効な置き換えは元の記号を保持します。</returns>
	ReplaceSymbol( tokenId, symbol )
	{
		const gapIndex = this.m_gaps.findIndex( ( items ) => items.some( ( token ) => token.id === tokenId ) ) ;
		if( gapIndex < 0 )
		{
			return false ;
		}
		const gap = this.m_gaps[ gapIndex ] ;
		const token = gap.find( ( item ) => item.id === tokenId ) ;
		const count = gap.filter( ( item ) => item.id !== tokenId && item.symbol !== "(" && item.symbol !== ")" ).length ;
		if( gapIndex === 0 && ( symbol === "*" || symbol === "/" ) )
		{
			document.getElementById( "feedback" ).textContent = "× と ÷ は先頭に置けません" ;
			return false ;
		}
		if( gapIndex > 0 && gapIndex < this.m_digits.length && symbol !== "(" && symbol !== ")" && count >= 2 )
		{
			document.getElementById( "feedback" ).textContent = "数字の間は2記号までです（括弧を除く）" ;
			return false ;
		}
		if( token.symbol === symbol )
		{
			return false ;
		}
		token.symbol = symbol ;
		document.getElementById( "feedback" ).textContent = "記号を置き換えました" ;
		return true ;
	}

	/// <summary>識別子に一致する配置済み記号を取り除きます。</summary>
	/// <param name="tokenId">削除する記号の識別子。</param>
	/// <returns>記号が存在し、削除した場合はtrue。</returns>
	RemoveSymbol( tokenId )
	{
		const exists = this.m_gaps.some( ( items ) => items.some( ( token ) => token.id === tokenId ) ) ;
		this.m_gaps = this.m_gaps.map( ( items ) => items.filter( ( token ) => token.id !== tokenId ) ) ;
		return exists ;
	}

	/// <summary>配置上限を守りながら記号を移動または追加します。</summary>
	/// <param name="source">ドラッグ元の要素。</param>
	/// <param name="gapIndex">移動先の桁間インデックス。</param>
	/// <param name="beforeId">この記号の直前に挿入する識別子。末尾ならnull。</param>
	/// <returns>記号を配置できた場合はtrue。</returns>
	PlaceSymbol( source, gapIndex, beforeId )
	{
		const tokenId = source.dataset.tokenId === undefined ? null : Number( source.dataset.tokenId ) ;
		const existing = this.m_gaps.flat().find( ( token ) => token.id === tokenId ) ;
		const symbol = existing?.symbol ?? source.dataset.paletteSymbol ;
		const gap = this.m_gaps[ gapIndex ].filter( ( token ) => token.id !== tokenId ) ;
		const count = gap.filter( ( token ) => token.symbol !== "(" && token.symbol !== ")" ).length ;
		if( ( gapIndex > 0 && gapIndex < this.m_digits.length && symbol !== "(" && symbol !== ")" && count >= 2 ) || ( gapIndex === 0 && ( symbol === "*" || symbol === "/" ) ) )
		{
			document.getElementById( "feedback" ).textContent = gapIndex === 0 ? "× と ÷ は先頭に置けません" : "数字の間は2記号までです（括弧を除く）" ;
			return false ;
		}
		if( tokenId !== null && tokenId === beforeId )
		{
			return false ;
		}
		this.m_gaps = this.m_gaps.map( ( items ) => items.filter( ( token ) => token.id !== tokenId ) ) ;
		const target = this.m_gaps[ gapIndex ] ;
		const beforeIndex = target.findIndex( ( token ) => token.id === beforeId ) ;
		const token = existing ?? { symbol: symbol, id: this.m_nextTokenId ++ } ;
		target.splice( beforeIndex < 0 ? target.length : beforeIndex, 0, token ) ;
		document.getElementById( "feedback" ).textContent = "数字を並べ替えて、記号を差し込もう" ;
		return true ;
	}

	/// <summary>右クリックした配置済み記号を削除します。</summary>
	/// <param name="event">右クリックイベント。</param>
	DeleteSymbol( event )
	{
		event.preventDefault() ;
		if( this.m_phase !== "play" || ! this.CheckTime() )
		{
			return ;
		}
		const target = event.target.closest( "[data-token-id]" ) ;
		if( target )
		{
			this.CancelDrag() ;
			const id = Number( target.dataset.tokenId ) ;
			if( this.RemoveSymbol( id ) )
			{
				this.PlaySoundEffect( "drop" ) ;
			}
			this.RenderExpression() ;
		}
	}

	/// <summary>ドラッグ先の強調表示を消します。</summary>
	ClearDropTargets()
	{
		this.m_insertionMarker?.remove() ;
		this.m_insertionMarker = null ;
		for( const element of document.querySelectorAll( ".drop-target, .digit-target, .palette-target, .replace-target, .insertion-active" ) )
		{
			element.classList.remove( "drop-target", "digit-target", "palette-target", "replace-target", "insertion-active" ) ;
		}
	}

	/// <summary>ドラッグ中の表示と状態を破棄します。</summary>
	CancelDrag()
	{
		this.m_ghost?.remove() ;
		this.m_ghost = null ;
		this.m_drag = null ;
		document.body.classList.remove( "dragging" ) ;
		this.ClearDropTargets() ;
	}

	/// <summary>操作時点で制限時間が残っているか確認します。</summary>
	/// <returns>まだ回答できる場合はtrue。</returns>
	CheckTime()
	{
		if( performance.now() >= this.m_deadline )
		{
			this.Finish( false ) ;
			return false ;
		}
		return true ;
	}

	/// <summary>正解を記録し、短い演出の後に進めます。</summary>
	AnswerCorrect()
	{
		this.m_phase = "feedback" ;
		this.m_correct ++ ;
		this.CancelDrag() ;
		const feedback = document.getElementById( "feedback" ) ;
		feedback.className = "feedback success" ;
		feedback.textContent = "10！ NICE DRIVE." ;
		this.PlayJingle() ;
		this.m_transitionTimer = setTimeout( () =>
		{
			if( this.m_correct === this.m_total )
			{
				this.Finish( true ) ;
			}
			else
			{
				this.NextQuestion() ;
			}
		}, 850 ) ;
	}

	/// <summary>結果画面に正解数とIQ評価を表示します。</summary>
	/// <param name="cleared">全問正解ならtrue。</param>
	Finish( cleared )
	{
		this.CancelDrag() ;
		clearTimeout( this.m_transitionTimer ) ;
		this.m_phase = cleared ? "clear" : "over" ;
		this.ShowScreen( "result" ) ;
		document.getElementById( "result-title" ).textContent = cleared ? "クリアおめでとう" : "ゲームオーバー" ;
		document.getElementById( "result-eyebrow" ).textContent = cleared ? "NICE DRIVE, WELL DONE!" : "LET'S TAKE ANOTHER DRIVE" ;
		document.getElementById( "result-count" ).textContent = `${ this.m_total } 問中 ${ this.m_correct } 問正解` ;
		document.getElementById( "iq-value" ).textContent = CalculateIq( this.m_correct ) ;
		this.m_particles = [] ;
		this.m_nextFirework = 0 ;
		const context = document.getElementById( "fireworks" ).getContext( "2d" ) ;
		context.clearRect( 0, 0, 1280, 720 ) ;
	}

	/// <summary>クリックの許可がある時点で音声を初期化します。</summary>
	InitializeAudio()
	{
		void this.m_bgm?.UnlockAsync() ;
		const sound = document.getElementById( "sound-button" ) ;
		sound.textContent = this.m_bgm?.m_muted ? "♪ OFF" : "♪ ON" ;
		sound.setAttribute( "aria-label", this.m_bgm?.m_muted ? "サウンドをオンにする" : "サウンドをオフにする" ) ;
		sound.setAttribute( "aria-pressed", String( this.m_bgm?.m_muted ?? false ) ) ;
		try
		{
			const Audio = window.AudioContext ?? window.webkitAudioContext ;
			if( Audio && ! this.m_audio )
			{
				this.m_audio = new Audio() ;
			}
			this.m_audio?.resume().catch( () =>
			{
				document.getElementById( "feedback" ).title = "ブラウザーで音声が許可されていません。" ;
			} ) ;
		}
		catch( error )
		{
			document.getElementById( "feedback" ).title = `音声を開始できませんでした：${ error.message }` ;
		}
	}

	/// <summary>決定・設置・枠外削除に対応する控えめな効果音を合成します。</summary>
	/// <param name="kind">confirm・place・dropのいずれか。</param>
	PlaySoundEffect( kind )
	{
		if( ! this.m_audio || this.m_audio.state === "closed" || this.m_bgm?.m_muted )
		{
			return ;
		}
		const sounds = {
			confirm: { from: 660, to: 880, duration: .085, volume: .055, type: "sine" },
			place: { from: 440, to: 660, duration: .13, volume: .075, type: "triangle" },
			drop: { from: 330, to: 130, duration: .22, volume: .085, type: "sine" }
		} ;
		const sound = sounds[ kind ] ;
		if( ! sound )
		{
			throw new RangeError( "不明な効果音です。" ) ;
		}
		const oscillator = this.m_audio.createOscillator() ;
		const gain = this.m_audio.createGain() ;
		const start = this.m_audio.currentTime ;
		oscillator.type = sound.type ;
		oscillator.frequency.setValueAtTime( sound.from, start ) ;
		oscillator.frequency.exponentialRampToValueAtTime( sound.to, start + sound.duration ) ;
		gain.gain.setValueAtTime( 0, start ) ;
		gain.gain.linearRampToValueAtTime( sound.volume, start + .005 ) ;
		gain.gain.exponentialRampToValueAtTime( .001, start + sound.duration ) ;
		oscillator.connect( gain ) ;
		gain.connect( this.m_audio.destination ) ;
		oscillator.start( start ) ;
		oscillator.stop( start + sound.duration + .01 ) ;
		oscillator.onended = () =>
		{
			oscillator.disconnect() ;
			gain.disconnect() ;
		} ;
	}

	/// <summary>外部音声ファイルを使わず短い正解ジングルを鳴らします。</summary>
	PlayJingle()
	{
		if( ! this.m_audio || this.m_audio.state !== "running" || this.m_bgm?.m_muted )
		{
			return ;
		}
		const notes = [ 523.25, 659.25, 783.99, 1046.5 ] ;
		for( let index = 0 ; index < notes.length ; index ++ )
		{
			const oscillator = this.m_audio.createOscillator() ;
			const gain = this.m_audio.createGain() ;
			const start = this.m_audio.currentTime + index * .105 ;
			oscillator.type = "triangle" ;
			oscillator.frequency.value = notes[ index ] ;
			gain.gain.setValueAtTime( 0, start ) ;
			gain.gain.linearRampToValueAtTime( .13, start + .015 ) ;
			gain.gain.exponentialRampToValueAtTime( .001, start + .22 ) ;
			oscillator.connect( gain ) ;
			gain.connect( this.m_audio.destination ) ;
			oscillator.start( start ) ;
			oscillator.stop( start + .24 ) ;
			oscillator.onended = () =>
			{
				oscillator.disconnect() ;
				gain.disconnect() ;
			} ;
		}
	}

	/// <summary>残り時間とプログレスバーを更新します。</summary>
	/// <param name="now">現在の単調増加時刻。</param>
	UpdateTime( now )
	{
		const remaining = Math.max( 0, this.m_deadline - now ) / 1000 ;
		document.getElementById( "time-value" ).textContent = ( Math.ceil( remaining * 10 ) / 10 ).toFixed( 1 ) ;
		document.getElementById( "time-fill" ).style.transform = `scaleX(${ remaining / 30 })` ;
		document.getElementById( "time-track" ).setAttribute( "aria-valuenow", remaining.toFixed( 1 ) ) ;
		this.m_root.classList.toggle( "low-time", remaining <= 5 ) ;
		if( remaining <= 0 )
		{
			this.Finish( false ) ;
		}
	}

	/// <summary>クリア時に花火の粒子を発生させて描画します。</summary>
	/// <param name="now">現在の単調増加時刻。</param>
	/// <param name="delta">前フレームからの秒数。</param>
	DrawFireworks( now, delta )
	{
		const context = document.getElementById( "fireworks" ).getContext( "2d" ) ;
		context.clearRect( 0, 0, 1280, 720 ) ;
		if( now >= this.m_nextFirework )
		{
			this.m_nextFirework = now + 650 ;
			const x = Math.random() < .5 ? 130 + Math.random() * 170 : 970 + Math.random() * 170 ;
			const y = 130 + Math.random() * 300 ;
			const colors = [ "#759764", "#c9a654", "#c67b63", "#91b5ac" ] ;
			const color = colors[ Math.floor( Math.random() * colors.length ) ] ;
			for( let index = 0 ; index < 46 ; index ++ )
			{
				const angle = index / 46 * Math.PI * 2 ;
				const speed = 65 + Math.random() * 85 ;
				this.m_particles.push( { x: x, y: y, vx: Math.cos( angle ) * speed, vy: Math.sin( angle ) * speed, life: 1.5, color: color } ) ;
			}
		}
		this.m_particles = this.m_particles.filter( ( particle ) => particle.life > 0 ) ;
		for( const particle of this.m_particles )
		{
			particle.x += particle.vx * delta ;
			particle.y += particle.vy * delta ;
			particle.vy += 35 * delta ;
			particle.life -= delta ;
			context.globalAlpha = Math.max( 0, particle.life / 1.5 ) ;
			context.fillStyle = particle.color ;
			context.beginPath() ;
			context.arc( particle.x, particle.y, 2.5, 0, Math.PI * 2 ) ;
			context.fill() ;
		}
		context.globalAlpha = 1 ;
	}

	/// <summary>制限時間と結果画面の演出をフレームごとに進めます。</summary>
	/// <param name="now">ブラウザーから渡された現在時刻。</param>
	Tick( now )
	{
		const delta = Math.min( .05, Math.max( 0, now - this.m_lastFrame ) / 1000 ) ;
		this.m_lastFrame = now ;
		this.m_bgm?.Update( delta ) ;
		if( this.m_phase === "play" )
		{
			this.UpdateTime( now ) ;
		}
		if( this.m_phase === "clear" )
		{
			this.DrawFireworks( now, delta ) ;
		}
		requestAnimationFrame( this.Tick.bind( this ) ) ;
	}
}

if( typeof document !== "undefined" )
{
	// ページを開いた際に生成するゲーム本体。
	const game = new NumberPlateGame() ;
}

if( typeof module !== "undefined" )
{
	module.exports = { Rational, ExpressionParser, GetQuestionRange, CalculateIq, NumberPlateGame } ;
}
