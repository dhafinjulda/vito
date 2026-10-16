import type {WorkerRequest,WorkerResponse} from './protocol';
import type {TrackerStartup} from './TrackerStartup';

interface Handlers {
  onMessage(event:MessageEvent<WorkerResponse>):void;
  onError(error:Error):void;
}

/** Camera-independent transport with explicit callback handoff, no packet queue. */
export class TrackerConnection {
  private handlers:Handlers;
  private started=false;
  constructor(private readonly worker:Worker,private readonly startup:TrackerStartup,private readonly isCurrent:()=>boolean) {
    this.handlers={onMessage:()=>{},onError:error=>startup.fail(error)};
    worker.onmessage=event=>{if(isCurrent())this.handlers.onMessage(event);};
    worker.onerror=()=>{if(isCurrent())this.handlers.onError(new Error('Face tracking worker failed.'));};
    worker.onmessageerror=()=>{if(isCurrent())this.handlers.onError(new Error('Face tracking worker message could not be decoded.'));};
  }
  setHandlers(handlers:Handlers):boolean {
    if(!this.isCurrent())return false;
    this.handlers=handlers;return true;
  }
  start(request:Extract<WorkerRequest,{type:'init'}>):Promise<void> {
    if(!this.isCurrent()){this.startup.fail(new Error('Tracker connection is no longer active.'));return this.startup.ready;}
    if(!this.started){
      this.started=true;
      try {this.worker.postMessage(request);}
      catch(error){this.startup.fail(error instanceof Error?error:new Error('Could not initialize tracker worker.'));}
    }
    return this.startup.ready;
  }
}
