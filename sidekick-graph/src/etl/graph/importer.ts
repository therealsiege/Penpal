import { NodeRecord, RelRecord, batchMergeNodes, batchMergeRels } from "../db/queries.js";

export class GraphImporter {
  private nodeBuffer: NodeRecord[] = [];
  private relBuffer: RelRecord[] = [];
  private stats = {
    nodes: new Map<string, number>(),
    rels: new Map<string, number>(),
  };

  addNode(node: NodeRecord): void {
    this.nodeBuffer.push(node);
    this.stats.nodes.set(
      node.label,
      (this.stats.nodes.get(node.label) || 0) + 1
    );
  }

  addNodes(nodes: NodeRecord[]): void {
    for (const n of nodes) this.addNode(n);
  }

  addRel(rel: RelRecord): void {
    this.relBuffer.push(rel);
    this.stats.rels.set(
      rel.type,
      (this.stats.rels.get(rel.type) || 0) + 1
    );
  }

  addRels(rels: RelRecord[]): void {
    for (const r of rels) this.addRel(r);
  }

  async flushNodes(): Promise<void> {
    if (this.nodeBuffer.length === 0) return;
    // Deduplicate by id
    const seen = new Set<string>();
    const deduped: NodeRecord[] = [];
    for (const n of this.nodeBuffer) {
      const key = `${n.label}:${n.properties.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(n);
      }
    }
    await batchMergeNodes(deduped);
    console.log(`  Flushed ${deduped.length} nodes`);
    this.nodeBuffer = [];
  }

  async flushRels(): Promise<void> {
    if (this.relBuffer.length === 0) return;
    // Deduplicate by fromId + toId + type
    const seen = new Set<string>();
    const deduped: RelRecord[] = [];
    for (const r of this.relBuffer) {
      const key = `${r.fromId}:${r.toId}:${r.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(r);
      }
    }
    await batchMergeRels(deduped);
    console.log(`  Flushed ${deduped.length} relationships`);
    this.relBuffer = [];
  }

  async flush(): Promise<void> {
    await this.flushNodes();
    await this.flushRels();
  }

  printStats(): void {
    console.log("\n=== Import Statistics ===");
    console.log("\nNodes:");
    let totalNodes = 0;
    for (const [label, count] of [...this.stats.nodes.entries()].sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`  ${label}: ${count}`);
      totalNodes += count;
    }
    console.log(`  TOTAL: ${totalNodes}`);

    console.log("\nRelationships:");
    let totalRels = 0;
    for (const [type, count] of [...this.stats.rels.entries()].sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`  ${type}: ${count}`);
      totalRels += count;
    }
    console.log(`  TOTAL: ${totalRels}`);
  }
}
