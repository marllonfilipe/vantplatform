import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';

export const model=JSON.parse(readFileSync(new URL('../core/model.json',import.meta.url),'utf8'));
export const modelVersion=model.repository+'@'+model.revision;
const queue=[];
let child,active;
function failure(code){return Object.assign(new Error(code),{code});}

function finish(error, vectors){
 if(!active)return;
 const task=active;
 clearTimeout(task.timer);
 active=null;
 if(error)task.reject(error);else task.resolve({vectors,latencyMs:Math.ceil(performance.now()-task.start)});
}
function schedule(){
 if(active||!queue.length)return;
 if(!child){
  const proc=spawn(process.env.VANT_PYTHON||'python3',['-u',fileURLToPath(new URL('../core/encode.py',import.meta.url))],{
   stdio:['pipe','pipe','inherit'],windowsHide:true,env:{...process.env,TOKENIZERS_PARALLELISM:'false'}
  });
  child=proc;
  function stopped(){if(child!==proc)return;child=null;finish(failure('model_unavailable'));schedule();}
  proc.once('error',stopped);proc.once('exit',stopped);proc.stdin.on('error',()=>proc.kill());
  createInterface({input:proc.stdout}).on('line',line=>{
   if(child!==proc||!active)return;
   try{
    const {vectors}=JSON.parse(line);
    if(!Array.isArray(vectors)||vectors.length!==active.texts.length||vectors.some(v=>v.length!==model.dimensions||!v.every(Number.isFinite)))throw Error();
    finish(null,vectors);
   }catch{finish(failure('model_response'));}
   schedule();
  });
 }
 active=queue.shift();
 active.timer=setTimeout(()=>{const proc=child;child=null;proc.kill();finish(failure('model_timeout'));schedule();},30000);
 child.stdin.write(JSON.stringify({texts:active.texts})+'\n');
}
export function embed(texts){
 if(!process.env.VANT_MODEL_ROOT)return Promise.reject(failure('model_unavailable'));
 if(!Array.isArray(texts)||!texts.length||texts.length>64||texts.some(s=>typeof s!=='string'||s.length>10000))return Promise.reject(failure('model_input'));
 if(queue.length>=8)return Promise.reject(failure('model_busy'));
 return new Promise((resolve,reject)=>{queue.push({texts,resolve,reject,start:performance.now()});schedule();});
}
export function stopInference(){
 for(const task of queue.splice(0))task.reject(failure('model_stopped'));
 const proc=child;child=null;proc?.kill();finish(failure('model_stopped'));
}
