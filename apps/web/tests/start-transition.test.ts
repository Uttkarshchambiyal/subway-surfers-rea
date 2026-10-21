import test from 'node:test';
import assert from 'node:assert/strict';
import {startPresentation} from '../src/start-transition';
import {Game} from '../src/engine';
const duration=1.2083332538604736,speed=21.38888888888889;
const near=(a:number,b:number,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('camera blend and track speed join the menu and running state continuously',()=>{
 const view=(elapsed:number)=>startPresentation('starting','running',duration-elapsed,duration,0,speed);
 const first=view(0),last=view(duration),running=startPresentation('running','running',0,duration,0,speed);
 near(first.blend,0);near(first.environmentDistance,0);near(last.blend,1);near(last.environmentDistance,running.environmentDistance);near(running.entityDistance,0);
 const step=1e-4;near((view(step).environmentDistance-first.environmentDistance)/step,0,1e-4);near((last.environmentDistance-view(duration-step).environmentDistance)/step,speed,1e-4);
});
test('pausing halfway through startup preserves the camera and character transition',()=>{
 const playing=startPresentation('starting','running',duration/2,duration,0,speed),paused=startPresentation('paused','starting',duration/2,duration,0,speed);
 assert.deepEqual(paused,playing);
});
test('web startup can finish the recovered intro clip before running',()=>{
 const game=new Game();game.startDuration=duration;game.start();game.tick(.9);assert.equal(game.phase,'starting');game.tick(.32);assert.equal(game.phase,'running');near(game.distance,0);
});
