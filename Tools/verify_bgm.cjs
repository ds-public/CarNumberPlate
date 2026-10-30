"use strict" ;

const assert = require( "node:assert/strict" ) ;
const NumberPlateBgm = require( "../Game/bgm.js" ) ;
const { NumberPlateGame } = require( "../Game/game.js" ) ;

/// <summary>音声パラメーターへ予約された値と時刻を記録します。</summary>
/// <returns>Web Audioのパラメーターを模した記録用オブジェクト。</returns>
function CreateParameter()
{
	const events = [] ;
	return {
		events: events,
		setValueAtTime: ( value, time ) => events.push( [ "set", value, time ] ),
		linearRampToValueAtTime: ( value, time ) => events.push( [ "linear", value, time ] ),
		exponentialRampToValueAtTime: ( value, time ) => events.push( [ "exponential", value, time ] )
	} ;
}

/// <summary>効果音の音程・音量・終了時刻・消音の制御を検証します。</summary>
function VerifyEffects()
{
	const notes = [] ;
	const gains = [] ;
	const game = Object.create( NumberPlateGame.prototype ) ;
	game.m_bgm = { m_muted: false } ;
	game.m_audio = {
		state: "running", currentTime: 4, destination: {},
		createOscillator: () =>
		{
			const node = {
				frequency: CreateParameter(),
				connect: ( target ) => target,
				disconnect: () => notes.push( "disconnected" ),
				start: ( time ) => node.startTime = time,
				stop: ( time ) => node.stopTime = time
			} ;
			notes.push( node ) ;
			return node ;
		},
		createGain: () =>
		{
			const node = {
				gain: CreateParameter(),
				connect: ( target ) => target,
				disconnect: () => gains.push( "disconnected" )
			} ;
			gains.push( node ) ;
			return node ;
		}
	} ;
	for( const kind of [ "confirm", "place", "drop" ] )
	{
		game.PlaySoundEffect( kind ) ;
		const node = notes.at( -1 ) ;
		const parameter = gains.at( -1 ).gain.events ;
		assert.equal( node.startTime, 4 ) ;
		assert( node.stopTime > 4 && node.stopTime < 4.3 ) ;
		assert( parameter[ 1 ][ 1 ] <= .1 ) ;
		assert.equal( parameter.at( -1 )[ 1 ], .001 ) ;
		if( kind === "drop" )
		{
			assert( node.frequency.events[ 1 ][ 1 ] < node.frequency.events[ 0 ][ 1 ] ) ;
		}
		node.onended() ;
		assert.equal( notes.at( -1 ), "disconnected" ) ;
		assert.equal( gains.at( -1 ), "disconnected" ) ;
	}
	game.m_bgm.m_muted = true ;
	game.PlaySoundEffect( "place" ) ;
	assert.equal( notes.length, 6 ) ;
	game.m_bgm.m_muted = false ;
	game.m_audio.state = "closed" ;
	game.PlaySoundEffect( "drop" ) ;
	assert.equal( notes.length, 6 ) ;
	game.m_audio.state = "suspended" ;
	game.PlaySoundEffect( "confirm" ) ;
	assert.equal( notes.length, 7, "初回クリックによる再開中も効果音を予約できる" ) ;
	console.log( "PASS: confirm/place/drop tones, quiet envelopes, node cleanup, mute, and initial audio resume." ) ;
}

/// <summary>音声の実再生なしで曲の切り替えと再生失敗を検証する代替要素です。</summary>
class TestAudio
{
	/// <summary>音声要素を生成した数。</summary>
	static m_count = 0 ;

	/// <summary>現在の再生位置。</summary>
	currentTime = 0 ;

	/// <summary>適用中の音量。</summary>
	volume = 0 ;

	/// <summary>再生要求の回数。</summary>
	m_playCount = 0 ;

	/// <summary>次の再生を失敗させるか。</summary>
	m_fail = false ;

	/// <summary>次の再生結果を保留するか。</summary>
	m_defer = false ;

	/// <summary>保留中の再生を失敗させるコールバック。</summary>
	m_reject = null ;

	/// <summary>生成した音声要素の数を記録します。</summary>
	constructor()
	{
		TestAudio.m_count ++ ;
	}

	/// <summary>実音声のイベント登録を省略します。</summary>
	/// <param name="name">イベント名。</param>
	/// <param name="callback">イベントのコールバック。</param>
	addEventListener( name, callback )
	{
	}

	/// <summary>再生状態を停止へ変更します。</summary>
	pause()
	{
		this.paused = true ;
	}

