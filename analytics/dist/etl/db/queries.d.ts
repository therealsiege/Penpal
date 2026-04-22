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
export declare function batchMergeNodes(nodes: NodeRecord[]): Promise<void>;
export declare function batchMergeRels(rels: RelRecord[]): Promise<void>;
