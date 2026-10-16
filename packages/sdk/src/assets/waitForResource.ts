export class ResourceTimeoutError extends Error {
  readonly retryable=true;
  readonly code:'asset-timeout'|'tracker-timeout';
  constructor(readonly stage:'asset'|'tracker') {
    super(`${stage==='asset'?'Glasses asset':'Tracker'} loading timed out. Retry or choose another frame.`);
    this.name='ResourceTimeoutError';this.code=`${stage}-timeout`;
  }
}
/** Bound startup waiting without assigning a deadline to camera permission. */
export async function waitForResource<T>(promise:Promise<T>,timeoutMs:number,stage:'asset'|'tracker',signal?:AbortSignal):Promise<T> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  let onAbort:(()=>void)|undefined;
  try {
    return await Promise.race([promise,new Promise<never>((_,reject)=>{
      timer=setTimeout(()=>reject(new ResourceTimeoutError(stage)),timeoutMs);
      onAbort=()=>reject(signal?.reason??new DOMException('Resource waiting cancelled.','AbortError'));
      signal?.addEventListener('abort',onAbort,{once:true});
      if(signal?.aborted)onAbort();
    })]);
  } finally {if(timer!==undefined)clearTimeout(timer);if(onAbort)signal?.removeEventListener('abort',onAbort);}
}
