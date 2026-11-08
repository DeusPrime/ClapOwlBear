import { stylizePixels } from "./clapImageStylePixels";
import { softenBackground } from "./backgroundFocus";

self.onmessage = event => {
  const { data, width, height, strength, focus, focusOnly } = event.data;
  const styled = focusOnly ? data : stylizePixels(data, width, height, strength);
  const output = focus ? softenBackground(styled, width, height, focus) : styled;
  self.postMessage(output, { transfer: [output.buffer] });
};
