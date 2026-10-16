import {describe,it,expect} from 'vitest';
import {StartupMetrics} from '../src/diagnostics/StartupMetrics';

describe('local startup timing',()=>{
  it('separates camera waiting, asset wait and first fit submission',()=>{
    const metrics=new StartupMetrics(true);metrics.reset(100);
    metrics.cameraRequested(110);metrics.cameraAcquired(1110);
    metrics.assetWaiting(1120);metrics.assetReady(1320);metrics.trackerReady(1520);
    expect(metrics.snapshot()).toEqual({cameraPendingMs:1000,assetWaitMs:200,trackerReadyMs:1420,firstFitSubmissionMs:null});
    metrics.fitSubmitted(1600);metrics.fitSubmitted(1900);metrics.trackerReady(2000);
    expect(metrics.snapshot()?.firstFitSubmissionMs).toBe(1500);
    expect(metrics.snapshot()?.trackerReadyMs).toBe(1420);
    const copy=metrics.snapshot()!;copy.assetWaitMs=99;expect(metrics.snapshot()?.assetWaitMs).toBe(200);
  });
  it('does not invent fit submission before tracker ready and clears attempts',()=>{
    const metrics=new StartupMetrics(true);metrics.reset(0);metrics.fitSubmitted(10);
    expect(metrics.snapshot()?.firstFitSubmissionMs).toBeNull();metrics.trackerReady(20);metrics.fitSubmitted(30);
    metrics.reset();expect(Object.values(metrics.snapshot()!)).toEqual([null,null,null,null]);
    metrics.reset(100);expect(metrics.snapshot()?.trackerReadyMs).toBeNull();
  });
  it('does not expose diagnostics when unsubscribed',()=>{
    const metrics=new StartupMetrics(false);metrics.reset(0);metrics.cameraRequested(1);metrics.cameraAcquired(2);metrics.trackerReady(3);metrics.fitSubmitted(4);
    expect(metrics.snapshot()).toBeUndefined();
  });
});
