import {afterEach,describe,expect,it,vi} from 'vitest';
import {waitForResource} from '../src/assets/waitForResource';
afterEach(()=>vi.useRealTimers());
describe('bounded resource waiting',()=>{
  it('times out with an actionable reason without hiding a late rejection',async()=>{
    vi.useFakeTimers();let reject!:(error:Error)=>void;
    const source=new Promise<void>((_,no)=>{reject=no;});
    const result=waitForResource(source,100,'asset').catch(e=>e);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toMatchObject({name:'ResourceTimeoutError',code:'asset-timeout',retryable:true});
    reject(new Error('Late load error'));await Promise.resolve();expect(vi.getTimerCount()).toBe(0);
  });
  it('cleans its deadline and abort listener after success or cancellation',async()=>{
    vi.useFakeTimers();const abort=new AbortController(),remove=vi.spyOn(abort.signal,'removeEventListener');
    await expect(waitForResource(Promise.resolve(3),100,'asset',abort.signal)).resolves.toBe(3);
    expect(remove).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
    const pending=waitForResource(new Promise(()=>{}),100,'tracker',abort.signal).catch(e=>e);
    abort.abort();expect(await pending).toBe(abort.signal.reason);expect(vi.getTimerCount()).toBe(0);
  });
});
