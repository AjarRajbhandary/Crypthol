# Reel #1: "On it 👍" (Meta / Instagram Reels)

The finished ad is **`pondros-reel-on-it.mp4`**:
- 1080×1920 (9:16), 30 fps, 31 s
- H.264 video, AAC 48 kHz audio, loudness about −14 LUFS
- Upload it directly in Ads Manager.

`pondros-reel-on-it.srt` is the caption file. Upload it in Ads Manager, or let Meta auto-caption the ad.

This is the motion-graphics build of the script in `../meta-reel-ad-spec.md`. The selfie-video shots from the spec became kinetic type.

## Before going live: [VERIFY]
- **The product UI shown is a mock-up.** It includes the "Commitment tracked" card, the Wednesday reminder DM with Mark done / Snooze, and the "This week" list. Swap it for real Pondros screens, or confirm the product works this way.
- **Brand placeholders:** the "P" mark and the violet accent `#8B7CFF`. Replace them with the real logo and brand colour, which are CSS variables in `src/reel.html`.
- **No Slack logos are used.** The chat UI is generic, and channel and people names are fictional.
- **The end card says "Try Pondros →" and does not say "free".** Add "free" only if the site offers a free trial.

## Audio
- **Voiceover:** Kokoro TTS (Apache-2.0 model), voice `af_heart`. For higher conversion, re-record it with a real founder voice using the same timings.
- **Music and sound effects:** synthesized in `src/audio.py`, so they are royalty-free. The music ducks under the voice.

## Rebuild
Requirements:
- Node with Playwright and Chromium
- Python with `kokoro-onnx`, `soundfile`, `scipy` and `numpy`
- ffmpeg with libx264

Steps:
1. `python tts_gen.py af_heart`
   - Needs `kokoro-v1.0.int8.onnx` and `voices-v1.0.bin`, which you can download from the thewh1teagle/kokoro-onnx releases.
   - Put the output wavs in `src/tts/`.
2. `python audio.py`. This writes `mix.wav`.
3. `FFMPEG=ffmpeg node render.js`. This renders the frames and encodes `pondros-reel-on-it.mp4`.

Scene timings live in the `render(t)` function in `reel.html`. Open the file in a browser and call `render(12)` in the console to preview any moment.
