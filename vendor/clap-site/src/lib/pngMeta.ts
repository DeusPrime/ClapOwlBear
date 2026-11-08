// Read/write tEXt chunks in PNG files (for embedding character JSON).
import { MAX_IMPORT_BYTES, MAX_PAYLOAD_LENGTH } from "./dataValidation";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

const isPng = (b: Uint8Array) => PNG_SIG.every((v, i) => b[i] === v);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const buildTextChunk = (keyword: string, text: string): Uint8Array => {
  const keyB = textEncoder.encode(keyword);
  const txtB = textEncoder.encode(text);
  const data = new Uint8Array(keyB.length + 1 + txtB.length);
  data.set(keyB, 0);
  data[keyB.length] = 0;
  data.set(txtB, keyB.length + 1);

  const type = textEncoder.encode("tEXt");
  const len = data.length;
  const chunk = new Uint8Array(4 + 4 + len + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, len);
  chunk.set(type, 4);
  chunk.set(data, 8);
  const crcInput = new Uint8Array(4 + len);
  crcInput.set(type, 0);
  crcInput.set(data, 4);
  dv.setUint32(8 + len, crc32(crcInput));
  return chunk;
};

export const writePngText = async (blob: Blob, keyword: string, text: string): Promise<Blob> => {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (!isPng(buf)) throw new Error("Not a PNG");
  // Find IEND chunk position
  let pos = 8;
  let iendPos = -1;
  while (pos + 12 <= buf.length) {
    const len = new DataView(buf.buffer, buf.byteOffset + pos, 4).getUint32(0);
    if (len > buf.length - pos - 12) throw new Error("PNG invalide.");
    const type = textDecoder.decode(buf.subarray(pos + 4, pos + 8));
    if (type === "IEND") {
      iendPos = pos;
      break;
    }
    pos += 12 + len;
  }
  if (iendPos < 0) throw new Error("IEND not found");
  const chunk = buildTextChunk(keyword, text);
  const out = new Uint8Array(buf.length + chunk.length);
  out.set(buf.subarray(0, iendPos), 0);
  out.set(chunk, iendPos);
  out.set(buf.subarray(iendPos), iendPos + chunk.length);
  return new Blob([out], { type: "image/png" });
};

export const readPngText = async (blob: Blob, keyword: string): Promise<string | null> => {
  if (blob.size > MAX_IMPORT_BYTES) return null;
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (!isPng(buf)) return null;
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const len = new DataView(buf.buffer, buf.byteOffset + pos, 4).getUint32(0);
    if (len > buf.length - pos - 12) return null;
    const type = textDecoder.decode(buf.subarray(pos + 4, pos + 8));
    if (type === "tEXt") {
      if (len > MAX_PAYLOAD_LENGTH) return null;
      const storedCrc = new DataView(buf.buffer, buf.byteOffset + pos + 8 + len, 4).getUint32(0);
      if (crc32(buf.subarray(pos + 4, pos + 8 + len)) !== storedCrc) return null;
      const data = buf.subarray(pos + 8, pos + 8 + len);
      const zero = data.indexOf(0);
      if (zero > 0) {
        const k = textDecoder.decode(data.subarray(0, zero));
        if (k === keyword) return textDecoder.decode(data.subarray(zero + 1));
      }
    }
    if (type === "IEND") break;
    pos += 12 + len;
  }
  return null;
};
