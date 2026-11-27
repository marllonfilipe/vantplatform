import {reserveInference,settleInference} from './inference-usage.mjs';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';

export const model=JSON.parse(readFileSync(new URL('../core/model.json',import.meta.url),'utf8'));
export const modelVersion=model.repository+'@'+model.revision;
const queue=[];
let child,active;
let admissions=0, generation=0;
function failure(code){
 console.warn(JSON.stringify({event:'core.inference.failure',code,model:modelVersion,queued:queue.length}));
 return Object.assign(new Error(code),{code});
}
function workerEnvironment(){
 const env={TOKENIZERS_PARALLELISM:'false'};
 for(const key of ['PATH','LANG','LC_ALL','LC_CTYPE','SYSTEMROOT','WINDIR','TMP','TEMP','TMPDIR','LD_LIBRARY_PATH','VIRTUAL_ENV','VANT_MODEL_ROOT','VANT_MODEL_THREADS']){
  if(process.env[key]!==undefined)env[key]=process.env[key];
 }
 return env;
}

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
   stdio:['pipe','pipe','inherit'],windowsHide:true,env:workerEnvironment()
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
// O catálogo fixo do copiloto é compartilhado entre empresas e aquecido uma vez por processo.
export function embedSharedTemplates(texts){return encodeBatch(texts,false);}
export function embed(texts){return encodeBatch(texts,true);}

async function encodeBatch(texts,metered){
 if(!process.env.VANT_MODEL_ROOT)throw failure('model_unavailable');
 if(!Array.isArray(texts)||!texts.length||texts.length>64||texts.some(s=>typeof s!=='string'||s.length>10000))throw failure('model_input');
 // Uma inferência ativa e oito na fila, incluindo as reservas em curso.
 if(queue.length+admissions+(active?1:0)>=9)throw failure('model_busy');
 const epoch=generation;
 let batch;
 if(metered){
  admissions++;
  try{batch=await reserveInference(texts.length,modelVersion);}finally{admissions--;}
 }
 let result;
 try{
  if(epoch!==generation)throw failure('model_stopped');
  result=await new Promise((resolve,reject)=>{queue.push({texts,resolve,reject,start:performance.now()});schedule();});
 }catch(error){
  await settleInference(batch,'failed');
  throw error;
 }
 // Se a confirmação no banco falhar, a reserva segue pendente para conciliação.
 await settleInference(batch,'completed');
 return result;
}
export function stopInference(){
 generation++;
 for(const task of queue.splice(0))task.reject(failure('model_stopped'));
 const proc=child;child=null;proc?.kill();finish(failure('model_stopped'));
}
