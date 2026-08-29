"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const { AegisContentError } = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "diagnostics.js"));
const Inspector = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "asset-inspector.js"));

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return output;
}

function rgbaPng(width, height, alphaValues) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = [];
  let pixel = 0;
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = 1 + x * 4;
      row[offset] = 240;
      row[offset + 1] = 200;
      row[offset + 2] = 80;
      row[offset + 3] = alphaValues[pixel++];
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function rgbaPngWithIdat(width, height, idat, interlace) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[12] = interlace || 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Complete FFmpeg/libwebp-encoded images, not synthesized RIFF/frame headers. The focused
// tests pass these bytes through the production FFmpeg decode gate before trusting metadata.
const REAL_WEBP_BASE64 = Object.freeze({
  opaqueLossless: "UklGRhwAAABXRUJQVlA4TA8AAAAvAUAAAAcQ/Y/+ByKi/wEA",
  alphaLossless: "UklGRhwAAABXRUJQVlA4TA8AAAAvAUAAEAcQ/Y/+BCKi/wEA",
  opaqueLossy: "UklGRjoAAABXRUJQVlA4IC4AAACQAQCdASoQABAAAUAmJaACdLoAA5gA/vtV4/+lwf/S4P/pcH/pcH8bss4bpAAA",
  alphaLossy: "UklGRloAAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSAUAAAAB6E9EBABWUDggLgAAAJABAJ0BKhAAEAABQCYloAJ0ugADmAD++1Xj/6XB/9Lg/+lwf+lwfxuyzhukAAA=",
});

// Complete lossless WebPs encoded from a 32 x 16, two-frame RGBA atlas. These
// fixtures exercise decoded pixels rather than trusting RIFF feature headers.
const REAL_ATLAS_WEBP_BASE64 = Object.freeze({
  clean: "UklGRi4AAABXRUJQVlA4TCIAAAAvH8ADEA8wyAM/UPMf8FDINgJ0j7/T6C6HENH/CdCd0k13",
  dirty: "UklGRkQAAABXRUJQVlA4TDcAAAAvH8ADEBcgEEjCH21EsWAy1PyvEAZq/gP+AgoZSZLqPr9FWp4xvSWI6H8kCWx6qF6r90NjIEkAAA==",
  magenta: "UklGRj4AAABXRUJQVlA4TDEAAAAvH8ADEBcwyAKBJH/bCRYIJCnuD/P8B/gLFLVtA6Xf8gdQsjsRRPR/AvgfQ9xQQfUeAA==",
  matte: "UklGRiYAAABXRUJQVlA4TBoAAAAvH8ADEA8wUAM1UPMf8BAIJP7SDbBARP9TNw==",
});

function realWebp(name) {
  return Buffer.from(REAL_WEBP_BASE64[name], "base64");
}

function realAtlasWebp(name) {
  return Buffer.from(REAL_ATLAS_WEBP_BASE64[name], "base64");
}

function atlasOptions(overrides) {
  return Object.assign({
    columns: 2,
    rows: 1,
    frameWidthPx: 16,
    frameHeightPx: 16,
    cornerSampleSizePx: 2,
  }, overrides);
}

function webpChunk(type, data) {
  const output = Buffer.alloc(8 + data.length + (data.length & 1));
  output.write(type, 0, 4, "ascii");
  output.writeUInt32LE(data.length, 4);
  data.copy(output, 8);
  return output;
}

function riffWebp(chunks) {
  const body = Buffer.concat([Buffer.from("WEBP", "ascii")].concat(chunks));
  const output = Buffer.alloc(8 + body.length);
  output.write("RIFF", 0, 4, "ascii");
  output.writeUInt32LE(body.length, 4);
  body.copy(output, 8);
  return output;
}

function webpChunks(bytes) {
  const output = [];
  let offset = 12;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    output.push({
      type: bytes.toString("ascii", offset, offset + 4),
      length: length,
      dataStart: dataStart,
      dataEnd: dataEnd,
    });
    offset = dataEnd + (length & 1);
  }
  return output;
}

function appendWebpChunk(bytes, type, data) {
  const output = Buffer.concat([bytes, webpChunk(type, data)]);
  output.writeUInt32LE(output.length - 8, 4);
  return output;
}

