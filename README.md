# HowLongToBeat for Raycast

Find your next adventure, see how much time it needs, and keep your current game close.

## Native Raycast extension

- **Search Games:** Live HowLongToBeat search in a full-width list with cover icons and Main Story times. Press Enter for a spacious detail view with Main Story / Main + Extras / Completionist estimates. Switch the dropdown to your library, backlog, current game, or completed games.
- **Current Game:** Pin a game, log your total hours, choose your play style, and see estimated time remaining. Switching games preserves the old game's progress in your backlog.
- **Steam Library:** Browse games installed through Steam on this computer, with cover art. Press Enter to search HowLongToBeat for a selected title, then choose the matching game or edition.
- **Look up Focused Steam Game:** Use Raycast's frontmost application API to match an executable to an installed Steam game and open search. If there is no match, the Steam picker opens instead.
- Save games, mark them complete, copy completion times, or open the original HowLongToBeat page from the action menu.

Your saved HowLongToBeat library contains games you choose yourself and is stored on your device in Raycast LocalStorage. The separate Steam picker reads local installation metadata; it does not need an API key, Steam account setup, or a HowLongToBeat account. The browser preview keeps its own separate library.

### Steam integration

Steam is detected through its Windows registry entry or its standard macOS install location. The extension follows `steamapps/libraryfolders.vdf` to discover every configured Steam library and reads per-game `appmanifest_*.acf` files. Drive letters and account names are not hardcoded. If automatic detection fails, set **Steam Installation Folder** to the folder containing `steamapps` in Raycast's extension settings.

Only fully installed titles with an existing game folder appear. Duplicate app IDs and Steam's shared redistributables are excluded. Other Steam tools may appear because the manifests do not reliably distinguish them from games. Offline, moved, or invalid libraries are skipped without blocking the others; **View Library Status** shows which locations were read or skipped. Correct stale paths in Steam Settings → Storage and refresh the extension.

Artwork loads directly from Steam's public CDN using the app ID, with a controller icon when an image is unavailable. Image requests disclose the requested app IDs to Steam's CDN. Names and installation paths remain local until you select a game for a HowLongToBeat lookup; only its search title is sent. Steam account files and credentials are not read, and the extension does not scan every game against HowLongToBeat in the background. Separated marketing labels such as “— Remastered” are removed from search terms; choose the correct edition from the results.

Assign **Look up Focused Steam Game** a hotkey and invoke it with your game focused. It uses [`getFrontmostApplication()`](https://developers.raycast.com/api-reference/utilities#getfrontmostapplication), which supplies an app name and path. Matching requires that path to be inside a discovered Steam install folder; editors and redistributable installers are excluded. This is a best-effort app hint and does not change your pinned current game or record playtime automatically. Manual Steam selection works when app detection is unavailable.

SDK 2.6.0 exposes no public game-library API for Raycast's built-in Games feature. [`WindowManagement.getActiveWindow()`](https://developers.raycast.com/api-reference/window-management) is currently documented as unavailable on Windows, and its `Window` type has no title field. This integration uses the supported frontmost-app API instead of window-title helpers.

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
4. Open **Steam Library**, choose an installed game, and press Enter to look it up.
5. Assign **Look up Focused Steam Game** a hotkey to try lookup from a focused Steam game.

Before publishing, set `author` in `package.json` to your actual Raycast handle.

### Build and checks

```sh
npm run build     # Native bundles in dist-raycast/
npm run lint
npm run typecheck
npm test
npm run test:live  # Real HowLongToBeat requests; refreshes preview's offline cache
npm run test:steam # Local Steam discovery plus one live HowLongToBeat lookup; requires installed games
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

Verified live searches: **Hollow Knight**, **Elden Ring**, and **Hades**. Unit checks cover time conversion, response validation, token refresh, concurrent authentication, caching, rate limits, cancellation, progress transitions, Steam manifest parsing, multiple library locations, incomplete installs, and frontmost executable matching. CI uses temporary Steam fixtures and does not require a Steam installation.

HowLongToBeat's public website endpoints are unofficial and may change. Errors show a retry option and a link to the original website. This extension is independent of HowLongToBeat and Raycast. Game data and cover art belong to their respective owners.

## License

MIT.
