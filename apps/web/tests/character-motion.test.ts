import test from 'node:test';
import assert from 'node:assert/strict';
import {characterMotion,MotionState} from '../src/character-motion';
const normal:MotionState={phase:'running',grounded:true,vy:0,roll:0,board:false,boots:false,jetpack:false};
test('board states never use the running-feet animation',()=>{
 for(const patch of [{},{grounded:false,vy:10},{grounded:false,vy:-10},{roll:.4},{transient:'h_skate_on'},{transient:'h_left'}])assert.ok(characterMotion({...normal,board:true,...patch}).clip.startsWith('h_'));
});
test('jetpack has priority over board, boots, roll and airborne fall',()=>{
 const state={...normal,board:true,boots:true,jetpack:true,roll:.5,grounded:false,vy:-5};
 assert.equal(characterMotion(state).clip,'Jetpack_forward_2');
 assert.equal(characterMotion({...state,transient:'Jetpack_changeLane_left'}).clip,'Jetpack_changeLane_left');
 assert.equal(characterMotion({...state,transient:'Jackpack_changeLane_Right'}).clip,'Jackpack_changeLane_Right');
});
test('sneaker running and ability expiry return to the correct pose',()=>{
 assert.equal(characterMotion({...normal,boots:true}).clip,'superRun');
 assert.equal(characterMotion(normal).clip,'RunNormal');
 assert.equal(characterMotion({...normal,phase:'menu',board:true,jetpack:true}).clip,'Jake_Breathe');
 assert.equal(characterMotion({...normal,phase:'results',board:true,jetpack:true}).clip,'death_lower');
});
