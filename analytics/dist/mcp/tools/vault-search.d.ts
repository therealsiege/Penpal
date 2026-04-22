export declare const vaultSearchSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            query: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            venture: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function vaultSearch(args: {
    query: string;
    limit?: number;
    venture?: string;
}): Promise<string>;
