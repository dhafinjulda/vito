/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import {createHash} from 'node:crypto';
import {readFile, readdir, mkdir, cp, writeFile, access} from 'node:fs/promises';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const sdk=resolve(root,'packages/sdk');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const entry=await readFile(resolve(sdk,'dist/vto-sdk.js'));
const id=sha(entry).slice(0,12);
const destination=resolve(root,`.benchmarks/sdk-${id}`);
const files=[];
async function inspect(directory) {
  for(const item of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
    const path=resolve(directory,item.name);
    if(item.isDirectory())await inspect(path);
    else files.push({path:relative(root,path).replaceAll('\\','/'),sha256:sha(await readFile(path))});
  }
}
await inspect(resolve(sdk,'src'));
await inspect(resolve(sdk,'dist/assets'));
let exists=false;try {await access(resolve(destination,'vto-sdk.js'));exists=true;}catch{}
if(!exists){await mkdir(destination,{recursive:true});await cp(resolve(sdk,'dist'),destination,{recursive:true,errorOnExist:true,force:false});}
const label=process.argv[2]??'baseline';
if(!/^[a-z0-9-]+$/.test(label))throw new Error('Baseline label must contain lowercase letters, digits or hyphens');
const manifest={recordedDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),label,entrySha256:sha(entry),sdkModulePath:relative(root,resolve(destination,'vto-sdk.js')).replaceAll('\\','/'),files,
  scope:'Source hashes at snapshot time and built entry/worker hashes. Source/build parity requires an immediately preceding successful build; this script does not establish it. No camera/person data. Frozen dist is local and ignored.',
  package:JSON.parse(await readFile(resolve(sdk,'package.json'),'utf8'))};
await writeFile(resolve(destination,'baseline-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const output=resolve(root,`docs/evidence/smoothness-${manifest.label}-manifest.json`);
await mkdir(resolve(root,'docs/evidence'),{recursive:true});await writeFile(output,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({id,module:manifest.sdkModulePath,manifest:relative(root,output)}));
