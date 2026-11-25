// Picks today's design for the tech stack constellation.
//
// Constellation's tech stack map ignores design settings, so this does two things:
//   1. writes today's randomized look and motion to <output.json>, from Constellation's
//      own design randomizer, seeded by the date; and
//   2. patches the checked-out Constellation source so the tech stack map reads that file.
// What the map shows (languages, frameworks, tools, and the rings) is never randomized.
//
// Usage: node randomize-design.mjs <constellation source> <output.json> [YYYY-MM-DD]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const [source, output, dateArg] = process.argv.slice(2);
if (!source || !output) throw new Error('usage: randomize-design.mjs <source> <output.json> [date]');
const day = dateArg || new Date().toISOString().slice(0, 10);
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

// The blog's look is fixed: near-black with yellow, the same palette as the profile
// constellation. Only the details of the sky and the motion change day to day.
const blog = { background: '#111111', foreground: '#f3f3f4', accent: '#e3de13', line: '#555a38', star: '#e3de13' };
const pick = values => values[Math.floor(random() * values.length)];
const design = {
  visualTheme: 'deep-space', // opaque, so the light labels read on any GitHub theme
  theme: 'midnight',
  visualStyle: {
    light: blog, dark: blog, labels: true, labelSize: 11,
    lineWidth: 1, lineOpacity: pick([0.5, 0.65, 0.8]), secondaryOpacity: 0.26, bridgeOpacity: 0.3,
    glow: pick([2, 3, 3.5, 4.5]), dustOpacity: pick([0.6, 0.8, 0.95]),
  },
  starfield: { mode: pick(['milky-way', 'milky-way', 'space', 'classic']), density: pick([70, 90, 100]), brightness: 1, depth: 0.95, twinkle: recipe.starfield.twinkle, seed: seed },
  effect: pick(['none', 'none', 'grid', 'scanlines']),
  animate: recipe.animate,
  starlightAnimate: recipe.starlightAnimate,
  ringAnimation: recipe.ringAnimation,
  ringRotations: recipe.ringRotations,
  floatingAnimation: recipe.floatingAnimation,
  perspective: { ...recipe.perspective, enabled: false }, // a tilted map would crowd the group labels
};
writeFileSync(output, JSON.stringify(design, null, 2));

// Make the tech stack map read the design file named by TECH_STACK_DESIGN.
// The command line draws from the copy in packages/core, so patch both.
const replacements = [
  ["import { createScene }", "import { readFileSync as __readFileSync } from 'node:fs';\nimport { createScene }"],
  ["const MAX_LANGUAGES_DRAWN", "const __design = JSON.parse(__readFileSync(process.env.TECH_STACK_DESIGN, 'utf8'));\nconst MAX_LANGUAGES_DRAWN"],
  ["visualTheme: 'deep-space', css: LABEL_CSS,", "visualTheme: 'deep-space', css: LABEL_CSS, ...__design,"],
];
for (const path of ['src/tech-stack/scene.mjs', 'packages/core/src/tech-stack/scene.mjs']) {
  const file = resolve(source, path);
  let text = readFileSync(file, 'utf8');
  if (text.includes('TECH_STACK_DESIGN')) continue;
  for (const [from, to] of replacements) {
    if (!text.includes(from)) throw new Error(`Constellation changed: cannot find "${from}" in ${path}. Pin the source to a release this script knows.`);
    text = text.replace(from, () => to);
  }
  writeFileSync(file, text);
}

console.log(`design ${code}`);
console.log(`starfield=${design.starfield.mode} effect=${design.effect} glow=${design.visualStyle.glow}`);
console.log(`moving: ${motionParts.filter((_, i) => mask & (1 << i)).map(([k]) => k).join(', ')}`);
