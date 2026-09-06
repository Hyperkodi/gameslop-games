export const BUILD = 'eduke32-ccf99ac-gs1';
export const saveName = name => /^(save\d{4}\.esv|eduke32\.cfg|settings\.cfg)$/i.test(name);
export class LocalStore {
  async open() {
    this.db = await new Promise((resolve,reject)=>{
      const req=indexedDB.open('gameslop-duke-browser-v1',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('files');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    return this;
  }
  get(key) {
    if(!this.db)return Promise.resolve(undefined);
    return new Promise((resolve,reject)=>{const req=this.db.transaction('files').objectStore('files').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  }
  put(key,value) {
    if(!this.db)return Promise.reject(new Error('Browser storage is unavailable. Export your saves before leaving.'));
    return new Promise((resolve,reject)=>{
      const tx=this.db.transaction('files','readwrite'),store=tx.objectStore('files');
      if(value===undefined)store.delete(key);else store.put(value,key);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage was cancelled.'));
    });
  }
}
export function encodeSaves(profile,files) {
  const result={version:1,build:BUILD,profile,files:{}};
  for(const [name,bytes] of Object.entries(files)) {
    if(!saveName(name))continue;
    let binary='';
    for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
    result.files[name]=btoa(binary);
  }
  return JSON.stringify(result);
}
export function decodeSaves(text,profile) {
  if(text.length>48*1024*1024)throw new Error('Save backup is too large (48 MB maximum).');
  const data=JSON.parse(text);
  if(data.version!==1||data.build!==BUILD||data.profile!==profile||!data.files||typeof data.files!=='object'||Array.isArray(data.files)) throw new Error('This backup belongs to a different game edition or engine build.');
  const result={};let total=0;
  if(Object.keys(data.files).length>100)throw new Error('Too many save files.');
  for(const [name,encoded] of Object.entries(data.files)) {
    if(!saveName(name)||typeof encoded!=='string')throw new Error('The backup contains an unexpected file.');
    const binary=atob(encoded);total+=binary.length;
    if(total>32*1024*1024)throw new Error('Save backup exceeds 32 MB of data.');
    result[name]=Uint8Array.from(binary,c=>c.charCodeAt(0));
  }
  return result;
}
