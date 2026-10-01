import { test, TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  discoverInstalledSteamGames,
  findSteamInstallation,
  InstalledSteamGame,
  matchFrontmostSteamGame,
  parseSteamVdf,
  steamSearchTitle,
} from "../src/lib/steam";

const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
async function fixture(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), "hltb-steam-test-"));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert(path.basename(root).startsWith("hltb-steam-test-"));
    await rm(root, { recursive: true, force: true });
  });
  const steam = path.join(root, "Steam");
  const second = path.join(root, "Other Library");
  await Promise.all([
    mkdir(path.join(steam, "steamapps"), { recursive: true }),
    mkdir(path.join(second, "steamapps"), { recursive: true }),
  ]);
  return { root, steam, second };
}
async function manifest(
  library: string,
  appId: number,
  name: string,
  directory: string,
  flags = 4,
  createDirectory = true,
) {
  await writeFile(
    path.join(library, "steamapps", `appmanifest_${appId}.acf`),
    `"AppState" { "appid" "${appId}" "name" ${quote(name)} "installdir" ${quote(directory)} "StateFlags" "${flags}" "LastOwner" "not-part-of-the-library-result" }`,
  );
  if (createDirectory) await mkdir(path.join(library, "steamapps", "common", directory), { recursive: true });
}

test("KeyValues parsing preserves escaped paths and quoted braces, supports comments, and rejects broken files", () => {
  const data = parseSteamVdf(
    '\uFEFF// comment\n"libraryfolders" { "0" { "path" "D:\\\\Steam Library" } "literal" "{" "quote" "A \\"name\\"" }',
  );
  const folders = data.libraryfolders as Record<string, unknown>;
  assert.equal((folders["0"] as Record<string, string>).path, "D:\\Steam Library");
  assert.equal(folders.literal, "{");
  assert.equal(folders.quote, 'A "name"');
  assert.throws(() => parseSteamVdf('"AppState" { "name" "unfinished'), /unfinished/);
  assert.throws(() => parseSteamVdf('"AppState" { "name" "Hades"'), /closing brace/);
  assert.equal(Object.getPrototypeOf(parseSteamVdf('"__proto__" "value"')), null);
});

test("discovers multiple libraries, deduplicates apps, excludes incomplete installs and rejects directory escapes", async (t) => {
  const { steam, second } = await fixture(t);
  await writeFile(
    path.join(steam, "steamapps", "libraryfolders.vdf"),
    `"libraryfolders" { "0" { "path" ${quote(steam)} } "1" { "path" ${quote(second)} } "2" { "path" ${quote(second)} } }`,
  );
  await manifest(steam, 10, "Hades®", "Hades", 6);
  await manifest(second, 10, "Duplicate Hades", "Hades");
  await manifest(second, 20, "The Witcher 3", "Witcher 3");
  await manifest(steam, 30, "Still downloading", "Downloading", 1);
  await manifest(steam, 40, "Removed files", "Missing", 4, false);
  await manifest(steam, 50, "Invalid path", "../../outside", 4, false);
  await manifest(steam, 228980, "Steamworks Common Redistributables", "Steamworks Shared");
  const result = await discoverInstalledSteamGames({ steamPath: steam });
  assert.deepEqual(
    result.games.map((game) => game.appId),
    [10, 20],
  );
  assert.equal(result.libraries.length, 2);
  assert.equal(steamSearchTitle(result.games[0]), "Hades");
  assert(!JSON.stringify(result).includes("not-part-of-the-library-result"));
  assert(result.warnings.some((warning) => warning.includes("invalid Steam manifest")));
});

test("supports old library metadata and keeps valid games when another library is offline or a manifest is corrupt", async (t) => {
  const { steam, second, root } = await fixture(t);
  await writeFile(
    path.join(steam, "steamapps", "libraryfolders.vdf"),
    `"LibraryFolders" { "1" ${quote(second)} "2" ${quote(path.join(root, "Offline"))} "TimeNextStatsReport" "0" }`,
  );
  await manifest(second, 20, "Hollow Knight", "Hollow Knight");
  await writeFile(path.join(second, "steamapps", "appmanifest_99.acf"), '"AppState" { "name"');
  const result = await discoverInstalledSteamGames({ steamPath: steam });
  assert.equal(result.games[0].name, "Hollow Knight");
  assert.equal(result.warnings.length, 2);
});

