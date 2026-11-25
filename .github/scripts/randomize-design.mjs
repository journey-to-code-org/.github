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

// Only the look and the motion. Nodes, groups, colors by group, labels and layout stay as they are.
// The map always sits on a dark sky, so its light labels stay readable.
const dark = recipe.visualStyle.dark;
const design = {
  visualTheme: recipe.visualTheme,
  theme: 'midnight',
  visualStyle: { ...recipe.visualStyle, light: dark, dark, labels: true, labelSize: 11 },
  starfield: recipe.starfield,
  nodeShape: recipe.nodeShape,
  effect: recipe.effect,
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
console.log(`theme=${design.visualTheme} shape=${design.nodeShape} starfield=${design.starfield.mode} effect=${design.effect}`);
console.log(`moving: ${motionParts.filter((_, i) => mask & (1 << i)).map(([k]) => k).join(', ')}`);
