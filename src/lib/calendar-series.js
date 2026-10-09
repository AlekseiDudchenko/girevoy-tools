// Серии турниров и деление на предстоящие и прошедшие. Серия — повторяющийся турнир
// из data/calendar/series.json; состав задаётся префиксом ключа события, а не разбором
// названия: ключи событий сверяются вручную и не меняются. «Сегодня» передаётся
// аргументом: сборка берёт дату сборки, браузер — свою.
export const todayISO = (now = new Date()) => now.toISOString().slice(0, 10);
export const isPast = (e, today) => e.endDate < today;
export const isLive = (e, today) => e.startDate <= today && today <= e.endDate;
export const daysUntil = (date, today) => Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
export function split(events, today) {
  const upcoming = events.filter((e) => !isPast(e, today)).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
  const past = events.filter((e) => isPast(e, today)).sort((a, b) => b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id));
  return { upcoming, past };
}
/** Ближайший старт: идущий сейчас или следующий подтверждённый; отменённые пропускаются. */
export const nextEvent = (events, today) => split(events, today).upcoming.find((e) => e.status !== 'cancelled') || null;
export const seriesOf = (series, e) => series.find((s) => e.id.startsWith(s.idPrefix)) || null;
export const seriesEvents = (s, events) => events.filter((e) => e.id.startsWith(s.idPrefix));
export function validateSeries(series, events) {
  const slugs = new Set();
  for (const s of series) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.slug) || slugs.has(s.slug)) throw new Error(`series ${s.slug}: slug`);
    slugs.add(s.slug);
    if (!s.name || !s.idPrefix) throw new Error(`series ${s.slug}: name, idPrefix`);
    const own = seriesEvents(s, events);
    if (own.length < 2) throw new Error(`series ${s.slug}: fewer than 2 events`);
    if (own.some((e) => !e.federations.includes(s.federation))) throw new Error(`series ${s.slug}: federation`);
  }
  for (const e of events) if (series.filter((s) => e.id.startsWith(s.idPrefix)).length > 1) throw new Error(`${e.id}: several series`);
  return series;
}
