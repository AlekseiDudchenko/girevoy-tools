const COUNTRIES = new Set('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '));
export const FEDERATIONS = ['WKSF', 'IKMF', 'IUKL', 'IKO', 'AKLU', 'BVDKS'];
export const FORMATS = ['in-person', 'online', 'hybrid'];
export const STATUSES = ['confirmed', 'tentative', 'postponed', 'cancelled'];
export const normalizeName = value => String(value).normalize('NFKC').trim().replace(/\s+/g, ' ');
export const nameKey = value => normalizeName(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const safeURL = value => { if (typeof value !== 'string' || /[\x00-\x20\x7f]/.test(value)) return false; try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; } };
export const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const isTimestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && isDate(value.slice(0,10)) && !isNaN(Date.parse(value));
export function normalizeEvent(raw) {
  return { ...raw, title: normalizeName(raw.title), city: normalizeName(raw.city || ''), organizer: normalizeName(raw.organizer), country: raw.country === null ? null : String(raw.country || '').trim().toUpperCase(), federations: [...new Set(raw.federations.map(x => x.trim().toUpperCase()))].sort(), disciplines: [...new Set(raw.disciplines.map(normalizeName))], sources: raw.sources.map(s => ({ ...s, organization: s.organization.trim().toUpperCase() })) };
}
export function validateEvent(e) {
  const errors = [];
  const fail = key => errors.push(key);
  if (!e || typeof e !== 'object') return ['event'];
  for (const k of ['id', 'title', 'organizer']) if (typeof e[k] !== 'string' || !e[k].trim()) fail(k);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(e.id || '')) fail('id');
  if (!isDate(e.startDate)) fail('startDate');
  if (!isDate(e.endDate) || e.endDate < e.startDate) fail('endDate');
  if (e.country !== null && !COUNTRIES.has(e.country)) fail('country');
  if (typeof e.city !== 'string') fail('city');
  if (!FORMATS.includes(e.format)) fail('format');
  if (!STATUSES.includes(e.status)) fail('status');
  for (const k of ['federations', 'disciplines']) if (!Array.isArray(e[k]) || !e[k].every(x => typeof x === 'string' && x.trim())) fail(k);
  if (!Array.isArray(e.federations) || !e.federations.length || !e.federations.every(x => FEDERATIONS.includes(x))) fail('federations');
  if (!Array.isArray(e.sources) || !e.sources.length) fail('sources');
  else for (const s of e.sources) if (!s || !FEDERATIONS.includes(s.organization) || !safeURL(s.url) || !isTimestamp(s.checkedAt)) fail('sources');
  for (const k of ['registrationUrl', 'organizerUrl']) if (e[k] !== null && !safeURL(e[k])) fail(k);
  if (e.registrationDeadline !== null && (!isDate(e.registrationDeadline) || e.registrationDeadline > e.endDate)) fail('registrationDeadline');
  if (!isTimestamp(e.lastChecked)) fail('lastChecked');
  if (Array.isArray(e.sources) && e.sources.some(s => Date.parse(s?.checkedAt) > Date.parse(e.lastChecked))) fail('lastChecked');
  if (e.timeZone !== null) { try { new Intl.DateTimeFormat('en', {timeZone:e.timeZone}); } catch { fail('timeZone'); } }
  if ((e.startAt != null) !== (e.endAt != null)) fail('times');
  if (e.startAt != null && (!isTimestamp(e.startAt) || !isTimestamp(e.endAt) || Date.parse(e.endAt) <= Date.parse(e.startAt) || !e.timeZone)) fail('times');
  if (e.startAt != null && isTimestamp(e.startAt) && isTimestamp(e.endAt) && e.timeZone) {
    try {
      const localDate = value => new Intl.DateTimeFormat('en-CA', {timeZone:e.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
      if (localDate(e.startAt) !== e.startDate || localDate(e.endAt) !== e.endDate) fail('times');
    } catch { fail('times'); }
  }
  if (!Number.isInteger(e.sequence) || e.sequence < 0) fail('sequence');
  return [...new Set(errors)];
}
export function validateEvents(events) {
  if (!Array.isArray(events)) throw new Error('events must be an array');
  const ids = new Set();
  for (const e of events) {
    const errors = validateEvent(e);
    if (ids.has(e?.id)) errors.push('duplicate id');
    if (errors.length) throw new Error(`${e?.id || '?'}: ${errors.join(', ')}`);
    ids.add(e.id);
  }
  return events;
}
const identity = e => [nameKey(e.title), e.startDate, e.country, nameKey(e.city), e.format].join('|');
const sourceKey = s => `${s.organization}|${s.url}`;
export function deduplicate(events) {
  const result = [], conflicts = [];
  for (const raw of events) {
    const e = normalizeEvent(raw);
    const existing = result.find(x => x.id === e.id || identity(x) === identity(e));
    if (!existing) { result.push(e); continue; }
    const different = ['startDate','endDate','country','city','format','status','timeZone','registrationDeadline','startAt','endAt'].filter(k => (existing[k] ?? null) !== (e[k] ?? null));
    for (const k of ['title', 'organizer']) if (nameKey(existing[k]) !== nameKey(e[k])) different.push(k);
    for (const k of ['registrationUrl', 'organizerUrl']) if (existing[k] && e[k] && existing[k] !== e[k]) different.push(k);
    if (different.length) { conflicts.push({id:existing.id, fields:different, incoming:e}); continue; }
    existing.federations = [...new Set([...existing.federations,...e.federations])].sort();
    existing.disciplines = [...new Set([...existing.disciplines,...e.disciplines])];
    for (const s of e.sources) {
      const old = existing.sources.find(x => sourceKey(x) === sourceKey(s));
      if (!old) existing.sources.push(s); else if (Date.parse(s.checkedAt) > Date.parse(old.checkedAt)) old.checkedAt = s.checkedAt;
    }
    if (Date.parse(e.lastChecked) > Date.parse(existing.lastChecked)) existing.lastChecked = e.lastChecked;
    for (const k of ['registrationUrl','organizerUrl']) existing[k] ||= e[k];
  }
  return {events:result.sort((a,b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id)), conflicts};
}
export function diffEvents(previous, incoming) {
  const items = [];
  const comparable = e => JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !['lastChecked','sequence'].includes(k)).sort(([a],[b])=>a.localeCompare(b))));
  for (const next of incoming) {
    const old = previous.find(e => e.id === next.id);
    if (!old) items.push({kind:'new',id:next.id,after:next});
    else if (comparable(old) !== comparable(next) || old.lastChecked !== next.lastChecked) items.push({kind:'changed',id:next.id,before:old,after:next});
  }
  for (const old of previous) if (!incoming.some(e => e.id === old.id)) items.push({kind:'missing',id:old.id,before:old});
  return items;
}
export function applyReviewed(previous, incoming, decisions) {
  const next = structuredClone(previous);
  for (const change of diffEvents(previous,incoming)) {
    if (!decisions.includes(change.id) || change.kind === 'missing') continue;
    const index = next.findIndex(e => e.id === change.id);
    const event = {...change.after,sequence:index < 0 ? 0 : next[index].sequence + 1};
    if (index < 0) next.push(event); else next[index] = event;
  }
  return validateEvents(next.sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.id.localeCompare(b.id)));
}
export const REGION_COUNTRIES = {europe:['AD','AL','AT','AX','BA','BE','BG','BY','CH','CY','CZ','DE','DK','EE','ES','FI','FO','FR','GB','GG','GI','GR','HR','HU','IE','IM','IS','IT','JE','LI','LT','LU','LV','MC','MD','ME','MK','MT','NL','NO','PL','PT','RO','RS','RU','SE','SI','SJ','SK','SM','TR','UA','VA'], 'north-america':['US','CA','MX']};
export function filterEvents(events, filters = {}) {
  return events.filter(e => (!filters.from || e.endDate >= filters.from) && (!filters.to || e.startDate <= filters.to) && (!filters.country || e.country === filters.country) && (!filters.region || REGION_COUNTRIES[filters.region]?.includes(e.country)) && (!filters.federation || e.federations.includes(filters.federation)) && (!filters.format || e.format === filters.format));
}
export function parseFilters(search) {
  const params = new URLSearchParams(search), result = {};
  for (const k of ['from','to','country','region','federation','format']) if (params.get(k)) result[k] = params.get(k);
  if (result.from && !isDate(result.from)) delete result.from;
  if (result.to && !isDate(result.to)) delete result.to;
  return result;
}
const icsText = value => String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line) {
  const chunks = []; let part = '', count = 0;
  for (const char of line) { const n = new TextEncoder().encode(char).length; if (count+n > 75) { chunks.push(part); part=' '; count=1; } part+=char; count+=n; }
  chunks.push(part); return chunks.join('\r\n');
}
const utc = timestamp => new Date(timestamp).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export function eventICS(e) {
  const errors = validateEvent(e); if (errors.length) throw new Error(errors.join(','));
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//vsegiri//Competition calendar//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${e.id}@tools.vsegiri.com`,`DTSTAMP:${utc(e.lastChecked)}`,`SEQUENCE:${e.sequence}`];
  if (e.startAt) lines.push(`DTSTART:${utc(e.startAt)}`,`DTEND:${utc(e.endAt)}`);
  else {
    const end = new Date(`${e.endDate}T00:00:00Z`); end.setUTCDate(end.getUTCDate()+1);
    lines.push(`DTSTART;VALUE=DATE:${e.startDate.replaceAll('-','')}`,`DTEND;VALUE=DATE:${end.toISOString().slice(0,10).replaceAll('-','')}`);
  }
  lines.push(`SUMMARY:${icsText(e.title)}`,`LOCATION:${icsText([e.city,e.country].filter(Boolean).join(', '))}`,`URL:${e.sources[0].url}`,`DESCRIPTION:${icsText(e.sources.map(s=>s.url).join('\n'))}`,`STATUS:${e.status==='cancelled'?'CANCELLED':e.status==='confirmed'?'CONFIRMED':'TENTATIVE'}`,'END:VEVENT','END:VCALENDAR');
  return lines.map(fold).join('\r\n')+'\r\n';
}
