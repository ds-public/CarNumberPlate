"use strict" ;

/// <summary>4画面のBGMをループ再生し、画面遷移時にフェードさせます。</summary>
class NumberPlateBgm
{
	/// <summary>各画面に対応するオリジナル音源。</summary>
	static m_tracks = Object.freeze( { title: "Audio/title.ogg", play: "Audio/play.ogg", clear: "Audio/clear.ogg", over: "Audio/over.ogg" } ) ;

	/// <summary>画面間で共有する音声要素。</summary>
	m_audio = null ;

	/// <summary>次に再生する画面名。</summary>
	m_desiredScene = "title" ;

	/// <summary>現在読み込んでいる曲の画面名。</summary>
	m_playingScene = null ;

	/// <summary>クリックによって再生を開始したか。</summary>
	m_unlocked = false ;

	/// <summary>全サウンドを消音しているか。</summary>
	m_muted = false ;

	/// <summary>フェードの音量係数。</summary>
	m_gain = 0 ;

	/// <summary>BGMの基準音量。</summary>
	m_volume = .28 ;

	/// <summary>古い再生要求の失敗を識別する連番。</summary>
	m_requestId = 0 ;

	/// <summary>再生失敗を画面へ伝えるコールバック。</summary>
	m_onError ;

	/// <summary>ローカルファイルでも再生できる音声要素を準備します。</summary>
	/// <param name="onError">音声の読み込みや再生に失敗した場合の通知先。</param>
	constructor( onError = null )
	{
		this.m_onError = onError ;
		if( typeof window !== "undefined" && typeof window.Audio === "function" )
		{
			this.m_audio = new window.Audio() ;
			this.m_audio.loop = true ;
			this.m_audio.preload = "auto" ;
			this.m_audio.volume = 0 ;
			this.m_audio.addEventListener( "error", () =>
			{
				this.m_onError?.( new Error( "BGMの音声ファイルを読み込めませんでした。" ) ) ;
			} ) ;
		}
	}

	/// <summary>クリック時に再生制限を解除し、選択中の画面のBGMを開始します。</summary>
	/// <returns>再生の開始または失敗通知が完了したことを表すタスク。</returns>
	async UnlockAsync()
	{
		if( this.m_unlocked || ! this.m_audio )
		{
			return ;
		}
		this.m_unlocked = true ;
		await this.StartTrackAsync( this.m_desiredScene ) ;
	}

	/// <summary>次に再生する画面を指定します。同じ画面では曲を再開しません。</summary>
	/// <param name="scene">title・play・clear・overの画面名。</param>
	SetScene( scene )
	{
		if( ! Object.hasOwn( NumberPlateBgm.m_tracks, scene ) )
		{
			throw new RangeError( "不明なBGMの画面名です。" ) ;
		}
		this.m_desiredScene = scene ;
	}

	/// <summary>フェードアウト後に曲を切り替え、フェードインさせます。</summary>
	/// <param name="delta">前フレームからの経過秒数。</param>
	Update( delta )
	{
		if( ! this.m_audio || ! this.m_unlocked )
		{
			return ;
		}
		if( this.m_desiredScene !== this.m_playingScene )
		{
			this.m_gain = Math.max( 0, this.m_gain - delta / .25 ) ;
			if( this.m_gain === 0 )
			{
				void this.StartTrackAsync( this.m_desiredScene ) ;
			}
		}
		else
		{
			this.m_gain = Math.min( 1, this.m_gain + delta / .6 ) ;
		}
		this.m_audio.volume = this.m_muted ? 0 : this.m_volume * this.m_gain ;
	}

	/// <summary>音声要素を再利用し、指定曲を先頭からループ再生します。</summary>
	/// <param name="scene">再生する曲の画面名。</param>
	/// <returns>再生開始または失敗通知が完了したことを表すタスク。</returns>
	async StartTrackAsync( scene )
	{
		const requestId = ++ this.m_requestId ;
		this.m_audio.pause() ;
		this.m_audio.volume = 0 ;
		this.m_audio.src = NumberPlateBgm.m_tracks[ scene ] ;
		this.m_audio.currentTime = 0 ;
		this.m_playingScene = scene ;
		this.m_gain = 0 ;
		try
		{
			await this.m_audio.play() ;
		}
		catch( error )
		{
			if( requestId === this.m_requestId )
			{
				this.m_unlocked = false ;
				this.m_onError?.( error ) ;
			}
		}
	}

	/// <summary>消音を切り替えます。曲の再生位置は維持します。</summary>
	/// <returns>切り替え後の消音状態。</returns>
	ToggleMute()
	{
		this.m_muted = ! this.m_muted ;
		if( this.m_audio )
		{
			this.m_audio.volume = this.m_muted ? 0 : this.m_volume * this.m_gain ;
		}
		return this.m_muted ;
	}
}

globalThis.NumberPlateBgm = NumberPlateBgm ;

if( typeof module !== "undefined" )
{
	module.exports = NumberPlateBgm ;
}
