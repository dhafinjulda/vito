import {ResourceTimeoutError} from '../assets/waitForResource';
import {TRACKER_PROTOCOL_VERSION} from './protocol';

/** Bounded startup wait, shared by camera-free preparation and active startup. */
export class TrackerStartup {
  readonly ready:Promise<void>;
  private resolve!:()=>void;
  private reject!:(error:Error)=>void;
  private settled=false;
  private totalTimer:ReturnType<typeof setTimeout>;
  private optionalTimer:ReturnType<typeof setTimeout>|null=null;
  private stages=new Set<'hand'|'hair'>();
  constructor(timeoutMs:number,private readonly optionalTimeoutMs:number) {
    this.ready=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});
    // Release may reject before the caller reaches its await (e.g. reentrant stop).
    void this.ready.catch(()=>{});
    this.totalTimer=setTimeout(()=>this.fail(new ResourceTimeoutError('tracker')),timeoutMs);
  }
  validateReady(version:number):boolean {
    if(this.settled)return false;
    if(version!==TRACKER_PROTOCOL_VERSION){this.fail(new Error('Tracker runtime version does not match the SDK. Reload the page to load the current worker.'));return false;}
    return true;
  }
  armOptional(stage:'hand'|'hair'):void {
    if(this.settled||this.stages.has(stage))return;
    this.stages.add(stage);this.clearOptional();
    this.optionalTimer=setTimeout(()=>this.fail(new Error(`Optional ${stage} startup timed out.`)),this.optionalTimeoutMs);
  }
  clearOptional():void {if(this.optionalTimer!==null)clearTimeout(this.optionalTimer);this.optionalTimer=null;}
  complete():void {if(!this.finish())return;this.resolve();}
  fail(error:Error):void {if(!this.finish())return;this.reject(error);}
  private finish():boolean {
    if(this.settled)return false;
    this.settled=true;clearTimeout(this.totalTimer);this.clearOptional();this.stages.clear();return true;
  }
}
