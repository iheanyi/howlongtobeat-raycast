import {
  Action,
  ActionPanel,
  Detail,
  Form,
  Icon,
  Keyboard,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import {
  formatHours,
  formatPlaytime,
  Game,
  gameUrl,
  PlayStyle,
  remainingHours,
  SavedGame,
  saveGame,
  STYLE_LABELS,
  updatePlaytime,
} from "../lib/game";
import { useLibrary } from "../lib/storage";

export function GameActions({
  game,
  library,
  persist,
}: {
  game: Game;
  library: SavedGame[];
  persist: (next: SavedGame[]) => Promise<void>;
}) {
  const saved = library.find((item) => item.game.id === game.id);
  const { push } = useNavigation();
  const update = async (next: SavedGame[], title: string) => {
    try {
      await persist(next);
      await showToast({ style: Toast.Style.Success, title });
    } catch {
      await showToast({ style: Toast.Style.Failure, title: "Couldn't save your game" });
    }
  };
  return (
    <>
      <ActionPanel.Section title="Your Library">
        <Action
          title={saved?.status === "playing" ? "Update Playtime" : "Set as Current Game"}
          icon={Icon.Play}
          onAction={() =>
            saved?.status === "playing"
              ? push(<PlaytimeForm saved={saved} library={library} persist={persist} />)
              : update(saveGame(library, game, "playing"), "Current game updated")
          }
        />
        {!saved ? (
          <Action
            title="Add to Backlog"
            icon={Icon.Bookmark}
            shortcut={{ macOS: { modifiers: ["cmd"], key: "b" }, Windows: { modifiers: ["ctrl"], key: "b" } }}
            onAction={() => update(saveGame(library, game), "Added to backlog")}
          />
        ) : null}
        {saved && saved.status !== "completed" ? (
          <Action
            title="Mark as Completed"
            icon={Icon.CheckCircle}
            onAction={() => update(saveGame(library, game, "completed"), "Another adventure finished")}
          />
        ) : null}
      </ActionPanel.Section>
      <ActionPanel.Section>
        <Action.OpenInBrowser
          title="Open on HowLongToBeat"
          url={gameUrl(game)}
          shortcut={Keyboard.Shortcut.Common.Open}
        />
        <Action.CopyToClipboard
          title="Copy Completion Times"
          content={`${game.name}\nMain Story: ${formatHours(game.main)}\nMain + Extras: ${formatHours(game.extra)}\nCompletionist: ${formatHours(game.complete)}\n${gameUrl(game)}`}
        />
        {saved ? (
          <Action
            title="Remove from Library"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            onAction={() =>
              update(
                library.filter((item) => item.game.id !== game.id),
                "Removed from library",
              )
            }
          />
        ) : null}
      </ActionPanel.Section>
    </>
  );
}
export function GameDetail({ game }: { game: Game }) {
  const { library, loading, persist } = useLibrary();
  const saved = library.find((item) => item.game.id === game.id);
  const remaining = saved ? remainingHours(saved) : null;
  const progress =
    saved && game[saved.style] > 0
      ? Math.min(100, Math.round((saved.hours / game[saved.style]) * 100))
      : null;
  const summary = [
    game.year ? String(game.year) : "",
    saved?.status === "playing" ? "Your current game" : "",
    game.rating ? `${game.rating}% community rating` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const markdown = [
    `# ${game.name}`,
    summary,
    "## How Long to Beat",
    `| Play style | Community average |\n| :--- | ---: |\n| Main Story | ${formatHours(game.main)} |\n| Main + Extras | ${formatHours(game.extra)} |\n| Completionist | ${formatHours(game.complete)} |`,
    ...(saved?.status === "playing"
      ? [
          "## Your Progress",
          `**${formatPlaytime(saved.hours)} played** · **${remaining === null ? "No time estimate yet" : `${formatPlaytime(remaining)} estimated remaining`}**`,
          `${STYLE_LABELS[saved.style]}${progress === null ? "" : ` · ${"▰".repeat(Math.round(progress / 10))}${"▱".repeat(10 - Math.round(progress / 10))} ${progress}% of the community estimate`}`,
        ]
      : []),
    ...(game.platforms.length ? ["## Platforms", game.platforms.join(" · ")] : []),
    "---",
    `Community averages${game.submissions ? ` from ${game.submissions.toLocaleString()} time submissions` : ""}. Play at your own pace.`,
    `[View on HowLongToBeat](${gameUrl(game)})`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return (
    <Detail
      isLoading={loading}
      navigationTitle={game.name}
      markdown={markdown}
      actions={
        <ActionPanel>
          <GameActions game={game} library={library} persist={persist} />
        </ActionPanel>
      }
    />
  );
}
export function PlaytimeForm({
  saved,
  library,
  persist,
}: {
  saved: SavedGame;
  library: SavedGame[];
  persist: (next: SavedGame[]) => Promise<void>;
}) {
  const [error, setError] = useState<string>();
  const { pop } = useNavigation();
  return (
    <Form
      navigationTitle="Update Playtime"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Progress"
            icon={Icon.Check}
            onSubmit={async (values: { hours: string; style: PlayStyle }) => {
              const hours = values.hours.trim() ? Number(values.hours) : NaN;
              if (!Number.isFinite(hours) || hours < 0 || hours > 100000) {
                setError("Enter a number between 0 and 100,000.");
                return;
              }
              try {
                await persist(updatePlaytime(library, saved.game.id, hours, values.style));
                await showToast({ style: Toast.Style.Success, title: "Progress saved" });
                pop();
              } catch {
                await showToast({ style: Toast.Style.Failure, title: "Couldn't save progress" });
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description title="Current Game" text={saved.game.name} />
      <Form.TextField
        id="hours"
        title="Total Hours Played"
        defaultValue={String(saved.hours)}
        error={error}
        onChange={() => setError(undefined)}
      />
      <Form.Dropdown id="style" title="Your Play Style" defaultValue={saved.style}>
        {Object.entries(STYLE_LABELS).map(([value, label]) => (
          <Form.Dropdown.Item key={value} value={value} title={label} />
        ))}
      </Form.Dropdown>
      <Form.Description text="Your remaining time is an estimate based on community averages. Play at your own pace." />
    </Form>
  );
}
