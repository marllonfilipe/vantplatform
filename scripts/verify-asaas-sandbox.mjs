const mode=process.argv[2];
const endpoint='https://api-sandbox.asaas.com/v3/myAccount/status/';
const headers={'User-Agent':'V4NT-Platform/1.0','Accept':'application/json'};

async function verify(){
  if(!['--public','--authenticated'].includes(mode))throw new Error('Escolha --public ou --authenticated.');
  if(mode==='--authenticated'){
    const key=process.env.VANT_ASAAS_SANDBOX_API_KEY;
    if(!key)throw new Error('Configure a chave de sandbox no ambiente de homologação.');
    if(key.startsWith('$aact_prod_'))throw new Error('A consulta aceita somente uma chave do sandbox.');
    headers.access_token=key;
  }
  let response;
  try{
    response=await fetch(endpoint,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(10000)});
  }catch{throw new Error('A consulta HTTPS ao sandbox não foi concluída.');}
  if(mode==='--public'){
    await response.body?.cancel();
    if(response.status!==401)throw new Error('Resposta pública inesperada do sandbox (HTTP '+response.status+').');
    console.log('O sandbox respondeu HTTP 401 à consulta sem credencial. A autenticação permanece por verificar.');
    return;
  }
  if(response.status!==200){
    await response.body?.cancel();
    throw new Error('O sandbox rejeitou a consulta autenticada (HTTP '+response.status+').');
  }
  let status;
  try{status=(await response.json()).general;}catch{throw new Error('Resposta cadastral ilegível.');}
  if(typeof status!=='string'||!status.trim())throw new Error('A resposta não identificou a situação cadastral da conta.');
  console.log('O sandbox confirmou a consulta autenticada da situação cadastral (HTTP 200).');
}

try{await verify();}catch(error){console.error(error.message);process.exitCode=1;}
