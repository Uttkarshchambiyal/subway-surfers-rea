import fs from 'node:fs';
import {Game,Power} from '../src/engine';
import scenario from '../../../shared/test-vectors/scenarios.json';
const g=new Game();g.start();g.phase='running';const samples:unknown[]=[];
for(let tick=0;tick<scenario.ticks;tick++){for(const event of scenario.actions.filter(a=>a.tick===tick)){if(['right','left','jump','roll'].includes(event.action))g.input(event.action);else g.power(event.action as Power);}g.grace=1;g.tick();if(scenario.sampleTicks.includes(tick+1))samples.push({tick:tick+1,distance:g.distance,speed:g.speed,x:g.x,y:g.y,coins:g.coins,score:g.score,...g.powers});}
fs.mkdirSync('../../outputs/web',{recursive:true});fs.writeFileSync('../../outputs/web/conformance.json',JSON.stringify({scenario:scenario.id,samples},null,2)+'\n');
console.log(JSON.stringify(samples));
