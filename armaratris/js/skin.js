/* Skin loader: turns skin/<name>/skin.json into CSS variables, fonts, strings and the Greek-key frame. */
(function (global) {
  "use strict";
  const A = global.Armaratris = global.Armaratris || {};
  A.skins = A.skins || {};

  const FALLBACK = "armara";
  const SERIF = 'Georgia, "Times New Roman", serif';

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function fetchSkin(name) {
    const base = "skin/" + name + "/";
    if (location.protocol !== "file:") {
      try {
        const r = await fetch(base + "skin.json", { cache: "no-store" });
        if (r.ok) return await r.json();
      } catch (e) { /* offline — fall through */ }
    }
    try { await loadScript(base + "skin.js"); } catch (e) { /* missing */ }
    return A.skins[name] || null;
  }

  // A square-spiral tile, repeated as a pattern → reads as a Greek key in any orientation.
  function frameDataUri(color) {
    const tile = "<path d='M1.5 22.5V1.5H22.5V22.5H7.5V7.5H16.5V16.5H13.5' fill='none' stroke='" + color + "' stroke-width='3'/>";
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'>" +
      "<defs><pattern id='k' width='24' height='24' patternUnits='userSpaceOnUse'>" + tile + "</pattern></defs>" +
      "<rect width='72' height='72' fill='url(#k)'/></svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function applySkin(skin) {
    const root = document.documentElement.style;
    Object.keys(skin.palette).forEach(function (k) { root.setProperty("--c-" + k, skin.palette[k]); });
    root.setProperty("--font-display", '"' + skin.fonts.display + '", ' + SERIF);
    root.setProperty("--font-body", '"' + skin.fonts.body + '", ' + SERIF);
    root.setProperty("--frame-image", frameDataUri(skin.palette.frame));

    if (skin.fonts.googleFonts && !document.getElementById("skinFonts")) {
      const link = document.createElement("link");
      link.id = "skinFonts"; link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?" + skin.fonts.googleFonts + "&display=swap";
      document.head.appendChild(link);
    }
    document.title = skin.title;
    document.querySelectorAll("[data-str]").forEach(function (el) {
      const key = el.getAttribute("data-str");
      if (key === "title") el.textContent = skin.title;
      else if (skin.strings[key] !== undefined) el.textContent = skin.strings[key];
    });
    const tagline = document.getElementById("tagline"); if (tagline) tagline.textContent = skin.tagline;
    const wordmark = document.getElementById("wordmark"); if (wordmark) wordmark.textContent = skin.title.replace(/TRIS$/i, "");
    ["titleLogo", "brandLogo"].forEach(function (id) {
      const img = document.getElementById(id); if (img) img.src = skin.base + skin.logo;
    });
    const favicon = document.getElementById("favicon"); if (favicon) favicon.href = skin.base + skin.logo;
    const theme = document.querySelector('meta[name="theme-color"]'); if (theme) theme.content = skin.palette.bg;
  }

  function preloadLogo(skin) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () { skin.logoImage = img; resolve(); };
      img.onerror = function () { skin.logoImage = null; resolve(); };
      img.src = skin.base + skin.logo;
    });
  }

  async function loadSkin(name) {
    name = (name || FALLBACK).replace(/[^a-z0-9_-]/gi, "").toLowerCase() || FALLBACK;
    let skin = await fetchSkin(name);
    if (!skin && name !== FALLBACK) {
      console.warn("Armaratris: skin '" + name + "' not found, falling back to '" + FALLBACK + "'");
      name = FALLBACK;
      skin = await fetchSkin(name);
    }
    if (!skin) throw new Error("Armaratris: no skin could be loaded");
    skin = JSON.parse(JSON.stringify(skin));
    skin.base = "skin/" + name + "/";
    applySkin(skin);
    await preloadLogo(skin);
    return skin;
  }

  A.loadSkin = loadSkin;
  A.frameDataUri = frameDataUri;
})(typeof window !== "undefined" ? window : globalThis);
