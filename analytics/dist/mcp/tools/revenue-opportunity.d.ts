export declare const revenueOpportunitySchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            leadName: {
                type: string;
                description: string;
            };
            specialty: {
                type: string;
                description: string;
            };
        };
    };
};
export declare function revenueOpportunity(args: {
    leadName?: string;
    specialty?: string;
}): Promise<string>;
