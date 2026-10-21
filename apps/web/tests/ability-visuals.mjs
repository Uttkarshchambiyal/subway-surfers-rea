import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out='../../outputs/web/ability-animation/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});
const context=await browser.newContext({viewport:{width:600,height:1000},serviceWorkers:'block'}),page=await context.newPage();const diagnostics={};
try{
 await page.goto('http://127.0.0.1:8175/?qa=1');await page.waitForFunction(()=>window.railRush?.world(),null,{timeout:60000});
 for(const power of ['board','boots','jetpack']){
  await page.evaluate(power=>{const qa=window.railRush,g=qa.game;g.spawn=()=>{};g.start();g.phase='running';for(const e of g.entities)e.active=false;g.power(power);qa.refresh();},power);
  await page.waitForTimeout(800);await page.screenshot({path:out+power+'.png'});
  diagnostics[power]=await page.evaluate(()=>{
   const qa=window.railRush,w=qa.world();w.boots.computeBoundingBox();return{state:qa.snapshot(),shoeBounds:{min:w.boots.boundingBox.min.toArray(),max:w.boots.boundingBox.max.toArray()},jetTransform:{position:w.jet.position.toArray(),scale:w.jet.scale.toArray()},boardMatrix:w.board.matrixWorld.toArray()};
  });
  if(power!=='jetpack'){await page.keyboard.press('ArrowUp');await page.waitForTimeout(250);await page.screenshot({path:out+power+'-jump.png'});}
 }
 await fs.writeFile(out+'diagnostics.json',JSON.stringify(diagnostics,null,2));console.log(JSON.stringify(diagnostics));
}finally{await context.close();await browser.close();}
