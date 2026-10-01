import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

type Vdf = { [key: string]: string | Vdf };
export type InstalledSteamGame = {
  appId: number;
  name: string;
  installDirectory: string;
  libraryDirectory: string;
};
export type SteamLibrary = { games: InstalledSteamGame[]; libraries: string[]; warnings: string[] };
type CommandRunner = (file: string, args: string[]) => Promise<string>;
type DiscoveryOptions = {
  steamPath?: string;
  platform?: NodeJS.Platform;
  homeDirectory?: string;
  variables?: NodeJS.ProcessEnv;
  runCommand?: CommandRunner;
};

// Steam's text KeyValues format: nested objects, quoted strings and line comments.
// Only install metadata is used. Account files and credentials are never read.
export function parseSteamVdf(source: string): Vdf {
  if (source.length > 2 * 1024 * 1024) throw new Error("Steam metadata is too large.");
  let offset = 0;
  type Token = { text: string } | { brace: "{" | "}" };
  const token = (): Token | undefined => {
    while (offset < source.length) {
      if (/\s|\uFEFF/.test(source[offset])) {
        offset++;
        continue;
      }
      if (source.startsWith("//", offset)) {
        while (offset < source.length && source[offset] !== "\n") offset++;
        continue;
      }
      break;
    }
    if (offset >= source.length) return;
    const first = source[offset++];
    if (first === "{" || first === "}") return { brace: first };
    if (first === '"') {
      let value = "";
      while (offset < source.length) {
        const char = source[offset++];
        if (char === '"') return { text: value };
        if (char === "\\") {
          if (offset >= source.length) break;
          const escaped = source[offset++];
          const escapes: Record<string, string> = { "\\": "\\", '"': '"', n: "\n", r: "\r", t: "\t" };
          value += escapes[escaped] ?? `\\${escaped}`;
        } else value += char;
      }
      throw new Error("Steam metadata contains an unfinished string.");
    }
    let value = first;
    while (offset < source.length && !/[\s{}]/.test(source[offset])) value += source[offset++];
    return { text: value };
  };
  const object = (nested: boolean, depth = 0): Vdf => {
    if (depth > 32) throw new Error("Steam metadata is nested too deeply.");
    const result: Vdf = Object.create(null);
    while (true) {
      const key = token();
      if (key === undefined) {
        if (nested) throw new Error("Steam metadata is missing a closing brace.");
        return result;
      }
      if ("brace" in key && key.brace === "}") {
        if (!nested) throw new Error("Steam metadata contains an unexpected closing brace.");
        return result;
      }
      if ("brace" in key) throw new Error("Steam metadata contains an unexpected opening brace.");
      const value = token();
      if (value === undefined || ("brace" in value && value.brace === "}"))
        throw new Error("Steam metadata is missing a value.");
      result[key.text] = "brace" in value ? object(true, depth + 1) : value.text;
    }
  };
  return object(false);
}

const property = (object: Vdf, key: string) =>
  Object.entries(object).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1];
const record = (value: string | Vdf | undefined): Vdf | undefined =>
  typeof value === "object" ? value : undefined;
const string = (value: string | Vdf | undefined): string => (typeof value === "string" ? value : "");
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";
const exists = async (directory: string) => {
  try {
    return (await stat(directory)).isDirectory();
  } catch {
    return false;
  }
};

const runCommand: CommandRunner = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { timeout: 5000, windowsHide: true, encoding: "utf8", maxBuffer: 64 * 1024 },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });

export async function findSteamInstallation(options: DiscoveryOptions = {}): Promise<string> {
  if (options.steamPath?.trim()) {
    const configured = path.resolve(options.steamPath.trim());
    if (await exists(path.join(configured, "steamapps"))) return configured;
    throw new Error(
      "The configured Steam folder has no steamapps directory. Choose the Steam installation folder in extension settings.",
    );
  }
  const platform = options.platform ?? process.platform;
  const home = options.homeDirectory ?? homedir();
  const variables = options.variables ?? process.env;
  const candidates: string[] = [];
  if (platform === "win32") {
    try {
      const output = await (options.runCommand ?? runCommand)("reg.exe", [
        "query",
        "HKCU\\Software\\Valve\\Steam",
        "/v",
        "SteamPath",
      ]);
      const installed = output.match(/SteamPath\s+REG_SZ\s+([^\r\n]+)/i)?.[1]?.trim();
      if (installed) candidates.push(installed);
    } catch {
      /* Try standard install locations if registry access is unavailable. */
    }
    for (const root of [variables["ProgramFiles(x86)"], variables.ProgramFiles, "C:\\Program Files (x86)"]) {
      if (root) candidates.push(path.join(root, "Steam"));
    }
  } else if (platform === "darwin")
    candidates.push(path.join(home, "Library", "Application Support", "Steam"));
  else candidates.push(path.join(home, ".local", "share", "Steam"), path.join(home, ".steam", "steam"));
  for (const candidate of candidates)
    if (await exists(path.join(candidate, "steamapps"))) return path.resolve(candidate);
  throw new Error("Steam wasn't found. Set Steam Installation Folder in extension settings, then refresh.");
}

async function readVdf(file: string) {
  if ((await stat(file)).size > 2 * 1024 * 1024) throw new Error("Steam metadata is too large.");
  return parseSteamVdf(await readFile(file, "utf8"));
}

