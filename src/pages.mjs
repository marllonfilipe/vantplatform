import { readFile } from 'node:fs/promises';
const assets=new Map([['/',['index.html','text/html']],['/app.js',['app.js','text/javascript']],['/style.css',['style.css','text/css']],['/crm-schema.js',['crm-schema.js','text/javascript']],['/inbox.js',['inbox.js','text/javascript']],['/crm.js',['crm.js','text/javascript']]]);
export async function servePage(req,res,url) {
 const asset=assets.get(url.pathname);
 if (!asset || req.method!=='GET') return false;
 try {
   const bytes=await readFile(new URL('../public/'+asset[0],import.meta.url));
   res.setHeader('Content-Type',asset[1]+'; charset=utf-8');res.end(bytes);return true;
 } catch(error) { if(error.code==='ENOENT') return false; throw error; }
}
