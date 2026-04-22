import fs from "fs";
import path from "path";
import { validateVaultPath, findBacklinks } from "./vault-helpers.js";
export const vaultWriteSchema = {
    name: "vault_write",
    description: "Write or update a file in the Obsidian vault. Uses atomic writes (tmp + rename) for safety. Returns confirmation with updated backlinks.",
    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Relative path within the vault (e.g. '1Putt/Notes/meeting.md')",
            },
            content: {
                type: "string",
                description: "File content to write",
            },
            createIfMissing: {
                type: "boolean",
                description: "If true, create the file and parent directories if they don't exist. Default: false.",
            },
        },
        required: ["path", "content"],
    },
};
export async function vaultWrite(args) {
    const fullPath = validateVaultPath(args.path);
    const exists = fs.existsSync(fullPath);
    if (!exists && !args.createIfMissing) {
        throw new Error(`File not found: ${args.path}. Set createIfMissing: true to create it.`);
    }
    // Ensure parent directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        if (args.createIfMissing) {
            fs.mkdirSync(dir, { recursive: true });
        }
        else {
            throw new Error(`Parent directory does not exist: ${path.dirname(args.path)}`);
        }
    }
    // Atomic write: write to tmp, then rename
    const tmpPath = fullPath + ".sidekick-tmp";
    try {
        fs.writeFileSync(tmpPath, args.content, "utf-8");
        fs.renameSync(tmpPath, fullPath);
    }
    catch (err) {
        try {
            fs.unlinkSync(tmpPath);
        }
        catch {
            /* ignore cleanup failure */
        }
        throw err;
    }
    const stat = fs.statSync(fullPath);
    const backlinks = findBacklinks(args.path);
    return JSON.stringify({
        success: true,
        path: args.path,
        mtime: stat.mtimeMs,
        backlinks,
    });
}
