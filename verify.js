#!/usr/bin/env node
// Self-check for the scoring maths. No test framework — plain asserts, run with `npm test`.
//
//   Part 1  hand-checked numbers on a tiny synthetic field
//   Part 2  the full 302-row original field, compared against the figures the
//           source site actually published (fixtures/original-published.json)

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { zscores, compute, assignMedals } = require('./build');

let checks = 0;
const near = (actual, expected, tol, what) => {
  checks++;
  assert.ok(
    actual != null && Math.abs(actual - expected) <= tol,
    `${what}: got ${actual}, expected ${expected} (±${tol})`
  );
};
const eq = (actual, expected, what) => { checks++; assert.strictEqual(actual, expected, what); };

// ---------- Part 1: synthetic, hand-checked ----------
// [2,4,4,4,5,5,7,9] has mean 5 and sample stdev 2 (sum of squared deviations 32, /7 = 4.571…).
{
  const z = zscores([2, 4, 4, 4, 5, 5, 7, 9]);
  const sd = Math.sqrt(32 / 7);
  near(z[0], (2 - 5) / sd, 1e-12, 'z of the lowest value');
  near(z[4], 0, 1e-12, 'z of a value at the mean');
  near(z.reduce((a, b) => a + b, 0), 0, 1e-12, 'z-scores sum to zero');
}

// A three-competitor field: one practical, one theory, both scored out of 10.
{
  const exams = [
    { key: 'p1', label: 'Prac', group: 'practical', max: 10, color: '#000', tag: '' },
    { key: 't1', label: 'Theo', group: 'theory', max: 10, color: '#000', tag: '' },
  ];
  const mk = (code, p, t) => ({ code, name: code, country: 'X', raw: { p1: p, t1: t }, z: {} });
  const students = compute(
    [mk('A', 9, 9), mk('B', 5, 5), mk('C', 1, 1)],
    exams,
    { 'score.base': 50, 'score.scale': 20, 'composite.practical': 'z-sum', 'composite.theory': 'raw-sum' }
  );
  const by = Object.fromEntries(students.map((s) => [s.code, s]));
  // Single-exam groups: the composite z is just that exam's z. Marks 9/5/1 → z of +1, 0, -1.
  near(by.A.zpractical, 1, 1e-9, 'top competitor practical z');
  near(by.B.zpractical, 0, 1e-9, 'middle competitor practical z');
  near(by.C.ztheory, -1, 1e-9, 'bottom competitor theory z');
  near(by.A.overall, 70, 1e-9, 'overall = 50 + 20 × 1');
  near(by.B.overall, 50, 1e-9, 'overall of an average competitor');
  near(by.C.overall, 30, 1e-9, 'overall = 50 + 20 × −1');
  eq(by.A.pos, 1, 'rank of the top competitor');
  eq(by.C.pos, 3, 'rank of the bottom competitor');
  near(by.A.leads, 20, 1e-9, 'gap from 1st to 2nd');
  eq(by.C.leads, null, 'last place leads nobody');

  const tiers = assignMedals(students, { 'medal.gold_through': 1, 'medal.silver_through': 2 });
  assert.deepStrictEqual(tiers, ['gold', 'silver'], 'blank tiers are dropped');
  eq(by.A.medal, 'gold', 'rank 1 medal');
  eq(by.B.medal, 'silver', 'rank 2 medal');
  eq(by.C.medal, 'none', 'rank past the last cut-off gets no medal');
}

// A competitor who missed one exam in a group gets no composite for that group, and no overall.
{
  const exams = [
    { key: 'p1', label: 'P1', group: 'practical', max: 10, color: '#000', tag: '' },
    { key: 'p2', label: 'P2', group: 'practical', max: 10, color: '#000', tag: '' },
    { key: 't1', label: 'T1', group: 'theory', max: 10, color: '#000', tag: '' },
  ];
  const mk = (code, p1, p2, t1) => ({ code, name: code, country: 'X', raw: { p1, p2, t1 }, z: {} });
  const students = compute(
    [mk('A', 9, 9, 9), mk('B', 5, 5, 5), mk('C', 1, null, 1)],
    exams,
    {}
  );
  const c = students.find((s) => s.code === 'C');
  eq(c.zpractical, null, 'no practical composite when an exam is missing');
  eq(c.overall, null, 'no overall score without every group');
  eq(c.pos, null, 'unscored competitor is left unranked');
  eq(c.pracRank, null, 'unscored competitor has no practical rank');
  eq(students.find((s) => s.code === 'A').pos, 1, 'ranking ignores unscored competitors');
}

console.log(`  synthetic maths      ${checks} checks passed`);

