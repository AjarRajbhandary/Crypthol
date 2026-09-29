import soundfile as sf, json, sys
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.int8.onnx", "voices-v1.0.bin")
voice = sys.argv[1] if len(sys.argv)>1 else "af_heart"
lines = [
 "On it.",
 "The two most dangerous words in Slack.",
 "Your team promises ten things a day in Slack. You find out one slipped when the client asks.",
 "And suddenly, you're not a manager. You're a human reminder.",
 "Pondros catches every commitment your team makes in Slack. Who owns it, and when it's due.",
 "Then it follows up for them, right inside Slack. No new tool anyone has to open.",
 "Capture. Chase. Complete. Nothing falls through the cracks.",
 "Stop chasing. Start finishing. Try Pondros. Link below.",
]
out={}
for i,l in enumerate(lines):
    s, sr = k.create(l, voice=voice, speed=1.08, lang="en-us")
    sf.write(f"{voice}_{i}.wav", s, sr); out[i]=round(len(s)/sr,2)
print(voice, out)
