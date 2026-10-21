import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const videoURL=new URL('../../../outputs/web/RailRush-gameplay.mp4',import.meta.url);
const output=fileURLToPath(new URL('../../../outputs/web/recovered-revision/video-playback.json',import.meta.url));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:430,height:932}});
 await page.goto(videoURL.href);await page.waitForSelector('video');
 await page.evaluate(async()=>{const v=document.querySelector('video');v.muted=true;v.currentTime=30;await v.play();});
 await page.waitForFunction(()=>document.querySelector('video').currentTime>31);
 const result=await page.evaluate(()=>{const v=document.querySelector('video');return{currentTime:v.currentTime,duration:v.duration,width:v.videoWidth,height:v.videoHeight,readyState:v.readyState,paused:v.paused,error:v.error?.message??null};});
 const pass=result.currentTime>31&&!result.paused&&!result.error&&result.width===430&&result.height===932;
 await fs.writeFile(output,JSON.stringify({pass,...result,boundary:'Headless Chrome local MP4 playback; original soundtrack added in post, not captured live effects or phone audio.'},null,2));
 for(const time of [0,30,60]){await page.evaluate(t=>{const video=document.querySelector('video');video.pause();video.currentTime=t},time);await page.waitForFunction(t=>Math.abs(document.querySelector('video').currentTime-t)<.2&&document.querySelector('video').readyState>=2,time);await page.waitForTimeout(100);await page.locator('video').screenshot({path:fileURLToPath(new URL(`../../../outputs/web/recovered-revision/video-${time}.png`,import.meta.url))});}console.log(JSON.stringify({pass,...result}));if(!pass)process.exitCode=1;
}finally{await browser.close();}
