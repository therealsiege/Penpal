export declare const queryGraphSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            cypher: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function queryGraph(args: {
    cypher: string;
}): Promise<string>;
