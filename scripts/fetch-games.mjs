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

import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";

const TOKEN = process.env.BGG_TOKEN;
const LIMIT = 100;
const BATCH = 20; // the API accepts at most 20 ids per request
const OUT = new URL("../data/games.js", import.meta.url);
const COVERS = new URL("../assets/covers/", import.meta.url);
const COVER_WIDTH = 900; // plenty for the card, a fraction of BGG's original size

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

// named HTML entities BGG uses in its text (numeric ones are handled generically)
const ENTITIES = {
  quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", zwnj: "", zwj: "", shy: "",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…",
  bull: "•", middot: "·", times: "×", deg: "°", eacute: "é", Eacute: "É", egrave: "è",
  ecirc: "ê", euml: "ë", aacute: "á", agrave: "à", acirc: "â", auml: "ä", Auml: "Ä",
  aring: "å", atilde: "ã", iacute: "í", icirc: "î", iuml: "ï", oacute: "ó", ocirc: "ô",
  ouml: "ö", Ouml: "Ö", otilde: "õ", oslash: "ø", uacute: "ú", ucirc: "û", uuml: "ü",
  Uuml: "Ü", ntilde: "ñ", ccedil: "ç", szlig: "ß", aelig: "æ", trade: "™", reg: "®", copy: "©",
};

function decode(s = "") {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => (name in ENTITIES ? ENTITIES[name] : m))
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

// If BGG's browse page can't be read, fall back to the games already in data/games.js;
// their current ranks still come from the API below.
async function currentIds() {
  const js = await readFile(OUT, "utf8");
  const data = JSON.parse(js.slice(js.indexOf("{"), js.lastIndexOf("}") + 1));
  return data.games.map((g) => String(g.id));
}

function parseItem(xml) {
  const attr = (tag) => (xml.match(new RegExp(`<${tag}[^>]*value="([^"]*)"`)) || [])[1];
  const best = decode(decode((xml.match(/<result name="bestwith" value="([^"]*)"/) || [])[1] || ""));
  const players = best
    .replace(/^Best with\s*/i, "")
    .replace(/\s*players?$/i, "")
    .replace(/,\s*/g, " or "); // "2, 4" reads as "2 or 4"
  return {
    id: +(xml.match(/<item[^>]*id="(\d+)"/) || [])[1],
    name: decode(decode((xml.match(/<name type="primary"[^>]*value="([^"]*)"/) || [])[1])),
    year: +attr("yearpublished") || null,
    image: ((xml.match(/<image>([^<]*)<\/image>/) || [])[1] || "").trim(),
    description: shortDescription((xml.match(/<description>([\s\S]*?)<\/description>/) || [])[1]),
    rating: Math.round(parseFloat(attr("average")) * 100) / 100,
    weight: Math.round(parseFloat(attr("averageweight")) * 100) / 100 || null, // complexity, 1 (light) to 5 (heavy)
    bestPlayers: players.replace(/–/g, "-"),
    bggRank: +(xml.match(/<rank[^>]*name="boardgame"[^>]*value="(\d+)"/) || [])[1] || null,
  };
}

async function main() {
  let ids;
  try {
    ids = await topIds();
  } catch (err) {
    console.warn(`Couldn't read the browse page (${err.message}); using the current list instead`);
    ids = await currentIds();
  }
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
  // order by BGG's live rank, falling back to the browse-page order
  const games = ids
    .map((id, i) => ({ order: i, ...byId.get(id) }))
    .filter((g) => g.name)
    .sort((a, b) => (a.bggRank ?? 1e9) - (b.bggRank ?? 1e9) || a.order - b.order)
    .map(({ order, bggRank, ...g }, i) => ({ rank: bggRank ?? i + 1, ...g }));
  const previous = await readFile(OUT, "utf8")
    .then((js) => JSON.parse(js.slice(js.indexOf("{"), js.lastIndexOf("}") + 1)).games)
    .catch(() => []);
  await saveCovers(games, previous);
  const data = { source: "boardgamegeek", updated: new Date().toISOString().slice(0, 10), games };
  // Saved as a script (not plain JSON) so index.html also works when opened straight from disk
  await writeFile(OUT, "window.BOARD_GAMES = " + JSON.stringify(data, null, 2) + ";\n");
  console.log(`Saved ${games.length} games to data/games.js`);
}

// Saves each box cover into assets/covers so the site serves its own copies:
// pages that block other websites' images (like the claude.ai preview) still show them,
// and visitors don't depend on BGG's servers. Covers that haven't changed are kept.
async function saveCovers(games, previous) {
  let sharp = null;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.warn("sharp isn't installed, so covers are saved at full size");
  }
  await mkdir(COVERS, { recursive: true });
  const before = new Map(previous.map((g) => [g.id, g.imageSource]));
  const keep = new Set();
  for (const g of games) {
    if (!g.image) continue;
    const source = g.image;
    const file = `${g.id}.jpg`;
    const path = new URL(file, COVERS);
    keep.add(file);
    const exists = await stat(path).then(() => true, () => false);
    if (!(exists && before.get(g.id) === source)) {
      try {
        const res = await fetch(source, { headers: { "User-Agent": headers["User-Agent"] } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let bytes = Buffer.from(await res.arrayBuffer());
        if (sharp) {
          bytes = await sharp(bytes)
            .resize({ width: COVER_WIDTH, height: COVER_WIDTH, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer();
        }
        await writeFile(path, bytes);
      } catch (err) {
        console.warn(`Kept the online cover for ${g.name} (${err.message})`);
        keep.delete(file);
        continue;
      }
    }
    g.imageSource = source;
    g.image = `assets/covers/${file}`;
  }
  // tidy up covers of games that dropped out of the top 100
  for (const file of await readdir(COVERS)) if (!keep.has(file)) await rm(new URL(file, COVERS));
  console.log(`Saved ${keep.size} covers to assets/covers`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
