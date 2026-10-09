// Optional asset-authoring command; not required by the build or CI.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PAGES } from '../src/pages/index.js';
import { LANGS, locale } from '../src/i18n/index.js';
import { socialCard, SOCIAL_WIDTH, SOCIAL_HEIGHT } from '../src/social.js';

const cards = LANGS.flatMap((lang) => PAGES.map((page) => socialCard(locale(lang), page)));
const logoSha256 = createHash('sha256').update(readFileSync(new URL('../assets/logo.png', import.meta.url))).digest('hex');
const result = spawnSync('python3', [fileURLToPath(new URL('./social-cards.py', import.meta.url))], {
  input: JSON.stringify({ width: SOCIAL_WIDTH, height: SOCIAL_HEIGHT, logoSha256, cards }),
  encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'],
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