function headerOnlyWebp(width, height, hasAlpha) {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = hasAlpha ? 0x10 : 0;
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  vp8x[4] = widthMinusOne & 0xff;
  vp8x[5] = (widthMinusOne >>> 8) & 0xff;
  vp8x[6] = (widthMinusOne >>> 16) & 0xff;
  vp8x[7] = heightMinusOne & 0xff;
  vp8x[8] = (heightMinusOne >>> 8) & 0xff;
  vp8x[9] = (heightMinusOne >>> 16) & 0xff;
  const vp8 = Buffer.alloc(10);
  vp8[3] = 0x9d;
  vp8[4] = 0x01;
  vp8[5] = 0x2a;
  vp8.writeUInt16LE(width, 6);
  vp8.writeUInt16LE(height, 8);
  const chunks = [webpChunk("VP8X", vp8x)];
  if (hasAlpha) chunks.push(webpChunk("ALPH", Buffer.from([0])));
  chunks.push(webpChunk("VP8 ", vp8));
  return riffWebp(chunks);
}

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, String(error));
    assert.equal(error.diagnostics[0].code, code);
    if (diagnosticPath !== undefined) assert.equal(error.diagnostics[0].path, diagnosticPath);
    return true;
  });
}

function temporaryRoot(t) {
  const prefix = path.join(os.tmpdir(), "aegis-asset-inspector-");
  const root = fs.mkdtempSync(prefix);
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  t.after(function () {
    if (path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + "aegis-asset-inspector-")) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  return root;
}

test("asset inspector measures PNG pixels, actual alpha, hashes, and decoded bytes", () => {
  const transparent = rgbaPng(2, 1, [255, 0]);
  const measured = Inspector.inspectImageBuffer(transparent, "art/unit.png");
  assert.deepEqual(measured, {
    relativeUrl: "art/unit.png",
    format: "png",
    sha256: "sha256:" + crypto.createHash("sha256").update(transparent).digest("hex"),
    widthPx: 2,
    heightPx: 1,
    alphaMode: "alpha",
    transferBytes: transparent.length,
    decodedBytes: 8,
  });
  assert.equal(Object.isFrozen(measured), true);

  const opaque = Inspector.inspectImageBuffer(rgbaPng(1, 1, [255]), "art/opaque.png");
  assert.equal(opaque.alphaMode, "opaque");
});

test("asset inspector decodes real lossless and extended lossy WebP pixels", () => {
  const fixtures = [
    ["opaqueLossless", 2, 2, "opaque"],
    ["alphaLossless", 2, 2, "alpha"],
    ["opaqueLossy", 16, 16, "opaque"],
    ["alphaLossy", 16, 16, "alpha"],
  ];
  fixtures.forEach(function (fixture) {
    const bytes = realWebp(fixture[0]);
    const measured = Inspector.inspectImageBuffer(bytes, "art/" + fixture[0] + ".webp");
    assert.equal(measured.widthPx, fixture[1]);
    assert.equal(measured.heightPx, fixture[2]);
    assert.equal(measured.alphaMode, fixture[3]);
    assert.equal(measured.decodedBytes, fixture[1] * fixture[2] * 4);
    assert.equal(measured.sha256, "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex"));
  });
});

test("atlas inspection exposes bounded scalar transparency and gutter proof", (t) => {
  const bytes = realAtlasWebp("clean");
  const result = Inspector.inspectAtlasImageBuffer(bytes, "art/clean-atlas.webp", atlasOptions());
  assert.deepEqual(result.inspection, Inspector.inspectImageBuffer(bytes, "art/clean-atlas.webp"));
  assert.deepEqual(result.transparency, {
    alphaClearMaximum: 8,
    cornerSampleSizePx: 2,
    minimumRequiredFrameClearPixelBasisPoints: 3000,
    maximumAllowedFramePerimeterVisibleBasisPoints: 5000,
    maximumAllowedFrameCornerVisibleBasisPoints: 5000,
    maximumAllowedFrameMagentaPerimeterBasisPoints: 40,
    maximumAllowedFrameMagentaCornerBasisPoints: 0,
    totalPixelCount: 512,
    transparentPixelCount: 480,
    clearPixelCount: 480,
    translucentPixelCount: 0,
    opaquePixelCount: 32,
    clearPixelBasisPoints: 9375,
    minimumFrameClearPixelBasisPoints: 9375,
    perimeterPixelCount: 120,
    visiblePerimeterPixelCount: 0,
    maximumFrameVisiblePerimeterBasisPoints: 0,
    cornerPixelCount: 32,
    visibleCornerPixelCount: 0,
    maximumFrameVisibleCornerBasisPoints: 0,
    visibleMagentaPerimeterPixelCount: 0,
    maximumFrameVisibleMagentaPerimeterBasisPoints: 0,
    visibleMagentaCornerPixelCount: 0,
    maximumFrameVisibleMagentaCornerBasisPoints: 0,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.inspection), true);
  assert.equal(Object.isFrozen(result.transparency), true);
  assert.equal(Object.values(result).some(Buffer.isBuffer), false);

  const root = temporaryRoot(t);
  fs.mkdirSync(path.join(root, "art"));
  fs.writeFileSync(path.join(root, "art", "clean-atlas.webp"), bytes);
  assert.deepEqual(
    Inspector.inspectAtlasAsset(root, "art/clean-atlas.webp", atlasOptions()),
    result
  );
});

