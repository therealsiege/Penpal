import { NodeRecord, RelRecord } from "../db/queries.js";
export declare class GraphImporter {
    private nodeBuffer;
    private relBuffer;
    private stats;
    addNode(node: NodeRecord): void;
    addNodes(nodes: NodeRecord[]): void;
    addRel(rel: RelRecord): void;
    addRels(rels: RelRecord[]): void;
    flushNodes(): Promise<void>;
    flushRels(): Promise<void>;
    flush(): Promise<void>;
    printStats(): void;
}
