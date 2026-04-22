export declare const searchLeadsSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            query: {
                type: string;
                description: string;
            };
            filters: {
                type: string;
                description: string;
                properties: {
                    state: {
                        type: string;
                        description: string;
                    };
                    ehr: {
                        type: string;
                        description: string;
                    };
                    stage: {
                        type: string;
                        description: string;
                    };
                };
            };
        };
        required: string[];
    };
};
export declare function searchLeads(args: {
    query: string;
    filters?: {
        state?: string;
        ehr?: string;
        stage?: string;
    };
}): Promise<string>;
