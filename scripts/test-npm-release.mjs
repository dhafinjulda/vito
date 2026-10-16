import {test} from 'node:test';
import assert from 'node:assert/strict';
import {releasePlan,assertUnpublished} from './npm-release-plan.mjs';
const manifest=(name,version)=>({name,version,repository:{url:'git+https://github.com/dhafinjulda/vito.git'}});
test('independent package releases require exact stable identity',()=>{
  assert.equal(releasePlan('vito-sdk-v0.2.0',manifest('vito-sdk','0.2.0')).directory,'packages/sdk');
  assert.equal(releasePlan('vito-asset-generator-v0.1.1',manifest('vito-asset-generator','0.1.1')).tarball,'vito-asset-generator-0.1.1.tgz');
  for(const tag of ['v0.2.0','vito-sdk-v0.2.0-beta.1','../../foo','vito-sdk-v0.2.0\ninjected=true'])assert.throws(()=>releasePlan(tag,manifest('vito-sdk','0.2.0')));
  assert.throws(()=>releasePlan('vito-sdk-v0.2.0',manifest('vito-sdk','0.1.1')));
  assert.throws(()=>releasePlan('vito-sdk-v0.2.0',{...manifest('vito-sdk','0.2.0'),private:true}));
});
test('registry check rejects duplicate versions and fails closed on registry errors',async()=>{
  const plan=releasePlan('vito-sdk-v0.2.0',manifest('vito-sdk','0.2.0'));
  await assertUnpublished(plan,async()=>({status:404}));
  await assert.rejects(assertUnpublished(plan,async()=>({status:200})),/already exists/);
  await assert.rejects(assertUnpublished(plan,async()=>({status:503})),/blocked/);
  await assert.rejects(assertUnpublished(plan,async()=>{throw Error('Network unavailable');}),/Network/);
});
