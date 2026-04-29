import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

// We need to override config.vaultPath before importing the tools.
// Set env var before config module loads.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-test-"));
process.env.VAULT_PATH = tmpDir;

// Now import tools (they'll use the overridden config)
const { vaultRead } = await import("../vault-read.js");
const { vaultSearch } = await import("../vault-search.js");
const { vaultWrite } = await import("../vault-write.js");
const { parseFrontmatter, findBacklinks, extractTags } = await import(
  "../vault-helpers.js"
);

// Set up test fixtures
before(() => {
  // Create a test file with frontmatter
  const testContent = `---
title: Test Note
tags: [health, sales]
status: active
---

# Test Note

This is a test note about healthcare technology.
It mentions [[Related Note]] as a wikilink.
`;
  fs.writeFileSync(path.join(tmpDir, "test-note.md"), testContent);

  // Create a related note that backlinks to test-note
  const relatedContent = `# Related Note

This note references [[test-note]] in its content.
It also discusses healthcare topics.
`;
  fs.writeFileSync(path.join(tmpDir, "related-note.md"), relatedContent);

  // Create a subfolder with a file
  fs.mkdirSync(path.join(tmpDir, "subfolder"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, "subfolder", "deep-note.md"),
    "# Deep Note\n\nA note in a subfolder about #integration patterns.\n",
  );
});

after(() => {
  // Clean up temp directory
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("vault_read", () => {
  it("reads file content and parses frontmatter", async () => {
    const result = JSON.parse(await vaultRead({ path: "test-note.md" }));
    assert.equal(result.path, "test-note.md");
    assert.ok(result.content.includes("# Test Note"));
    assert.equal(result.frontmatter.title, "Test Note");
    assert.deepEqual(result.frontmatter.tags, ["health", "sales"]);
    assert.equal(result.frontmatter.status, "active");
  });

  it("includes backlinks from other files", async () => {
    const result = JSON.parse(await vaultRead({ path: "test-note.md" }));
    assert.ok(result.backlinks.length > 0);
    const backlink = result.backlinks.find(
      (b: { title: string }) => b.title === "related-note",
    );
    assert.ok(backlink, "Should find related-note as a backlink");
    assert.ok(backlink.snippet.includes("[[test-note]]"));
  });

  it("includes related files from same folder", async () => {
    const result = JSON.parse(await vaultRead({ path: "test-note.md" }));
    assert.ok(Array.isArray(result.relatedFiles));
    assert.ok(
      result.relatedFiles.some((f: string) => f.includes("related-note.md")),
    );
  });

  it("throws on non-existent file", async () => {
    await assert.rejects(() => vaultRead({ path: "nope.md" }), {
      message: /File not found/,
    });
  });

  it("throws on path traversal", async () => {
    await assert.rejects(() => vaultRead({ path: "../../etc/passwd" }), {
      message: /Path traversal denied/,
    });
  });
});

describe("vault_search", () => {
  it("finds files matching a query", async () => {
    const result = JSON.parse(await vaultSearch({ query: "healthcare" }));
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0, "Should find at least one match");
    const match = result.find((r: { path: string }) =>
      r.path.includes("test-note.md"),
    );
    assert.ok(match, "Should find test-note.md");
    assert.ok(match.snippet.length > 0);
    assert.ok(Array.isArray(match.tags));
    assert.ok(Array.isArray(match.folder));
  });

  it("returns empty for no matches", async () => {
    const result = JSON.parse(
      await vaultSearch({ query: "zzzznonexistent12345" }),
    );
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });

  it("respects limit parameter", async () => {
    const result = JSON.parse(
      await vaultSearch({ query: "note", limit: 1 }),
    );
    assert.ok(result.length <= 1);
  });

  it("throws on empty query", async () => {
    await assert.rejects(() => vaultSearch({ query: "" }), {
      message: /empty/,
    });
  });
});

describe("vault_write", () => {
  it("creates a new file with createIfMissing", async () => {
    const content = "# New Note\n\nCreated by test.\n";
    const result = JSON.parse(
      await vaultWrite({
        path: "new-note.md",
        content,
        createIfMissing: true,
      }),
    );
    assert.equal(result.success, true);
    assert.equal(result.path, "new-note.md");
    assert.ok(result.mtime > 0);

    // Verify round-trip
    const readResult = JSON.parse(await vaultRead({ path: "new-note.md" }));
    assert.equal(readResult.content, content);
  });

  it("creates nested directories with createIfMissing", async () => {
    const content = "# Deep New Note\n";
    const result = JSON.parse(
      await vaultWrite({
        path: "new-folder/sub/deep-new.md",
        content,
        createIfMissing: true,
      }),
    );
    assert.equal(result.success, true);

    // Verify file exists
    const readResult = JSON.parse(
      await vaultRead({ path: "new-folder/sub/deep-new.md" }),
    );
    assert.equal(readResult.content, content);
  });

  it("overwrites existing files", async () => {
    const original = "# Original\n";
    const updated = "# Updated\n";
    fs.writeFileSync(path.join(tmpDir, "overwrite-me.md"), original);

    await vaultWrite({ path: "overwrite-me.md", content: updated });
    const readResult = JSON.parse(
      await vaultRead({ path: "overwrite-me.md" }),
    );
    assert.equal(readResult.content, updated);
  });

  it("throws when file missing and createIfMissing is false", async () => {
    await assert.rejects(
      () =>
        vaultWrite({
          path: "does-not-exist.md",
          content: "test",
          createIfMissing: false,
        }),
      { message: /File not found/ },
    );
  });

  it("throws on path traversal", async () => {
    await assert.rejects(
      () =>
        vaultWrite({
          path: "../../evil.md",
          content: "bad",
          createIfMissing: true,
        }),
      { message: /Path traversal denied/ },
    );
  });
});

describe("vault-helpers", () => {
  it("parseFrontmatter extracts YAML fields", () => {
    const fm = parseFrontmatter(
      "---\ntitle: Hello\ntags: [a, b]\n---\n# Content",
    );
    assert.equal(fm.title, "Hello");
    assert.deepEqual(fm.tags, ["a", "b"]);
  });

  it("parseFrontmatter returns empty for no frontmatter", () => {
    const fm = parseFrontmatter("# Just a heading\n\nNo frontmatter here.");
    assert.deepEqual(fm, {});
  });

  it("extractTags finds frontmatter and inline tags", () => {
    const tags = extractTags(
      "---\ntags: [foo, bar]\n---\n# Note\n\nSome #baz content with #qux tags.",
    );
    assert.ok(tags.includes("foo"));
    assert.ok(tags.includes("bar"));
    assert.ok(tags.includes("baz"));
    assert.ok(tags.includes("qux"));
  });

  it("findBacklinks finds wikilink references", () => {
    const backlinks = findBacklinks("test-note.md");
    assert.ok(backlinks.length > 0);
    assert.ok(backlinks.some((b) => b.title === "related-note"));
  });
});
