import {companiesUrl,hubspotConfig,readHubspot} from '../src/hubspot.mjs';

try {
  if(process.argv[2]==='--public'){
    const response=await fetch(companiesUrl(),{redirect:'error',signal:AbortSignal.timeout(10000)});
    await response.body?.cancel();
    if(response.status!==401)throw new Error('status');
    console.log('API de empresas respondeu HTTP 401 à consulta sem credencial.');
  }else if(process.argv[2]==='--authenticated'){
    const result=await readHubspot(hubspotConfig({access_token:process.env.VANT_HUBSPOT_CHECK}));
    console.log('Leitura autenticada concluída. Empresas retornadas: '+result.companies.length+'.');
  }else throw new Error('mode');
} catch(error) {
  const known=['access','quota','configuration','upstream','size'];
  console.error('Consulta não confirmada. Motivo: '+(known.includes(error.code)?error.code:'verificação'));
  process.exitCode=1;
}
