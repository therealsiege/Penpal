import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import searchRoutes from "./routes/search.js";
import entityRoutes from "./routes/entity.js";
import graphRoutes from "./routes/graph.js";
import statsRoutes from "./routes/stats.js";
import venturesRoutes from "./routes/ventures.js";
const app = new Hono();
// CORS for local development
app.use("/*", cors({
    origin: ["http://localhost:3100", "http://localhost:5173", "http://127.0.0.1:3100"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
}));
// API routes
app.route("/api", searchRoutes);
app.route("/api", entityRoutes);
app.route("/api", graphRoutes);
app.route("/api", statsRoutes);
app.route("/api", venturesRoutes);
// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
// Static files from public directory (fallback after API routes)
app.use("/*", serveStatic({ root: "./public" }));
const port = 3100;
serve({ fetch: app.fetch, port }, () => {
    console.log(`Knowledge Explorer API running at http://localhost:${port}`);
});
export default app;