export async function discoverInstalledSteamGames(options: DiscoveryOptions = {}): Promise<SteamLibrary> {
  const root = await findSteamInstallation(options);
  const warnings: string[] = [];
  const folders = [root];
  try {
    const contents = await readVdf(path.join(root, "steamapps", "libraryfolders.vdf"));
    const libraries = record(property(contents, "libraryfolders"));
    if (!libraries) throw new Error("Invalid library metadata.");
    for (const [key, value] of Object.entries(libraries)) {
      if (!/^\d+$/.test(key)) continue;
      const folder = typeof value === "string" ? value : string(property(value, "path"));
      if (folder && path.isAbsolute(folder)) folders.push(path.resolve(folder));
    }
  } catch (error) {
    if (!isMissing(error))
      warnings.push(
        "Couldn't read Steam's additional library locations. The main library is still available.",
      );
  }
  const uniqueFolders = [
    ...new Map(
      folders.map((folder) => [
        (options.platform ?? process.platform) === "win32" ? folder.toLowerCase() : folder,
        folder,
      ]),
    ).values(),
  ];
  const games = new Map<number, InstalledSteamGame>();
  const libraries: string[] = [];
  for (const folder of uniqueFolders) {
    const steamapps = path.join(folder, "steamapps");
    let files: string[];
    try {
      files = (await readdir(steamapps, { withFileTypes: true }))
        .filter((file) => file.isFile() && /^appmanifest_\d+\.acf$/i.test(file.name))
        .map((file) => file.name);
      libraries.push(folder);
    } catch (error) {
      warnings.push(
        isMissing(error)
          ? `Steam lists ${folder}, but its steamapps folder is missing. Check the location in Steam Settings → Storage.`
          : `Couldn't read ${path.join(folder, "steamapps")}. Check folder access, then refresh.`,
      );
      continue;
    }
    let invalid = 0;
    const readGame = async (file: string): Promise<InstalledSteamGame | undefined> => {
      try {
        const data = record(property(await readVdf(path.join(steamapps, file)), "AppState"));
        if (!data) throw new Error("Invalid manifest.");
        const appId = Number(string(property(data, "appid")));
        const fileId = Number(file.match(/\d+/)?.[0]);
        const name = string(property(data, "name")).trim();
        const directory = string(property(data, "installdir"));
        const flags = Number(string(property(data, "StateFlags")));
        if (
          !Number.isSafeInteger(appId) ||
          appId <= 0 ||
          appId > 4294967295 ||
          appId !== fileId ||
          !name ||
          !directory ||
          !Number.isSafeInteger(flags)
        )
          throw new Error("Invalid manifest fields.");
        if ((flags & 4) === 0 || appId === 228980) return;
        const common = path.join(steamapps, "common");
        const installDirectory = path.resolve(common, directory);
        const relative = path.relative(common, installDirectory);
        if (
          !relative ||
          relative === ".." ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative)
        )
          throw new Error("Invalid install directory.");
        if (!(await exists(installDirectory))) return;
        return { appId, name, installDirectory, libraryDirectory: folder };
      } catch {
        invalid++;
      }
    };
    // Bound filesystem concurrency when a library contains hundreds of manifests.
    for (let index = 0; index < files.length; index += 8) {
      for (const game of await Promise.all(files.slice(index, index + 8).map(readGame))) {
        if (game && !games.has(game.appId)) games.set(game.appId, game);
      }
    }
    if (invalid)
      warnings.push(`Skipped ${invalid} unreadable or invalid Steam manifest${invalid === 1 ? "" : "s"}.`);
  }
  if (!libraries.length)
    throw new Error(
      "Steam's library folders couldn't be read. Check folder access or choose a different Steam installation folder.",
    );
  return { games: [...games.values()].sort((a, b) => a.name.localeCompare(b.name)), libraries, warnings };
}

export function steamSearchTitle(game: InstalledSteamGame): string {
  // Steam can append edition/marketing labels that are absent from HLTB titles.
  // Keep the original Steam name in the picker; the user chooses the HLTB match.
  return game.name
    .replace(/[™®©]/g, "")
    .replace(
      /\s+[-–—|]\s+(?:Remastered|Definitive Edition|Game of the Year Edition|Complete Edition|Deluxe Edition|Ultimate Edition)\s*$/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export const steamCoverUrl = (appId: number): string =>
  `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;

export function matchFrontmostSteamGame(
  applicationPath: string | undefined,
  games: InstalledSteamGame[],
  platform: NodeJS.Platform = process.platform,
): InstalledSteamGame | undefined {
  if (!applicationPath) return;
  const paths = platform === "win32" ? path.win32 : path.posix;
  if (!paths.isAbsolute(applicationPath)) return;
  if (platform === "win32" && !/\.exe$/i.test(applicationPath)) return;
  const normalize = (value: string) =>
    platform === "win32" ? paths.normalize(value).toLowerCase() : paths.normalize(value);
  const candidate = normalize(applicationPath);
  if (
    /(?:^|[\\/])(?:_?commonredist|redist|redistributables|installers?)(?:[\\/]|$)/i.test(candidate) ||
    /^(?:vc[_-]?redist|vcredist|dxsetup|setup|unins\d*|uninstall|unitycrashhandler\d*|crashreporter)(?:[_-].*)?\.exe$/i.test(
      paths.basename(candidate),
    )
  )
    return;
  return [...games]
    .sort((a, b) => b.installDirectory.length - a.installDirectory.length)
    .find((game) => {
      const relative = paths.relative(normalize(game.installDirectory), candidate);
      return (
        relative !== "" &&
        relative !== ".." &&
        !relative.startsWith(`..${paths.sep}`) &&
        !paths.isAbsolute(relative)
      );
    });
}
