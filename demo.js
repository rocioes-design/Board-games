// Demo mode: open the site with #demo at the end of the address (index.html#demo)
// and it plays a short tour by itself, with an on-screen cursor, for screen recordings.
// It browses a few games, hovers the player avatars, filters for light 1–2 player games,
// and browses the results. Reload the page to play it again.

(function () {
  if (location.hash !== "#demo") return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  document.documentElement.classList.add("is-demo");

  // the on-screen cursor
  const cursor = document.createElement("div");
  cursor.className = "demo-cursor";
  cursor.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2.5v16.6l4.3-4.1 2.8 6.5 3-1.3-2.8-6.4h6z"/></svg>';
  document.body.appendChild(cursor);
  let pos = { x: innerWidth * 0.62, y: innerHeight * 0.72 };
  const place = () => (cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`);
  place();

  // glides the cursor to a point (or the centre of an element)
  async function moveTo(target, ms = 700) {
    const to = target instanceof Element
      ? (({ left, top, width, height }) => ({ x: left + width / 2, y: top + height / 2 }))(target.getBoundingClientRect())
      : target;
    const from = { ...pos };
    const t0 = performance.now();
    await new Promise((done) => {
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        pos = { x: from.x + (to.x - from.x) * ease(k), y: from.y + (to.y - from.y) * ease(k) };
        place();
        k < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
  }

  async function click(action) {
    cursor.classList.add("is-pressing");
    await sleep(120);
    action?.();
    cursor.classList.remove("is-pressing");
  }

  // where a slider handle sits for a given value
  function handlePoint(input) {
    const r = input.closest(".range").getBoundingClientRect();
    const k = (+input.value - +input.min) / (+input.max - +input.min);
    return { x: r.left + 10 + (r.width - 20) * k, y: r.top + r.height / 2 };
  }

  // drags a slider handle to a new value, moving the cursor with it
  async function drag(input, value, ms = 1100) {
    const name = input.id.split("-")[0];
    await moveTo(handlePoint(input), 500);
    cursor.classList.add("is-grabbing");
    await sleep(150);
    const from = +input.value;
    const t0 = performance.now();
    await new Promise((done) => {
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        input.value = from + (value - from) * ease(k);
        paintRange(name);
        pos = handlePoint(input);
        place();
        k < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
    if (name === "players") snap(input);
    await sleep(200);
    cursor.classList.remove("is-grabbing");
  }

  async function tour() {
    const next = document.querySelector(".next");
    const front = () => document.querySelector('.card[data-pos="0"]');

    await sleep(1600);

    // browse four games
    await moveTo(next, 900);
    for (let i = 0; i < 4; i++) {
      await click(() => go(1));
      await sleep(1250);
    }

    // hover the player avatars; the label appears and each face lifts in turn
    const players = front().querySelector(".players");
    const avatars = [...players.querySelectorAll(".avatar")];
    await moveTo(avatars[0], 900);
    players.classList.add("is-hovered");
    for (const a of avatars) {
      await moveTo(a, 260);
      a.classList.add("is-lifted");
      await sleep(380);
      a.classList.remove("is-lifted");
    }
    await sleep(500);
    players.classList.remove("is-hovered");

    // open the filters and pick light games for 1–2 players
    await moveTo(document.querySelector(".filter-toggle"), 1000);
    await click(() => openPanel(true));
    await sleep(700);
    await drag(document.getElementById("players-max"), 2);
    await sleep(400);
    await drag(document.getElementById("weight-max"), 2);
    await sleep(500);
    await moveTo(document.querySelector(".btn-solid"), 600);
    await click(() => {
      applyFilters();
      openPanel(false);
    });
    await sleep(1400);

    // browse the results
    await moveTo(next, 900);
    for (let i = 0; i < 3; i++) {
      await click(() => go(1));
      await sleep(1400);
    }

    // rest the cursor out of the way
    await moveTo({ x: innerWidth * 0.62, y: innerHeight * 0.9 }, 900);
    document.documentElement.dataset.demo = "done"; // lets recording tools know the tour is over
  }

  // start once the page (and the first covers) have loaded
  const start = () => setTimeout(tour, 300);
  document.readyState === "complete" ? start() : addEventListener("load", start);
})();
