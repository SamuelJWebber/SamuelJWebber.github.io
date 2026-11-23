// Minimal MP4/MOV metadata reader: creation time, duration, and GPS (©xyz / ISO 6709).
// Reads only box headers and the moov box, never the whole file.
async function readMp4Meta(file) {
  const out = { created: null, durationSec: null, lat: null, lon: null };
  const size = file.size;
  const rd = async (pos, len) => new DataView(await file.slice(pos, Math.min(size, pos + len)).arrayBuffer());
  let pos = 0, moov = null, guard = 0;
  while (pos + 8 <= size && guard++ < 200) {
    const h = await rd(pos, 16);
    let boxSize = h.getUint32(0);
    const type = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7));
    let header = 8;
    if (boxSize === 1) { boxSize = Number(h.getBigUint64(8)); header = 16; }
    else if (boxSize === 0) boxSize = size - pos;
    if (boxSize < header) break;
    if (type === 'moov') {
      if (boxSize > 64 * 1024 * 1024) break;
      moov = new Uint8Array(await file.slice(pos, pos + boxSize).arrayBuffer());
      break;
    }
    pos += boxSize;
  }
  if (!moov) return out;
  const dv = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
  const find = (sig, from = 0) => {
    outer: for (let i = from; i <= moov.length - sig.length; i++) {
      for (let j = 0; j < sig.length; j++) if (moov[i + j] !== sig[j]) continue outer;
      return i;
    }
    return -1;
  };
  const mvhd = find([0x6d, 0x76, 0x68, 0x64]); // 'mvhd'
  if (mvhd > 0) {
    const v = moov[mvhd + 4], b = mvhd + 8;
    const EPOCH_1904 = Date.UTC(1904, 0, 1);
    let created, timescale, duration;
    if (v === 1) { created = Number(dv.getBigUint64(b)); timescale = dv.getUint32(b + 16); duration = Number(dv.getBigUint64(b + 20)); }
    else { created = dv.getUint32(b); timescale = dv.getUint32(b + 8); duration = dv.getUint32(b + 12); }
    if (created > 0) {
      const d = new Date(EPOCH_1904 + created * 1000);
      if (d.getUTCFullYear() > 2005 && d.getUTCFullYear() < 2100) out.created = d;
    }
    if (timescale) out.durationSec = duration / timescale;
  }
  // GPS as ISO 6709 text: Android writes it in a ©xyz box, iPhone in a quicktime location key.
  const text = new TextDecoder('latin1').decode(moov);
  const m = text.match(/([+-]\d{1,2}\.\d{3,})([+-]\d{1,3}\.\d{3,})/);
  if (m) { out.lat = parseFloat(m[1]); out.lon = parseFloat(m[2]); return out; }
  // Android wipes the type and contents of the location box (©xyz, loci) when it strips location:
  // look for a child of 'udta' whose type and payload are all zero bytes
  const ud = find([0x75, 0x64, 0x74, 0x61]);
  if (ud >= 4) {
    const udSize = dv.getUint32(ud - 4); let p = ud + 4; const stop = Math.min(moov.length, ud - 4 + udSize);
    while (p + 8 <= stop) {
      const size = dv.getUint32(p); if (size < 8 || p + size > stop) break;
      const typeZero = moov[p + 4] === 0 && moov[p + 5] === 0 && moov[p + 6] === 0 && moov[p + 7] === 0;
      if (typeZero && size >= 12 && size <= 64) { let allZero = true; for (let q = p + 8; q < p + size; q++) if (moov[q] !== 0) { allZero = false; break; } if (allZero) { out.locationBlanked = true; break; } }
      p += size;
    }
  }
  // 3GPP 'loci' box: fixed-point 16.16 longitude, latitude after a place-name string.
  const li = find([0x6c, 0x6f, 0x63, 0x69]);
  if (li > 0) {
    let p = li + 4 + 4 + 2;
    while (p < moov.length && moov[p] !== 0) p++;
    p += 2; // string terminator + role byte
    if (p + 8 <= moov.length) {
      const lon = dv.getInt32(p) / 65536, lat = dv.getInt32(p + 4) / 65536;
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat || lon)) { out.lat = lat; out.lon = lon; }
    }
  }
  return out;
}
if (typeof module !== 'undefined') module.exports = { readMp4Meta };
