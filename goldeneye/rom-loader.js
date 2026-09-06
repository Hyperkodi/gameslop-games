'use strict';
// No upload endpoint: read, validate and transform the selected bytes locally.
window.GoldenEyeRom = (()=>{
  const SIZE=12582912;
  const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  async function unzip(bytes){
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
      if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===bytes.length){end=i;break;}
    }
    if(end<0)throw Error('This ZIP is incomplete or unsupported. Select the extracted .z64 file instead.');
    if(v.getUint16(end+4,true)||v.getUint16(end+6,true))throw Error('Split ZIP files are not supported.');
    const count=v.getUint16(end+10,true),candidates=[];
    let p=v.getUint32(end+16,true);
    for(let i=0;i<count;i++){
      if(p+46>end||v.getUint32(p,true)!==0x02014b50)throw Error('Invalid ZIP directory.');
      const nameLength=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true);
      if(p+46+nameLength+extra+comment>end)throw Error('Invalid ZIP entry.');
      const name=new TextDecoder().decode(bytes.subarray(p+46,p+46+nameLength));
      if(/\.z64$/i.test(name))candidates.push({flags:v.getUint16(p+8,true),method:v.getUint16(p+10,true),packed:v.getUint32(p+20,true),size:v.getUint32(p+24,true),offset:v.getUint32(p+42,true)});
      p+=46+nameLength+extra+comment;
    }
    if(candidates.length!==1)throw Error('Choose a ZIP containing one GoldenEye USA .z64 file.');
    const entry=candidates[0],o=entry.offset;
    if(entry.flags&1||entry.size!==SIZE||o+30>bytes.length||v.getUint32(o,true)!==0x04034b50)throw Error('This ZIP does not contain a supported GoldenEye USA game.');
    const start=o+30+v.getUint16(o+26,true)+v.getUint16(o+28,true);
    if(start+entry.packed>bytes.length)throw Error('The game file in this ZIP is incomplete.');
    const compressed=bytes.subarray(start,start+entry.packed);
    if(entry.method===0){if(compressed.length!==SIZE)throw Error('Invalid game size.');return compressed;}
    if(entry.method!==8)throw Error('Extract the ZIP and select its .z64 file.');
    let stream;
    try{stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}
    catch{throw Error('This browser needs the extracted .z64 file. Unzip your game and select it.');}
    const reader=stream.getReader(),output=new Uint8Array(SIZE);let length=0;
    try{
      while(true){const {value,done}=await reader.read();if(done)break;if(length+value.length>SIZE)throw Error('Invalid expanded game size.');output.set(value,length);length+=value.length;}
    }finally{await reader.cancel().catch(()=>{});}
    if(length!==SIZE)throw Error('Incomplete game data.');
    return output;
  }
  async function patch(original,delta,manifest){
    if(manifest?.schema!==1||manifest.size!==SIZE||original.length!==SIZE||await sha(original)!==manifest.original)throw Error('Please select the original GoldenEye 007 (USA) .z64 or ZIP. Other regions and already modified ROMs are not supported.');
    if(await sha(delta)!==manifest.patch)throw Error('The Gameslop update failed verification. Reload and try again.');
    const v=new DataView(delta.buffer,delta.byteOffset,delta.byteLength);
    if(delta.length<12||new TextDecoder().decode(delta.subarray(0,8))!=='SLOPGE01'||v.getUint32(8)!==SIZE)throw Error('Invalid Gameslop patch.');
    const output=original.slice();let p=12,lastEnd=0,records=0;
    while(p<delta.length){
      if(p+8>delta.length)throw Error('Truncated patch record.');
      const offset=v.getUint32(p),length=v.getUint32(p+4);p+=8;
      if(!length||offset<lastEnd||offset+length>SIZE||p+length>delta.length)throw Error('Invalid patch range.');
      output.set(delta.subarray(p,p+length),offset);p+=length;lastEnd=offset+length;records++;
    }
    if(records!==manifest.records||await sha(output)!==manifest.patched)throw Error('The patched game failed verification. Reload and try again.');
    return output;
  }
  return {sha,unzip,patch};
})();

if(typeof document!=='undefined'){
  const input=document.getElementById('rom-file'),play=document.getElementById('play'),note=document.getElementById('file-status');
  let request=0;
  window.GoldenEyePublic=null;
  input.addEventListener('change',async()=>{
    const current=++request,file=input.files[0];play.disabled=true;
    if(window.GoldenEyePublic)URL.revokeObjectURL(window.GoldenEyePublic.gameUrl);
    window.GoldenEyePublic=null;
    if(!file){note.textContent='Select your GoldenEye USA game file to play.';return;}
    try{
      if(file.size>32*1024*1024)throw Error('Choose the GoldenEye USA ZIP or .z64 file (up to 32 MB).');
      note.textContent='Checking your game and applying Gameslop artwork…';
      let bytes=new Uint8Array(await file.arrayBuffer());
      if(/\.zip$/i.test(file.name))bytes=await GoldenEyeRom.unzip(bytes);
      else if(!/\.z64$/i.test(file.name))throw Error('Select a .zip or .z64 file.');
      const [manifestResponse,patchResponse]=await Promise.all([fetch('patch-manifest.json',{cache:'no-store'}),fetch('gameslop.patch')]);
      if(!manifestResponse.ok||!patchResponse.ok)throw Error('Could not load the Gameslop update. Check your connection and try again.');
      const manifest=await manifestResponse.json(),delta=new Uint8Array(await patchResponse.arrayBuffer());
      const output=await GoldenEyeRom.patch(bytes,delta,manifest);
      if(current!==request)return;
      window.GoldenEyePublic={gameUrl:URL.createObjectURL(new Blob([output],{type:'application/octet-stream'})),sha256:manifest.patched};
      note.textContent='Ready. Gameslop characters, menus, and mouse controls are enabled.';play.disabled=false;
    }catch(error){if(current===request)note.textContent=error.message;}
  });
}
