"""Original deterministic route, audio and physics vectors. No third-party assets."""
from pathlib import Path
import json, math, wave, struct
ROOT=Path(__file__).resolve().parents[1]
def dump(p,v):
 p=ROOT/p;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2)+'\n')
C=json.loads((ROOT/'shared/config/gameplay.json').read_text())
state=C['seed']
sequence=[]
def rnd():
 global state
 state=(1664525*state+1013904223)&0xffffffff
 sequence.append(state)
 return state/4294967296
entities=[]
def add(kind,lane,z,y=0,length=1):
 entities.append(dict(id=len(entities),kind=kind,lane=lane,z=z,y=y,length=length))
powers=['magnet','jetpack','boots','multiplier','board']
rows=[]
for row in range(96):
 z=C['firstRow']+C['rowSpacing']*row
 safe=int(rnd()*3)-1
 other=[l for l in [-1,0,1] if l!=safe]
 variant=int(rnd()*6)
 # ramp precedes a stationary train; top coins reward taking the route
 if variant==0:
  lane=other[0];add('ramp',lane,z-7,0,7);add('train',lane,z,0,10)
  for q in range(4):add('coin',lane,z+q*2.2,3.9,.5)
 else:
  kind=['barrier','overhead','train','movingTrain','barrier','overhead'][variant]
  add(kind,other[0],z,0,10 if 'Train' in kind or kind=='train' else 1.4)
 if row%3!=0:add('overhead' if variant%2==0 else 'barrier',other[1],z+2,0,1.4)
 for q in range(6):add('coin',safe,z-12+q*3.5,.9,.5)
 if row%4==1:
  power=powers[(row//4)%5];add(power,safe,z+13,1.1,1)
  if power=='jetpack':
   for q in range(32):add('coin',safe,z+20+q*5,8.9,.5)
 rows.append(dict(row=row,safeLane=safe,variant=variant,z=z))
dump(Path('shared/config/route.json'),dict(schemaVersion=1,seed=1337,cycleLength=C['routeCycleLength'],rows=rows,entities=entities))
dump(Path('shared/test-vectors/prng.json'),dict(seed=1337,algorithm='LCG32: (1664525*s+1013904223) mod 2^32',first10=sequence[:10],first5Rows=rows[:5]))
# Fixed-step unimpeded progression and jump tests
v=C['initialSpeed'];d=0;dt=C['fixedStep']
for _ in range(1200):v=min(C['maxSpeed'],v+C['acceleration']*dt);d+=v*dt
y=0;vy=C['jumpVelocity'];t=0;apex=0
while True:
 vy-=C['gravity']*dt;y+=vy*dt;t+=dt;apex=max(apex,y)
 if y<=0:break
dump(Path('shared/test-vectors/physics.json'),{'dt':dt,'unimpeded10s':{'speed':v,'distance':d,'score':math.floor(d)*3},'jump':{'landingSeconds':t,'apex':apex},'lane':{'seconds':C['laneChangeSeconds'],'midpointX':C['laneWidth']/2,'endX':C['laneWidth']},'power':{'magnetStart':12,'after1200Ticks':2},'tolerance':1e-5})
# Small PCM originals; shared on every platform; composed synth loop 104 BPM.
audio=ROOT/'shared/assets/audio';audio.mkdir(parents=True,exist_ok=True)
rate=22050
def wav(name,duration,fn):
 with wave.open(str(audio/(name+'.wav')),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate)
  w.writeframes(b''.join(struct.pack('<h',max(-32767,min(32767,int(fn(i/rate)*32767)))) for i in range(int(rate*duration))))
for name,dur,freq in [('coin',.14,1120),('jump',.25,420),('roll',.19,180),('power',.55,660),('crash',.38,90),('click',.08,760)]:
 def f(t,du=dur,fr=freq,na=name):
  pitch=fr*(1+(.8*t/du if na in ('power','jump') else -.3*t/du))
  a=(1-t/du)**2*.28
  return math.sin(2*math.pi*pitch*t)*a + (math.sin(2*math.pi*67*t)*a*.5 if na=='crash' else 0)
 wav(name,dur,f)
beat=60/104;length=beat*16
notes=[261.63,329.63,392,329.63,293.66,349.23,440,349.23,220,261.63,329.63,392,196,246.94,293.66,392]
def music(t):
 step=int(t/(beat/2));within=t%(beat/2);env=math.exp(-within*12);note=notes[step%len(notes)]
 melody=(math.sin(2*math.pi*note*t)+.25*math.sin(4*math.pi*note*t))*.075*env
 bt=t%beat;kick=math.sin(2*math.pi*(65-22*bt)*bt)*math.exp(-bt*30)*.15
 bass=[130.81,146.83,110,98][int(t/(beat*4))%4]
 return melody+kick+math.sin(2*math.pi*bass*t)*.035
wav('music',length,music)
dump(Path('shared/assets/inventory.json'),{'license':'Original assets authored in this workspace; no original Subway Surfers assets included.','scene':'scene.json: common named box, capsule and ellipsoid character, renderer-assembled architectural details.','route':'../config/route.json: procedural original design using LCG32 seed1337.','audio':{p.name:{'author':'procedural original synthesizer/composition','format':'mono PCM16 22050Hz','generator':'scripts/generate-shared.py'} for p in audio.glob('*.wav')}})
print('Generated',len(entities),'route entities,',len(list(audio.glob('*.wav'))),'audio assets')
