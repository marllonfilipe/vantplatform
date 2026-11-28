import {kommoConfig,readKommo} from '../src/kommo.mjs';

try {
  const config=kommoConfig(JSON.parse(process.env.VANT_KOMMO_CHECK??'null'));
  const preview=await readKommo(config);
  console.log('Consulta autenticada concluída. Empresas retornadas: '+preview.companies.length+'.');
} catch(error) {
  const categories=['access','quota','configuration','upstream','size'];
  console.error('Consulta não confirmada. Motivo: '+(categories.includes(error.code)?error.code:'configuration'));
  process.exitCode=1;
}
