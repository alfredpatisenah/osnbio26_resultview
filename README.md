# Results site — GitHub Pages edition

A static competition-results page — podium, score histogram, searchable/sortable ranking table,
and a per-competitor exam breakdown — generated from a single Excel file, published by GitHub
Actions to GitHub Pages.

```bash
npm install
npm run build     # data.xlsx  ->  dist/
npm test          # check the scoring maths
npm run serve     # build and open a local server
```

This is the GitHub Pages variant of the project. The site itself is identical to the Netlify
edition — the only difference is `.github/workflows/deploy.yml` in place of `netlify.toml`.

---

## First-time setup

**1. Create the repo and push:**

```bash
cd ~/results-site-ghpages
git init -b main
git add .
git commit -m "OSN Biologi 2026 results site"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

**2. Turn Pages on:** in the repo, go to **Settings → Pages → Build and deployment → Source** and
select **GitHub Actions**. Not "Deploy from a branch" — the workflow needs the Actions source.

**3. Watch it deploy:** the **Actions** tab shows the run. First one takes about a minute. When it
finishes, your URL appears there and under Settings → Pages, as
`https://YOUR-USERNAME.github.io/YOUR-REPO/`.

That's it. From then on:

```bash
git add data.xlsx && git commit -m "update results" && git push
```

The workflow rebuilds and republishes automatically. **You never run `npm run build` for a
deploy** — GitHub does it.

---

## What the workflow does

`.github/workflows/deploy.yml` runs on every push to `main`:

1. `npm ci` — install from the lockfile
2. `npm test` — the scoring self-check (273,870 assertions)
3. `npm run build` — render `dist/` from `data.xlsx`
4. upload `dist/` and publish it to Pages

Steps 2 and 3 are both gates. If the maths breaks or `data.xlsx` has a bad cell, the run fails and
**the previously published site stays up untouched** — you never publish a broken page.

You can also re-deploy without a commit: **Actions → Deploy to GitHub Pages → Run workflow**.

---

## Two things to know about Pages

**Free GitHub Pages requires a public repository.** That makes `data.xlsx` publicly downloadable —
not just the rendered site, but the raw marks for every competitor. If that isn't acceptable, you
need GitHub Pro/Team (Pages on a private repo), or use the Netlify edition, where the repo can stay
private and only the built site is public.

**Project sites live under a subpath** (`username.github.io/repo-name/`). Every asset in the page is
referenced relatively (`assets/logo.png`, never `/assets/logo.png`), so this works with no
configuration. Don't change those to absolute paths or the images will 404 on Pages.

---

## Editing the data

Everything lives in **`data.xlsx`**. You only ever enter raw marks — every z-score, rank, medal
and overall score is recomputed at build time.

### Sheet `Results` — one row per competitor

| code | name | country | mb | ap | am | pc | ta | tb |
|---|---|---|---|---|---|---|---|---|
| KPR-S1 | DERICKSON LIE | Prov. Kepulauan Riau | 37.7 | 48 | 73 | 127 | 24.8 | 34.2 |

`code`, `name` and `country` are fixed. After them comes **one column per exam**, its header
matching a `key` from the `Exams` sheet. Leave a cell blank if the competitor did not sit that exam.

The part of `code` before the first `-` is shown as the region tag (`KPR-S1` → `KPR`).

The column is named `country` for historical reasons but it is just a grouping label — set
`label.region` / `label.region_plural` in `Config` to display it as Province, State, School, or
anything else. The column header itself must stay `country`.

### Sheet `Exams` — what the exams are

| key | label | group | max | color | tag |
|---|---|---|---|---|---|
| mb | Biologi Molekuler dan Biokimia | practical | 100 | #408DC4 | LAB1 |
| ta | Theory A | theory | 50 | #E8BC05 | |

- **`group`** must be `practical` or `theory`.
- **`max`** is the paper's maximum mark — it drives the progress bars and range-checks your data.
- **`tag`** is the small coloured pill in the breakdown; leave blank for a plain dot.

Add or remove rows freely. The table columns, the modal and the footer text all follow.

### Sheet `Config` — copy and rules

| key | meaning |
|---|---|
| `page.title` | browser tab title |
| `event.eyebrow` | small green line above the heading |
| `event.title` | the big heading |
| `event.subtitle` | line under the heading |
| `event.metrics_label` | caption over the medal counts |
| `event.footer` | sentence under the table |
| `label.region` | what the `country` column is called — `Country`, `Province`, `State`… |
| `label.region_plural` | its plural, used in "60 competitors · 17 provinces" |
| `medal.gold_through` | best rank through which Gold is awarded (`5` → ranks 1–5) |
| `medal.silver_through` | …through which Silver is awarded (`15` → ranks 6–15) |
| `medal.bronze_through` | …through which Bronze is awarded (`30` → ranks 16–30) |
| `medal.merit_through` | optional extra tier; leave blank and everyone past Bronze gets no medal |
| `score.base` / `score.scale` | overall score = `base + scale × mean(practical z, theory z)` |
| `composite.practical` | `z-sum` or `raw-sum` (see below) |
| `composite.theory` | `z-sum` or `raw-sum` |

---

## How the scoring works

1. **Per exam** — `z = (mark − mean) / stdev`, using the sample standard deviation (n−1), over
   everyone who sat that exam.
2. **Per group** — one composite z per group, controlled by `composite.<group>`:
   - `z-sum` — add up the group's *z-scores*, then z-score that sum. Right when the exams have
     different maximums or difficulties, since it weights each one equally.
   - `raw-sum` — add up the group's *raw marks*, then z-score that sum. Right when the papers are
     directly comparable.
3. **Overall** — `base + scale × mean(practical z, theory z)`, so an average competitor scores
   exactly `base`.
4. **Rank** — by overall score, descending.
5. **Medals** — by rank, using the `medal.*_through` cut-offs.

A competitor who misses any exam in a group gets no composite for that group, and therefore no
overall score and no rank. They still appear in the table, marked `—`.

**Ties share a rank.** Two identical scores both get rank 5, and the next competitor is 7th. This
matters because medals are handed out by rank: splitting a genuine tie would hand one competitor
Gold and the other Silver on nothing but spreadsheet row order.

---

## When the build fails

The build refuses to produce a page from data it does not understand, and tells you where to look:

```
Build stopped — problem in data.xlsx:
Sheet "Results", row 12, column "ta": "44.o" is not a number
```

It checks for unknown columns, missing exam columns, duplicate competitor codes, missing names,
non-numeric marks, and marks outside `0…max`. On GitHub this shows up as a failed Actions run,
with the live site left as it was.

---

## Swapping the branding

`assets/logo.png` and `assets/garland.png` are the header logo and the decorative strip beneath it.
Replace the two files — the template references them by name, so nothing else changes.

> The images currently in `assets/` are the IBO 2026 event's own branding, carried over from the
> site this page was modelled on. Replace them before publishing.

---

## Files

| | |
|---|---|
| `data.xlsx` | the only file you edit day to day |
| `build.js` | reads the spreadsheet, computes everything, writes `dist/` |
| `template.html` | page markup, CSS and browser JS — edit to restyle |
| `verify.js` | `npm test`; checks the maths, including against 302 rows of real published results |
| `.github/workflows/deploy.yml` | builds and publishes to Pages on every push |
