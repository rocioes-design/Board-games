const allGames = (window.BOARD_GAMES?.games || []).slice(0, 100);
let games = allGames; // the games currently in the deck (all of them, or the filtered ones)

const deck = document.querySelector(".deck");
const template = document.getElementById("card-template");
const counter = document.querySelector(".counter");

const BEHIND = 2; // how many upcoming games peek out behind the front card
const LEAVE_MS = 1000;

let index = 0;
let cards = []; // cards[0] is the front card

const wrap = (i) => (i + games.length) % games.length;

// player portraits from Watermelon UI, with local copies in assets/players as a fallback
const PLAYERS = [
  { name: "Mark", src: "https://assets.watermelon.sh/wm_ben.png" },
  { name: "Olivia", src: "https://assets.watermelon.sh/wm_olivia.png" },
  { name: "Josh", src: "https://assets.watermelon.sh/wm_josh.png" },
  { name: "Emma", src: "https://assets.watermelon.sh/wm_emma.png" },
];
const MAX_AVATARS = 4;

// "3-4" shows four players; big counts like "10+" show three and a "+7" bubble
function fillPlayers(el, best) {
  if (!best) {
    el.hidden = true;
    return;
  }
  const label = `Best: ${best} ${best === "1" ? "player" : "players"}`;
  el.setAttribute("aria-label", label);
  el.querySelector(".players-tip").textContent = label;

  const count = Math.max(...String(best).match(/\d+/g).map(Number));
  const shown = count > MAX_AVATARS ? MAX_AVATARS - 1 : count;
  const avatars = el.querySelector(".avatars");
  for (let k = 0; k < shown; k++) {
    const player = PLAYERS[k % PLAYERS.length];
    const a = document.createElement("img");
    a.className = "avatar";
    a.alt = "";
    a.addEventListener("error", () => (a.src = `assets/players/player-${(k % PLAYERS.length) + 1}.png`), { once: true });
    a.src = player.src;
    avatars.appendChild(a);
  }
  if (count > shown) {
    const more = document.createElement("span");
    more.className = "avatar more";
    more.textContent = `+${count - shown}`;
    avatars.appendChild(more);
  }
}

function makeCard(i) {
  const g = games[wrap(i)];
  const card = template.content.firstElementChild.cloneNode(true);
  const q = (s) => card.querySelector(s);

  q(".rank-text").textContent = g.rank;
  q(".rank-text").classList.toggle("long", String(g.rank).length > 2);
  q(".rank-label").textContent = `Rank ${g.rank}`;
  q(".name").textContent = g.name;
  q(".year").textContent = g.year || "";
  q(".description").textContent = g.description;
  q(".rating-value").textContent = Number(g.rating).toFixed(2);
  fillPlayers(q(".players"), g.bestPlayers);

  const img = q(".art img");
  const placeholder = q(".placeholder");
  placeholder.firstElementChild.textContent = g.name;
  img.alt = `${g.name} box art`;
  img.hidden = true;
  if (g.image) {
    img.addEventListener("load", () => {
      img.hidden = false;
      placeholder.hidden = true;
    });
    img.src = g.image;
  }
  return card;
}

// give every card its place in the fan; CSS animates the moves
function depth() {
  return Math.min(BEHIND, games.length - 1); // with few games, fewer peek out behind
}

function layout() {
  cards.forEach((card, pos) => {
    card.dataset.pos = pos;
    const front = pos === 0;
    card.inert = !front;
    card.setAttribute("aria-hidden", String(!front));
  });
  counter.textContent = `${index + 1} / ${games.length}`;
}

function add(card, pos) {
  card.dataset.pos = pos;
  deck.appendChild(card);
  card.getBoundingClientRect(); // start the animation from this position
}

function discard(card, pos) {
  card.dataset.pos = pos;
  card.inert = true;
  setTimeout(() => card.remove(), LEAVE_MS);
}

function go(step) {
  if (games.length < 2) return;
  index = wrap(index + step);
  if (step > 0) {
    // toss the front card away, pull a new one in at the back
    discard(cards.shift(), "out");
    const card = makeCard(index + depth());
    add(card, BEHIND + 1);
    cards.push(card);
  } else {
    // bring the previous card back in on top, drop the last one
    discard(cards.pop(), BEHIND + 1);
    const card = makeCard(index);
    add(card, "out");
    cards.unshift(card);
  }
  layout();
}

document.querySelector(".prev").addEventListener("click", () => go(-1));
document.querySelector(".next").addEventListener("click", () => go(1));
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, .filter-panel")) return; // arrow keys move the sliders there
  if (e.key === "ArrowLeft") go(-1);
  if (e.key === "ArrowRight") go(1);
});

let touchX = null;
deck.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
deck.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  touchX = null;
});

