import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {normalizeEvent,validateEvent,validateEvents,deduplicate,diffEvents,applyReviewed,filterEvents,parseFilters,eventICS,isDate} from '../src/lib/calendar.js';
import {schemaErrors} from '../src/lib/calendar-schema.js';
import {renderEvents,renderBrowse,relative} from '../src/lib/calendar-view.js';
import {validateSeries,split,nextEvent,localISO} from '../src/lib/calendar-series.js';
import {importSources} from '../scripts/calendar-import.mjs';
import {locale} from '../src/i18n/index.js';
import {redirects} from '../src/redirects.js';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const events=read('data/calendar/events.json');
const schema=read('data/calendar/event.schema.json');
const fixture=()=>structuredClone(events.find(e=>e.id==='wksf-european-2026'));

test('published events and all five manual source adapters conform to the canonical schema',()=>{
  assert.equal(validateEvents(events),events);
  const sources=read('data/calendar/sources.json');
  assert.equal(sources.filter(s=>s.method==='manual').length,5);
  const imported=importSources(sources,s=>read(`data/calendar/sources/${s.file}`),new Date('2026-10-10'));
  assert.equal(imported.conflicts.length,0);
  assert.equal(imported.notices.filter(n=>n.kind==='failure').length,0);
  assert.deepEqual(imported.events,events);
  for(const e of [...events,...sources.filter(s=>s.file).flatMap(s=>read(`data/calendar/sources/${s.file}`))]) assert.deepEqual(schemaErrors(e,schema),[],e.id);
});
test('normalization handles whitespace, ISO countries and federation identifiers without losing provenance',()=>{
  const e=fixture();e.title='  WKSF  European\nOpen ';e.city=' Turbigo  ';e.country=' it ';e.federations=[' wksf ','WKSF'];
  const n=normalizeEvent(e);assert.equal(n.title,'WKSF European Open');assert.equal(n.country,'IT');assert.deepEqual(n.federations,['WKSF']);assert.deepEqual(n.sources,e.sources);
  e.country=null;assert.equal(normalizeEvent(e).country,null);
});
test('invalid dates, locations, URLs, timestamps and time zones are rejected',()=>{
  assert.equal(isDate('2026-02-30'),false);assert.equal(isDate('2028-02-29'),true);
  for(const patch of [{startDate:'2026-02-30'},{endDate:'2025-01-01'},{country:'ZZ'},{timeZone:'Europe/Fake'},{registrationUrl:'javascript:alert(1)'},{registrationUrl:'https://example.com/\nBEGIN:VEVENT'},{registrationDeadline:'2027-01-01'},{lastChecked:'yesterday'},{format:'virtual'},{status:'gone'},{sequence:-1},{sources:[]}]) assert.ok(validateEvent({...fixture(),...patch}).length,JSON.stringify(patch));
  assert.ok(schemaErrors({...fixture(),extra:1},schema).length);
  const e=fixture();delete e.city;assert.ok(schemaErrors(e,schema).length);
  assert.throws(()=>validateEvents([fixture(),fixture()]),/duplicate/);
});
test('same event merges independent references, deduplicates URLs, keeps latest checks and stable ID',()=>{
  const a=fixture(),b=fixture();b.id='second-source';b.sources=[{organization:'BVDKS',url:'https://bvdks.de/',checkedAt:a.lastChecked}];
  const merged=deduplicate([a,b,b]);assert.equal(merged.events.length,1);assert.equal(merged.events[0].id,a.id);assert.equal(merged.events[0].sources.length,3);
  assert.equal(merged.conflicts.length,0);
});
test('date and status conflicts are review items, not silently overwritten',()=>{
  const a=fixture(),b=fixture();b.status='cancelled';b.startDate='2026-12-04';
  const merged=deduplicate([a,b]);assert.equal(merged.events[0].status,'confirmed');assert.equal(merged.conflicts.length,1);assert.deepEqual(merged.conflicts[0].fields,['startDate','status']);
  b.id='different-tournament';assert.equal(deduplicate([a,b]).events.length,2);
});
test('new/changed/missing diffs preserve previous state and accept only reviewed events',()=>{
  const a=fixture(),b=fixture();b.status='postponed';
  const fresh={...fixture(),id:'new-event'};
  const before=structuredClone([a]);
  assert.equal(diffEvents([a],[b])[0].kind,'changed');assert.equal(diffEvents([a],[])[0].kind,'missing');
  assert.deepEqual(applyReviewed([a],[b,fresh],[]),[a]);
  const accepted=applyReviewed([a],[b,fresh],[a.id]);assert.equal(accepted[0].status,'postponed');assert.equal(accepted[0].sequence,1);assert.equal(accepted.length,1);
  assert.deepEqual(applyReviewed([a],[],[a.id]),[a]);assert.deepEqual([a],before);
});
test('source errors and stale/blocked sources are actionable and do not refresh verification dates',()=>{
  const sources=read('data/calendar/sources.json');
  const report=importSources(sources,s=>{if(s.id==='AKLU')throw new Error('Unavailable');return read(`data/calendar/sources/${s.file}`);},new Date('2027-01-01'));
  assert.ok(report.notices.some(n=>n.kind==='failure'&&n.source==='AKLU'));
  assert.ok(report.notices.some(n=>n.kind==='stale'&&n.source==='WKSF'));
  assert.ok(report.notices.some(n=>n.kind==='blocked'&&n.source==='IKO'));
  assert.equal(report.events[0].lastChecked,events[0].lastChecked);
});
test('date filters include overlapping multi-day events; regional and hybrid filters combine',()=>{
  assert.ok(filterEvents(events,{from:'2026-12-04',to:'2026-12-04'}).some(e=>e.id==='wksf-european-2026'));
  assert.equal(filterEvents(events,{region:'north-america',country:'CA',format:'hybrid',federation:'IKO'}).length,1);
  assert.equal(filterEvents(events,{region:'europe',format:'online'}).length,0);
  assert.equal(filterEvents([{...fixture(),country:'SI'}],{region:'europe'}).length,1);
  assert.equal(filterEvents([{...fixture(),country:'SK'}],{region:'europe'}).length,1);
  assert.deepEqual(parseFilters('?from=2026-02-30&to=2026-12-06&region=europe'),{to:'2026-12-06',region:'europe'});
});
test('ICS all-day ranges have exclusive end dates; local timed events convert to UTC',()=>{
  const ics=eventICS(fixture());assert.match(ics,/DTSTART;VALUE=DATE:20261203\r\n/);assert.match(ics,/DTEND;VALUE=DATE:20261207\r\n/);
  assert.match(ics,/UID:wksf-european-2026@tools.vsegiri.com/);
  const timed=eventICS(events.find(e=>e.id==='bremen-open-2026'));assert.match(timed,/DTSTART:20261128T090000Z/);assert.match(timed,/DTEND:20261128T160000Z/);
  const summer={...fixture(),startDate:'2026-06-01',endDate:'2026-06-01',timeZone:'Europe/Berlin',startAt:'2026-06-01T10:00:00+02:00',endAt:'2026-06-01T11:00:00+02:00'};
  assert.match(eventICS(summer),/DTSTART:20260601T080000Z/);
  assert.ok(validateEvent({...summer,startDate:'2026-06-02',endDate:'2026-06-02'}).includes('times'));
  assert.match(eventICS({...fixture(),status:'cancelled'}),/STATUS:CANCELLED/);
  assert.match(eventICS({...fixture(),status:'postponed'}),/STATUS:TENTATIVE/);
});
test('ICS escapes injection and folds UTF-8 lines at 75 octets',()=>{
  const e=fixture();e.title='Турнир,;\\\n'+ 'Гиревой спорт '.repeat(20);
  const ics=eventICS(e);for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
  const unfolded=ics.replace(/\r\n /g,'');assert.ok(unfolded.includes('SUMMARY:Турнир\\,\\;\\\\\\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,1);
});
test('all languages render a useful list, escape source facts, and handle unknown discipline names',()=>{
  for(const lang of ['en','de','ru'])assert.ok(renderEvents(locale(lang),events,{today:'2026-10-09'}).includes('wksf-european-2026'));
  const e=fixture();e.title='<img src=x>';e.disciplines=['new-discipline'];
  const html=renderEvents(locale('en'),[e],{today:e.startDate});assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(html.includes('new-discipline'));
});
test('build exports event JSON and ICS without a wildcard redirect shadowing downloads',()=>{
  const out=mkdtempSync(join(tmpdir(),'calendar-build-'));execFileSync('node',['scripts/build.mjs',out]);
  assert.deepEqual(read(join(out,'calendar/events.json')),events);
  assert.match(readFileSync(join(out,'calendar/ics/bremen-open-2026.ics'),'utf8'),/DTSTART:20261128T090000Z/);
  assert.ok(!redirects().includes('/calendar/*'));
});
test('review command produces previous/candidate/diff artifacts without modifying public events',()=>{
  const before=readFileSync('data/calendar/events.json','utf8');const out=mkdtempSync(join(tmpdir(),'calendar-review-'));
  execFileSync('node',['scripts/calendar-import.mjs',`--out=${out}`]);assert.deepEqual(read(join(out,'previous.json')),events);assert.equal(read(join(out,'review.json')).changes.length,0);
  assert.equal(readFileSync('data/calendar/events.json','utf8'),before);
});

test('registration, organizer URLs and names require review when both sources differ',()=>{
  for (const key of ['registrationUrl','organizerUrl','title','organizer']) {
    const a=fixture(),b=fixture();
    a[key]=key.endsWith('Url')?'https://old.example/register':'Old name';
    b[key]=key.endsWith('Url')?'https://new.example/register':'New name';
    const merged=deduplicate([a,b]);
    assert.equal(merged.conflicts.length,1,key);assert.ok(merged.conflicts[0].fields.includes(key));
    assert.equal(merged.events[0][key],a[key]);
  }
  const a=fixture(),b=fixture();b.registrationUrl='https://example.com/register';
  const merged=deduplicate([a,b]);assert.equal(merged.conflicts.length,0);assert.equal(merged.events[0].registrationUrl,b.registrationUrl);
  b.title=a.title.toUpperCase();assert.equal(deduplicate([a,b]).conflicts.length,0);
});
test('verification timestamps compare instants across offsets, not lexicographic order',()=>{
  const a=fixture();a.lastChecked='2026-10-09T16:00:00+02:00';
  a.sources=a.sources.map(s=>({...s,checkedAt:'2026-10-09T14:30:00Z'}));
  assert.ok(validateEvent(a).includes('lastChecked'));
  a.sources=a.sources.map(s=>({...s,checkedAt:'2026-10-09T16:00:00+02:00'}));
  assert.deepEqual(validateEvent(a),[]);
  const b=structuredClone(a);b.lastChecked='2026-10-09T14:30:00Z';b.sources=b.sources.map(s=>({...s,checkedAt:b.lastChecked}));
  for(const records of [[a,b],[b,a]]) {
    const merged=deduplicate(records);assert.equal(merged.events[0].lastChecked,b.lastChecked);
    assert.ok(merged.events[0].sources.every(s=>s.checkedAt===b.lastChecked));
  }
  const report=importSources([{id:'WKSF',method:'manual',frequencyDays:7,url:'https://example.com'}],()=>[b,{...a,id:'another-event'}],new Date('2026-10-16T14:15:00Z'));
  assert.ok(report.notices.some(n=>n.kind==='stale'));
});
test('series: every series has at least two editions of its federation, each event is in at most one series',()=>{
  const series=read('data/calendar/series.json');
  assert.equal(validateSeries(series,events),series);
  assert.throws(()=>validateSeries([{slug:'x',name:'X',federation:'IUKL',idPrefix:'no-such-'}],events),/fewer than 2/);
  assert.throws(()=>validateSeries([...series,{...series[0],slug:'copy'}],events),/several series/);
});
test('upcoming and past split on the given day; a running event is upcoming and live',()=>{
  const today='2026-10-09';const {upcoming,past}=split(events,today);
  assert.equal(upcoming.length+past.length,events.length);
  assert.ok(upcoming.every(e=>e.endDate>=today)&&past.every(e=>e.endDate<today));
  assert.ok(past.every((e,i)=>!i||past[i-1].startDate>=e.startDate),'past: newest first');
  assert.equal(nextEvent(events,today).id,'iukl-world-new-delhi-2026');
  assert.equal(relative(locale('en'),nextEvent(events,today),today),'Happening now');
  assert.equal(relative(locale('ru'),{startDate:'2026-10-23',endDate:'2026-10-25'},today),'через 14 дней');
  const browse=renderBrowse(locale('en'),events,{when:'past',federation:'BVDKS'},{today,series:read('data/calendar/series.json')});
  assert.ok(browse.html.includes('rhein-main-cup-2026')&&!browse.html.includes('bremen-open-2026'));
  assert.equal(browse.shown,browse.past);
});
test('registration button is hidden after the deadline; local day uses the viewer clock',()=>{
  const e={...fixture(),registrationUrl:'https://example.org/register',registrationDeadline:'2026-12-01',startDate:'2026-12-05',endDate:'2026-12-05'};
  assert.ok(renderEvents(locale('en'),[e],{today:'2026-11-30'}).includes('example.org/register'));
  assert.ok(!renderEvents(locale('en'),[e],{today:'2026-12-02'}).includes('example.org/register'));
  assert.equal(localISO(new Date(2026,0,5,23,30)),'2026-01-05');
});
