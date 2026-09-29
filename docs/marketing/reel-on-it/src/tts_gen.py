import soundfile as sf, sys
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.int8.onnx", "voices-v1.0.bin")
voice = sys.argv[1] if len(sys.argv) > 1 else "af_heart"; speed = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
lines = [
 "On it.",
 "The two most dangerous words in Slack.",
 "Your team promises ten things a day in Slack. You find out one slipped when the client asks.",
 "And suddenly, you're not a manager. You're a human reminder.",
 "Meet Pondros. Not another task app. An AI project manager, right in Slack.",
 "It captures every commitment automatically. Who owns it, and when it's due.",
 "Then it chases for you, so nobody has to circle back.",
 "Capture. Chase. Complete.",
 "Pondros. Never circle back. Add it to Slack today.",
]
d={}
for i,l in enumerate(lines):
    s,sr=k.create(l,voice=voice,speed=speed,lang="en-us"); sf.write(f"v2_{i}.wav",s,sr); d[i]=round(len(s)/sr,2)
print(d, round(sum(d.values()),2))
