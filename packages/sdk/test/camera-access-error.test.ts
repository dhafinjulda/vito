import {describe,it,expect} from 'vitest';
import {CameraAccessError} from '../src/camera/CameraAccessError';
describe('camera acquisition classification',()=>{
  it.each([
    ['NotAllowedError','camera-access-blocked'],['SecurityError','camera-access-blocked'],
    ['NotFoundError','camera-not-found'],['NotReadableError','camera-unreadable'],
    ['OverconstrainedError','camera-unavailable'],['AbortError','camera-unavailable'],
  ])('classifies %s while preserving native context', (name,code)=>{
    const native=new DOMException('Native detail',name),error=CameraAccessError.from(native);
    expect(error).toBeInstanceOf(Error);expect(error.code).toBe(code);expect(error.name).toBe(name);
    expect(error.message).toBe(native.message);expect(error.cause).toBe(native);expect(error.retryable).toBe(true);
    expect(CameraAccessError.from(error)).toBe(error);
  });
  it('does not interpret unknown failures as permission denial',()=>{
    expect(CameraAccessError.from('failure')).toMatchObject({code:'camera-unavailable',message:'Camera acquisition failed.'});
    expect(new CameraAccessError('camera-unsupported')).toMatchObject({retryable:false,stage:'camera'});
  });
});
