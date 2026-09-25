// Refreshes data/games.js with the top 100 games from BoardGameGeek.
//
// 1. Reads the ranking from https://boardgamegeek.com/browse/boardgame
// 2. Asks the XML API (https://boardgamegeek.com/using_the_xml_api) for the
//    image, year, description, average rating and "best with" player count.
//
// BGG requires an application token for the XML API. Register one at
// https://boardgamegeek.com/applications and run:
//
//   BGG_TOKEN=your-token node scripts/fetch-games.mjs

import { writeFile } from "node:fs/promises";

const TOKEN = process.env.BGG_TOKEN;
const LIMIT = 100;
const BATCH = 20; // the API accepts at most 20 ids per request
const OUT = new URL("../data/games.js", import.meta.url);

const headers = {
  "User-Agent": "board-games-slideshow (github.com/rocioes-design/board-games)",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers });
    // 202 means BGG queued the request; 429 means slow down
    if (res.status === 200) return res.text();
    if (res.status === 401) throw new Error("BGG rejected the request: set a valid BGG_TOKEN");
    await sleep(3000 * (i + 1));
  }
  throw new Error(`Gave up on ${url}`);
}

function decode(s = "") {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&rsquo;/g, "’")
    .replace(/&amp;/g, "&");
}

// Keeps the first sentence (or two, if the first is very short) of BGG's long description.
function shortDescription(raw) {
  const text = decode(decode(raw)).replace(/\s+/g, " ").trim();
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let out = sentences[0].trim();
  if (out.length < 60 && sentences[1]) out += " " + sentences[1].trim();
  return out.length > 180 ? out.slice(0, 177).replace(/\s+\S*$/, "") + "…" : out;
}

async function topIds() {
  const html = await get("https://boardgamegeek.com/browse/boardgame/page/1");
  const ids = [];
  for (const m of html.matchAll(/href="\/boardgame\/(\d+)\/[^"]*"\s+class='primary'|href="\/boardgame\/(\d+)\/[^"]*"\s+class="primary"/g)) {
    const id = m[1] || m[2];
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length < LIMIT) throw new Error(`Found only ${ids.length} games on the browse page`);
  return ids.slice(0, LIMIT);
}

function parseItem(xml) {
  const attr = (tag) => (xml.match(new RegExp(`<${tag}[^>]*value="([^"]*)"`)) || [])[1];
  const best = (xml.match(/<result name="bestwith" value="([^"]*)"/) || [])[1] || "";
  const players = best.replace(/^Best with\s*/i, "").replace(/\s*players?$/i, "");
  return {
    id: +(xml.match(/<item[^>]*id="(\d+)"/) || [])[1],
    name: decode((xml.match(/<name type="primary"[^>]*value="([^"]*)"/) || [])[1]),
    year: +attr("yearpublished") || null,
    image: ((xml.match(/<image>([^<]*)<\/image>/) || [])[1] || "").trim(),
    description: shortDescription((xml.match(/<description>([\s\S]*?)<\/description>/) || [])[1]),
    rating: Math.round(parseFloat(attr("average")) * 100) / 100,
    bestPlayers: players.replace(/–/g, "-"),
  };
}

async function main() {
  const ids = await topIds();
  const byId = new Map();
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const xml = await get(`https://boardgamegeek.com/xmlapi2/thing?id=${chunk.join(",")}&stats=1`);
    for (const item of xml.split(/(?=<item )/).slice(1)) {
      const game = parseItem(item);
      byId.set(String(game.id), game);
    }
    console.log(`Fetched ${Math.min(i + BATCH, ids.length)} / ${ids.length}`);
    await sleep(2000);
  }
  const games = ids.map((id, i) => ({ rank: i + 1, ...byId.get(id) }));
  const data = { source: "boardgamegeek", updated: new Date().toISOString().slice(0, 10), games };
  // Saved as a script (not plain JSON) so index.html also works when opened straight from disk
  await writeFile(OUT, "window.BOARD_GAMES = " + JSON.stringify(data, null, 2) + ";\n");
  console.log(`Saved ${games.length} games to data/games.js`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
