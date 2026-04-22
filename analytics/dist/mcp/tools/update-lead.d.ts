export declare const updateLeadSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            name: {
                type: string;
                description: string;
            };
            company: {
                type: string;
                description: string;
            };
            stage: {
                type: string;
                enum: string[];
                description: string;
            };
            notes: {
                type: string;
                description: string;
            };
            priority: {
                type: string;
                enum: string[];
                description: string;
            };
            nextAction: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function updateLead(args: {
    name: string;
    company?: string;
    stage?: string;
    notes?: string;
    priority?: string;
    nextAction?: string;
}): Promise<string>;
