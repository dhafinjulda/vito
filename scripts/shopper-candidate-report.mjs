import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sdk=JSON.parse(await readFile(resolve(root,'docs/evidence/smoothness-shopper-sprint-final-manifest.json'),'utf8'));
const manifest=JSON.parse(await readFile(resolve(root,'examples/vanilla/src/glasses-manifest.json'),'utf8'));
const assets=[];
for(const asset of manifest.assets){
  const path='examples/vanilla/public/'+asset.file,bytes=await readFile(resolve(root,path));
  if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(16)!==0x4e4f534a)throw Error('Expected validated GLB JSON first chunk');
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  const primitives=(gltf.meshes??[]).flatMap(mesh=>mesh.primitives);
  const triangleCount=primitives.every(p=>(p.mode??4)===4)?primitives.reduce((sum,p)=>sum+gltf.accessors[p.indices??p.attributes.POSITION].count/3,0):null;
  assets.push({id:asset.id,path,bytes:bytes.length,sha256:sha(bytes),underProposed2MB:bytes.length<=2000000,meshDefinitionTriangleCount:triangleCount,underProposed30000Triangles:triangleCount===null?null:triangleCount<=30000,images:(gltf.images??[]).length,estimatedDecodedTextureBytes:(gltf.images??[]).length===0?0:null,provenance:asset.assetProvenance,license:asset.license??'Original repository procedural demonstration; see THIRD_PARTY_NOTICES.md',nominalDimensionsMm:asset.nominalDimensionsMm,dimensionsAreSupplierMeasured:false,fit:asset.fit,partNames:asset.partNames});
}
const source=[];
for(const path of ['examples/vanilla/index.html','examples/vanilla/src/main.ts','examples/vanilla/src/style.css','examples/vanilla/src/glasses-manifest.json','THIRD_PARTY_NOTICES.md'])source.push({path,sha256:sha(await readFile(resolve(root,path)))});
const report={recordedDate:'2026-10-15',sdkEntrySha256:sdk.entrySha256,sdkModulePath:sdk.sdkModulePath,worker:sdk.files.filter(f=>/dist\/assets\/.*\.js$/.test(f.path)),source,assets,defaults:{presentation:'auto',adaptiveQuality:true,cameraCompositing:true,hair:'guarded automatic',hands:'opt-in disabled',runtimeCache:'reference example explicitly opts into pinned static cache',camera:'explicit start only; audio false',preparation:'explicit public prepare only; no camera'},coordinateSystem:manifest.coordinateSystem,scope:'Local candidate inventory only. No camera/person data, supplier measurement, retail asset or physical-device qualification. Candidate SDK built before snapshot; example/source hashes capture local reviewed reference integration.'};
await writeFile(resolve(root,'docs/evidence/shopper-final-candidate.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sdk:sdk.entrySha256.slice(0,12),assets:assets.length,source:source.length}));
