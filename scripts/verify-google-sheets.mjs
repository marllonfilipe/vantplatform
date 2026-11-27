import {readSheet,sheetConfig} from '../src/google-sheets.mjs';

try {
  if (!process.env.VANT_SHEETS_CHECK) throw new Error();
  const config = sheetConfig(JSON.parse(process.env.VANT_SHEETS_CHECK));
  const rows = await readSheet(config);
  console.log('Leitura autenticada concluída. Linhas retornadas: ' + rows.length + '.');
} catch (error) {
  const known = ['configuration','access','quota','upstream','size'];
  console.error('Leitura não confirmada. Motivo: ' + (known.includes(error.code)?error.code:'configuration'));
  process.exitCode = 1;
}
