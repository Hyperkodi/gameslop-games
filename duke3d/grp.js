const table = Uint32Array.from({length:256}, (_, n) => {
  for (let i=0;i<8;i++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export const EDITIONS = {
  '983ad923': 'Shareware · L.A. Meltdown',
  'bbc9ce44': 'Duke Nukem 3D · v1.3D',
  'f514a6ac': 'Plutonium Pak · v1.4',
  'fd3dcff1': 'Atomic Edition · v1.5'
};
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8,'0');
}
export function inspectGrp(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 16 || buffer.byteLength > 50*1024*1024) throw new Error('Choose an original DUKE3D.GRP file, up to 50 MB.');
  const bytes = new Uint8Array(buffer), text = new TextDecoder('ascii'), view = new DataView(buffer);
  if (text.decode(bytes.subarray(0,12)) !== 'KenSilverman') throw new Error('That is not a GRP game archive. Extract DUKE3D.GRP from your game download first.');
  const count = view.getUint32(12,true);
  let size = 16+16*count;
  if (size > bytes.length) throw new Error('The archive directory is incomplete. Please copy the file again.');
  const names = new Set();
  for(let i=0;i<count;i++) {
    const offset=16+i*16;
    const name=text.decode(bytes.subarray(offset,offset+12)).replace(/\0.*$/,'');
    if (!/^[A-Za-z0-9_.!+-]+$/.test(name) || names.has(name.toUpperCase())) throw new Error('The archive contains invalid or duplicate file entries.');
    names.add(name.toUpperCase()); size+=view.getUint32(offset+12,true);
  }
  if(size!==bytes.length || !names.has('E1L1.MAP') || !names.has('GAME.CON')) throw new Error('This is an incomplete game file or an add-on. Choose the original DUKE3D.GRP.');
  const crc=crc32(bytes), label=EDITIONS[crc];
  if(!label) throw new Error('This edition is not supported yet. Use the v1.3D shareware, original v1.3D, or Atomic Edition GRP.');
  return {crc,label,size:bytes.length};
}
