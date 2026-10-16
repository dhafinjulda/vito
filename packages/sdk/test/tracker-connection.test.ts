import {describe,it,expect,vi} from 'vitest';
import {TrackerWorkerOwner} from '../src/tracking/TrackerWorkerOwner';
const init={type:'init',wasmRoot:'/wasm',modelAssetPath:'/face.task'} as const;
function setup(){
  const worker={postMessage:vi.fn(),terminate:vi.fn(),onmessage:null,onerror:null,onmessageerror:null} as unknown as Worker;
  const owner=new TrackerWorkerOwner(()=>worker);owner.acquire();
  const startup=owner.beginStartup(worker,20000,12000);
  return {worker,owner,startup,connection:owner.connect(worker,startup)};
}
describe('camera-independent tracker connection',()=>{
  it('sends init once and hands callbacks to the active consumer on the same worker',async()=>{
    const {worker,owner,startup,connection}=setup();
    const prepared=vi.fn(),active=vi.fn(),onError=vi.fn();
    connection.setHandlers({onMessage:prepared,onError});
    const ready=connection.start(init);expect(connection.start(init)).toBe(ready);
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith(init);
    worker.onmessage!({data:{type:'face-ready'}} as MessageEvent);
    expect(prepared).toHaveBeenCalledOnce();startup.complete();await ready;
    expect(connection.setHandlers({onMessage:active,onError})).toBe(true);
    worker.onmessage!({data:{type:'frame-done',timestampMs:1}} as MessageEvent);
    expect(active).toHaveBeenCalledOnce();expect(prepared).toHaveBeenCalledOnce();
    owner.release();expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('ignores queued obsolete callbacks and rejects handoff after release',async()=>{
    const {worker,owner,startup,connection}=setup(),onMessage=vi.fn(),onError=vi.fn();
    connection.setHandlers({onMessage,onError});const queued=worker.onmessage!;
    owner.release();await expect(startup.ready).rejects.toThrow('stopped');
    queued.call(worker,{data:{type:'face-ready'}} as MessageEvent);
    expect(onMessage).not.toHaveBeenCalled();expect(connection.setHandlers({onMessage,onError})).toBe(false);
  });
  it('rejects synchronous init transport failure and reports deserialization failure',async()=>{
    const {worker,owner,connection}=setup();
    vi.mocked(worker.postMessage).mockImplementation(()=>{throw Error('transfer blocked');});
    await expect(connection.start(init)).rejects.toThrow('transfer blocked');owner.release();
    const second=setup();second.worker.onmessageerror!({} as MessageEvent);
    await expect(second.startup.ready).rejects.toThrow('decoded');second.owner.release();
  });
});
