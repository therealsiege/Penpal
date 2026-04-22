export declare const searchKnowledgeSchema: {
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
            documentType: {
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
export declare function searchKnowledge(args: {
    query: string;
    limit?: number;
    documentType?: string;
    venture?: string;
}): Promise<string>;
