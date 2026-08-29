"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const Inspector = require("../../../tools/lib/aegis/asset-inspector.js");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const AEGIS_ROOT = path.resolve(__dirname, "..");
const PREVIEW_PATH = path.join(AEGIS_ROOT, "art-preview.html");
const INDEX_PATH = path.join(AEGIS_ROOT, "index.html");

function markup() {
  return fs.readFileSync(PREVIEW_PATH, "utf8");
}

function inspectAegis(relativeUrl) {
  return Inspector.inspectAsset(AEGIS_ROOT, relativeUrl, {
    maxDimensionPx: 4096,
    maxIndividualBytes: 2 * 1024 * 1024,
  });
}

test("art showcase is explicitly local, non-production, and unlinked from the game", function () {
  const html = markup();
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.equal((html.match(/LOCAL ART PREVIEW \/ NON-PRODUCTION/g) || []).length, 2);
  assert.match(html, /<body class="aegis-art" data-preview-only="true">/);
  assert.doesNotMatch(fs.readFileSync(INDEX_PATH, "utf8"), /art-preview\.html/i);
  assert.doesNotMatch(html, /release-selector|preview-loader|content\/generated|game\.js|engine\.js|renderer\.js|<canvas\b/i);
  assert.equal((html.match(/<script\b/g) || []).length, 1);
  assert.match(html, /<script src="js\/presentation\/ui-theme\.js" defer><\/script>/);
});

test("showcase consumes the shared art system and canonical Armara logo as a live image", function () {
  const html = markup();
  assert.match(html, /<link rel="stylesheet" href="css\/aegis-art-system\.css">/);
  assert.match(html, /<img class="showcase-brand-logo" src="skin\/armara\/logo\.png"[^>]+alt="Armara">/);
  assert.doesNotMatch(html, /background(?:-image)?:[^;}]*logo\.png/i);

  const logo = inspectAegis("skin/armara/logo.png");
  assert.deepEqual(
    { format: logo.format, widthPx: logo.widthPx, heightPx: logo.heightPx, alphaMode: logo.alphaMode },
    { format: "png", widthPx: 1254, heightPx: 1254, alphaMode: "alpha" }
  );
});

test("responsive picture selects the accepted landscape and portrait shell art", function () {
  const html = markup();
  assert.match(html, /<picture class="showcase-shell-picture" aria-hidden="true">/);
  assert.match(html, /<source media="\(orientation: portrait\)" srcset="art\/v2\/ui\/shell-portrait-v1\.webp">/);
  assert.match(html, /<source media="\(orientation: landscape\)" srcset="art\/v2\/ui\/shell-landscape-v1\.webp">/);
  assert.match(html, /<img src="art\/v2\/ui\/shell-landscape-v1\.webp" width="2048" height="1280" alt=""/);

  const landscape = inspectAegis("art/v2/ui/shell-landscape-v1.webp");
  const portrait = inspectAegis("art/v2/ui/shell-portrait-v1.webp");
  assert.deepEqual([landscape.widthPx, landscape.heightPx, landscape.alphaMode], [2048, 1280, "opaque"]);
  assert.deepEqual([portrait.widthPx, portrait.heightPx, portrait.alphaMode], [1000, 1600, "opaque"]);
});

