import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out='../../outputs/web/recovered-revision/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});
const context=await browser.newContext({viewport:{width:430,height:932},serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:8173/?qa=1');await page.waitForFunction(()=>window.railRush&&window.railRush.world(),{timeout:60000});await page.waitForTimeout(1000);await page.screenshot({path:out+'menu.png'});
console.log('menu',await page.evaluate(()=>({text:document.body.innerText,render:window.railRush.snapshot(),errors:document.querySelector('.error')?.innerText})));
await page.getByRole('button',{name:'Tap to Play'}).click();await page.waitForTimeout(1500);await page.screenshot({path:out+'run.png'});console.log('run',await page.evaluate(()=>window.railRush.snapshot()),'errors',errors);
await fs.writeFile(out+'smoke.json',JSON.stringify({errors,snapshot:await page.evaluate(()=>window.railRush.snapshot())},null,2));await browser.close();
