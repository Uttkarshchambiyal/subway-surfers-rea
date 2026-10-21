import test from 'node:test';
import assert from 'node:assert/strict';
import {registerOffline} from '../src/offline';

function setup(t:any,controlled:boolean,online=true,reject=false){
 let reloads=0;let updates=0;let registrations=0;
 const listeners=new Set<()=>void>();
 const registration={update(){updates++;throw new Error('first-activation race');}};
 const serviceWorker={
  controller:controlled?{}:null,
  addEventListener:(_name:string,listener:()=>void)=>listeners.add(listener),
  removeEventListener:(_name:string,listener:()=>void)=>listeners.delete(listener),
  register:async(path:string,options:any)=>{registrations++;assert.equal(path,'./sw.js');assert.equal(options.updateViaCache,'none');if(reject)throw new TypeError('offline');return registration;},
 };
 for(const [name,value] of Object.entries({navigator:{serviceWorker,onLine:online},location:{reload:()=>reloads++}})){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,name);
  Object.defineProperty(globalThis,name,{value,configurable:true});
  t.after(()=>{if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);});
 }
 return {registration,listeners,change:()=>listeners.forEach(listener=>listener()),counts:()=>({reloads,updates,registrations})};
}
test('first installation does not force a reload or race update()',async t=>{
 const worker=setup(t,false);
 assert.equal(await registerOffline(),worker.registration);worker.change();
 assert.deepEqual(worker.counts(),{reloads:0,updates:0,registrations:1});
});
test('a newer worker reloads an already controlled page exactly once',async t=>{
 const worker=setup(t,true);
 await registerOffline();worker.change();worker.change();
 assert.deepEqual(worker.counts(),{reloads:1,updates:0,registrations:1});
});
test('offline registration failure leaves the cached game alone',async t=>{
 const worker=setup(t,true,false,true);
 const warnings=t.mock.method(console,'warn',()=>{});
 assert.equal(await registerOffline(),null);assert.equal(worker.listeners.size,0);assert.equal(warnings.mock.callCount(),0);
});
