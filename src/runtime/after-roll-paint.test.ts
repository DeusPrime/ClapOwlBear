// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {afterRollPaint} from './after-roll-paint';
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
it('lets the local animation paint before publishing and publishes once',()=>{
  vi.useFakeTimers();const frames:FrameRequestCallback[]=[];vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>{frames.push(fn);return frames.length;});vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});const publish=vi.fn();afterRollPaint(publish);expect(publish).not.toHaveBeenCalled();frames[0](0);expect(publish).not.toHaveBeenCalled();frames[1](16);expect(publish).toHaveBeenCalledTimes(1);vi.runAllTimers();expect(publish).toHaveBeenCalledTimes(1);
});
it('still publishes once if a hidden panel never receives animation frames',()=>{
  vi.useFakeTimers();const frames:FrameRequestCallback[]=[];vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>{frames.push(fn);return frames.length;});vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});const publish=vi.fn();afterRollPaint(publish);vi.advanceTimersByTime(100);expect(publish).toHaveBeenCalledTimes(1);frames[0](100);frames[1](116);expect(publish).toHaveBeenCalledTimes(1);
});
