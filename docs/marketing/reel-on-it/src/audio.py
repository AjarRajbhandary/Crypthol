import numpy as np, soundfile as sf
SR=48000; DUR=31.0; N=int(SR*DUR)
rng=np.random.default_rng(7)
def t_(d): return np.arange(int(SR*d))/SR
def place(buf,x,at,g=1.0):
    i=int(at*SR); x=x[:max(0,len(buf)-i)]; buf[i:i+len(x)]+=g*x
def lp(x,a):  # one-pole lowpass
    y=np.empty_like(x); s=0.0
    for i,v in enumerate(x): s+=a*(v-s); y[i]=s
    return y
# ---------- voiceover
from scipy.signal import resample_poly
vo=np.zeros(N); starts=[0.35,1.5,4.1,9.4,12.9,18.1,23.1,26.8]
for i,st in enumerate(starts):
    x,sr=sf.read(f'tts/af_heart_{i}.wav'); x=resample_poly(x,SR,sr) if sr!=SR else x
    place(vo,x/ (np.abs(x).max()+1e-9)*0.8,st)
# ---------- music (92 bpm lo-fi)
bpm=92; beat=60/bpm; mus=np.zeros(N)
def ep(f,d):  # electric-piano-ish
    t=t_(d); env=np.exp(-t*2.2)*(1-np.exp(-t*80))
    return env*(np.sin(2*np.pi*f*t)+.35*np.sin(2*np.pi*2*f*t)*np.exp(-t*5)+.12*np.sin(2*np.pi*3*f*t)*np.exp(-t*8))
def midi(n): return 440*2**((n-69)/12)
chords=[[57,60,64,67],[53,57,60,64],[48,52,55,59],[55,59,62,65]]  # Am7 Fmaj7 Cmaj7 G7
bar=4*beat; b=0; t0=0.0
while t0<DUR:
    ch=chords[b%4]
    for n in ch: place(mus,ep(midi(n),bar*1.1),t0,0.07)
    place(mus,ep(midi(ch[0]-12),bar)*1.0,t0,0.12)  # bass
    t0+=bar; b+=1
def kick():
    t=t_(0.35); f=50+90*np.exp(-t*30); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*9)
def hat():
    t=t_(0.06); n=rng.standard_normal(len(t)); n=n-lp(n,0.35); return n*np.exp(-t*60)
def snare():
    t=t_(0.2); n=rng.standard_normal(len(t)); n=lp(n,0.5)-lp(n,0.08); return n*np.exp(-t*22)*0.8
k=kick();h=hat();s=snare()
t0=0.0; i=0
while t0<DUR:
    if i%2==0: place(mus,h,t0,0.05)
    else: place(mus,h,t0,0.03)
    if t0>=12.8 and t0<26.6:  # drop: full groove
        if i%8 in (0,5): place(mus,k,t0,0.55)
        if i%8 in (2,6): place(mus,s,t0,0.25)
    elif t0>=26.6:
        if i%8==0: place(mus,k,t0,0.5)
    t0+=beat/2; i+=1
mus=lp(mus,0.25)
# fade in/out
env=np.ones(N); env[:int(SR*.4)]=np.linspace(0,1,int(SR*.4)); env[-int(SR*1.2):]=np.linspace(1,0,int(SR*1.2)); mus*=env
# duck under VO
vabs=np.abs(vo); win=int(SR*0.12); ve=np.convolve(vabs,np.ones(win)/win,'same'); duck=1-0.55*np.clip(ve*12,0,1)
duck=lp(duck,0.0005)
mus*=duck
# ---------- sfx
sfx=np.zeros(N)
def pop(f=880):
    t=t_(0.18); return np.sin(2*np.pi*(f+400*np.exp(-t*40))*t)*np.exp(-t*28)
def whoosh(d=1.6):
    t=t_(d); n=rng.standard_normal(len(t)); e=np.sin(np.pi*t/d)**2
    return (lp(n,0.08)-lp(n,0.01))*e*1.5
def buzz(d=0.8):
    t=t_(d); return np.sign(np.sin(2*np.pi*150*t))*0.3*(np.sin(2*np.pi*12*t)>0)*np.exp(-t*1.2)
def chime():
    t=t_(0.9); return (np.sin(2*np.pi*1318*t)+.6*np.sin(2*np.pi*1975*t))*np.exp(-t*5)*.5
def tick():
    t=t_(0.07); return np.sin(2*np.pi*2400*t)*np.exp(-t*80)
def tap():
    t=t_(0.05); n=rng.standard_normal(len(t)); return lp(n,.3)*np.exp(-t*90)
place(sfx,pop(700),0.05,0.35)
place(sfx,whoosh(1.9),2.0,0.35)
for j in range(10): place(sfx,pop(600+j*60),4.15+j*0.2,0.18)
place(sfx,buzz(),7.0,0.28)
for j in range(3): place(sfx,tick(),9.5+j*0.75+0.72,0.25)
place(sfx,whoosh(0.6),12.6,0.3)
place(sfx,chime(),14.1,0.3)
place(sfx,chime(),18.3,0.22)
place(sfx,tap(),20.3,0.5); place(sfx,pop(1000),20.8,0.3)
for j in range(6): place(sfx,tick(),23.5+j*0.38,0.35)
place(sfx,whoosh(0.8),26.3,0.3)
mix=vo*1.0+mus*0.9+sfx*0.8
mix/=np.abs(mix).max()/0.89
st=np.stack([mix,mix],1)
sf.write('mix.wav',st,SR)
sf.write('vo_only.wav',np.stack([vo,vo],1)/np.abs(vo).max()*0.89,SR)
sf.write('music_sfx_only.wav',np.stack([mus*0.9+sfx*0.8]*2,1)/np.abs(mus*0.9+sfx*0.8).max()*0.89,SR)
print('ok')
