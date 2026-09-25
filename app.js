const games = (window.BOARD_GAMES?.games || []).slice(0, 100);

const card = document.querySelector(".card");
const el = {
  rankText: card.querySelectorAll(".rank-text"),
  rankLabel: card.querySelector(".rank-label"),
  img: card.querySelector(".art img"),
  placeholder: card.querySelector(".placeholder"),
  name: card.querySelector(".name"),
  year: card.querySelector(".year"),
  description: card.querySelector(".description"),
  rating: card.querySelector(".rating-value"),
  players: card.querySelector(".players-value"),
  counter: document.querySelector(".counter"),
};

let index = 0;

function showPlaceholder(name) {
  el.img.hidden = true;
  el.placeholder.hidden = false;
  el.placeholder.firstElementChild.textContent = name;
}

el.img.addEventListener("error", () => showPlaceholder(games[index].name));
el.img.addEventListener("load", () => {
  el.img.hidden = false;
  el.placeholder.hidden = true;
});

function render() {
  const g = games[index];
  el.rankText.forEach((t) => (t.textContent = g.rank));
  el.rankLabel.textContent = `Rank ${g.rank}`;
  el.name.textContent = g.name;
  el.year.textContent = g.year || "";
  el.description.textContent = g.description;
  el.rating.textContent = Number(g.rating).toFixed(2);
  el.players.textContent = g.bestPlayers ? `Best: ${g.bestPlayers} players` : "";
  el.img.alt = `${g.name} box art`;
  if (g.image) {
    el.img.src = g.image;
  } else {
    el.img.removeAttribute("src");
    showPlaceholder(g.name);
  }
  el.counter.textContent = `${index + 1} / ${games.length}`;

  // warm up the neighbours so paging feels instant
  [1, -1].forEach((d) => {
    const n = games[(index + d + games.length) % games.length];
    if (n.image) new Image().src = n.image;
  });
}

function go(step) {
  if (!games.length) return;
  card.style.setProperty("--shift", `${-step * 24}px`);
  card.classList.add("leaving");
  setTimeout(() => {
    index = (index + step + games.length) % games.length;
    render();
    card.style.setProperty("--shift", `${step * 24}px`);
    requestAnimationFrame(() => card.classList.remove("leaving"));
  }, 180);
}

document.querySelector(".prev").addEventListener("click", () => go(-1));
document.querySelector(".next").addEventListener("click", () => go(1));
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") go(-1);
  if (e.key === "ArrowRight") go(1);
});

let touchX = null;
card.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
card.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  touchX = null;
});

if (games.length) render();
