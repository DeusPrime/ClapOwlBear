// Recompress PNG scanlines directly. No canvas, colour conversion, resizing,
// metadata removal, or decoding/re-encoding of pixel values is involved.
const MAX_RAW_BYTES = 64 * 1024 * 1024;
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
async function readBounded(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_RAW_BYTES) { await reader.cancel(); throw new Error("PNG trop grand pour l’optimisation."); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes;
}

export async function recompressPng(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined" || typeof DecompressionStream === "undefined") return bytes;
  if (bytes.length < 33 || ![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return bytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: { start: number; end: number; type: string }[] = [];
  const compressedParts: Uint8Array[] = [];
  let compressedLength = 0, ended = false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset);
    const end = offset + length + 12;
    if (end > bytes.length) return bytes;
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === "acTL" || type === "fdAT") return bytes; // Preserve animations intact.
    if (type === "IHDR") {
      if (length !== 13) return bytes;
      const width = view.getUint32(offset + 8), height = view.getUint32(offset + 12);
      // Upper bound for 16-bit RGBA, including row filters.
      if (!width || !height || width * height * 8 + height > MAX_RAW_BYTES) return bytes;
    }
    if (view.getUint32(end - 4) !== crc32(bytes.subarray(offset + 4, end - 4))) return bytes;
    chunks.push({ start: offset, end, type });
    if (type === "IDAT") { compressedParts.push(bytes.subarray(offset + 8, end - 4)); compressedLength += length; }
    offset = end;
    if (type === "IEND") { ended = offset === bytes.length; break; }
  }
  if (!ended || !compressedParts.length || chunks[0]?.type !== "IHDR") return bytes;
  const compressed = new Uint8Array(compressedLength);
  let offset = 0;
  for (const part of compressedParts) { compressed.set(part, offset); offset += part.length; }
  const raw = await readBounded(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate")));
  const packed = await readBounded(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate")));
  const idatCount = compressedParts.length;
  if (packed.length + 12 >= compressedLength + idatCount * 12) return bytes;
  const idat = new Uint8Array(packed.length + 12);
  const idatView = new DataView(idat.buffer);
  idatView.setUint32(0, packed.length); idat.set([73, 68, 65, 84], 4); idat.set(packed, 8);
  idatView.setUint32(idat.length - 4, crc32(idat.subarray(4, idat.length - 4)));
  const output = new Uint8Array(bytes.length - compressedLength - idatCount * 12 + idat.length);
  output.set(bytes.subarray(0, 8)); offset = 8;
  let inserted = false;
  for (const chunk of chunks) {
    if (chunk.type === "IDAT") {
      if (!inserted) { output.set(idat, offset); offset += idat.length; inserted = true; }
    } else { output.set(bytes.subarray(chunk.start, chunk.end), offset); offset += chunk.end - chunk.start; }
  }
  return output;
}
