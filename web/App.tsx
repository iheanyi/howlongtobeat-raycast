import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Command,
  Compass,
  ExternalLink,
  Gamepad2,
  Keyboard,
  Library,
  LoaderCircle,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
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
} from "../src/lib/game";
import cached from "./discover.json";

type View = "discover" | "playing" | "backlog" | "completed";
const STORAGE_KEY = "hltb.browser.library.v1";
const views = { discover: "Discover", playing: "Now playing", backlog: "Backlog", completed: "Completed" };
const navIcons = { discover: Compass, playing: Play, backlog: Bookmark, completed: CheckCheck };
const descriptions: Record<View, string> = {
  discover: "A little less browsing. A little more playing.",
  playing: "One adventure at a time. Enjoy the journey.",
  backlog: "Good things are worth making time for.",
  completed: "Every ending is the start of another adventure.",
};

function readLibrary(): SavedGame[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is SavedGame =>
        !!item?.game &&
        typeof item.game.id === "number" &&
        typeof item.game.name === "string" &&
        ["backlog", "playing", "completed"].includes(item.status) &&
        ["main", "extra", "complete"].includes(item.style) &&
        Number.isFinite(item.hours) &&
        item.hours >= 0,
    );
  } catch {
    return [];
  }
}

function ClockLogo({ small = false }: { small?: boolean }) {
  return (
    <div className={`clock-logo ${small ? "small" : ""}`}>
      <Clock3 aria-hidden="true" strokeWidth={2.1} />
    </div>
  );
}
function Cover({ game, className = "" }: { game: Game; className?: string }) {
  const [failed, setFailed] = useState(false);
  return failed || !game.image ? (
    <div className={`cover-fallback ${className}`}>
      <Gamepad2 />
      <span>{game.name}</span>
    </div>
  ) : (
    <img
      className={className}
      src={game.image}
      alt={`${game.name} cover`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
function GameCard({
  game,
  saved,
  onOpen,
  onSave,
}: {
  game: Game;
  saved?: SavedGame;
  onOpen: () => void;
  onSave: () => void;
}) {
  return (
    <article className="game-card">
      <div className="cover-wrap">
        <button type="button" className="cover-button" onClick={onOpen} aria-label={`View ${game.name}`}>
          <Cover game={game} />
          <span className="cover-shade" />
          <span className="view-game">
            View game <ArrowUpRight size={16} />
          </span>
        </button>
        <button
          type="button"
          className={`save-game ${saved ? "is-saved" : ""}`}
          onClick={onSave}
          aria-label={`${saved ? "Remove" : "Save"} ${game.name}${saved ? " from library" : " to backlog"}`}
          title={saved ? "Remove from library" : "Save to backlog"}
        >
          {saved ? <Check size={15} /> : <Plus size={16} />}
        </button>
        {saved?.status === "playing" ? (
          <span className="cover-status">
            <span className="status-dot" />
            Now playing
          </span>
        ) : null}
        {saved?.status === "completed" ? (
          <span className="cover-status">
            <Check size={12} />
            Completed
          </span>
        ) : null}
      </div>
      <button type="button" className="game-title" onClick={onOpen}>
        {game.name}
      </button>
      <div className="game-subtitle">
        {game.year || "Release TBA"}
        <span>·</span>
        {game.platforms.includes("PC") ? "PC" : game.platforms[0] || "Game"}
        {game.platforms.length > 1 ? ` +${game.platforms.length - 1}` : ""}
      </div>
      <div className="card-times">
        <div>
          <p>MAIN STORY</p>
          <strong>{formatHours(game.main)}</strong>
        </div>
        <div>
          <p>COMPLETIONIST</p>
          <strong>{formatHours(game.complete)}</strong>
        </div>
      </div>
    </article>
  );
}

function Hero({
  game,
  current,
  onStart,
  onOpen,
  onLog,
}: {
  game: Game;
  current?: SavedGame;
  onStart: () => void;
  onOpen: () => void;
  onLog: () => void;
}) {
  const progress =
    current && game[current.style] > 0
      ? Math.min(100, Math.round((current.hours / game[current.style]) * 100))
      : 0;
  const remaining = current ? remainingHours(current) : null;
  const isHollow = game.id === 26286;
  return (
    <section className={`hero ${isHollow ? "hollow-hero" : ""}`}>
      {isHollow ? <div className="hero-art" /> : <Cover game={game} className="hero-cover" />}
      <div className="hero-gradient" />
      <div className="hero-content">
        <div className="hero-eyebrow">
          {current ? (
            <>
              <span className="status-dot" />
              YOUR CURRENT ADVENTURE
            </>
          ) : (
            <>
              <Sparkles size={13} />
              IN THE SPOTLIGHT
            </>
          )}
        </div>
        <h2>{game.name}</h2>
        <p>{current ? "Take your time. The adventure is yours." : "A world worth getting lost in."}</p>
        {current ? (
          <div className="hero-progress">
            <div>
              <span>{formatPlaytime(current.hours)} played</span>
              <span>{progress}% of estimate</span>
            </div>
            <div className="progress-track">
              <div style={{ width: `${progress}%` }} />
            </div>
            <p>
              {remaining === null
                ? "No community estimate yet."
                : remaining === 0
                  ? "You’ve reached the community estimate. Keep exploring."
                  : `About ${formatPlaytime(remaining)} left · ${STYLE_LABELS[current.style]}`}
            </p>
          </div>
        ) : (
          <div className="hero-time">
            <Clock3 size={15} />
            <strong>{formatHours(game.main)}</strong>
            <span>to finish the main story</span>
          </div>
        )}
        <div className="hero-actions">
          <button type="button" className="button primary" onClick={current ? onLog : onStart}>
            {current ? <Plus size={16} /> : <Play size={14} fill="currentColor" />}
            {current ? "Log playtime" : "Start playing"}
          </button>
          <button type="button" className="button hero-secondary" onClick={onOpen}>
            View game
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
      <div className="hero-caption">
        <span>{game.year}</span>
        <span>·</span>
        <span>{game.rating ? `${game.rating}% community rating` : "Community favorite"}</span>
      </div>
    </section>
  );
}

function GameDrawer({
  game,
  saved,
  onClose,
  onStatus,
  onRemove,
  onLog,
}: {
  game: Game;
  saved?: SavedGame;
  onClose: () => void;
  onStatus: (status: SavedGame["status"]) => void;
  onRemove: () => void;
  onLog: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
  }, []);
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-top">
          <div>
            <Clock3 size={15} />
            Game details
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close game details"
            onClick={onClose}
            ref={close}
          >
            <X size={19} />
          </button>
        </div>
        <div className="drawer-body">
          <div className="drawer-cover">
            <Cover game={game} />
            {game.rating > 0 ? (
              <div className="rating">
                <span>{game.rating}%</span> community rating
              </div>
            ) : null}
          </div>
          <div className="drawer-kicker">
            {game.year || "Release TBA"} <span>·</span> {game.type === "dlc" ? "DLC" : "Full game"}
          </div>
          <h2 id="drawer-title">{game.name}</h2>
          {saved ? (
            <div className="library-status">
              <span className="status-dot" />
              {saved.status === "playing"
                ? "Your current adventure"
                : saved.status === "completed"
                  ? "Adventure completed"
                  : "Saved in your backlog"}
            </div>
          ) : null}
          <h3>How long to beat</h3>
          <div className="detail-times">
            {(["main", "extra", "complete"] as PlayStyle[]).map((style, index) => (
              <div key={style}>
                <div>
                  <span className={`time-dot time-dot-${index}`} />
                  {STYLE_LABELS[style]}
                </div>
                <strong>{formatHours(game[style])}</strong>
              </div>
            ))}
          </div>
          <p className="estimate-note">
            Community averages from {game.submissions.toLocaleString()} playthroughs. Your journey may take a
            little longer.
          </p>
          {saved?.status === "playing" ? (
            <div className="drawer-progress">
              <div>
                <h3>Your progress</h3>
                <button type="button" className="text-button" onClick={onLog}>
                  Update
                  <ArrowUpRight size={13} />
                </button>
              </div>
              <p>
                <strong>{formatPlaytime(saved.hours)}</strong> played · {STYLE_LABELS[saved.style]}
              </p>
              <p>
                {remainingHours(saved) === null
                  ? "No time estimate yet."
                  : `${formatPlaytime(remainingHours(saved)!)} estimated remaining`}
              </p>
            </div>
          ) : null}
          <h3>Available on</h3>
          <div className="platforms">
            {game.platforms.length ? (
              game.platforms.map((platform) => <span key={platform}>{platform}</span>)
            ) : (
              <span>No platforms listed</span>
            )}
          </div>
          <a className="source-link" href={gameUrl(game)} target="_blank" rel="noreferrer">
            View on HowLongToBeat
            <ExternalLink size={14} />
          </a>
        </div>
        <div className="drawer-actions">
          <button
            type="button"
            className="button primary"
            onClick={() => (saved?.status === "playing" ? onLog() : onStatus("playing"))}
          >
            <Play size={14} />
            {saved?.status === "playing" ? "Log playtime" : "Set as current game"}
          </button>
          <div>
            {!saved ? (
              <button type="button" className="button secondary" onClick={() => onStatus("backlog")}>
                <Bookmark size={15} />
                Add to backlog
              </button>
            ) : (
              <button type="button" className="button secondary" onClick={onRemove}>
                <Trash2 size={14} />
                Remove
              </button>
            )}
            {saved && saved.status !== "completed" ? (
              <button type="button" className="button secondary" onClick={() => onStatus("completed")}>
                <Check size={14} />
                Mark complete
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function PlaytimeDialog({
  saved,
  onClose,
  onSave,
}: {
  saved: SavedGame;
  onClose: () => void;
  onSave: (hours: number, style: PlayStyle) => void;
}) {
  const [hours, setHours] = useState(String(saved.hours || ""));
  const [style, setStyle] = useState<PlayStyle>(saved.style);
  const [error, setError] = useState("");
  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playtime-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="icon-button modal-close"
          aria-label="Close playtime"
          onClick={onClose}
        >
          <X size={19} />
        </button>
        <div className="modal-icon">
          <Clock3 size={22} />
        </div>
        <h2 id="playtime-title">A little further along.</h2>
        <p>Update your journey through {saved.game.name}.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = Number(hours);
            if (!hours.trim() || !Number.isFinite(value) || value < 0 || value > 100000) {
              setError("Enter a valid number of hours between 0 and 100,000.");
              return;
            }
            onSave(value, style);
          }}
        >
          <label htmlFor="hours">Total hours played</label>
          <div className="hours-input">
            <input
              id="hours"
              name="hours"
              type="number"
              min="0"
              max="100000"
              step="0.1"
              placeholder="e.g. 12.5"
              value={hours}
              onChange={(event) => {
                setHours(event.target.value);
                setError("");
              }}
              autoFocus
            />
            <span>hours</span>
          </div>
          <label htmlFor="playstyle">Your play style</label>
          <div className="select-wrap">
            <select
              id="playstyle"
              name="playstyle"
              value={style}
              onChange={(event) => setStyle(event.target.value as PlayStyle)}
            >
              {Object.entries(STYLE_LABELS).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </div>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="button primary">
            <Check size={16} />
            Save progress
          </button>
        </form>
        <p className="modal-footnote">Community estimates are a guide. Play at your own pace.</p>
      </section>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("discover");
  const [library, setLibrary] = useState(readLibrary);
  const [query, setQuery] = useState("");
  const [games, setGames] = useState<Game[]>(cached.games as Game[]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cachedResults, setCachedResults] = useState(false);
  const [retry, setRetry] = useState(0);
  const [duration, setDuration] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState("popular");
  const [selected, setSelected] = useState<Game>();
  const [logging, setLogging] = useState<SavedGame>();
  const [shortcuts, setShortcuts] = useState(false);
  const [toast, setToast] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(cached.games.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeRequest = useRef(0);
  const [spotlight] = useState<Game>(
    () => (cached.games as Game[]).find((game) => game.id === 26286) ?? (cached.games[0] as Game),
  );
  const current = library.find((item) => item.status === "playing");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const requestId = ++activeRequest.current;
    if (view !== "discover") {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setCachedResults(false);
    setPage(1);
    const timer = setTimeout(
      async () => {
        try {
          const response = await fetch(
            `/api/games?q=${encodeURIComponent(query)}&sort=${sort === "name" ? "name" : "popular"}`,
            { signal: controller.signal },
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Search is unavailable.");
          if (requestId === activeRequest.current) {
            setGames(data.games);
            setCount(data.count);
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : "Search is unavailable.");
          setGames(query.trim() ? [] : (cached.games as Game[]));
          setCount(query.trim() ? 0 : cached.games.length);
          setCachedResults(!query.trim());
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      query ? 350 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, sort, retry, view]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isInput =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "/" && !isInput && !selected && !logging && !shortcuts) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        if (logging) setLogging(undefined);
        else if (selected) setSelected(undefined);
        else if (shortcuts) setShortcuts(false);
        else {
          setQuery("");
          searchRef.current?.blur();
        }
      }
      if (event.key === "?" && !isInput) setShortcuts((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, logging, shortcuts]);
  useEffect(() => {
    if (!selected && !logging && !shortcuts) return;
    document.body.style.overflow = "hidden";
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      const dialog = dialogs[dialogs.length - 1];
      const focusable = dialog?.querySelectorAll<HTMLElement>("button, a[href], input, select");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", trap);
    };
  }, [selected, logging, shortcuts]);
  const persist = (next: SavedGame[], message: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setLibrary(next);
      setToast(message);
    } catch {
      setToast("Couldn't save your library. Device storage may be full.");
    }
  };
  const changeStatus = (game: Game, status: SavedGame["status"]) =>
    persist(
      saveGame(library, game, status),
      status === "playing"
        ? `${game.name} is your current adventure.`
        : status === "completed"
          ? `${game.name} completed. On to the next adventure!`
          : `${game.name} added to your backlog.`,
    );
  const remove = (game: Game) =>
    persist(
      library.filter((item) => item.game.id !== game.id),
      `${game.name} removed from your library.`,
    );
  const changeView = (next: View) => {
    setView(next);
    setQuery("");
    setDuration("all");
    setPlatform("all");
  };
  const source =
    view === "discover"
      ? games
      : library
          .filter((item) => item.status === view)
          .map((item) => item.game)
          .filter((game) => game.name.toLowerCase().includes(query.toLowerCase()));
  let filtered = source.filter((game) => {
    const time = game.main;
    const durationMatch =
      duration === "all" ||
      (duration === "short" && time > 0 && time < 10) ||
      (duration === "medium" && time >= 10 && time < 30) ||
      (duration === "long" && time >= 30 && time < 60) ||
      (duration === "epic" && time >= 60);
    return durationMatch && (platform === "all" || game.platforms.some((value) => value.includes(platform)));
  });
  if (sort === "shortest")
    filtered = [...filtered].sort((a, b) => (a.main || Infinity) - (b.main || Infinity));
  if (sort === "name") filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  const loadMore = async () => {
    const requestId = activeRequest.current;
    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/games?q=${encodeURIComponent(query)}&page=${page + 1}&sort=${sort === "name" ? "name" : "popular"}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (requestId === activeRequest.current) {
        setGames((previous) => [
          ...previous,
          ...data.games.filter((game: Game) => !previous.some((item) => item.id === game.id)),
        ]);
        setPage((value) => value + 1);
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Couldn't load more games.");
    } finally {
      setLoadingMore(false);
    }
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          type="button"
          className="brand"
          onClick={() => changeView("discover")}
          aria-label="HowLongToBeat home"
        >
          <ClockLogo />
          <div>
            HowLongToBeat<p>A RAYCAST COMPANION</p>
          </div>
        </button>
        <div className="sidebar-body">
          <div className="nav-label">YOUR SPACE</div>
          <nav aria-label="Main navigation">
            {(Object.keys(views) as View[]).map((key) => {
              const Icon = navIcons[key];
              const total = library.filter((item) => item.status === key).length;
              return (
                <button
                  type="button"
                  className={`nav-item ${view === key ? "active" : ""}`}
                  key={key}
                  onClick={() => changeView(key)}
                  aria-current={view === key ? "page" : undefined}
                >
                  <Icon size={18} />
                  <span>{views[key]}</span>
                  {key === "discover" ? null : (
                    <span className={`nav-count ${key === "playing" && total ? "playing-count" : ""}`}>
                      {total}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="sidebar-note">
            <div className="little-stars">
              <Sparkles size={19} />
            </div>
            <h3>Good games take time.</h3>
            <p>Find a little space for your next great adventure.</p>
            <a href="https://howlongtobeat.com" target="_blank" rel="noreferrer">
              Meet the community
              <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="storage-status">
            <span className="status-dot" />
            Your library, saved locally
          </div>
          <div className="sidebar-bottom-row">
            <span>Made for the way you play.</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Keyboard shortcuts"
              onClick={() => setShortcuts(true)}
            >
              <Keyboard size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Library size={15} />
            <span>Your library</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{views[view]}</strong>
          </div>
          <div className="topbar-right">
            <span className="extension-label">
              <span className="raycast-mark">↗</span>Raycast extension
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="Show keyboard shortcuts"
              onClick={() => setShortcuts(true)}
            >
              <Command size={17} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">MAKE A LITTLE TIME FOR PLAY</div>
              <h1>
                {view === "discover"
                  ? "Your next adventure."
                  : view === "playing"
                    ? "Enjoy the journey."
                    : view === "backlog"
                      ? "Someday starts here."
                      : "A few great adventures."}
              </h1>
              <p>{descriptions[view]}</p>
            </div>
            <div className="heading-decoration" aria-hidden="true">
              <Gamepad2 strokeWidth={1} />
            </div>
          </div>
          {(view === "discover" || view === "playing") && !query && (current || view === "discover") ? (
            <Hero
              game={current?.game ?? spotlight}
              current={current}
              onStart={() => changeStatus(spotlight, "playing")}
              onOpen={() => setSelected(current?.game ?? spotlight)}
              onLog={() => current && setLogging(current)}
            />
          ) : null}
          <section className="discover-section" aria-labelledby="section-title">
            <div className="section-heading">
              <div>
                <h2 id="section-title">
                  {query ? "Search results" : view === "discover" ? "Find your next favorite" : views[view]}
                  <span className="result-count">{loading ? "…" : filtered.length}</span>
                </h2>
                <p>
                  {query
                    ? `Games matching “${query}”.`
                    : view === "discover"
                      ? "Worth your time. Picked by the community."
                      : view === "backlog"
                        ? "Your personal list of worlds to explore."
                        : view === "completed"
                          ? "The stories you’ve seen through."
                          : "Your current game, right where you left it."}
                </p>
              </div>
              <div className="sort-control">
                <span>Sort by</span>
                <div className="select-wrap">
                  <select
                    name="sort"
                    aria-label="Sort games"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                  >
                    <option value="popular">Popular</option>
                    <option value="name">Title A–Z</option>
                    <option value="shortest">Shortest first</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
            <div className="filter-bar">
              <div className="search-field">
                <Search size={18} />
                <input
                  ref={searchRef}
                  type="search"
                  name="search"
                  aria-label="Search games"
                  placeholder={view === "discover" ? "Search any game…" : "Search your library…"}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query ? (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <X size={15} />
                  </button>
                ) : (
                  <kbd>⌘ K</kbd>
                )}
              </div>
              <div className="filter-select select-wrap">
                <Clock3 size={15} />
                <select
                  name="duration"
                  aria-label="Filter by game length"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                >
                  <option value="all">Any playtime</option>
                  <option value="short">Under 10 hours</option>
                  <option value="medium">10–30 hours</option>
                  <option value="long">30–60 hours</option>
                  <option value="epic">60+ hours</option>
                </select>
                <ChevronDown size={14} />
              </div>
              <div className="filter-select select-wrap">
                <SlidersHorizontal size={15} />
                <select
                  name="platform"
                  aria-label="Filter by platform"
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                >
                  <option value="all">All platforms</option>
                  <option value="PC">PC</option>
                  <option value="PlayStation">PlayStation</option>
                  <option value="Xbox">Xbox</option>
                  <option value="Nintendo Switch">Nintendo Switch</option>
                  <option value="Mac">Mac</option>
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
            {error ? (
              <div className="error-banner" role="status">
                <span>
                  {cachedResults
                    ? `Live search is unavailable. Showing cached favorites from ${new Date(cached.fetchedAt).toLocaleDateString()}.`
                    : error}
                </span>
                <button type="button" onClick={() => setRetry((value) => value + 1)}>
                  Retry
                  <ArrowRight size={13} />
                </button>
              </div>
            ) : null}
            {loading && query ? (
              <div className="loading-state" role="status">
                <LoaderCircle className="spin" size={23} />
                <p>Finding your next adventure…</p>
              </div>
            ) : filtered.length ? (
              <div className={`games-grid ${loading ? "is-loading" : ""}`}>
                {filtered.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    saved={library.find((item) => item.game.id === game.id)}
                    onOpen={() => setSelected(game)}
                    onSave={() =>
                      library.some((item) => item.game.id === game.id)
                        ? remove(game)
                        : changeStatus(game, "backlog")
                    }
                  />
                ))}
              </div>
            ) : null}
            {!loading && !filtered.length ? (
              <div className="empty-state">
                <div className="empty-icon">
                  {view === "completed" ? (
                    <CheckCheck size={28} />
                  ) : query ? (
                    <Search size={28} />
                  ) : (
                    <Bookmark size={28} />
                  )}
                </div>
                <h3>
                  {query
                    ? "No adventures found."
                    : duration !== "all" || platform !== "all"
                      ? "Nothing here just yet."
                      : view === "backlog"
                        ? "A blank page, a world of possibilities."
                        : view === "completed"
                          ? "Your first ending awaits."
                          : "Choose your next adventure."}
                </h3>
                <p>
                  {query
                    ? "Try another title, or give those filters a little room."
                    : view === "completed"
                      ? "Mark a game complete to keep a little record of the journey."
                      : "Find a game you love and make a little time for it."}
                </p>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    changeView("discover");
                    searchRef.current?.focus();
                  }}
                >
                  Explore games
                  <ArrowRight size={15} />
                </button>
              </div>
            ) : null}
            {view === "discover" && !loading && !cachedResults && games.length < count ? (
              <div className="load-more">
                <button type="button" className="button secondary" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <LoaderCircle size={16} className="spin" /> : <ArrowDown size={15} />}
                  {loadingMore ? "Loading games…" : "Discover more games"}
                </button>
                <span>
                  Showing {games.length} of {count.toLocaleString()} games
                </span>
              </div>
            ) : null}
          </section>
          <footer className="content-footer">
            <p>
              <Clock3 size={13} />
              Completion times from{" "}
              <a href="https://howlongtobeat.com" target="_blank" rel="noreferrer">
                HowLongToBeat
              </a>
              <span>·</span>Every playthrough is different.
            </p>
            <button type="button" onClick={() => setShortcuts(true)}>
              Keyboard friendly
              <Keyboard size={14} />
            </button>
          </footer>
        </main>
      </div>
      {selected ? (
        <GameDrawer
          game={selected}
          saved={library.find((item) => item.game.id === selected.id)}
          onClose={() => setSelected(undefined)}
          onStatus={(status) => changeStatus(selected, status)}
          onRemove={() => remove(selected)}
          onLog={() => setLogging(library.find((item) => item.game.id === selected.id))}
        />
      ) : null}
      {logging ? (
        <PlaytimeDialog
          saved={logging}
          onClose={() => setLogging(undefined)}
          onSave={(hours, style) => {
            persist(
              updatePlaytime(library, logging.game.id, hours, style),
              "Progress saved. A little further along.",
            );
            setLogging(undefined);
          }}
        />
      ) : null}
      {shortcuts ? (
        <div className="overlay modal-overlay" onClick={() => setShortcuts(false)}>
          <section
            className="modal shortcuts-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="icon-button modal-close"
              aria-label="Close shortcuts"
              autoFocus
              onClick={() => setShortcuts(false)}
            >
              <X size={19} />
            </button>
            <div className="modal-icon">
              <Keyboard size={23} />
            </div>
            <h2 id="shortcuts-title">Keep your hands on the keys.</h2>
            <p>A few shortcuts to stay in the flow.</p>
            <div className="shortcut-row">
              <span>Search games</span>
              <div>
                <kbd>⌘ / Ctrl</kbd>
                <kbd>K</kbd>
              </div>
            </div>
            <div className="shortcut-row">
              <span>Jump to search</span>
              <kbd>/</kbd>
            </div>
            <div className="shortcut-row">
              <span>Close or clear search</span>
              <kbd>esc</kbd>
            </div>
            <div className="shortcut-row">
              <span>Show these shortcuts</span>
              <kbd>?</kbd>
            </div>
            <div className="shortcut-row">
              <span>Navigate controls</span>
              <kbd>tab</kbd>
            </div>
          </section>
        </div>
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
