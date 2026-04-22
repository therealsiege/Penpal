export declare const findSimilarSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            text: {
                type: string;
                description: string;
            };
            documentPath: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            searchType: {
                type: string;
                enum: string[];
                description: string;
            };
            venture: {
                type: string;
                description: string;
            };
        };
        required: never[];
    };
};
export declare function findSimilar(args: {
    text?: string;
    documentPath?: string;
    limit?: number;
    searchType?: string;
    venture?: string;
}): Promise<string>;
