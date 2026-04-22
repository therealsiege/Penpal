/**
 * Health Check
 *
 * Verifies that all Penny infrastructure is reachable:
 * - Memgraph (bolt connection + simple query)
 * - Qdrant (collection list)
 * - API keys present (OpenAI, Anthropic)
 * - Docker containers running
 *
 * Usage:
 *   npm run health
 *   npm run health -- --json
 *
 * Exports checkHealth() for use by the scheduler and future Electron dashboard.
 */
import { config } from "../shared/config.js";
async function timedCheck(name, fn) {
    const start = Date.now();
    try {
        const message = await fn();
        return { name, status: "ok", latency_ms: Date.now() - start, message: message || undefined };
    }
    catch (err) {
        return { name, status: "fail", latency_ms: Date.now() - start, message: err.message };
    }
}
async function checkMemgraph() {
    // Dynamic import to avoid loading neo4j-driver if not needed elsewhere
    const neo4j = await import("neo4j-driver");
    const driver = neo4j.default.driver(config.memgraphUri, config.memgraphUser ? neo4j.default.auth.basic(config.memgraphUser, config.memgraphPassword) : undefined);
    const session = driver.session();
    try {
        const result = await session.run("MATCH (n) RETURN count(n) AS cnt");
        const cnt = result.records[0]?.get("cnt");
        const count = cnt && typeof cnt === "object" && "toNumber" in cnt ? cnt.toNumber() : Number(cnt);
        return `${count} nodes`;
    }
    finally {
        await session.close();
        await driver.close();
    }
}
async function checkQdrant() {
    const res = await fetch(`${config.qdrantUrl}/collections`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    const data = (await res.json());
    const count = data.result?.collections?.length ?? 0;
    return `${count} collections`;
}
async function checkDocker() {
    const { execSync } = await import("child_process");
    const output = execSync("docker compose ps --format json 2>/dev/null || docker-compose ps --format json 2>/dev/null", {
        cwd: new URL("../../", import.meta.url).pathname,
        timeout: 10000,
        encoding: "utf-8",
    });
    // docker compose v2 returns one JSON object per line
    const lines = output.trim().split("\n").filter(Boolean);
    const services = [];
    for (const line of lines) {
        try {
            services.push(JSON.parse(line));
        }
        catch { /* skip non-JSON lines */ }
    }
    const running = services.filter((s) => s.State === "running");
    if (running.length === 0)
        throw new Error("No containers running");
    return `${running.length}/${services.length} running`;
}
function checkApiKey(name, value) {
    if (value && value.length > 8) {
        return { name, status: "ok", latency_ms: 0, message: `...${value.slice(-4)}` };
    }
    return { name, status: "fail", latency_ms: 0, message: "Not set or too short" };
}
export async function checkHealth() {
    const checks = [];
    // Run infrastructure checks in parallel
    const [memgraph, qdrant, docker] = await Promise.allSettled([
        timedCheck("memgraph", checkMemgraph),
        timedCheck("qdrant", checkQdrant),
        timedCheck("docker", checkDocker),
    ]);
    checks.push(memgraph.status === "fulfilled" ? memgraph.value : { name: "memgraph", status: "fail", latency_ms: 0, message: "Check threw" }, qdrant.status === "fulfilled" ? qdrant.value : { name: "qdrant", status: "fail", latency_ms: 0, message: "Check threw" }, docker.status === "fulfilled" ? docker.value : { name: "docker", status: "fail", latency_ms: 0, message: "Check threw" });
    // API key checks (sync)
    checks.push(checkApiKey("openai_key", config.openaiApiKey));
    checks.push(checkApiKey("anthropic_key", config.anthropicApiKey));
    checks.push(checkApiKey("firecrawl_key", config.firecrawlApiKey));
    const failCount = checks.filter((c) => c.status === "fail").length;
    const infraFails = checks.filter((c) => ["memgraph", "qdrant", "docker"].includes(c.name) && c.status === "fail").length;
    let overall;
    if (infraFails >= 2)
        overall = "down";
    else if (failCount > 0)
        overall = "degraded";
    else
        overall = "healthy";
    return {
        timestamp: new Date().toISOString(),
        overall,
        checks,
    };
}
// ─── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
    const jsonMode = process.argv.includes("--json");
    const result = await checkHealth();
    if (jsonMode) {
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.overall === "down" ? 1 : 0);
    }
    const statusIcon = { healthy: "OK", degraded: "WARN", down: "FAIL" };
    console.log(`\nPenny Health: ${statusIcon[result.overall]} (${result.overall})`);
    console.log("─".repeat(50));
    for (const check of result.checks) {
        const icon = check.status === "ok" ? "+" : "x";
        const latency = check.latency_ms > 0 ? ` (${check.latency_ms}ms)` : "";
        console.log(`  [${icon}] ${check.name}${latency}${check.message ? ` — ${check.message}` : ""}`);
    }
    console.log();
    process.exit(result.overall === "down" ? 1 : 0);
}
const isDirectRun = process.argv[1]?.includes("health");
if (isDirectRun) {
    main().catch((err) => {
        console.error("Health check failed:", err);
        process.exit(1);
    });
}
