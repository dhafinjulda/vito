export type CameraErrorCode='camera-access-blocked'|'camera-not-found'|'camera-unreadable'|'camera-unsupported'|'camera-unavailable';

/** Camera acquisition failure only; permission prompts remain untimed.
 * Native name/message are preserved for existing integrations; cause is original.
 */
export class CameraAccessError extends Error {
  readonly stage='camera';
  readonly retryable:boolean;
  constructor(readonly code:CameraErrorCode,cause?:unknown) {
    const native=cause&&typeof cause==='object'?cause as {name?:unknown;message?:unknown}:undefined;
    super(typeof native?.message==='string'?native.message:code==='camera-unsupported'?'Camera access requires HTTPS or localhost and a supported browser.':'Camera acquisition failed.',{cause});
    this.name=typeof native?.name==='string'&&native.name?native.name:'CameraAccessError';
    this.retryable=code!=='camera-unsupported';
  }
  static from(error:unknown):CameraAccessError {
    if(error instanceof CameraAccessError)return error;
    const name=error&&typeof error==='object'?(error as {name?:unknown}).name:undefined;
    const code:CameraErrorCode=name==='NotAllowedError'||name==='SecurityError'?'camera-access-blocked':name==='NotFoundError'?'camera-not-found':name==='NotReadableError'?'camera-unreadable':'camera-unavailable';
    return new CameraAccessError(code,error);
  }
}
