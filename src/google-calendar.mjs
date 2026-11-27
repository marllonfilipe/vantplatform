import {ApiError} from './http.mjs';
import {serviceCredentials,privateGoogleConfig,invalidGoogleConfig,googleJson,googleToken} from './google-auth.mjs';

export const calendarScope = 'https://www.googleapis.com/auth/calendar.events.readonly';
const pageSize = 50;
const invalidResponse = () => new ApiError(502,'upstream','O Google retornou uma agenda inválida.');

export function calendarConfig(input) {
  const id = input?.calendar_id;
  if (typeof id !== 'string' || id.length > 254 || !/^[\w.+-]+@[\w.-]+$/.test(id)) throw invalidGoogleConfig();
  return {calendar_id:id,...serviceCredentials(input)};
}
export const tenantCalendar = tenant => privateGoogleConfig(tenant,process.env.VANT_GOOGLE_CALENDAR_DIR,calendarConfig);

export function calendarQuery(config,now) {
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(config.calendar_id) + '/events');
  url.search = new URLSearchParams({timeMin:now.toISOString(),timeMax:new Date(now.getTime()+7*86400000).toISOString(),
    singleEvents:'true',orderBy:'startTime',showDeleted:'false',maxResults:String(pageSize),
    fields:'kind,nextPageToken,items(status,visibility,summary,start(date,dateTime),end(date,dateTime))'});
  return url;
}

export function calendarPreview(data) {
  const items = data?.items === undefined ? [] : data.items;
  if (data?.kind !== 'calendar#events' || !Array.isArray(items) || items.length > pageSize) throw invalidResponse();
  const events = [];
  for (const item of items) {
    if (item?.status === 'cancelled') continue;
    const allDay = typeof item?.start?.date === 'string';
    const start = allDay ? item.start.date : item?.start?.dateTime;
    const end = allDay ? item?.end?.date : item?.end?.dateTime;
    const pattern = allDay ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/;
    if (![start,end].every(value=>typeof value==='string' && pattern.test(value) && Number.isFinite(Date.parse(value)))) throw invalidResponse();
    if (allDay && (start >= end || [start,end].some(value=>new Date(value).toISOString().slice(0,10)!==value))) throw invalidResponse();
    const hidden = ['private','confidential'].includes(item.visibility);
    events.push({title:hidden?'Reservado':(typeof item.summary==='string' && item.summary.trim() || 'Sem título'),start,end,all_day:allDay});
  }
  return {events,has_more:Boolean(data.nextPageToken)};
}

export async function readCalendar(config) {
  try {
    const token = await googleToken(config,calendarScope);
    const url = calendarQuery(config,new Date());
    const data = await googleJson(url,{headers:{Authorization:'Bearer '+token}},512000);
    return calendarPreview(data);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502,'upstream','Falha ao consultar o Google Calendar.');
  }
}
