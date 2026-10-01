import { Action, ActionPanel, Icon, launchCommand, LaunchType, List } from "@raycast/api";
import { GameDetail } from "./components/game-detail";
import { useLibrary } from "./lib/storage";

export default function CurrentGame() {
  const { library, loading } = useLibrary();
  const current = library.find((item) => item.status === "playing");
  if (current) return <GameDetail game={current.game} />;
  return (
    <List isLoading={loading}>
      <List.EmptyView
        title="Your Next Adventure Awaits"
        description="Search for a game and choose Set as Current Game to start tracking your progress."
        icon={Icon.GameController}
        actions={
          <ActionPanel>
            <Action
              title="Search Games"
              icon={Icon.MagnifyingGlass}
              onAction={() => launchCommand({ name: "search-games", type: LaunchType.UserInitiated })}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}
