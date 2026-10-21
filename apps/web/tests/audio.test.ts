import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioBus} from '../src/audio';

test('concurrent audio unlocks share decoding and resume during the gesture',async t=>{
 const events:string[]=[];
 const decoded:Array<()=>void>=[];
 class Node {
  gain={value:1};buffer:unknown;loop=false;onended:(()=>void)|null=null;stopped=false;disconnected=false;
  connect(){} disconnect(){this.disconnected=true;} start(){events.push('start');} stop(){this.stopped=true;}
 }
 class Context {
  state='suspended';destination={};currentTime=0;nodes:Node[]=[];
  constructor(){events.push('context');}
  createGain(){const node=new Node();this.nodes.push(node);return node;}
  createBufferSource(){const node=new Node();this.nodes.push(node);return node;}
  async resume(){events.push('resume');this.state='running';}
  decodeAudioData(){return new Promise(resolve=>decoded.push(()=>resolve({})));}
 }
 for(const [name,value] of Object.entries({AudioContext:Context,document:{baseURI:'http://game.test/'}})){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,name);
  Object.defineProperty(globalThis,name,{value,configurable:true});
  t.after(()=>{if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);});
 }
 t.mock.method(globalThis,'fetch',async()=>{events.push('fetch');return new Response(new ArrayBuffer(8));});
 const audio=new AudioBus();
 const first=audio.unlock();const second=audio.unlock();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(events.filter(event=>event==='context').length,1);
 assert.equal(events.filter(event=>event==='fetch').length,10);
 assert.ok(events.indexOf('resume')<events.indexOf('fetch'));
 assert.equal(audio.ready,false);
 decoded.forEach(resolve=>resolve());await Promise.all([first,second]);
 assert.equal(audio.ready,true);assert.equal(audio.buffers.size,10);
 audio.effect('coin');assert.equal(events.filter(event=>event==='start').length,1,'first coin is audible at currentTime 0');
 audio.effect('coin');assert.equal(events.filter(event=>event==='start').length,1,'rapid coin effects are limited');
 audio.playMusic();const music=audio.music as unknown as Node;audio.playMusic();
 assert.equal(events.filter(event=>event==='start').length,2,'music starts once');
 audio.stopMusic();assert.equal(music.stopped,true);assert.equal(music.disconnected,true);assert.equal(audio.music,null);
 audio.playMusic();assert.equal(events.filter(event=>event==='start').length,3,'resume can restart music');
 audio.enabled=false;audio.apply();assert.equal(audio.gain!.gain.value,0);
 audio.enabled=true;audio.volume=3;audio.apply();assert.equal(audio.gain!.gain.value,1);
});
