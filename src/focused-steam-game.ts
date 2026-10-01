import {
  getFrontmostApplication,
  getPreferenceValues,
  launchCommand,
  LaunchType,
  showToast,
  Toast,
} from "@raycast/api";
import { discoverInstalledSteamGames, matchFrontmostSteamGame, steamSearchTitle } from "./lib/steam";

export default async function FocusedSteamGame() {
  // Request the frontmost app before starting filesystem or UI work.
  const application = getFrontmostApplication().catch(() => undefined);
  const toast = await showToast({ style: Toast.Style.Animated, title: "Finding Your Focused Steam Game" });
  try {
    const { steamPath } = getPreferenceValues<{ steamPath?: string }>();
    const [app, library] = await Promise.all([application, discoverInstalledSteamGames({ steamPath })]);
    const game = matchFrontmostSteamGame(app?.path, library.games);
    if (game) {
      await launchCommand({
        name: "search-games",
        type: LaunchType.UserInitiated,
        context: { query: steamSearchTitle(game) },
      });
      await toast.hide();
    } else {
      toast.style = Toast.Style.Failure;
      toast.title = "No Focused Steam Game Found";
      toast.message =
        "Choose a game from your Steam library, or focus a game and try this command with a hotkey.";
      await launchCommand({ name: "steam-library", type: LaunchType.UserInitiated });
    }
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Couldn't Look up Your Steam Game";
    toast.message = error instanceof Error ? error.message : "Try the Steam Library command.";
    await launchCommand({ name: "steam-library", type: LaunchType.UserInitiated });
  }
}