test("atlas inspection rejects false-alpha matte, chroma-magenta residue, and dirty frame guards", () => {
  expectDiagnostic(
    () => Inspector.inspectAtlasImageBuffer(
      realAtlasWebp("matte"), "art/false-alpha-matte.webp", atlasOptions()
    ),
    "ASSET_ATLAS_MATTE",
    "/relativeUrl"
  );
  expectDiagnostic(
    () => Inspector.inspectAtlasImageBuffer(
      realAtlasWebp("magenta"), "art/magenta-residue.webp", atlasOptions()
    ),
    "ASSET_ATLAS_MAGENTA",
    "/relativeUrl"
  );
  expectDiagnostic(
    () => Inspector.inspectAtlasImageBuffer(
      realAtlasWebp("dirty"), "art/dirty-gutter.webp", atlasOptions()
    ),
    "ASSET_ATLAS_GUTTER",
    "/relativeUrl"
  );
});

test("atlas inspection validates exact frame geometry and bounded corner sampling", () => {
  expectDiagnostic(
    () => Inspector.inspectAtlasImageBuffer(
      realAtlasWebp("clean"), "art/wrong-grid.webp", atlasOptions({ columns: 3 })
    ),
    "ASSET_ATLAS_DIMENSION",
    "/relativeUrl"
  );
  expectDiagnostic(
    () => Inspector.inspectAtlasImageBuffer(
      realAtlasWebp("clean"), "art/bad-corners.webp", atlasOptions({ cornerSampleSizePx: 9 })
    ),
    "ASSET_ATLAS_OPTION",
    "/options/cornerSampleSizePx"
  );
});

test("asset inspector rejects header-only, decoder-truncated, duplicate, and mixed WebP frames", () => {
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(headerOnlyWebp(3, 2, true), "art/header-only.webp"),
    "ASSET_IMAGE_FORMAT",
    "/relativeUrl"
  );

  const lossless = realWebp("opaqueLossless");
  const losslessFrame = webpChunks(lossless).find(function (chunk) { return chunk.type === "VP8L"; });
  const decoderTruncated = riffWebp([
    webpChunk("VP8L", lossless.subarray(losslessFrame.dataStart, losslessFrame.dataStart + 6)),
  ]);
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(decoderTruncated, "art/decoder-truncated.webp"),
    "ASSET_IMAGE_FORMAT",
    "/relativeUrl"
  );

  const lossy = realWebp("opaqueLossy");
  const lossyFrame = webpChunks(lossy).find(function (chunk) { return chunk.type === "VP8 "; });
  const duplicate = appendWebpChunk(
    lossy,
    "VP8 ",
    lossy.subarray(lossyFrame.dataStart, lossyFrame.dataEnd)
  );
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(duplicate, "art/duplicate.webp"),
    "ASSET_IMAGE_FORMAT",
    "/relativeUrl"
  );
  const mixed = appendWebpChunk(
    lossy,
    "VP8L",
    lossless.subarray(losslessFrame.dataStart, losslessFrame.dataEnd)
  );
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(mixed, "art/mixed.webp"),
    "ASSET_IMAGE_FORMAT",
    "/relativeUrl"
  );
});

test("asset inspector rejects WebP canvas mismatch, invalid ALPH, and false alpha declarations", () => {
  const canvasMismatch = realWebp("alphaLossy");
  const mismatchHeader = webpChunks(canvasMismatch).find(function (chunk) { return chunk.type === "VP8X"; });
  canvasMismatch[mismatchHeader.dataStart + 4] = 16;
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(canvasMismatch, "art/canvas-mismatch.webp"),
    "ASSET_IMAGE_FORMAT",
    "/relativeUrl"
  );

  const invalidAlpha = realWebp("alphaLossy");
  const alphaChunk = webpChunks(invalidAlpha).find(function (chunk) { return chunk.type === "ALPH"; });
  invalidAlpha[alphaChunk.dataStart] = (invalidAlpha[alphaChunk.dataStart] & 0xfc) | 0x03;
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(invalidAlpha, "art/invalid-alpha.webp"),
    "ASSET_IMAGE_FORMAT",
    "/relativeUrl"
  );

  const falseAlpha = realWebp("opaqueLossless");
  const losslessChunk = webpChunks(falseAlpha).find(function (chunk) { return chunk.type === "VP8L"; });
  falseAlpha.writeUInt32LE(falseAlpha.readUInt32LE(losslessChunk.dataStart + 1) | 0x10000000,
    losslessChunk.dataStart + 1);
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(falseAlpha, "art/false-alpha.webp"),
    "ASSET_ALPHA_MISMATCH",
    "/relativeUrl"
  );
});

