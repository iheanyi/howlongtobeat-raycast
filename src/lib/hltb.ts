import { Game, normalizeGame } from "./game";

const ORIGIN = "https://howlongtobeat.com";
const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Referer: `${ORIGIN}/`,
  Origin: ORIGIN,
  Accept: "application/json",
};
type SearchOptions = { query?: string; page?: number; sort?: "popular" | "name"; signal?: AbortSignal };
export type SearchResponse = { games: Game[]; count: number; page: number };
export class HltbError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

// The site's public search changed from /api/search to /api/search/site in 2026.
// Keep authentication in one place and refresh once on an expired token.
export class HltbClient {
  private token?: { value: string; at: number };
  private tokenRequest?: Promise<string>;
  private cache = new Map<string, { at: number; result: SearchResponse }>();
  constructor(private request: typeof fetch = fetch) {}
  private async json(path: string, init: RequestInit = {}): Promise<unknown> {
    let response: Response;
    try {
      const deadline = AbortSignal.timeout(15000);
      response = await this.request(`${ORIGIN}${path}`, {
        ...init,
        headers: { ...HEADERS, ...init.headers },
        signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline,
      });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      throw new HltbError("Couldn't reach HowLongToBeat. Check your connection and try again.");
    }
    if (!response.ok)
      throw new HltbError(
        response.status === 429
          ? "HowLongToBeat is receiving too many requests. Try again shortly."
          : `HowLongToBeat returned ${response.status}. Try again or open the website.`,
        response.status,
      );
    try {
      return await response.json();
    } catch {
      throw new HltbError(
        "HowLongToBeat returned an unexpected response. Open the website or try again later.",
      );
    }
  }
  private async authenticate(): Promise<string> {
    if (this.token && Date.now() - this.token.at < 5 * 60000) return this.token.value;
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = (async () => {
      const data = (await this.json(`/api/search/site/init?t=${Date.now()}`)) as { token?: unknown };
      if (typeof data?.token !== "string" || !data.token)
        throw new HltbError("HowLongToBeat search authentication has changed. Please open the website.");
      this.token = { value: data.token, at: Date.now() };
      return data.token;
    })();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = undefined;
    }
  }
  async search({
    query = "",
    page = 1,
    sort = "popular",
    signal,
  }: SearchOptions = {}): Promise<SearchResponse> {
    const term = query.trim().slice(0, 200);
    page = Math.max(1, Math.min(100, Math.floor(page) || 1));
    const key = JSON.stringify([term.toLowerCase(), page, sort]);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < 5 * 60000) return cached.result;
    const body = JSON.stringify({
      searchType: "games",
      searchTerms: term ? term.split(/\s+/) : [],
      searchPage: page,
      size: 20,
      searchOptions: {
        games: {
          userId: 0,
          platform: "",
          sortCategory: sort === "name" ? "name" : "popular",
          rangeCategory: "main",
          rangeTime: { min: null, max: null },
          gameplay: { perspective: "", flow: "", genre: "" },
          year: "",
          modifier: "",
        },
        users: { sortCategory: "postcount" },
        lists: { sortCategory: "follows" },
        filter: "",
        sort: 0,
        randomizer: 0,
      },
      useCache: true,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.authenticate();
      signal?.throwIfAborted();
      try {
        const data = (await this.json("/api/search/site", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-auth-token": token },
          body,
          signal,
        })) as { data?: unknown; count?: number };
        if (!Array.isArray(data?.data))
          throw new HltbError("HowLongToBeat search data has changed. Please open the website.");
        const result = {
          games: data.data.map(normalizeGame),
          count: typeof data.count === "number" ? data.count : data.data.length,
          page,
        };
        if (this.cache.size > 60) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { at: Date.now(), result });
        return result;
      } catch (error) {
        if (error instanceof HltbError && error.status === 403 && attempt === 0) {
          this.token = undefined;
          continue;
        }
        throw error;
      }
    }
    throw new HltbError("HowLongToBeat couldn't authenticate this search.");
  }
}
export const hltb = new HltbClient();
