const SOUNDS=['coin','swish','power','stumble','click','music','power-down','jetpack','magnet','side-stumble'];

export class AudioBus {
 context:AudioContext|null=null; gain:GainNode|null=null; buffers=new Map<string,AudioBuffer>(); music:AudioBufferSourceNode|null=null; ready=false; enabled=true; volume=.55;lastCoin=-Infinity;
 private loading:Promise<void>|null=null;
 private musicGain:GainNode|null=null;

 async unlock(){
  if(!this.context){
   this.context=new AudioContext();this.gain=this.context.createGain();this.gain.connect(this.context.destination);
  }
  const context=this.context;
  // Resume in the input handler, before fetch/decode yields the user gesture.
  const resumed=context.state==='suspended'?context.resume().catch(error=>console.warn('Audio could not resume',error)):Promise.resolve();
  if(!this.loading){
   this.loading=Promise.all(SOUNDS.map(async name=>{
    try{
     const response=await fetch(new URL(`recovered/audio/${name}.wav`,document.baseURI));
     if(!response.ok)throw new Error(`HTTP ${response.status}`);
     this.buffers.set(name,await context.decodeAudioData(await response.arrayBuffer()));
    }catch(error){console.warn('Audio unavailable',name,error);}
   })).then(()=>{this.ready=true;});
  }
  // Every caller awaits the same decode operation, including concurrent taps.
  await Promise.all([resumed,this.loading]);this.apply();
 }
 apply(){if(this.gain)this.gain.gain.value=this.enabled?Math.max(0,Math.min(1,this.volume)):0;}
 effect(name:string){
  name=({jump:'swish',roll:'swish',crash:'stumble'} as Record<string,string>)[name]??name;
  if(!this.context||!this.ready||!this.enabled)return;
  if(name==='coin'&&this.context.currentTime-this.lastCoin<.045)return;
  const buffer=this.buffers.get(name);if(!buffer)return;
  if(name==='coin')this.lastCoin=this.context.currentTime;
  const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.gain!);
  source.onended=()=>source.disconnect();source.start();
 }
 playMusic(){
  if(this.music||!this.context||!this.buffers.has('music'))return;
  const source=this.context.createBufferSource();source.buffer=this.buffers.get('music')!;source.loop=true;
  const gain=this.context.createGain();gain.gain.value=.42;gain.connect(this.gain!);source.connect(gain);
  this.music=source;this.musicGain=gain;
  source.onended=()=>{source.disconnect();gain.disconnect();if(this.music===source){this.music=null;this.musicGain=null;}};
  source.start();
 }
 stopMusic(){
  const source=this.music;this.music=null;
  if(source){try{source.stop();}catch{}source.disconnect();}
  this.musicGain?.disconnect();this.musicGain=null;
 }
}
