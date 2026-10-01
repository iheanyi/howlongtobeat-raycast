import assert from "node:assert/strict";
import { discoverInstalledSteamGames, steamSearchTitle } from "../src/lib/steam";
import { hltb } from "../src/lib/hltb";

const library = await discoverInstalledSteamGames();
assert(library.games.length > 0, "No installed Steam games discovered.");
assert.equal(new Set(library.games.map((game) => game.appId)).size, library.games.length);
console.log(
  `Discovered ${library.games.length} installed Steam games across ${library.libraries.length} libraries. ${library.warnings.length} discovery warnings.`,
);
const game = library.games.find((game) => /witcher 3/i.test(game.name)) ?? library.games[0];
const query = steamSearchTitle(game);
const result = await hltb.search({ query });
assert(result.games.length > 0, "The selected Steam title produced no HowLongToBeat results.");
assert(
  result.games.some((game) => game.main > 0),
  "The selected Steam title has no completion times.",
);
console.log(
  `Verified Steam → HowLongToBeat lookup for ${query}. ${result.games.length} results with completion times.`,
);
