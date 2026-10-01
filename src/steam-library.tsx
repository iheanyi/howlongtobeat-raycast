import {
  Action,
  ActionPanel,
  Application,
  Color,
  Detail,
  getFrontmostApplication,
  getPreferenceValues,
  Icon,
  Keyboard,
  launchCommand,
  LaunchType,
  List,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import {
  discoverInstalledSteamGames,
  InstalledSteamGame,
  matchFrontmostSteamGame,
  SteamLibrary,
  steamSearchTitle,
  steamCoverUrl,
} from "./lib/steam";

export default function SteamGames() {
  const { steamPath } = getPreferenceValues<{ steamPath?: string }>();
  const [library, setLibrary] = useState<SteamLibrary>();
  const [application, setApplication] = useState<Application>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const captured = useRef<Promise<Application | undefined> | null>(null);
  useEffect(() => {
    let active = true;
    // Capture once at command launch. Never guess a game from an arbitrary app name.
    captured.current ??= getFrontmostApplication().catch(() => undefined);
    captured.current.then((app) => {
      if (active) setApplication(app);
    });
    setLoading(true);
    setError(undefined);
    discoverInstalledSteamGames({ steamPath })
      .then((result) => {
        if (!active) return;
        setLibrary(result);
        if (result.warnings.length)
          void showToast({
            style: Toast.Style.Failure,
            title: "Some Steam Data Was Unavailable",
            message: result.warnings.join("\n"),
          });
      })
      .catch((reason) => {
        if (active) {
          setLibrary(undefined);
          setError(reason instanceof Error ? reason.message : "Couldn't read Steam's library.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [steamPath, refresh]);

  const focused = matchFrontmostSteamGame(application?.path, library?.games ?? []);
  const actions = (game?: InstalledSteamGame) => (
    <ActionPanel>
      {game ? (
        <Action
          title="Search HowLongToBeat"
          icon={Icon.MagnifyingGlass}
          onAction={async () => {
            try {
              await launchCommand({
                name: "search-games",
                type: LaunchType.UserInitiated,
                context: { query: steamSearchTitle(game) },
              });
            } catch {
              await showToast({
                style: Toast.Style.Failure,
                title: "Couldn't Open Game Search",
                message: "Try opening Search Games directly.",
              });
            }
          }}
        />
      ) : null}
      {game ? (
        <Action.OpenInBrowser
          title="View Steam Store"
          url={`https://store.steampowered.com/app/${game.appId}`}
        />
      ) : null}
      <Action
        title="Refresh Steam Library"
        icon={Icon.ArrowClockwise}
        shortcut={Keyboard.Shortcut.Common.Refresh}
        onAction={() => setRefresh((value) => value + 1)}
      />
      <Action title="Configure Steam Folder" icon={Icon.Gear} onAction={openExtensionPreferences} />
      {library ? (
        <Action.Push
          title="View Library Status"
          icon={Icon.Info}
          target={
            <Detail
              navigationTitle="Steam Library Status"
              markdown={[
                "# Steam Library Status",
                `${library.games.length} installed titles found across ${library.libraries.length} readable libraries.`,
                "## Available Libraries",
                library.libraries.map((folder) => `- ${folder}`).join("\n"),
                ...(library.warnings.length
                  ? ["## Skipped Data", library.warnings.map((warning) => `- ${warning}`).join("\n")]
                  : []),
                "Library locations come from Steam's configuration on this computer. Use Steam Settings → Storage to correct missing locations, then refresh this list.",
              ].join("\n\n")}
            />
          }
        />
      ) : null}
    </ActionPanel>
  );
  const item = (game: InstalledSteamGame, isFocused = false) => (
    <List.Item
      key={game.appId}
      id={String(game.appId)}
      title={game.name}
      icon={{ source: steamCoverUrl(game.appId), fallback: Icon.GameController }}
      accessories={
        isFocused
          ? [
              {
                tag: { value: "Focused App", color: Color.Green },
                tooltip: "Raycast's frontmost app path matches this Steam install folder.",
              },
            ]
          : [{ text: "Installed", tooltip: game.installDirectory }]
      }
      actions={actions(game)}
    />
  );
  return (
    <List
      isLoading={loading}
      navigationTitle="Steam Library"
      searchBarPlaceholder="Search your installed Steam games…"
    >
      <List.EmptyView
        title={
          error
            ? "Steam Library Unavailable"
            : loading
              ? "Reading Your Steam Library"
              : "No Installed Games Found"
        }
        description={
          error ??
          "Install a game through Steam, then refresh. Only installed games on this computer appear here."
        }
        icon={Icon.GameController}
        actions={actions()}
      />
      {focused ? (
        <List.Section title="Focused Steam Game" subtitle="Confirmed by app path">
          {item(focused, true)}
        </List.Section>
      ) : null}
      <List.Section
        title="Installed Steam Games"
        subtitle={
          library
            ? `${library.games.length} games · ${library.libraries.length} ${library.libraries.length === 1 ? "library" : "libraries"}`
            : undefined
        }
      >
        {library?.games.filter((game) => game.appId !== focused?.appId).map((game) => item(game))}
      </List.Section>
    </List>
  );
}
