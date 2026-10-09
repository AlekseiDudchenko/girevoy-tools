import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schemaErrors } from '../src/lib/calendar-schema.js';
import { deduplicate, validateEvents, diffEvents, applyReviewed } from '../src/lib/calendar.js';
const root = fileURLToPath(new URL('../data/calendar/',import.meta.url));
const read = path => JSON.parse(readFileSync(path,'utf8'));
const write = (path,data) => writeFileSync(path,JSON.stringify(data,null,2)+'\n');
export function importSources(sources, readSource, now = new Date()) {
  const records=[], notices=[];
  for (const source of sources) {
    if (source.method === 'blocked') { notices.push({source:source.id,kind:'blocked',reason:source.restriction,url:source.url}); continue; }
    try {
      const rows=validateEvents(readSource(source));
      if (!rows.length) notices.push({source:source.id,kind:'empty',url:source.url});
      records.push(...rows);
      const checked=rows.map(e=>e.sources.filter(s=>s.organization===source.id).map(s=>s.checkedAt)).flat().sort().at(0);
      if (!checked || now-Date.parse(checked)>source.frequencyDays*86400000) notices.push({source:source.id,kind:'stale',checkedAt:checked,url:source.url});
      notices.push({source:source.id,kind:'manual',url:source.url,reason:source.restriction});
    } catch (error) { notices.push({source:source.id,kind:'failure',reason:error.message,url:source.url}); }
  }
  const merged=deduplicate(records);
  validateEvents(merged.events);
  return {...merged,notices};
}
export function run(args=process.argv.slice(2)) {
  const output=resolve(args.find(x=>x.startsWith('--out='))?.slice(6)||'calendar-review');
  mkdirSync(output,{recursive:true});
  const schema=read(join(root,'event.schema.json'));
  const previous=read(join(root,'events.json'));
  validateEvents(previous);
  const incoming=importSources(read(join(root,'sources.json')),s=>{ const rows=read(join(root,'sources',s.file)); for (const e of rows) {const errors=schemaErrors(e,schema);if(errors.length) throw new Error(errors.join(', '));} return rows; });
  const report={generatedAt:new Date().toISOString(),changes:diffEvents(previous,incoming.events),conflicts:incoming.conflicts,notices:incoming.notices};
  write(join(output,'previous.json'),previous); write(join(output,'candidate.json'),incoming.events); write(join(output,'review.json'),report);
  const md=['# Calendar review','',`Generated: ${report.generatedAt}`,'','No changes are automatically published. Missing records are retained, never cancelled.','',...report.changes.map(c=>`- ${c.kind}: ${c.id}`),...report.conflicts.map(c=>`- CONFLICT: ${c.id}: ${c.fields.join(', ')}`),...report.notices.map(n=>`- ${n.kind}: ${n.source} — ${n.url} — ${n.reason||n.checkedAt||''}`),'','Inspect previous.json, candidate.json and review.json before accepting named IDs.'];
  writeFileSync(join(output,'review.md'),md.join('\n')+'\n');
  const accept=args.find(x=>x.startsWith('--accept='));
  if (accept) {
    const ids=accept.slice(9).split(',');
    if (incoming.conflicts.length || incoming.notices.some(n=>n.kind==='failure')) throw new Error('Resolve conflicts and source failures before approval');
    const changed=report.changes.filter(c=>c.kind!=='missing').map(c=>c.id);
    if (ids.some(id=>!changed.includes(id))) throw new Error('Only explicit changed/new IDs can be accepted');
    write(join(root,'events.json'),applyReviewed(previous,incoming.events,ids));
  }
  console.log(`Review: ${report.changes.length} changes, ${report.conflicts.length} conflicts; ${report.notices.filter(n=>['failure','stale','blocked'].includes(n.kind)).length} source alerts. ${output}`);
  if (incoming.notices.some(n=>n.kind==='failure')) process.exitCode=1;
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
