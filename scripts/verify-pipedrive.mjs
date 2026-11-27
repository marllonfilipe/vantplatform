import {pipedriveConfig,readPipedrive} from '../src/pipedrive.mjs';

try {
  const config=pipedriveConfig(JSON.parse(process.env.VANT_PIPEDRIVE_CHECK??'null'));
  const preview=await readPipedrive(config);
  console.log('Consulta autenticada concluída. Organizações retornadas: '+preview.organizations.length+'.');
} catch(error) {
  const categories=['access','quota','configuration','upstream','size'];
  console.error('Consulta não confirmada. Motivo: '+(categories.includes(error.code)?error.code:'configuration'));
  process.exitCode=1;
}
