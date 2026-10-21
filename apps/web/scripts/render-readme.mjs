import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';

// Render actual deterministic gameplay into the editable README composition.
// Run from apps/web after starting the production preview on port 8175.
const root=fileURLToPath(new URL('../../../',import.meta.url));
const frames=path.join(root,'outputs/readme-art/');await fs.mkdir(frames,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});
try{
 const context=await browser.newContext({viewport:{width:600,height:1000},serviceWorkers:'block'}),game=await context.newPage();
 await game.goto(process.env.GAME_URL||'http://127.0.0.1:8175/?qa=1');await game.waitForFunction(()=>window.railRush?.world(),null,{timeout:60000});
 await game.evaluate(()=>{const q=window.railRush,g=q.game;window.readmeTick=g.tick;g.tick=()=>{};g.spawn=()=>{};g.start();g.phase='running';for(const e of g.entities)e.active=false;g.power('magnet');for(let i=0;i<50;i++){window.readmeTick.call(g);q.world().render(performance.now()/1000);}q.refresh();document.getElementById('notice')?.replaceChildren();});
 const art=await context.newPage();await art.setViewportSize({width:1280,height:720});await art.goto(pathToFileURL(path.join(root,'docs/media/readme-scene.html')).href);await art.evaluate(()=>document.fonts.ready);
 for(let frame=0;frame<48;frame++){
  await game.evaluate(frame=>{const q=window.railRush,g=q.game;if(frame%12===0)for(const lane of [-1,0,1]){const e=g.entities.find(e=>!e.active);Object.assign(e,{active:true,attraction:undefined,kind:'coin',id:100000+frame*3+lane,lane,z:g.distance+7,y:.9,length:.5});}for(let i=0;i<10;i++){window.readmeTick.call(g);q.world().render(performance.now()/1000);}},frame);
  const png=await game.screenshot();await art.evaluate(({src,phase})=>window.setFrame(src,phase),{src:'data:image/png;base64,'+png.toString('base64'),phase:frame/48});
  await art.screenshot({path:path.join(frames,String(frame).padStart(3,'0')+'.png')});
  if(frame===5)await art.screenshot({path:path.join(root,'docs/media/subway-rea-poster.png')});
 }
 console.log('Rendered 48 actual gameplay fixture frames and README poster.');
}finally{await browser.close();}
