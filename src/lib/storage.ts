import { LocalStorage } from "@raycast/api";
import { useEffect, useState } from "react";
import { SavedGame } from "./game";

const KEY = "howlongtobeat.library.v1";
const listeners = new Set<(library: SavedGame[]) => void>();
export function useLibrary() {
  const [library, setLibrary] = useState<SavedGame[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    listeners.add(setLibrary);
    LocalStorage.getItem<string>(KEY)
      .then((raw) => {
        if (active && raw) {
          try {
            const value = JSON.parse(raw);
            if (Array.isArray(value)) setLibrary(value);
          } catch {
            /* A corrupt cache should not prevent launching search. */
          }
        }
      })
      .catch(() => {
        /* Search still works if the library cannot be read. */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      listeners.delete(setLibrary);
    };
  }, []);
  const persist = async (next: SavedGame[]) => {
    await LocalStorage.setItem(KEY, JSON.stringify(next));
    for (const listener of listeners) listener(next);
  };
  return { library, loading, persist };
}
