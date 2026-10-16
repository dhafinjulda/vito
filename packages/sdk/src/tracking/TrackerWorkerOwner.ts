/** One session owns one tracker worker, across startup and recovery.
 * Release detaches callbacks before termination. Releasing an obsolete worker
 * cannot terminate its replacement. No camera or model data is retained here.
 */
import {TrackerStartup} from './TrackerStartup';
import {TrackerConnection} from './TrackerConnection';
export class TrackerWorkerOwner {
  private active:Worker|null=null;
  private startup:TrackerStartup|null=null;
  constructor(private readonly factory:()=>Worker) {}
  get current():Worker|null {return this.active;}
  acquire():Worker {
    this.release();
    const worker=this.factory();
    this.active=worker;
    return worker;
  }
  beginStartup(worker:Worker,timeoutMs:number,optionalTimeoutMs:number):TrackerStartup {
    if(worker!==this.active)throw new Error('Cannot initialize an obsolete tracker worker.');
    this.startup?.fail(new Error('Tracker startup replaced.'));
    return this.startup=new TrackerStartup(timeoutMs,optionalTimeoutMs);
  }
  connect(worker:Worker,startup:TrackerStartup):TrackerConnection {
    if(worker!==this.active||startup!==this.startup)throw new Error('Cannot connect an obsolete tracker startup.');
    return new TrackerConnection(worker,startup,()=>this.active===worker&&this.startup===startup);
  }
  release(expected:Worker|null=this.active):void {
    if(!expected||expected!==this.active)return;
    this.active=null;
    this.startup?.fail(new Error('Camera session stopped while the tracker was starting.'));
    this.startup=null;
    expected.onmessage=null;
    expected.onerror=null;
    expected.onmessageerror=null;
    expected.terminate();
  }
}