// ---------- Part 2: the original 302-competitor field ----------
const fixturePath = path.join(__dirname, 'fixtures', 'original-published.json');
if (!fs.existsSync(fixturePath)) {
  console.log('  original field       skipped (fixtures/original-published.json not present)');
} else {
  const before = checks;
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const exams = [
    { key: 'mb', label: 'Molecular Biology', group: 'practical', max: 100, color: '#408DC4', tag: 'LAB1' },
    { key: 'ap', label: 'Animal Physiology', group: 'practical', max: 93, color: '#5AAB55', tag: 'LAB2' },
    { key: 'am', label: 'Animal Morphology', group: 'practical', max: 105, color: '#844E94', tag: 'LAB3' },
    { key: 'pc', label: 'Plant & Comp. Biology', group: 'practical', max: 67.5, color: '#D24D3B', tag: 'LAB4' },
    { key: 'ta', label: 'Theory A', group: 'theory', max: 50, color: '#E8BC05', tag: '' },
    { key: 'tb', label: 'Theory B', group: 'theory', max: 50, color: '#c2960a', tag: '' },
  ];
  const students = compute(
    fixture.map((f) => ({ code: f.code, name: f.name, country: f.country, raw: { ...f.raw }, z: {} })),
    exams,
    { 'score.base': 50, 'score.scale': 20, 'composite.practical': 'z-sum', 'composite.theory': 'raw-sum' }
  );
  const by = Object.fromEntries(students.map((s) => [s.code, s]));

  // The published figures are rounded to 2–3 decimals, so 0.01 is the honest tolerance.
  for (const f of fixture) {
    const s = by[f.code];
    const e = f.expect;
    for (const k of ['mb', 'ap', 'am', 'pc']) {
      if (e.z[k] != null) near(s.z[k], e.z[k], 0.01, `${f.code} ${k} z`);
    }
    if (e.zprac != null) near(s.zpractical, e.zprac, 0.01, `${f.code} practical composite`);
    if (e.ztheo != null) near(s.ztheory, e.ztheo, 0.01, `${f.code} theory composite`);
    if (e.overall != null) near(s.overall, e.overall, 0.01, `${f.code} overall score`);
  }

  // Ranks. The fixture only carries the site's *rounded* figures, so it cannot settle the order
  // of two competitors whose true scores differ by less than that rounding — and the site split
  // exact ties into consecutive ranks where we share one. So assert the two things the published
  // data really does pin down:
  //   (a) wherever a pair is far enough apart for the rounding to be irrelevant, we agree on
  //       which competitor is ahead;
  //   (b) competitors we score identically all come out on the same rank.
  // Compared against the source's published *scores*, not its rank column: two of its rows
  // contradict their own scores (asserted below), so its ranks are not a trustworthy oracle.
  const expectedByCode = Object.fromEntries(fixture.map((f) => [f.code, f.expect]));
  for (const [key, rankKey, expectKey, precision] of [
    ['overall', 'pos', 'overall', 0.01],        // site published overall to 2 decimals
    ['zpractical', 'pracRank', 'zprac', 0.002], // …and the composites to 3
    ['ztheory', 'theoRank', 'ztheo', 0.002],
  ]) {
    const sat = students.filter((s) => s[key] != null && expectedByCode[s.code][expectKey] != null);
    let decided = 0, indeterminate = 0;
    for (let i = 0; i < sat.length; i++) {
      for (let j = i + 1; j < sat.length; j++) {
        const a = sat[i], b = sat[j];
        if (Math.abs(a[key] - b[key]) <= precision) { indeterminate++; continue; }
        decided++;
        checks++;
        const weSayAIsAhead = a[key] > b[key];
        const theySayAIsAhead = expectedByCode[a.code][expectKey] > expectedByCode[b.code][expectKey];
        assert.ok(weSayAIsAhead === theySayAIsAhead,
          `${rankKey}: we put ${a.code} ${weSayAIsAhead ? 'ahead of' : 'behind'} ${b.code}, the source site's published scores disagree`);
        // Our rank order must follow our own scores too.
        checks++;
        assert.ok(weSayAIsAhead === (a[rankKey] < b[rankKey]),
          `${rankKey}: ${a.code}/${b.code} ranked inconsistently with their scores`);
      }
    }
    const groups = new Map();
    for (const s of sat) groups.set(s[key], (groups.get(s[key]) ?? []).concat(s));
    let shared = 0;
    for (const [, group] of groups) {
      if (group.length > 1) shared++;
      for (const s of group) eq(s[rankKey], group[0][rankKey], `${s.code} shares its ${rankKey} with the rest of its tie`);
    }
    console.log(`  ${rankKey.padEnd(19)}${decided.toLocaleString()} orderings confirmed, `
      + `${indeterminate} pairs too close for the source's rounding to settle, ${shared} shared ranks`);
  }
  // The source site's own rank column contradicts its own scores in exactly two places. Pinned
  // here so that if the fixture is ever refreshed and the count changes, this check says so.
  const byPos = fixture.filter((f) => f.expect.pos != null).sort((a, b) => a.expect.pos - b.expect.pos);
  const sourceBugs = byPos.filter((f, i) => i > 0 && f.expect.overall > byPos[i - 1].expect.overall + 1e-9)
    .map((f, i, arr) => f.code);
  eq(sourceBugs.length, 2, 'known self-contradictions in the source site\'s rank column');
  console.log(`  source-data defects  ${sourceBugs.length} rows where the source ranks a lower score above a higher one (${sourceBugs.join(', ')}) — not reproduced`);
  console.log(`  original field       ${checks - before} checks passed across ${fixture.length} competitors`);
}

console.log(`\n  all ${checks} checks passed\n`);
