import { getSession } from "../../shared/connections.js";
import { config } from "../../shared/config.js";

export interface NodeRecord {
  label: string;
  properties: Record<string, unknown>;
}

export interface RelRecord {
  fromLabel: string;
  fromId: string;
  toLabel: string;
  toId: string;
  type: string;
  properties?: Record<string, unknown>;
}

export async function batchMergeNodes(nodes: NodeRecord[]): Promise<void> {
  if (nodes.length === 0) return;

  // Group by label for efficient UNWIND
  const byLabel = new Map<string, Record<string, unknown>[]>();
  for (const node of nodes) {
    const group = byLabel.get(node.label) || [];
    group.push(node.properties);
    byLabel.set(node.label, group);
  }

  const session = getSession();
  try {
    for (const [label, props] of byLabel) {
      for (let i = 0; i < props.length; i += config.batchSize) {
        const batch = props.slice(i, i + config.batchSize);
        await session.run(
          `UNWIND $batch AS props
           MERGE (n:${label} {id: props.id})
           SET n += props`,
          { batch }
        );
      }
    }
  } finally {
    await session.close();
  }
}

export async function batchMergeRels(rels: RelRecord[]): Promise<void> {
  if (rels.length === 0) return;

  // Group by (fromLabel, toLabel, type) for efficient batching
  const key = (r: RelRecord) => `${r.fromLabel}|${r.toLabel}|${r.type}`;
  const groups = new Map<string, RelRecord[]>();
  for (const rel of rels) {
    const k = key(rel);
    const group = groups.get(k) || [];
    group.push(rel);
    groups.set(k, group);
  }

  const session = getSession();
  try {
    for (const [k, group] of groups) {
      const [fromLabel, toLabel, type] = k.split("|");
      const batch = group.map((r) => ({
        fromId: r.fromId,
        toId: r.toId,
        props: r.properties || {},
      }));

      for (let i = 0; i < batch.length; i += config.batchSize) {
        const chunk = batch.slice(i, i + config.batchSize);
        await session.run(
          `UNWIND $batch AS rel
           MATCH (a:${fromLabel} {id: rel.fromId})
           MATCH (b:${toLabel} {id: rel.toId})
           MERGE (a)-[r:${type}]->(b)
           SET r += rel.props`,
          { batch: chunk }
        );
      }
    }
  } finally {
    await session.close();
  }
}
