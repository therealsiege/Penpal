import fs from "fs";
import { config } from "../../shared/config.js";
export function parseWebIntel() {
    const webIntelPath = config.webIntelPath;
    if (!fs.existsSync(webIntelPath)) {
        console.log("  web-intel.json not found, skipping web intel ingestion");
        return [];
    }
    const raw = fs.readFileSync(webIntelPath, "utf-8");
    const data = JSON.parse(raw);
    console.log(`  Loaded ${data.length} web intel records`);
    return data;
}
