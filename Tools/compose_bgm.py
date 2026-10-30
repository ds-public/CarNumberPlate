"""画面ごとの穏やかなオリジナルBGMを、ループ可能なWAVとして生成する。"""

import wave
from pathlib import Path

import numpy as np


SAMPLE_RATE = 22050


SONGS = {
    'title': {
        'bpm': 72,
        'chords': [(48, 55, 59, 64), (45, 52, 55, 60), (41, 48, 52, 57), (43, 50, 57, 62),
                   (48, 55, 59, 64), (45, 52, 55, 60), (41, 48, 52, 57), (43, 50, 55, 59)],
        'melody': [(76, None, 74, 71), (72, None, 71, 67), (69, None, 72, 76), (74, None, 71, None),
                   (76, 79, 76, 74), (72, None, 71, 67), (69, 72, 71, 69), (67, None, None, None)],
    },
    'play': {
        'bpm': 80,
        'chords': [(50, 57, 60, 64), (43, 50, 53, 57), (46, 53, 57, 62), (45, 52, 55, 62),
                   (50, 57, 60, 65), (43, 50, 53, 57), (46, 53, 57, 60), (45, 52, 55, 61)],
        'melody': [(69, None, 72, None), (70, None, 69, 65), (69, None, 65, None), (67, None, 64, None),
                   (69, 72, 74, None), (70, None, 69, 65), (65, None, 62, 65), (64, None, None, None)],
    },
    'clear': {
        'bpm': 84,
        'chords': [(50, 57, 61, 66), (43, 50, 54, 59), (47, 54, 57, 62), (45, 52, 57, 61),
                   (50, 57, 61, 66), (43, 50, 54, 59), (45, 52, 56, 61), (50, 57, 61, 66)],
        'melody': [(78, 76, 74, 69), (71, None, 74, 78), (78, 76, 74, 71), (73, None, 76, None),
                   (78, 81, 78, 76), (74, None, 78, 79), (76, 73, 69, 73), (74, None, None, None)],
    },
    'over': {
        'bpm': 64,
        'chords': [(45, 52, 55, 60), (41, 48, 52, 57), (38, 45, 48, 53), (40, 47, 50, 55),
                   (45, 52, 55, 59), (41, 48, 52, 57), (38, 45, 48, 53), (40, 47, 52, 56)],
        'melody': [(76, None, 74, 72), (71, None, 69, None), (69, None, 65, 64), (67, None, None, None),
                   (72, None, 71, 69), (69, None, 65, None), (65, None, 64, 62), (64, None, None, None)],
    },
}


def add_note(audio, start, duration, midi, volume, pan=0.0, pad=False):
    """短いアタックと長い減衰を持つ音を、ループ境界をまたいで加算する。"""
    count = int(duration * SAMPLE_RATE)
    time = np.arange(count, dtype=np.float64) / SAMPLE_RATE
    frequency = 440 * 2 ** ((midi - 69) / 12)
    phase = 2 * np.pi * frequency * time
    if pad:
        tone = np.sin(phase) + .14 * np.sin(2 * phase) + .06 * np.sin(phase * 1.002)
        attack = np.minimum(time / .35, 1)
        release = np.minimum((duration - time) / .8, 1)
        envelope = attack * np.maximum(0, release)
    else:
        tone = (np.sin(phase + .16 * np.sin(2 * phase) * np.exp(-time * 4))
                + .22 * np.sin(2 * phase) * np.exp(-time * 2)
                + .07 * np.sin(3 * phase) * np.exp(-time * 5))
        envelope = (1 - np.exp(-time / .009)) * np.exp(-time / (duration * .38))
        envelope *= np.clip((duration - time) / .16, 0, 1)
    signal = tone * envelope * volume
    stereo = signal[:, None] * np.array([np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)])
    position = int(start * SAMPLE_RATE) % len(audio)
    first = min(count, len(audio) - position)
    audio[position:position + first] += stereo[:first]
    if first < count:
        audio[:count - first] += stereo[first:]


def render_song(name, song, directory):
    """8小節の和音・分散和音・旋律を合成し、ステレオPCMで保存する。"""
    beat = 60 / song['bpm']
    audio = np.zeros((round(32 * beat * SAMPLE_RATE), 2), dtype=np.float64)
    for bar, chord in enumerate(song['chords']):
        start = bar * 4 * beat
        for index, note in enumerate(chord):
            add_note(audio, start, 4 * beat + .6, note, .025, (index - 1.5) * .22, pad=True)
        add_note(audio, start, 3.7 * beat, chord[0] - 12, .105)
        for step, index in enumerate((0, 2, 1, 3, 1, 2, 3, 2)):
            add_note(audio, start + step * .5 * beat, 1.7 * beat,
                     chord[index] + 12, .06 if step % 2 == 0 else .045, -.28)
        for step, note in enumerate(song['melody'][bar]):
            if note is not None:
                add_note(audio, start + step * beat, 2 * beat, note, .15, .23)
    dry = audio.copy()
    for delay, level in ((.17, .14), (.31, .10), (.47, .07), (.73, .04)):
        audio += np.roll(dry[:, ::-1], round(delay * SAMPLE_RATE), axis=0) * level
    audio -= audio.mean(axis=0)
    audio *= .76 / max(np.abs(audio).max(), .001)
    pcm = np.round(np.clip(audio, -1, 1) * 32767).astype('<i2')
    path = directory / f'{name}.wav'
    with wave.open(str(path), 'wb') as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm.tobytes())
    rms = np.sqrt(np.mean(audio ** 2))
    print(f'{path.name}: {len(audio) / SAMPLE_RATE:.2f}s, peak .76, RMS {rms:.3f}')


def main():
    """全4曲をゲームの音声フォルダーへ出力する。"""
    directory = Path(__file__).resolve().parents[1] / 'Game' / 'Audio'
    directory.mkdir(parents=True, exist_ok=True)
    for name, song in SONGS.items():
        render_song(name, song, directory)


if __name__ == '__main__':
    main()