test("every accepted UI raster is present at exact case and used without baked labels", function () {
  const html = markup();
  const expected = [
    ["art/v2/ui/panel-4x3-v1.webp", 1024, 768],
    ["art/v2/ui/act-1-attican-v1.webp", 1536, 512],
    ["art/v2/ui/act-2-aegean-v1.webp", 1536, 512],
    ["art/v2/ui/act-3-oracle-v1.webp", 1536, 512],
    ["art/v2/ui/act-4-titan-v1.webp", 1536, 512],
    ["art/v2/ui/victory-share-v1.webp", 1200, 630],
  ];
  expected.forEach(function (entry) {
    const inspection = inspectAegis(entry[0]);
    assert.match(html, new RegExp("<img src=\\\"" + entry[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\\"[^>]+alt=\\\"\\\""));
    assert.deepEqual([inspection.format, inspection.widthPx, inspection.heightPx], ["webp", entry[1], entry[2]]);
  });

  [
    "Tower store",
    "Choose a defense",
    "Wave incoming",
    "Sentinel · Rank II",
    "The Attican Front",
    "The Aegean Reach",
    "The Oracle Depths",
    "The Titan Ascendant",
    "Gate of Dawn secured",
  ].forEach(function (label) {
    assert.ok(html.includes(label), "missing live label: " + label);
  });
});

test("component specimens cover interactive, affordability, warning, modal, sheet, and live-status states", function () {
  const html = markup();
  [
    "aegis-art-panel",
    "aegis-art-card",
    "aegis-art-button",
    "aegis-art-chip",
    "aegis-art-nav",
    "aegis-art-nav-item",
    "aegis-art-modal",
    "aegis-art-sheet",
    "aegis-art-live",
  ].forEach(function (className) {
    assert.match(html, new RegExp("\\b" + className + "\\b"), className);
  });
  assert.match(html, /data-affordability="unaffordable" aria-disabled="true"/);
  assert.match(html, /data-state="warning"/);
  assert.match(html, /role="dialog" aria-modal="false"/);
  assert.match(html, /class="aegis-art-live" role="status"/);
  assert.doesNotMatch(html, /<button(?![^>]*\btype="button")[^>]*>/i);
});

test("all four campaign banners and victory statistics are live and structured", function () {
  const html = markup();
  ["Act I", "Act II", "Act III", "Act IV"].forEach(function (act) {
    assert.match(html, new RegExp(">" + act + "<"));
  });
  assert.equal((html.match(/class="showcase-act-banner"/g) || []).length, 4);
  assert.equal((html.match(/class="showcase-share-stats"/g) || []).length, 1);
  assert.match(html, /<data value="18">18 \/ 20<\/data>/);
  assert.match(html, /<data value="12">12<\/data>/);
  assert.match(html, /<data value="430">430<\/data>/);
  assert.match(html, /Share card preview<\/button>/);
});

test("M01 road proof is displayed and links to the deterministic self-contained SVG", function () {
  const html = markup();
  const pngUrl = "docs/aegis/art-guides/m01-player-road-preview.png";
  const svgPath = path.join(REPO_ROOT, "docs", "aegis", "art-guides", "m01-player-road-preview.svg");
  const inspection = Inspector.inspectAsset(REPO_ROOT, pngUrl, {
    maxDimensionPx: 4096,
    maxIndividualBytes: 16 * 1024 * 1024,
  });
  assert.deepEqual([inspection.format, inspection.widthPx, inspection.heightPx], ["png", 2048, 1280]);
  assert.equal(fs.existsSync(svgPath), true);
  assert.match(html, /href="\.\.\/\.\.\/docs\/aegis\/art-guides\/m01-player-road-preview\.svg"/);
  assert.match(html, /src="\.\.\/\.\.\/docs\/aegis\/art-guides\/m01-player-road-preview\.png" width="2048" height="1280"/);
  assert.match(html, /alt="Gate of Dawn battlefield with one narrow ancient road transitioning from earth to limestone and city cobbles"/);
});

test("accepted M01 enemy atlases retain exact 4 by 2 frame geometry", function () {
  const html = markup();
  const atlases = [
    "art/v2/m01/enemies/scout-anim-v1.webp",
    "art/v2/m01/enemies/raider-anim-v1.webp",
  ];
  atlases.forEach(function (relativeUrl) {
    const inspection = inspectAegis(relativeUrl);
    assert.deepEqual(
      [inspection.format, inspection.widthPx, inspection.heightPx, inspection.alphaMode],
      ["webp", 1024, 512, "alpha"]
    );
    assert.equal(inspection.widthPx / 4, 256, relativeUrl + " frame width");
    assert.equal(inspection.heightPx / 2, 256, relativeUrl + " frame height");
    assert.ok(html.includes('url("' + relativeUrl + '")'), relativeUrl);
  });
  assert.match(html, /--showcase-sprite-columns:\s*4/);
  assert.match(html, /--showcase-sprite-rows:\s*2/);
  assert.match(html, /--showcase-sprite-frame-source:\s*256px/);
  assert.match(html, /background-size:\s*400% 200%/);
  assert.doesNotMatch(html, /repeating-conic-gradient|checkerboard|#f{2}00f{2}/i);
});

test("enemy showcase animates both atlas rows and offers pause and reduced-motion static poses", function () {
  const html = markup();
  assert.equal((html.match(/class="showcase-sprite showcase-sprite--(?:scout|raider) showcase-sprite--(?:movement|combat)"/g) || []).length, 4);
  assert.match(html, /@keyframes showcase-sprite-row-top/);
  assert.match(html, /@keyframes showcase-sprite-row-bottom/);
  assert.match(html, /animation:\s*showcase-sprite-row-top 880ms linear infinite/);
  assert.match(html, /animation:\s*showcase-sprite-row-bottom 1120ms linear infinite/);
  ["0% 0%", "33.333333% 0%", "66.666667% 0%", "100% 0%", "0% 100%", "33.333333% 100%", "66.666667% 100%", "100% 100%"].forEach(function (position) {
    assert.ok(html.includes("background-position: " + position), position);
  });
  assert.match(html, /id="unit-motion-paused" type="checkbox"/);
  assert.match(html, /#unit-motion-paused:checked ~ \.showcase-enemy-grid \.showcase-sprite,[\s\S]*?animation-play-state: paused;/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.showcase-sprite\s*{\s*animation: none !important;/);
  assert.match(html, /\.showcase-sprite--movement\s*{\s*background-position: 33\.333333% 0%;/);
  assert.match(html, /\.showcase-sprite--combat\s*{\s*background-position: 100% 100%;/);
  assert.match(html, /Pause \/ resume unit animations/);
  assert.match(html, /Reduced-motion mode shows meaningful static poses/);
});

test("accepted tower atlases retain exact 4 by 3 upgrade and action geometry", function () {
  const html = markup();
  const atlases = [
    "art/v2/m01/towers/sentinel-anim-v1.webp",
    "art/v2/m01/towers/chronos-anim-v1.webp",
    "art/v2/m01/towers/siege-anim-v1.webp",
  ];
  atlases.forEach(function (relativeUrl) {
    const inspection = inspectAegis(relativeUrl);
    assert.deepEqual(
      [inspection.format, inspection.widthPx, inspection.heightPx, inspection.alphaMode],
      ["webp", 1024, 768, "alpha"]
    );
    assert.equal(inspection.widthPx / 4, 256, relativeUrl + " frame width");
    assert.equal(inspection.heightPx / 3, 256, relativeUrl + " frame height");
    assert.ok(html.includes('url("' + relativeUrl + '")'), relativeUrl);
  });
  assert.match(html, /--showcase-tower-columns:\s*4/);
  assert.match(html, /--showcase-tower-rows:\s*3/);
  assert.match(html, /--showcase-tower-frame-source:\s*256px/);
  assert.match(html, /background-size:\s*400% 300%/);
});

test("tower showcase exposes all upgrade rows and one real four-frame cycle per tower", function () {
  const html = markup();
  assert.equal((html.match(/class="showcase-tower-level"/g) || []).length, 9);
  assert.equal((html.match(/showcase-tower-sprite--animated" role="img"/g) || []).length, 3);
  assert.equal((html.match(/>Level I<\/figcaption>/g) || []).length, 3);
  assert.equal((html.match(/>Level II<\/figcaption>/g) || []).length, 3);
  assert.equal((html.match(/>Level III<\/figcaption>/g) || []).length, 3);
  assert.match(html, /\.showcase-tower-sprite--level-1\s*{\s*background-position: 0% 0%;/);
  assert.match(html, /\.showcase-tower-sprite--level-2\s*{\s*background-position: 0% 50%;/);
  assert.match(html, /\.showcase-tower-sprite--level-3\s*{\s*background-position: 0% 100%;/);
  assert.match(html, /@keyframes showcase-tower-row-level-3/);
  assert.match(html, /animation:\s*showcase-tower-row-level-3 1280ms linear infinite/);
  ["Idle A", "Idle B", "Active / fire", "Recovery / hit"].forEach(function (label) {
    assert.ok(html.includes(label), label);
  });
});

test("tower cycles share pause control and become a meaningful static fire frame for reduced motion", function () {
  const html = markup();
  assert.match(html, /#unit-motion-paused:checked ~ \.showcase-tower-showcase \.showcase-tower-sprite--animated[\s\S]*?animation-play-state: paused;/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.showcase-tower-sprite--animated\s*{\s*animation: none !important;\s*background-position: 66\.666667% 100%;\s*will-change: auto;/);
  assert.match(html, /href="#towers">Towers<\/a>/);
  assert.match(html, /id="towers" aria-labelledby="towers-title"/);
});

test("preview declares safe responsive layouts for 320, 390, 768, and 1280 CSS pixels", function () {
  const html = markup();
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  ["80rem", "48rem", "24.375rem", "20rem"].forEach(function (breakpoint) {
    assert.ok(html.includes("@media (max-width: " + breakpoint + ")"), breakpoint);
  });
  assert.match(html, /@media \(orientation: portrait\)/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /env\(safe-area-inset-(?:top|right|bottom|left)\)/);
  assert.match(html, /min-inline-size: 0/);
  assert.match(html, /flex-wrap: wrap/);
  assert.doesNotMatch(html, /font-size:\s*\d+(?:\.\d+)?px/i);
});
