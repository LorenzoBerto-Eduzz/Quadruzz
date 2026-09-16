const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_MANIFEST_BYTES = 64 * 1024;

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function extensionVersionFromZip(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = viewOf(bytes);
  const minimumEocd = 22;
  const searchStart = Math.max(0, bytes.length - minimumEocd - 65_535);
  let eocd = -1;
  for (let offset = bytes.length - minimumEocd; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('ZIP directory not found.');

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) throw new Error('Invalid ZIP directory.');
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)).replace(/^\.\//, '');
    if (name === 'manifest.json') {
      if (uncompressedSize > MAX_MANIFEST_BYTES || compressedSize > MAX_MANIFEST_BYTES) throw new Error('Extension manifest is too large.');
      if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) throw new Error('Invalid manifest entry.');
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      if (dataOffset + compressedSize > bytes.length) throw new Error('Incomplete manifest entry.');
      const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
      const manifestBytes = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : null;
      if (!manifestBytes || manifestBytes.length > MAX_MANIFEST_BYTES) throw new Error('Unsupported manifest compression.');
      const manifest = JSON.parse(decoder.decode(manifestBytes)) as { manifest_version?: unknown; version?: unknown };
      if ((manifest.manifest_version !== 3 && manifest.manifest_version !== 2) || typeof manifest.version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(manifest.version)) {
        throw new Error('The ZIP does not contain a valid Chrome extension manifest.');
      }
      return manifest.version;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error('The ZIP must contain manifest.json at its root.');
}
