// Builds today's constellation settings from Constellation's own design randomizer.
// Usage: node randomize-design.mjs <path to constellation source> <output.json> [YYYY-MM-DD]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const [source, output, dateArg] = process.argv.slice(2);
if (!source || !output) throw new Error('usage: randomize-design.mjs <source> <output.json> [date]');
const day = dateArg ?? new Date().toISOString().slice(0, 10);
const load = name => import(pathToFileURL(resolve(source, 'src', name)).href);
const { randomizeV5, motionParts } = await load('design-randomizer-v5.mjs');
const { seededRandom } = await load('seeded-random.mjs');

// Same date, same design, so a re-run on one day doesn't change the picture.
const random = seededRandom(`journey-to-code-org:${day}`);
const year = Number(day.slice(0, 4));

// Choose which parts move. Only motion that needs no sign-in or history is allowed.
const movable = new Set(['starlight', 'starfield', 'ring1', 'ring2', 'ring3', 'ring4', 'floating', 'perspective']);
let mask = 0;
motionParts.forEach(([key], i) => { if (movable.has(key) && random() < 0.65) mask |= 1 << i; });
if (!mask) mask = 1; // never fully still: the twinkle is always on
const seed = day.replaceAll('-', '') + '-' + Math.floor(random() * 36 ** 6).toString(36);
const code = `v5:m${mask.toString(16).padStart(3, '0')}-y${year}-f${year - 8}-${seed}`;

const recipe = randomizeV5(code);
const config = {
  ...recipe,
  // The look and the motion are random. The languages and the rings are not.
  accountType: 'organization',
  organizationScope: 'active',
  organizationView: 'projects',
  nodeMode: 'languages',
  maxRepos: 25,
  connectionDensity: 'balanced',
  organization: { contributors: { enabled: false }, grouping: { mode: 'auto', pattern: '' } },
  minStars: 0,
  updatedWithin: 0,
  includeForks: false,
  includeArchived: false,
  sortBy: 'updated',
  repoQuery: '',
  exportProfile: 'custom',
  // Always on rings, with the stars lined up on them. Only the look and motion vary.
  arrangement: 'rings',
  snapToRings: true,
  identityRing: true,
  layout: 'atlas',
  visualStyle: { ...recipe.visualStyle, labels: true, labelSize: Math.max(11, recipe.visualStyle.labelSize ?? 11) },
  history: { ...recipe.history, mode: 'current' },
  activityEffect: 'off',
  codingRhythm: false,
  version: 7,
};
writeFileSync(output, JSON.stringify(config, null, 2));
console.log(`design ${code}`);
console.log(`theme=${config.visualTheme} arrangement=${config.arrangement} shape=${config.nodeShape} starfield=${config.starfield.mode}`);
console.log(`moving: ${motionParts.filter((_, i) => mask & (1 << i)).map(([k]) => k).join(', ')}`);