// (re)builds the deck from the current list of games
function deal() {
  cards.forEach((card) => card.remove());
  cards = [];
  index = 0;
  const none = games.length === 0;
  document.querySelector(".stage").hidden = none;
  counter.hidden = none;
  document.querySelector(".empty").hidden = !none;
  if (none) return;
  for (let k = 0; k <= depth(); k++) {
    const card = makeCard(k);
    deck.appendChild(card);
    cards.push(card);
  }
  document.querySelectorAll(".nav").forEach((b) => (b.disabled = games.length < 2));
  layout();
}

/* ---------- filters ---------- */

const PLAYERS_MAX = 6; // the top of the players slider means "6 or more"
const hasWeights = allGames.some((g) => g.weight);

// the player counts a game is best with: "3-4" → [3, 4], "2 or 4" → [2, 4], "10+" → [10]
function bestCounts(best) {
  const counts = [];
  for (const part of String(best || "").split(/\s+or\s+|,\s*/)) {
    const [a, b] = part.match(/\d+/g)?.map(Number) || [];
    if (a === undefined) continue;
    for (let n = a; n <= (b ?? a); n++) counts.push(n);
  }
  return counts;
}

const panel = document.getElementById("filter-panel");
const toggle = document.querySelector(".filter-toggle");
const ranges = {
  players: { min: 1, max: PLAYERS_MAX, from: 1, to: PLAYERS_MAX, fmt: (v) => (v >= PLAYERS_MAX ? `${v}+` : `${v}`) },
  weight: { min: 1, max: 5, from: 1, to: 5, fmt: (v) => Number(v).toFixed(1) },
};
const applied = { players: [1, PLAYERS_MAX], weight: [1, 5] };

function readRange(name) {
  const lo = document.getElementById(`${name}-min`);
  const hi = document.getElementById(`${name}-max`);
  return [Math.min(+lo.value, +hi.value), Math.max(+lo.value, +hi.value)];
}

function paintRange(name) {
  const r = ranges[name];
  const [a, b] = readRange(name);
  const pct = (v) => `${((v - r.min) / (r.max - r.min)) * 100}%`;
  const el = document.querySelector(`[data-range="${name}"]`);
  el.style.setProperty("--from", pct(a));
  el.style.setProperty("--to", pct(b));
  const text = name === "players" && a === b
    ? `${r.fmt(a)} ${a === 1 ? "player" : "players"}`
    : `${r.fmt(a)} to ${r.fmt(b)}${name === "players" ? " players" : ""}`;
  document.getElementById(`${name}-value`).textContent = text;
}

function setRange(name, [a, b]) {
  document.getElementById(`${name}-min`).value = a;
  document.getElementById(`${name}-max`).value = b;
  paintRange(name);
}

function isDefault(name, [a, b]) {
  return a === ranges[name].min && b === ranges[name].max;
}

function matches(g) {
  const [pa, pb] = applied.players;
  if (!isDefault("players", applied.players)) {
    const ok = bestCounts(g.bestPlayers).some((n) => n >= pa && (pb >= PLAYERS_MAX ? true : n <= pb));
    if (!ok) return false;
  }
  const [wa, wb] = applied.weight;
  if (hasWeights && !isDefault("weight", applied.weight)) {
    if (!g.weight || g.weight < wa || g.weight > wb + 0.001) return false;
  }
  return true;
}

function applyFilters() {
  applied.players = readRange("players");
  applied.weight = readRange("weight");
  games = allGames.filter(matches);
  document.querySelector(".filter-dot").hidden = isDefault("players", applied.players) && isDefault("weight", applied.weight);
  deal();
}

function openPanel(open) {
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  if (open) {
    // show what's currently applied, not a half-finished edit from last time
    setRange("players", applied.players);
    setRange("weight", applied.weight);
  }
}

for (const name of Object.keys(ranges)) {
  for (const end of ["min", "max"]) {
    document.getElementById(`${name}-${end}`).addEventListener("input", () => paintRange(name));
  }
}
if (!hasWeights) {
  document.querySelector('[data-range="weight"]').classList.add("is-disabled");
  document.querySelectorAll("#weight-min, #weight-max").forEach((i) => (i.disabled = true));
  document.getElementById("weight-note").hidden = false;
}

toggle.addEventListener("click", () => openPanel(panel.hidden));
panel.addEventListener("submit", (e) => {
  e.preventDefault();
  applyFilters();
  openPanel(false);
  toggle.focus();
});
function clearFilters() {
  setRange("players", [1, PLAYERS_MAX]);
  setRange("weight", [1, 5]);
  applyFilters();
}
document.getElementById("filter-clear").addEventListener("click", () => {
  clearFilters();
  openPanel(false);
});
document.getElementById("empty-clear").addEventListener("click", clearFilters);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panel.hidden) {
    openPanel(false);
    toggle.focus();
  }
});
document.addEventListener("click", (e) => {
  if (!panel.hidden && !e.target.closest(".filters")) openPanel(false);
});

setRange("players", applied.players);
setRange("weight", applied.weight);
deal();
