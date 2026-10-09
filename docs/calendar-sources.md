# International competition calendar

Issue: #18. Public pages: `/ru/calendar/`, `/en/calendar/`, `/de/calendar/`;
`/calendar` redirects to Russian, matching the existing tools convention.

## Source inventory (reviewed 2026-10-09)

| Organization | Official listing | Extraction / current adapter | Restrictions and fallback | Review frequency |
|---|---|---|---|---|
| WKSF | https://wksf.site/2026-informations/ | Manual structured snapshot of headings and linked European championship brochure | No verified API/feed or scraping permission. Transcribe dates and place; link the original brochure, do not copy its text or images. | Weekly |
| IKMF | https://www.ikmf-world.com/calendars/ikmf-international-competitions/ | Manual structured snapshot of dated headings | Posters contain additional details; do not infer an unknown city or disciplines. No approved automated adapter. | Weekly |
| AKLU | https://www.aklu.net/sanctioned-events | Manual structured snapshot of dated Wix headings, venue, format, registration links | Full dates only: month-only 2027 listings stay out of the public calendar until clarified. Registration forms are outbound links; no participant information is collected. No verified machine feed/policy. | Weekly |
| BVDKS | https://bvdks.de/events/ and https://bvdks.de/ | Manual structured snapshot of individual event pages and homepage listings | The Events Calendar/WordPress offers potential feeds, but usage terms and feed completeness are not verified. Existing pages include stale variants; prefer current detailed event pages. | Weekly |
| IUKL | https://giri-iukl.com/ | Manual homepage snapshot of Riga dates | Annual calendar PDF and automation not yet verified. Direct homepage and BVDKS provenance are preserved separately. | Weekly |
| IKO | https://www.kettlebellworld.org/ | Blocked automated extraction, manual fallback through organizer announcements | 2026 calendar active links are marked “coming soon”. AKLU listings and the Westshore organizer form supply event facts/affiliation without claiming the IKO homepage was ingested. | Weekly |

All automated website scraping is disabled. This is a deliberate manual-fallback MVP,
not a claim of live federation synchronization. No source is known to prohibit factual
manual transcription, but robots/terms/feed permissions have **not** been established;
check those before implementing and enabling each remote adapter. No authentication,
CAPTCHA bypass, bulk descriptions, images, PDFs or personal registration data.

Initial coverage: nine upcoming/ongoing events from five independent official sources.
Selection is not exhaustive. Country codes are ISO 3166-1 alpha-2; Scotland maps to GB
without inventing a city. Unknown optional data remains null/empty. WKSF European
and IUKL Riga cross-listings merge under explicitly assigned canonical IDs.

## Data and moderation

- `data/calendar/event.schema.json`: JSON Schema Draft 2020-12, limited to the subset
  checked by `src/lib/calendar-schema.js`. `calendar.js` adds semantic checks for real
  dates, allowed countries, HTTP(S) URLs, time zones and start/end ordering.
- `data/calendar/sources/<organization>.json`: one manual source adapter snapshot.
  Entries use the canonical schema; `sources[].checkedAt` is a real human check date.
- `events.json`: **reviewed public state**, read by the build. Import never replaces it
  automatically. The public JSON lives at `/calendar/events.json`.
- Event ID remains stable through rescheduling/status changes. Match explicit IDs or
  exact normalized title/date/country/city/format; never fuzzy-merge unrelated events.
  Conflicting dates/status/location require a maintainer decision. Sources merge by
  organization+URL, preserving the most recent genuine check date.
- Multiple announcements may use the same manually reconciled ID. Keep organizer
  and registration details consistent across these snapshots, or resolve conflicts
  before approval. Manual corrections are edits to these source records in a PR.
- Submission/correction links open the GitHub Issue Form; submitting requires a GitHub
  account, browsing does not. A maintainer verifies the public organizer source,
  updates the source snapshot, reviews the candidate and merges a PR. Nothing from
  an issue is automatically imported or published.

## Weekly review and publication

`npm run calendar:review` reads adapters, validates/normalizes/deduplicates them and
writes `calendar-review/{previous.json,candidate.json,review.json,review.md}`. It reports
new, changed, missing and conflicting records, source failures, blocked adapters and
verification older than the weekly interval. Errors do not erase public state; stale
snapshots do not acquire a fresh “checked” timestamp just because a job ran.

The scheduled GitHub Action runs every Monday, places actionable notices in the job
summary and retains the previous state plus candidate/diff as a 90-day artifact.
For the manual adapters this is an overdue-check and local-snapshot change review;
it does **not** fetch live sites or detect remote changes without a human refreshing
snapshots. Refresh each official source weekly, including looking for newly announced
opens, and update only the dates actually checked.

1. Read the official listing and any detailed announcement; edit that source snapshot.
2. Run `npm run calendar:review`, inspect both states and conflicts in the artifact.
3. Resolve conflicting sources manually and document the decision in the PR. For a
   postponement/cancellation require a positive official announcement. A missing
   listing is always a review notice, never a deletion or automatic cancellation.
4. Accept explicit reviewed IDs:
   `node scripts/calendar-import.mjs --accept=wksf-european-2026,bremen-open-2026`.
   `--accept` cannot publish through source failures/conflicts, accepts no wildcard,
   retains all missing records, and increments ICS sequence for changed events.
5. `npm run check`, commit snapshots and public state together to a feature branch,
   open a PR to main. Deployment reads only reviewed `events.json`.

Git history retains earlier published states; artifacts capture each review run.
The initial snapshot was seeded from the official listings above and reviewed as
part of this PR. Future acceptance remains a maintainer action.

## ICS and frontend

Each event has a static downloadable `/calendar/ics/<id>.ics`, also usable without
JavaScript. Date-only events are all-day events in local calendar dates: DTEND is
exclusive (one day after the inclusive source end), with no invented starting hour.
Known local start/end times require an explicit offset and IANA time zone; export
converts them to UTC, avoiding unsupported/incomplete VTIMEZONE definitions.
Stable UID, sequence, status, escaping, CRLF and 75-octet UTF-8 folding are tested.
This is an individual download, not a subscription or reminder service.

The list is rendered on the server at build time, grouped by month, on all three
languages. JavaScript adds combined date/country/region/federation/format filters;
filter state is shareable in the URL and survives language switching. Without
JavaScript all reviewed events, registration/source links and ICS downloads remain
available. The calendar namespace has no wildcard redirect, so JSON/schema/ICS files
are not redirected to a language page.

## Follow-ups

Verify and implement official permitted feeds for each organization; retain the same
review gate. Add exact-date entries for AKLU month-only announcements, more national
and club calendars, dynamic subscriptions, distance filters and watchlists separately.
