import {reject} from './http.mjs';
export function leadCsv(input) {
 if(typeof input!=='string'||!input.trim()||Buffer.byteLength(input)>512000) reject(400,'csv','Informe um CSV de até 500 KB.');
 const text=input.replace(/^\uFEFF/,'');
 const separator=text.split(/\r?\n/,1)[0].includes(';')?';':',';
 const rows=[];let row=[],value='',quoted=false,closed=false;
 function field(){row.push(value.trim());value='';closed=false;}
 function line(){field();if(row.some(Boolean))rows.push(row);row=[];}
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c!=='"')value+=c;else if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}continue;}
  if(c===separator){field();continue;}
  if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;line();continue;}
  if(closed||(c==='"'&&value))reject(400,'csv','Aspas inválidas.');
  if(c==='"')quoted=true;else value+=c;
 }
 if(quoted)reject(400,'csv','Campo sem fechamento.');
 line();if(rows.length<2||rows.length>501)reject(400,'csv','Informe de 1 a 500 registros.');
 const aliases={nome:'name',email:'email',telefone:'phone',origem:'source',segmento:'segment',tags:'tags',observações:'notes',observacoes:'notes'};
 const cols=rows.shift().map(k=>Object.hasOwn(aliases,k.toLowerCase())?aliases[k.toLowerCase()]:null);
 if(!cols.includes('name')||cols.includes(null)||new Set(cols).size!==cols.length)reject(400,'csv','Cabeçalho inválido.');
 return rows.map((r,i)=>{
  if(r.length!==cols.length)reject(400,'csv','Confira a linha '+(i+2)+'.');
  const data=Object.fromEntries(cols.map((k,j)=>[k,r[j]]));data.source||='Importação CSV';
  if(data.tags!==undefined)data.tags=data.tags.split('|').map(s=>s.trim()).filter(Boolean);
  return data;
 });
}
