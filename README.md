# HowLongToBeat for Raycast

Find your next adventure, see how much time it needs, and keep your current game close.

## Native Raycast extension

- **Search Games:** Live HowLongToBeat search in a full-width list with cover icons and Main Story times. Press Enter for a spacious detail view with Main Story / Main + Extras / Completionist estimates. Switch the dropdown to your library, backlog, current game, or completed games.
- **Current Game:** Pin a game, log your total hours, choose your play style, and see estimated time remaining. Switching games preserves the old game's progress in your backlog.
- Save games, mark them complete, copy completion times, or open the original HowLongToBeat page from the action menu.

Your library contains games you save yourself and is stored on your device in Raycast LocalStorage. This extension does not import Steam, Epic, or other launcher libraries and does not require a HowLongToBeat account. The browser preview keeps its own separate library.

### Run in Raycast

Requires Node.js 22.22.2 or newer and Raycast with extension support installed on the same computer.

```sh
npm install
npm run dev
```

The Raycast development command imports the extension and enables automatic reload. Open **Search Games**, choose a game, and select **Set as Current Game**. Then **Current Game** opens its progress view directly.

The project follows [Raycast's native extension starter](https://developers.raycast.com/basics/create-your-first-extension) structure: a command manifest, React and TypeScript command entry points, `ray develop`, `ray build`, and the official Raycast ESLint configuration. The default development and build scripts operate on the extension.

### Dogfood flow

1. Run `npm run dev` to import the commands into Raycast.
2. Open **Search Games**, search for a game, and choose **Set as Current Game**.
3. Open **Current Game**, choose **Update Playtime**, and save your total hours.

Before publishing, set `author` in `package.json` to your actual Raycast handle.

### Build and checks

```sh
npm run build     # Native bundles in dist-raycast/
npm run lint
npm run typecheck
npm test
npm run test:live  # Real HowLongToBeat requests; refreshes preview's offline cache
```

## Interactive browser companion

The optional browser preview preserves the cover-grid design. It includes search, playtime and platform filters, sorting, a game-details drawer, and keyboard shortcuts. It is separate from the native Raycast commands.

```sh
npm run browser:dev
```

Open http://127.0.0.1:5173. `⌘/Ctrl K` or `/` focuses search, `Esc` closes dialogs or clears search, and `?` opens shortcuts.

```sh
npm run browser:build
npm run browser:preview
```

The Vite development and preview servers provide `/api/games` so the browser can search the live site without cross-origin requests. The static `dist` folder alone has no search backend. If live search is unavailable, the homepage labels its cached favorites with their fetch date; failed searches never pretend to have live results.

## Search client

This project uses its own small, dependency-free HowLongToBeat client in `src/lib/hltb.ts`. On September 30, 2026, `howlongtobeat@1.8.0` (the ckatzorke wrapper) failed a live Hollow Knight search with HTTP 403. The custom client uses the site's current `/api/search/site/init` and `/api/search/site` endpoints, a short-lived token, one token-refresh retry, 15-second request deadlines, cancellation, and a bounded five-minute cache. Completion times come from live community data in seconds and are converted to hours; unavailable times display as a dash.

Verified live searches: **Hollow Knight**, **Elden Ring**, and **Hades**. Unit checks cover time conversion, response validation, token refresh, concurrent authentication, caching, rate limits, cancellation, and progress transitions.

HowLongToBeat's public website endpoints are unofficial and may change. Errors show a retry option and a link to the original website. This extension is independent of HowLongToBeat and Raycast. Game data and cover art belong to their respective owners.

## License

MIT.
