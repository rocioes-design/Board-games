# Top 100 Board Games

A slideshow of the 100 highest-ranked games on [BoardGameGeek](https://boardgamegeek.com/browse/boardgame), set against a painted landscape of white horses on open plains.

**To view it:** open `index.html` in a browser. Use the arrows, your keyboard's ← → keys, or swipe on a phone.

## Where the data comes from

The games are stored in `data/games.js`, and their box covers in `assets/covers/`. Both come from BoardGameGeek's XML API and are refreshed by a weekly GitHub Action. To set it up:

1. Get a free BGG API token. Sign in to BoardGameGeek, go to <https://boardgamegeek.com/applications>, and register an application. BGG requires a token for its [XML API](https://boardgamegeek.com/using_the_xml_api).
2. In this GitHub repository, go to **Settings → Secrets and variables → Actions → New repository secret**. Name it `BGG_TOKEN` and paste in the token.
3. Go to **Actions → Update games from BoardGameGeek → Run workflow**.

After the first run, the list refreshes itself every Monday. Each game gets its box cover (saved into the project at web size), year, a short description, its average rating, its complexity (BGG's 1–5 "weight") and BGG's "best with" player count.

To refresh the list on your own computer instead, run `BGG_TOKEN=your-token node scripts/fetch-games.mjs`.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The page, including the golden rank tag |
| `styles.css` | Colors and layout |
| `assets/background-horses.webp` | The background image |
| `app.js` | The slideshow and the filters |
| `data/games.js` | The 100 games |
| `assets/covers/` | Box covers saved by the weekly update |
| `scripts/fetch-games.mjs` | Downloads fresh data from BoardGameGeek |
