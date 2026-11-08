import { recompressPng } from "./losslessImage";
self.onmessage = async event => {
  const bytes = new Uint8Array(event.data);
  try {
    const output = await recompressPng(bytes);
    self.postMessage(output.buffer, { transfer: [output.buffer as ArrayBuffer] });
  } catch { self.postMessage(bytes.buffer, { transfer: [bytes.buffer] }); }
};
