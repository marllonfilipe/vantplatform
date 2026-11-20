import {embed} from './inference.mjs';
import {reject} from './http.mjs';

export function similarity(left,right){
 let dot=0,aa=0,bb=0;
 for(let i=0;i<left.length;i++){dot+=left[i]*right[i];aa+=left[i]*left[i];bb+=right[i]*right[i];}
 return Math.min(1,Math.max(0,dot/(Math.sqrt(aa*bb)||1)));
}

export async function prospectVectors(texts){
 try{return (await embed(texts)).vectors;}catch(e){reject(e.code==='model_busy'?429:503,e.code==='model_busy'?'model_busy':'model_unavailable','Não foi possível executar a classificação local.');}
}