	/// <summary>再生開始、失敗、または保留を返します。</summary>
	/// <returns>音声の再生要求を表すタスク。</returns>
	play()
	{
		this.m_playCount ++ ;
		this.paused = false ;
		if( this.m_defer )
		{
			this.m_defer = false ;
			return new Promise( ( resolve, reject ) =>
			{
				this.m_reject = reject ;
			} ) ;
		}
		return this.m_fail ? Promise.reject( new Error( "再生を拒否しました。" ) ) : Promise.resolve() ;
	}
}

/// <summary>曲の切り替え、フェード、消音、失敗からの再試行を検証します。</summary>
/// <returns>すべての再生制御の検証が完了したことを表すタスク。</returns>
async function VerifyAsync()
{
	VerifyEffects() ;
	global.window = { Audio: TestAudio } ;
	const errors = [] ;
	const bgm = new NumberPlateBgm( ( error ) => errors.push( error ) ) ;
	assert.equal( bgm.m_audio.loop, true ) ;
	bgm.Update( .6 ) ;
	assert.equal( bgm.m_audio.m_playCount, 0, "クリック前には再生しない" ) ;
	await bgm.UnlockAsync() ;
	assert.equal( bgm.m_audio.src, "Audio/title.wav" ) ;
	bgm.Update( .6 ) ;
	assert.equal( bgm.m_audio.volume, .28 ) ;
	bgm.m_audio.currentTime = 12 ;
	bgm.SetScene( "title" ) ;
	bgm.Update( .1 ) ;
	assert.equal( bgm.m_audio.currentTime, 12 ) ;
	assert.equal( bgm.m_audio.m_playCount, 1 ) ;
	bgm.SetScene( "play" ) ;
	bgm.Update( .125 ) ;
	assert.equal( bgm.m_audio.volume, .14 ) ;
	bgm.Update( .125 ) ;
	await Promise.resolve() ;
	assert.equal( bgm.m_audio.src, "Audio/play.wav" ) ;
	assert.equal( bgm.m_audio.currentTime, 0 ) ;
	assert.equal( bgm.m_audio.volume, 0 ) ;
	bgm.Update( .6 ) ;
	for( const scene of [ "clear", "over", "title" ] )
	{
		bgm.SetScene( scene ) ;
		bgm.Update( .25 ) ;
		await Promise.resolve() ;
		assert.equal( bgm.m_audio.src, `Audio/${ scene }.wav` ) ;
		bgm.Update( .6 ) ;
		assert.equal( bgm.m_audio.volume, .28 ) ;
	}
	assert.equal( TestAudio.m_count, 1, "音声要素を重複生成せず再利用する" ) ;
	assert.equal( bgm.ToggleMute(), true ) ;
	assert.equal( bgm.m_audio.volume, 0 ) ;
	bgm.SetScene( "clear" ) ;
	bgm.Update( .25 ) ;
	bgm.Update( .6 ) ;
	assert.equal( bgm.m_audio.volume, 0 ) ;
	assert.equal( bgm.ToggleMute(), false ) ;
	assert.equal( bgm.m_audio.volume, .28 ) ;
	assert.throws( () => bgm.SetScene( "unknown" ), RangeError ) ;
	bgm.m_audio.m_fail = true ;
	bgm.SetScene( "over" ) ;
	bgm.Update( .25 ) ;
	await Promise.resolve() ;
	assert.equal( bgm.m_unlocked, false ) ;
	assert.equal( errors.length, 1 ) ;
	bgm.m_audio.m_fail = false ;
	await bgm.UnlockAsync() ;
	assert.equal( bgm.m_unlocked, true ) ;
	assert.equal( bgm.m_audio.src, "Audio/over.wav" ) ;

	const pending = new NumberPlateBgm( ( error ) => errors.push( error ) ) ;
	pending.m_audio.m_defer = true ;
	const first = pending.UnlockAsync() ;
	pending.SetScene( "play" ) ;
	pending.Update( .05 ) ;
	pending.m_audio.m_reject( new Error( "古い曲の要求が中断されました。" ) ) ;
	await first ;
	assert.equal( pending.m_unlocked, true ) ;
	assert.equal( pending.m_playingScene, "play" ) ;
	assert.equal( errors.length, 1, "古い要求の中断を新しい曲の再生失敗にしない" ) ;
	console.log( "PASS: four tracks, click-to-start, loops, fades, scene changes, mute, no duplicate playback, retries, and stale request rejection." ) ;
}

VerifyAsync().catch( ( error ) =>
{
	console.error( error ) ;
	process.exitCode = 1 ;
} ) ;
