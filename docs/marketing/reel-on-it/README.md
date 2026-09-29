# Reel #1: "On it 👍" (Meta / Instagram Reels)

The finished ad is **`pondros-reel-on-it.mp4`**:
- 1080×1920 (9:16), 30 fps, 33 s
- H.264 video, AAC 48 kHz audio, loudness about −14 LUFS
- Upload it directly in Ads Manager.

`pondros-reel-on-it.srt` is the caption file. Upload it in Ads Manager, or let Meta auto-caption the ad.

This is the motion-graphics build of the script in `../meta-reel-ad-spec.md`. The selfie-video shots from the spec became kinetic type.

## Brand alignment (v2)
v2 is restyled to match the official brand ad `pondros-ad-v13-elise-calm.mp4`. The full brand system is in §0 of the spec.
- **Logo:** the real Pondros mark (black rounded square with the white "p" glyph) and the "Pondros" wordmark. The glyph is extracted from the v13 end card into `src/assets/glyph.png`.
- **Canvas:** light, with pastel blurred blobs and white cards. Action blue is `#2F6BE6`.
- **Positioning:** "Pondros is not another ~~task app~~ … It's an AI project manager", using the brand's red and blue chip treatments.
- **Product UI:** matches what v13 shows.
  - "✅ Added to Pondros — … · owner · due", with "Board Client work › project", Mark as Done and Not a task.
  - "Captured automatically. No commands. No tagging."
  - "Pondros nudging Jess" → "Quick chase: … Still on track?", with **On it ✓** / Snooze and the reply bubble.
- **End card:** matches v13 exactly. It shows the mark, the wordmark, **Never circle back.** in the brand gradient, and the dark pill with "Add to Slack · pondros.com".
- **Voiceover:** a calm female read, to sit alongside v13's calm VO.

## Before going live: [VERIFY]
- **Glyph resolution:** the logo glyph was pulled from a video frame at about 200px. It looks clean at the sizes used, but for pixel-perfect output swap in the vector logo (`src/assets/glyph.png` → SVG).
- **Slack mark:** it is also cropped from v13's CTA pill, and it appears only inside "Add to Slack", as in v13. Swap in the official "Add to Slack" asset if you have it.
- **Scenes not taken from v13:** the "Capture → Chase → Complete" step cards and the chat filler are illustrative. Channel, client and people names are fictional.

## Audio
- **Voiceover:** Kokoro TTS (Apache-2.0 model), voice `af_heart` at 1.0× speed for a calm read. If Elise, the v13 voice, is available, re-record the lines in `pondros-reel-on-it.srt` with the same timings.
- **Music and sound effects:** a calm bed synthesized in `src/audio.py`, so it is royalty-free. The music ducks under the voice.

## Rebuild
Requirements:
- Node with Playwright and Chromium
- Python with `kokoro-onnx`, `soundfile`, `scipy` and `numpy`
- ffmpeg with libx264

Steps:
1. `python tts_gen.py af_heart 1.0`
   - Needs `kokoro-v1.0.int8.onnx` and `voices-v1.0.bin`, which you can download from the thewh1teagle/kokoro-onnx releases.
   - Put the output `v2_*.wav` files in `src/tts/`.
2. `python audio.py`. This writes `mix.wav`.
3. `FFMPEG=ffmpeg node render.js`. This renders the frames and encodes `pondros-reel-on-it.mp4`.

Scene timings live in the `render(t)` function in `reel.html`. Open the file in a browser and call `render(20)` in the console to preview any moment.
