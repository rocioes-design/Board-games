const games = (window.BOARD_GAMES?.games || []).slice(0, 100);

const deck = document.querySelector(".deck");
const template = document.getElementById("card-template");
const counter = document.querySelector(".counter");

const BEHIND = 2; // how many upcoming games peek out behind the front card
const LEAVE_MS = 650;

let index = 0;
let cards = []; // cards[0] is the front card

const wrap = (i) => (i + games.length) % games.length;

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
  q(".players-value").textContent = g.bestPlayers ? `Best: ${g.bestPlayers} players` : "";

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
  if (!games.length) return;
  index = wrap(index + step);
  if (step > 0) {
    // toss the front card away, pull a new one in at the back
    discard(cards.shift(), "out");
    const card = makeCard(index + BEHIND);
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

if (games.length) {
  for (let k = 0; k <= BEHIND; k++) {
    const card = makeCard(k);
    deck.appendChild(card);
    cards.push(card);
  }
  layout();
}
