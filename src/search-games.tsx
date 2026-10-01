import { Action, ActionPanel, Color, Icon, LaunchProps, List, showToast, Toast } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { GameActions, GameDetail } from "./components/game-detail";
import { formatHours, Game } from "./lib/game";
import { hltb } from "./lib/hltb";
import { useLibrary } from "./lib/storage";

export default function SearchGames(
  props: LaunchProps<{ arguments: { query?: string }; launchContext: { query?: string } }>,
) {
  const [query, setQuery] = useState(props.launchContext?.query ?? props.arguments?.query ?? "");
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [view, setView] = useState("discover");
  const [retry, setRetry] = useState(0);
  const [count, setCount] = useState(0);
  const page = useRef(1);
  const moreLoading = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const { library, loading: libraryLoading, persist } = useLibrary();
  useEffect(() => {
    if (view !== "discover") return;
    const controller = new AbortController();
    requestController.current = controller;
    page.current = 1;
    setLoading(true);
    setError(undefined);
    const timer = setTimeout(
      () => {
        hltb
          .search({ query, signal: controller.signal })
          .then((result) => {
            if (!controller.signal.aborted) {
              setGames(result.games);
              setCount(result.count);
            }
          })
          .catch((error) => {
            if (!controller.signal.aborted) {
              setError(error.message);
              setGames([]);
              setCount(0);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      query ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, view, retry]);
  const loadMore = async () => {
    const controller = requestController.current;
    if (loading || moreLoading.current || !controller || controller.signal.aborted) return;
    moreLoading.current = true;
    setLoading(true);
    try {
      const result = await hltb.search({ query, page: page.current + 1, signal: controller.signal });
      if (!controller.signal.aborted) {
        page.current++;
        setGames((previous) => [
          ...previous,
          ...result.games.filter((game) => !previous.some((item) => item.id === game.id)),
        ]);
        if (!result.games.length) setCount(games.length);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        await showToast({
          style: Toast.Style.Failure,
          title: "Couldn't load more games",
          message: error instanceof Error ? error.message : "Try again shortly.",
        });
    } finally {
      moreLoading.current = false;
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  const displayed =
    view === "discover"
      ? games
      : library
          .filter((item) => view === "library" || item.status === view)
          .map((item) => item.game)
          .filter((game) => game.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <List
      isLoading={(view === "discover" && loading) || libraryLoading}
      filtering={false}
      searchText={query}
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Search your next adventure…"
      pagination={
        view === "discover"
          ? { pageSize: 20, hasMore: games.length < count, onLoadMore: loadMore }
          : undefined
      }
      searchBarAccessory={
        <List.Dropdown tooltip="View" value={view} onChange={setView}>
          <List.Dropdown.Item value="discover" title="Discover Games" />
          <List.Dropdown.Item value="library" title="My Library" />
          <List.Dropdown.Item value="playing" title="Now Playing" />
          <List.Dropdown.Item value="backlog" title="Backlog" />
          <List.Dropdown.Item value="completed" title="Completed" />
        </List.Dropdown>
      }
    >
      <List.EmptyView
        title={
          error
            ? "Search Unavailable"
            : query
              ? "No Games Found"
              : view === "discover"
                ? "Finding Your Next Adventure"
                : "Your Next Adventure Awaits"
        }
        description={
          error ?? (query ? "Try a different game title." : "Search for a game and add it to your library.")
        }
        icon={error ? Icon.Wifi : Icon.GameController}
        actions={
          <ActionPanel>
            {error ? (
              <Action
                title="Retry Search"
                icon={Icon.ArrowClockwise}
                onAction={() => setRetry((value) => value + 1)}
              />
            ) : (
              <Action
                title="Search Games"
                icon={Icon.MagnifyingGlass}
                onAction={() => {
                  setView("discover");
                  setQuery("");
                }}
              />
            )}
            <Action.OpenInBrowser title="Open HowLongToBeat" url="https://howlongtobeat.com" />
          </ActionPanel>
        }
      />
      <List.Section
        title={query ? "Search Results" : view === "discover" ? "Popular with the Community" : "Your Games"}
        subtitle={String(displayed.length)}
      >
        {displayed.map((game) => {
          const saved = library.find((item) => item.game.id === game.id);
          return (
            <List.Item
              key={game.id}
              id={String(game.id)}
              title={game.name}
              subtitle={game.year ? String(game.year) : undefined}
              icon={game.image || Icon.GameController}
              accessories={[
                { text: formatHours(game.main), icon: Icon.Clock, tooltip: "Main Story" },
                ...(saved
                  ? [
                      {
                        tag: {
                          value:
                            saved.status === "playing"
                              ? "Now Playing"
                              : saved.status === "backlog"
                                ? "Backlog"
                                : "Completed",
                          color: saved.status === "playing" ? Color.Green : Color.SecondaryText,
                        },
                      },
                    ]
                  : []),
              ]}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="View Game Details"
                    icon={Icon.Eye}
                    target={<GameDetail game={game} />}
                  />
                  <GameActions game={game} library={library} persist={persist} />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
