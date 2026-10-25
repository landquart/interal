// Installed family indices remain immutable while history/authority is unresolved.
// This is a process-local API fence, not a sandbox for arbitrary native programs.
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {resolve,dirname,relative,isAbsolute,basename,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const protectedRoots=['family-index-v5','family-index-v6'].map(x=>resolve(root,'associativvordes',x));
const realpath=fs.realpathSync;
function canonical(value){
 if(typeof value==='number')value=realpath(`/proc/self/fd/${value}`);
 if(value instanceof URL)value=fileURLToPath(value);
 let p=resolve(Buffer.isBuffer(value)?value.toString():String(value)),tail=[];
 while(true){try{return resolve(realpath(p),...tail.reverse());}catch(e){if(!['ENOENT','ENOTDIR'].includes(e.code))throw e;const parent=dirname(p);if(parent===p)throw e;tail.push(basename(p));p=parent;}}
}
const below=(p,q)=>{const r=relative(q,p);return r===''||(r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r));};
export function assertInstalledHistoryTarget(value,{ancestors=false}={}){
 const p=canonical(value);
 if(protectedRoots.some(q=>below(p,q)||(ancestors&&below(q,p))))throw new Error('HISTORY_BLOCKED: installed family-index data is immutable; reviewed exact scopes and certified controlled materialization are required');
}
const checked=(name,args)=>{
 if(name==='open'||name==='openSync'){
  const flag=args[1]??'r';if(typeof flag==='number'?(flag&(fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_TRUNC|fs.constants.O_APPEND)):String(flag).includes('+')||/[wa]/.test(flag))assertInstalledHistoryTarget(args[0]);return;
 }
 if(['rename','renameSync','link','linkSync','symlink','symlinkSync'].includes(name)){assertInstalledHistoryTarget(args[0],{ancestors:true});assertInstalledHistoryTarget(args[1],{ancestors:true});return;}
 if(['copyFile','copyFileSync','cp','cpSync'].includes(name)){assertInstalledHistoryTarget(args[1]);return;}
 assertInstalledHistoryTarget(args[0],{ancestors:['rm','rmSync','rmdir','rmdirSync','unlink','unlinkSync'].includes(name)});
};
const names=['writeFile','appendFile','rename','unlink','rm','rmdir','mkdir','copyFile','cp','link','symlink','truncate','chmod','open','write','writev','ftruncate','fchmod'];
for(const name of names){
 for(const key of [name,name+'Sync'])if(typeof fs[key]==='function'){
  const original=fs[key];fs[key]=function(...args){checked(key,args);return Reflect.apply(original,this,args);};
 }
 if(typeof fs.promises[name]==='function'){
  const original=fs.promises[name];fs.promises[name]=async function(...args){checked(name,args);return Reflect.apply(original,this,args);};
 }
}
const stream=fs.createWriteStream;fs.createWriteStream=function(...args){assertInstalledHistoryTarget(args[1]?.fd??args[0]);return Reflect.apply(stream,this,args);};
syncBuiltinESMExports();
