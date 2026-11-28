import {rdStationConfig,readRdStation} from '../src/rd-station.mjs';

try {
  const config=rdStationConfig(JSON.parse(process.env.VANT_RD_STATION_CHECK??'null'));
  const preview=await readRdStation(config);
  console.log('Consulta autenticada concluída. Organizações retornadas: '+preview.organizations.length+'.');
} catch(error) {
  const categories=['access','quota','configuration','upstream','size'];
  console.error('Consulta não confirmada. Motivo: '+(categories.includes(error.code)?error.code:'configuration'));
  process.exitCode=1;
}
