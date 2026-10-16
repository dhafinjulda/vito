import {readFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function releasePlan(tag,manifest){
  const match=/^(vito-sdk|vito-asset-generator)-v(\d+\.\d+\.\d+)$/.exec(tag);
  if(!match)throw Error('Expected stable tag vito-sdk-vX.Y.Z or vito-asset-generator-vX.Y.Z.');
  const [,name,version]=match;
  if(manifest.name!==name||manifest.version!==version||manifest.private===true)throw Error('Release tag must match the public package name/version exactly.');
  if(manifest.repository?.url!=='git+https://github.com/dhafinjulda/vito.git')throw Error('Package repository does not match the publishing repository.');
  return {name,version,directory:name==='vito-sdk'?'packages/sdk':'packages/asset-generator',tarball:`${name}-${version}.tgz`};
}
export async function assertUnpublished(plan,fetcher=fetch){
  const response=await fetcher(`https://registry.npmjs.org/${plan.name}/${plan.version}`,{signal:AbortSignal.timeout(15000)});
  if(response.status===200)throw Error(`${plan.name}@${plan.version} already exists; increment the package version before release.`);
  if(response.status!==404)throw Error(`Registry preflight failed (${response.status}); publication is blocked.`);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const tag=process.argv[2]??'';
  const match=/^(vito-sdk|vito-asset-generator)-v\d+\.\d+\.\d+$/.exec(tag);
  if(!match)throw Error('Unsupported release tag.');
  const root=fileURLToPath(new URL('../',import.meta.url));
  const directory=match[1]==='vito-sdk'?'packages/sdk':'packages/asset-generator';
  const plan=releasePlan(tag,JSON.parse(await readFile(resolve(root,directory,'package.json'),'utf8')));
  if(process.argv.includes('--check-registry'))await assertUnpublished(plan);
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,Object.entries(plan).map(([key,value])=>`${key}=${value}\n`).join(''));
  console.log(JSON.stringify(plan));
}
