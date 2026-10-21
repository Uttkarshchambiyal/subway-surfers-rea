import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
async function files(dir){const entries=await fs.readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
const all=(await files('dist')).filter(p=>!p.endsWith('/sw.js'));
const precache=all.filter(p=>!p.includes('/recovered/')||/\/recovered\/(?:environment\/(?:environment.json|textures\/)|character\/(?:jake.glb|super-sneakers.json|jake_outfit[012]_tex.png)|ui\/|audio\/.*\.wav$)/.test(p));
const hash=createHash('sha256');for(const file of precache.sort()){hash.update(file);hash.update(await fs.readFile(file));}
const digest=hash.digest('hex').slice(0,16);
let sw=await fs.readFile('dist/sw.js','utf8');sw=sw.replace('rail-rush-v1',`rail-rush-${digest}`).replace('/*PRECACHE*/[]',JSON.stringify(['./',...precache.map(p=>'./'+path.relative('dist',p))]));await fs.writeFile('dist/sw.js',sw);
console.log(`Offline cache ${digest}: ${precache.length} resources`);
