import {afterEach,describe,it,expect,vi} from 'vitest';
import {TrackerStartup} from '../src/tracking/TrackerStartup';
import {TrackerWorkerOwner} from '../src/tracking/TrackerWorkerOwner';
import {TRACKER_PROTOCOL_VERSION} from '../src/tracking/protocol';
afterEach(()=>vi.useRealTimers());
describe('owned tracker startup',()=>{
  it('does not extend optional deadlines on repeated loading messages',async()=>{
    vi.useFakeTimers();const startup=new TrackerStartup(40000,12000);
    const rejected=expect(startup.ready).rejects.toThrow('Optional hair startup timed out');
    startup.armOptional('hair');await vi.advanceTimersByTimeAsync(11000);startup.armOptional('hair');
    await vi.advanceTimersByTimeAsync(1000);await rejected;expect(vi.getTimerCount()).toBe(0);
  });
  it('retains the total bound when optional phases advance',async()=>{
    vi.useFakeTimers();const startup=new TrackerStartup(15000,12000);
    const rejected=expect(startup.ready).rejects.toMatchObject({code:'tracker-timeout'});
    startup.armOptional('hand');await vi.advanceTimersByTimeAsync(10000);startup.armOptional('hair');
    await vi.advanceTimersByTimeAsync(5000);await rejected;expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects protocol mismatch and clears all waits on success',async()=>{
    vi.useFakeTimers();const wrong=new TrackerStartup(20000,12000);
    expect(wrong.validateReady(-1)).toBe(false);await expect(wrong.ready).rejects.toThrow('version');
    const good=new TrackerStartup(20000,12000);good.armOptional('hair');
    expect(good.validateReady(TRACKER_PROTOCOL_VERSION)).toBe(true);good.complete();
    await good.ready;good.fail(Error('late'));expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels released startup without affecting the replacement wait',async()=>{
    vi.useFakeTimers();const create=()=>({terminate:vi.fn(),onmessage:null,onerror:null,onmessageerror:null}) as unknown as Worker;
    const owner=new TrackerWorkerOwner(create),first=owner.acquire();
    const startup=owner.beginStartup(first,20000,12000);owner.release();
    await expect(startup.ready).rejects.toThrow('stopped');
    const next=owner.acquire(),replacement=owner.beginStartup(next,20000,12000);
    owner.release(first);expect(owner.current).toBe(next);replacement.complete();await replacement.ready;
    owner.release();expect(vi.getTimerCount()).toBe(0);
  });
});
