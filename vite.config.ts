import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { hltb, HltbError } from "./src/lib/hltb";

function searchApi(): Plugin {
  const handler = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
    next: () => void,
  ) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/games") return next();
    res.setHeader("Content-Type", "application/json");
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method not allowed." }));
      return;
    }
    try {
      const result = await hltb.search({
        query: url.searchParams.get("q") ?? "",
        page: Number(url.searchParams.get("page") || 1),
        sort: url.searchParams.get("sort") === "name" ? "name" : "popular",
      });
      res.setHeader("Cache-Control", "private, max-age=60");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = error instanceof HltbError ? (error.status >= 500 ? 502 : error.status) : 500;
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Search is unavailable. Please try again.",
        }),
      );
    }
  };
  return {
    name: "hltb-search",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
export default defineConfig({ plugins: [react(), searchApi()], server: { port: 5173, strictPort: true } });
