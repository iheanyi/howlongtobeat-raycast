import { test } from "node:test";
import assert from "node:assert/strict";
import { HltbClient } from "../src/lib/hltb";
import {
  formatHours,
  formatPlaytime,
  normalizeGame,
  remainingHours,
  saveGame,
  updatePlaytime,
} from "../src/lib/game";

const raw = {
  game_id: 26286,
  game_name: "Hollow Knight",
  game_image: "26286_Hollow_Knight.jpg",
  comp_main: 97200,
  comp_plus: 150000,
  comp_100: 237600,
  release_world: 2017,
  profile_platform: "PC, Nintendo Switch",
  review_score: 91,
  comp_all_count: 9000,
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("normalizes live seconds, platforms, and missing times without invented estimates", () => {
  const game = normalizeGame(raw);
  assert.equal(game.main, 27);
  assert.equal(game.complete, 66);
  assert.deepEqual(game.platforms, ["PC", "Nintendo Switch"]);
  assert.equal(normalizeGame({ game_id: 1, game_name: "Unknown" }).main, 0);
  assert.equal(formatHours(0), "—");
  assert.equal(formatHours(27.5), "27.5h");
  assert.equal(formatHours(0.5), "30m");
  assert.equal(formatPlaytime(0), "0h");
});
test("search authenticates, sends current endpoint payload, and reuses cached results", async () => {
  let requests = 0;
  const request: typeof fetch = async (url, init) => {
    requests++;
    if (String(url).includes("/init")) return reply({ token: "test-token" });
    assert.equal(String(url), "https://howlongtobeat.com/api/search/site");
    assert.equal((init?.headers as Record<string, string>)["x-auth-token"], "test-token");
    assert.deepEqual(JSON.parse(init?.body as string).searchTerms, ["Hollow", "Knight"]);
    return reply({ data: [raw], count: 3 });
  };
  const client = new HltbClient(request);
  const first = await client.search({ query: " Hollow Knight " });
  assert.equal(first.games[0].main, 27);
  assert.equal(first.count, 3);
  await client.search({ query: "hollow knight" });
  assert.equal(requests, 2);
});
test("expired search token refreshes once and retries", async () => {
  let auth = 0;
  let searches = 0;
  const client = new HltbClient(async (url) =>
    String(url).includes("/init")
      ? reply({ token: `token-${++auth}` })
      : ++searches === 1
        ? reply({}, 403)
        : reply({ data: [raw] }),
  );
  assert.equal((await client.search({ query: "Hollow Knight" })).games.length, 1);
  assert.equal(auth, 2);
  assert.equal(searches, 2);
});
test("concurrent searches share token initialization", async () => {
  let auth = 0;
  const client = new HltbClient(async (url) => {
    if (String(url).includes("/init")) {
      auth++;
      return reply({ token: "shared" });
    }
    return reply({ data: [raw] });
  });
  await Promise.all([client.search({ query: "Hollow" }), client.search({ query: "Knight" })]);
  assert.equal(auth, 1);
});
test("rate limits are actionable and do not cause automatic retry storms", async () => {
  let searches = 0;
  const client = new HltbClient(async (url) =>
    String(url).includes("/init") ? reply({ token: "test" }) : (searches++, reply({}, 429)),
  );
  await assert.rejects(client.search(), /too many requests/);
  assert.equal(searches, 1);
});
test("empty results succeed and malformed responses fail visibly", async () => {
  const empty = new HltbClient(async (url) =>
    String(url).includes("/init") ? reply({ token: "test" }) : reply({ data: [], count: 0 }),
  );
  assert.deepEqual((await empty.search({ query: "no such game" })).games, []);
  const malformed = new HltbClient(async (url) =>
    String(url).includes("/init") ? reply({ token: "test" }) : reply({ wrong: [] }),
  );
  await assert.rejects(malformed.search(), /data has changed/);
});
test("aborted searches do not send a search request", async () => {
  let searches = 0;
  const client = new HltbClient(async (url) =>
    String(url).includes("/init") ? reply({ token: "test" }) : (searches++, reply({ data: [raw] })),
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(client.search({ signal: controller.signal }));
  assert.equal(searches, 0);
});
test("one current game is retained, switching preserves playtime, completion stays explicit", () => {
  const game = normalizeGame(raw);
  const other = { ...game, id: 68151, name: "Elden Ring" };
  let library = saveGame([], game, "playing");
  library = updatePlaytime(library, game.id, 12.5, "main");
  assert.equal(remainingHours(library[0]), 14.5);
  library = saveGame(library, other, "playing");
  assert.equal(library.filter((item) => item.status === "playing").length, 1);
  assert.equal(library.find((item) => item.game.id === game.id)?.hours, 12.5);
  library = saveGame(library, game, "playing");
  assert.equal(library[0].hours, 12.5);
  library = updatePlaytime(library, game.id, 30, "main");
  assert.equal(remainingHours(library[0]), 0);
  assert.equal(library[0].status, "playing");
  assert.throws(() => updatePlaytime(library, game.id, -1, "main"));
  assert.throws(() => updatePlaytime(library, game.id, NaN, "main"));
});
