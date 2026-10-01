export type PlayStyle = "main" | "extra" | "complete";
export type Game = {
  id: number;
  name: string;
  image: string;
  main: number;
  extra: number;
  complete: number;
  year: number;
  platforms: string[];
  rating: number;
  submissions: number;
  type: string;
};
export type SavedGame = {
  game: Game;
  status: "backlog" | "playing" | "completed";
  hours: number;
  style: PlayStyle;
  addedAt: string;
};
export const STYLE_LABELS: Record<PlayStyle, string> = {
  main: "Main Story",
  extra: "Main + Extras",
  complete: "Completionist",
};
export const gameUrl = (game: Game) => `https://howlongtobeat.com/game/${game.id}`;
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${Number(hours.toFixed(1))}h`;
}
export function remainingHours(saved: SavedGame): number | null {
  const estimate = saved.game[saved.style];
  return estimate > 0 ? Math.max(0, estimate - saved.hours) : null;
}
export const formatPlaytime = (hours: number): string => (hours === 0 ? "0h" : formatHours(hours));
export function normalizeGame(raw: Record<string, unknown>): Game {
  const numeric = (key: string) =>
    typeof raw[key] === "number" && Number.isFinite(raw[key]) ? Math.max(0, raw[key] as number) : 0;
  if (!numeric("game_id") || typeof raw.game_name !== "string")
    throw new Error("Invalid game in HowLongToBeat response.");
  return {
    id: numeric("game_id"),
    name: raw.game_name,
    image:
      typeof raw.game_image === "string" && raw.game_image
        ? `https://howlongtobeat.com/games/${encodeURIComponent(raw.game_image)}`
        : "",
    main: numeric("comp_main") / 3600,
    extra: numeric("comp_plus") / 3600,
    complete: numeric("comp_100") / 3600,
    year: numeric("release_world"),
    platforms:
      typeof raw.profile_platform === "string"
        ? raw.profile_platform
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : [],
    rating: numeric("review_score"),
    submissions: numeric("comp_all_count"),
    type: typeof raw.game_type === "string" ? raw.game_type : "game",
  };
}
export function saveGame(
  library: SavedGame[],
  game: Game,
  status: SavedGame["status"] = "backlog",
): SavedGame[] {
  const existing = library.find((item) => item.game.id === game.id);
  const entry: SavedGame = existing
    ? { ...existing, game, status }
    : { game, status, hours: 0, style: "main", addedAt: new Date().toISOString() };
  const rest = library
    .filter((item) => item.game.id !== game.id)
    .map((item) =>
      status === "playing" && item.status === "playing" ? { ...item, status: "backlog" as const } : item,
    );
  return [entry, ...rest];
}
export function updatePlaytime(
  library: SavedGame[],
  id: number,
  hours: number,
  style: PlayStyle,
): SavedGame[] {
  if (!Number.isFinite(hours) || hours < 0 || hours > 100000)
    throw new Error("Enter a valid number of hours between 0 and 100,000.");
  return library.map((item) => (item.game.id === id ? { ...item, hours, style } : item));
}
