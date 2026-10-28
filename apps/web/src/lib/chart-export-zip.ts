/** Uncompressed ZIP: PNGs are already compressed. All filenames are ASCII. */
export function chartImagesZip(files: Array<{ name: string; bytes: Uint8Array }>): Blob {
  const chunks: BlobPart[] = [];
  const directory: ArrayBuffer[] = [];
  let offset = 0;
  let directorySize = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    let crc = 0xffffffff;
    for (const byte of file.bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true);
    l.setUint16(12, 33, true); l.setUint32(14, crc, true);
    l.setUint32(18, file.bytes.length, true); l.setUint32(22, file.bytes.length, true);
    l.setUint16(26, name.length, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint16(14, 33, true); c.setUint32(16, crc, true);
    c.setUint32(20, file.bytes.length, true); c.setUint32(24, file.bytes.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
    chunks.push(local, new Uint8Array(file.bytes).buffer);
    directory.push(central.buffer); directorySize += central.length;
    offset += local.length + file.bytes.length;
  }
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, end], { type: "application/zip" });
}