test("WebP decoder availability is an explicit fail-closed tooling precondition", () => {
  assert.match(Inspector.WEBP_DECODER_PRECONDITION, /FFmpeg.*WebP decoder/i);
  const missingExecutable = path.join(os.tmpdir(), "aegis-definitely-missing-ffmpeg-" + process.pid);
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(realWebp("opaqueLossless"), "art/opaque.webp", {
      ffmpegPath: missingExecutable,
    }),
    "ASSET_DECODER_UNAVAILABLE",
    "/options/ffmpegPath"
  );
});

test("PNG decompression is bounded and interlaced alpha is never inferred from metadata", () => {
  const oversizedBeforeInflate = rgbaPngWithIdat(4096, 1, Buffer.from("not-zlib"), 0);
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(oversizedBeforeInflate, "art/oversized.png"),
    "ASSET_DIMENSION",
    "/relativeUrl"
  );

  const decompressionBomb = rgbaPngWithIdat(1, 1, zlib.deflateSync(Buffer.alloc(100000)), 0);
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(decompressionBomb, "art/bomb.png"),
    "ASSET_IMAGE_FORMAT",
    "/relativeUrl"
  );

  const interlaced = rgbaPngWithIdat(1, 1, zlib.deflateSync(Buffer.from([0, 1, 2, 3, 0])), 1);
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(interlaced, "art/interlaced.png"),
    "ASSET_IMAGE_FORMAT",
    "/relativeUrl"
  );
});

test("asset inspector rejects bad signatures and unsafe traversal", (t) => {
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(Buffer.from("not a png"), "art/bad.png"),
    "ASSET_SIGNATURE",
    "/relativeUrl"
  );
  const root = temporaryRoot(t);
  expectDiagnostic(() => Inspector.inspectAsset(root, "../outside.png"), "ASSET_REFERENCE", "/relativeUrl");
  expectDiagnostic(() => Inspector.inspectAsset(root, "art/../../outside.png"), "ASSET_REFERENCE", "/relativeUrl");
});

test("asset inspector enforces exact filesystem case and contained regular files", (t) => {
  const root = temporaryRoot(t);
  fs.mkdirSync(path.join(root, "Art"));
  fs.writeFileSync(path.join(root, "Art", "Unit.png"), rgbaPng(1, 1, [0]));

  const measured = Inspector.inspectAsset(root, "Art/Unit.png");
  assert.equal(measured.alphaMode, "alpha");
  expectDiagnostic(() => Inspector.inspectAsset(root, "art/Unit.png"), "ASSET_CASE", "/relativeUrl");
  expectDiagnostic(() => Inspector.inspectAsset(root, "Art/unit.png"), "ASSET_CASE", "/relativeUrl");
});

test("asset inspector compares every manifest measurement claim", () => {
  const measured = Inspector.inspectImageBuffer(rgbaPng(2, 1, [255, 0]), "art/unit.png");
  const claim = {
    relativeUrl: measured.relativeUrl,
    sha256: measured.sha256,
    widthPx: measured.widthPx,
    heightPx: measured.heightPx,
    alphaMode: measured.alphaMode,
    transferBytes: measured.transferBytes,
    decodedBytes: measured.decodedBytes,
  };
  assert.strictEqual(Inspector.compareManifestClaim(claim, measured), measured);
  claim.widthPx += 1;
  expectDiagnostic(
    () => Inspector.compareManifestClaim(claim, measured),
    "ASSET_CLAIM_MISMATCH",
    "/asset/widthPx"
  );
});

test("asset inspector enforces compressed-byte and maximum-dimension budgets", () => {
  const bytes = rgbaPng(2, 1, [255, 255]);
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(bytes, "art/wide.png", { maxIndividualBytes: bytes.length - 1 }),
    "ASSET_SIZE",
    "/relativeUrl"
  );
  expectDiagnostic(
    () => Inspector.inspectImageBuffer(bytes, "art/wide.png", { maxDimensionPx: 1 }),
    "ASSET_DIMENSION",
    "/relativeUrl"
  );
});
