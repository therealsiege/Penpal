export declare const askKnowledgeSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            question: {
                type: string;
                description: string;
            };
            documentType: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function askKnowledge(args: {
    question: string;
    documentType?: string;
}): Promise<string>;
