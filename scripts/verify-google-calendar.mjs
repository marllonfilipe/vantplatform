import {readCalendar,calendarConfig} from '../src/google-calendar.mjs';

try {
  if (!process.env.VANT_CALENDAR_CHECK) throw new Error();
  const config = calendarConfig(JSON.parse(process.env.VANT_CALENDAR_CHECK));
  const preview = await readCalendar(config);
  console.log('Leitura autenticada concluída. Eventos retornados: ' + preview.events.length + '.');
} catch (error) {
  const known = ['configuration','access','quota','upstream','size'];
  console.error('Leitura não confirmada. Motivo: ' + (known.includes(error.code)?error.code:'configuration'));
  process.exitCode = 1;
}
