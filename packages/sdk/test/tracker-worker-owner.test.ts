import {describe,it,expect,vi} from 'vitest';
import {TrackerWorkerOwner} from '../src/tracking/TrackerWorkerOwner';

function worker(){return {onmessage:vi.fn(),onerror:vi.fn(),onmessageerror:vi.fn(),terminate:vi.fn()} as unknown as Worker;}
describe('session tracker ownership',()=>{
  it('detaches old callbacks before termination and ignores obsolete release',()=>{
    const first=worker(),second=worker(),factory=vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const owner=new TrackerWorkerOwner(factory);
    owner.acquire();
    vi.mocked(first.terminate).mockImplementation(()=>{
      expect(owner.current).toBeNull();
      expect(first.onmessage).toBeNull();expect(first.onerror).toBeNull();expect(first.onmessageerror).toBeNull();
    });
    expect(owner.acquire()).toBe(second);
    owner.release(first);expect(owner.current).toBe(second);expect(second.terminate).not.toHaveBeenCalled();
    owner.release();owner.release();expect(first.terminate).toHaveBeenCalledOnce();expect(second.terminate).toHaveBeenCalledOnce();
  });
  it('leaves no obsolete ownership when replacement construction fails',()=>{
    const first=worker(),factory=vi.fn().mockReturnValueOnce(first).mockImplementationOnce(()=>{throw Error('Worker blocked');});
    const owner=new TrackerWorkerOwner(factory);owner.acquire();
    expect(()=>owner.acquire()).toThrow('Worker blocked');expect(owner.current).toBeNull();expect(first.terminate).toHaveBeenCalledOnce();
  });
});