test("missing additional-library metadata still permits main-library discovery and invalid settings fail clearly", async (t) => {
  const { steam, root } = await fixture(t);
  await manifest(steam, 10, "Hades", "Hades");
  assert.equal((await discoverInstalledSteamGames({ steamPath: steam })).games.length, 1);
  await assert.rejects(
    findSteamInstallation({ steamPath: path.join(root, "Wrong folder") }),
    /no steamapps directory/,
  );
});

test("Windows Steam discovery reads only the fixed registry path and tolerates spaces in its result", async (t) => {
  const { steam } = await fixture(t);
  const found = await findSteamInstallation({
    platform: "win32",
    variables: {},
    runCommand: async (file, args) => {
      assert.equal(file, "reg.exe");
      assert.deepEqual(args, ["query", "HKCU\\Software\\Valve\\Steam", "/v", "SteamPath"]);
      return `HKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    ${steam}\r\n`;
    },
  });
  assert.equal(found, steam);
});

test("frontmost app matching uses install boundaries, handles Windows casing, and ignores editors and redistributable installers", () => {
  const games: InstalledSteamGame[] = [
    {
      appId: 20,
      name: "The Witcher 3",
      installDirectory: "D:\\SteamLibrary\\steamapps\\common\\The Witcher 3",
      libraryDirectory: "D:\\SteamLibrary",
    },
  ];
  assert.equal(
    matchFrontmostSteamGame(
      "d:/steamlibrary/steamapps/common/the witcher 3/bin/x64/witcher3.exe",
      games,
      "win32",
    )?.appId,
    20,
  );
  assert.equal(
    matchFrontmostSteamGame(
      "D:\\SteamLibrary\\steamapps\\common\\The Witcher 30\\witcher3.exe",
      games,
      "win32",
    ),
    undefined,
  );
  assert.equal(
    matchFrontmostSteamGame("C:\\Program Files\\Microsoft Visual Studio 2008\\devenv.exe", games, "win32"),
    undefined,
  );
  assert.equal(
    matchFrontmostSteamGame(
      "D:\\SteamLibrary\\steamapps\\common\\The Witcher 3\\_CommonRedist\\vcredist.exe",
      games,
      "win32",
    ),
    undefined,
  );
  assert.equal(
    matchFrontmostSteamGame("D:\\SteamLibrary\\steamapps\\common\\The Witcher 3\\setup.exe", games, "win32"),
    undefined,
  );
  assert.equal(matchFrontmostSteamGame("Applications", games, "win32"), undefined);
  assert.equal(matchFrontmostSteamGame(undefined, games, "win32"), undefined);
  const macGames = [{ ...games[0], installDirectory: "/Steam/steamapps/common/Hades", name: "Hades" }];
  assert.equal(
    matchFrontmostSteamGame("/Steam/steamapps/common/Hades/Hades.app", macGames, "darwin")?.appId,
    20,
  );
});

test("Steam lookup removes separated marketing labels while preserving editions that are part of the game name", () => {
  const game = {
    appId: 292030,
    name: "The Witcher 3: Wild Hunt — Remastered",
    installDirectory: "",
    libraryDirectory: "",
  };
  assert.equal(steamSearchTitle(game), "The Witcher 3: Wild Hunt");
  assert.equal(steamSearchTitle({ ...game, name: "Dark Souls Remastered" }), "Dark Souls Remastered");
});

test("macOS discovery uses the supplied home folder and discovers its local Steam install", async (t) => {
  const { root } = await fixture(t);
  const steam = path.join(root, "Library", "Application Support", "Steam");
  await mkdir(path.join(steam, "steamapps"), { recursive: true });
  await manifest(steam, 10, "Hades", "Hades");
  const result = await discoverInstalledSteamGames({ platform: "darwin", homeDirectory: root });
  assert.deepEqual(result.libraries, [steam]);
  assert.equal(result.games[0].name, "Hades");
});
