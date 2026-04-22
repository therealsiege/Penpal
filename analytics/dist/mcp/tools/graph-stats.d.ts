export declare const graphStatsSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {};
        required: never[];
    };
};
export declare function graphStats(): Promise<string>;
