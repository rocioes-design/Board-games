# Top 100 Board Games

A slideshow of the 100 highest-ranked games on [BoardGameGeek](https://boardgamegeek.com/browse/boardgame), set in a medieval landscape.

**To view it:** open `index.html` in a browser. Use the arrows, your keyboard's ← → keys, or swipe on a phone.

## Where the data comes from

The games are stored in `data/games.js`. The file in the repository is a **starter list**. It has no box art, and its ratings and rankings are approximate. To replace it with live data from BoardGameGeek:

1. Get a free BGG API token. Sign in to BoardGameGeek, go to <https://boardgamegeek.com/applications>, and register an application. BGG requires a token for its [XML API](https://boardgamegeek.com/using_the_xml_api).
2. In this GitHub repository, go to **Settings → Secrets and variables → Actions → New repository secret**. Name it `BGG_TOKEN` and paste in the token.
3. Go to **Actions → Update games from BoardGameGeek → Run workflow**.

After the first run, the list refreshes itself every Monday. Each game gets its box image, year, a short description, its average rating and BGG's "best with" player count.

To refresh the list on your own computer instead, run `BGG_TOKEN=your-token node scripts/fetch-games.mjs`.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The page, including the landscape illustration |
| `styles.css` | Colors, layout, and the push-pin style of the rank number |
| `app.js` | The slideshow |
| `data/games.js` | The 100 games |
| `scripts/fetch-games.mjs` | Downloads fresh data from BoardGameGeek |
