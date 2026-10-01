import { hltb } from "../src/lib/hltb";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

for (const query of ["Hollow Knight", "Elden Ring", "Hades"]) {
  const result = await hltb.search({ query });
  assert(
    result.games.some((game) => game.name.toLowerCase() === query.toLowerCase()),
    `No exact match for ${query}`,
  );
  assert(
    result.games.some((game) => game.main > 0),
    `No completion times for ${query}`,
  );
  console.log(
    query,
    result.games
      .filter((game) => game.name.toLowerCase() === query.toLowerCase())
      .map(({ name, main, extra, complete }) => ({ name, main, extra, complete })),
  );
}
const popular = await hltb.search();
assert(popular.games.length > 0);
await writeFile(
  "web/discover.json",
  JSON.stringify({ fetchedAt: new Date().toISOString(), games: popular.games }, null, 2),
);
console.log(`Verified live search. Cached ${popular.games.length} popular games for the offline preview.`);
