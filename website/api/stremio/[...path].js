/**
 * Vercel Serverless — Stremio Addon catch-all handler.
 *
 * Handles: /stremio/manifest.json, /stremio/meta/series/..., /stremio/subtitles/series/...
 *          /stremio/configure (landing page with config form)
 *
 * NOTE: CommonJS required — stremio-addon-sdk doesn't support ESM.
 */

const { getRouter } = require("stremio-addon-sdk");
const landingTemplate = require("stremio-addon-sdk/src/landingTemplate");
const builder = require("./lib/addon");

const MAINTENANCE_STREAM = JSON.stringify({
  streams: [{
    name: "🚧 ADDON DISABLED",
    description: "AnimeFillerChecker addon is currently disabled indefinitely.\nThere were too many requests coming in and my Vercel deployment can't provide it anymore. Until I find a sustainable hosting solution, the Stremio addon will stay offline.\nThe browser extension at animefillerchecker.com still works for filler info, visit the site for updates.\nIn the meantime you can still host the stremio addon on your local device on your own if you want.\n\nhttps://github.com/nehirakbass/anime-filler-checker",
    externalUrl: "https://github.com/nehirakbass/anime-filler-checker",
  }],
});
const MAINTENANCE_SUBTITLES = JSON.stringify({ subtitles: [] });

const addonInterface = builder.getInterface();
const router = getRouter(addonInterface);
const landingHTML = landingTemplate(addonInterface.manifest).replace(
  "</head>",
  `<style>
    input[type="checkbox"] { transform: scale(1.6); margin-right: 0.8vh; }
    .label-to-right { font-size: 1.7vh; }
    .gives, .gives + ul { display: none; }
  </style></head>`
).replaceAll(
  "window.location.host",
  "window.location.host + window.location.pathname.replace(/\\/configure$/, '')"
);

module.exports = (req, res) => {
  // Strip the /stremio prefix so the SDK router sees /manifest.json, /meta/..., etc.
  const strippedUrl = req.url.replace(/^\/stremio/, "") || "/";
  req.url = strippedUrl;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Maintenance mode: intercept early, serve cached static response
  if (builder.MAINTENANCE_MODE && /\/(stream|subtitles)\//.test(strippedUrl)) {
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 200;
    res.end(strippedUrl.includes("/subtitles/") ? MAINTENANCE_SUBTITLES : MAINTENANCE_STREAM);
    return;
  }

  // CDN caching
  const cleanUrl2 = strippedUrl.split("?")[0];
  if (cleanUrl2.includes("/manifest.json")) {
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  } else if (/\/(stream|subtitles)\//.test(cleanUrl2)) {
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
  }

  // Serve landing/configure page
  const cleanUrl = strippedUrl.split("?")[0].replace(/\/$/, "");
  if (cleanUrl === "/" || cleanUrl === "" || cleanUrl === "/configure") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(landingHTML);
    return;
  }

  router(req, res, () => {
    res.statusCode = 404;
    res.end(JSON.stringify({ err: "not found" }));
  });
};
