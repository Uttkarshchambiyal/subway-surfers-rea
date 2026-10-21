import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
function worker(fetcher:typeof fetch){
 const handlers=new Map<string,Function>();
 const entries=new Map<string,Response>([['http://game.test/',new Response('old entry')]]);
 const key=(request:any)=>typeof request==='string'?request:request.url;
 vm.runInNewContext(source,{
  URL,location:{origin:'http://game.test'},fetch:fetcher,
  self:{registration:{scope:'http://game.test/'},addEventListener:(name:string,handler:Function)=>handlers.set(name,handler)},
  caches:{open:async()=>({match:async(request:any)=>entries.get(key(request))?.clone(),put:async(request:any,response:Response)=>entries.set(key(request),response)})},
 });
 return {entries,request:async(mode='navigate')=>{
  let result!:Promise<Response>;
  handlers.get('fetch')!({request:{method:'GET',url:'http://game.test/?visit=new',mode},respondWith:(response:Promise<Response>)=>{result=response;}});
  return result;
 }};
}
test('a cached old entry does not hide a newer online build',async()=>{
 const w=worker(async()=>new Response('new entry'));
 assert.equal(await (await w.request()).text(),'new entry');
 assert.equal(await w.entries.get('http://game.test/')!.text(),'new entry');
});
test('navigation still loads the saved entry when offline',async()=>{
 const w=worker(async()=>{throw new TypeError('offline');});
 assert.equal(await (await w.request()).text(),'old entry');
});
test('a failed server response falls back to the saved game',async()=>{
 const w=worker(async()=>new Response('unavailable',{status:503}));
 assert.equal(await (await w.request()).text(),'old entry');
});
