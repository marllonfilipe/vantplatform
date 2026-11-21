import { readFile } from 'node:fs/promises';
const assets=new Map([['/',['index.html','text/html']],['/app.js',['app.js','text/javascript']],['/style.css',['style.css','text/css']],['/crm-schema.js',['crm-schema.js','text/javascript']],['/inbox.js',['inbox.js','text/javascript']],['/memory.js',['memory.js','text/javascript']],['/copilot.js',['copilot.js','text/javascript']],['/copilot-questions.js',['copilot-questions.js','text/javascript']],['/supervision.js',['supervision.js','text/javascript']],['/automations.js',['automations.js','text/javascript']],['/prospect-people.js',['prospect-people.js','text/javascript']],['/prospecting.js',['prospecting.js','text/javascript']],['/revenue-forecast.js',['revenue-forecast.js','text/javascript']],['/revenue.js',['revenue.js','text/javascript']],['/crm.js',['crm.js','text/javascript']]]);
export async function servePage(req,res,url) {
 const asset=assets.get(url.pathname);
 if (!asset || req.method!=='GET') return false;
 try {
   const bytes=await readFile(new URL('../public/'+asset[0],import.meta.url));
   res.setHeader('Content-Type',asset[1]+'; charset=utf-8');res.end(bytes);return true;
 } catch(error) { if(error.code==='ENOENT') return false; throw error; }
}
