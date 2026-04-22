export declare const pipelineStatusSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            groupBy: {
                type: string;
                enum: string[];
                description: string;
            };
            territory: {
                type: string;
                description: string;
            };
            minScore: {
                type: string;
                description: string;
            };
        };
        required: never[];
    };
};
export declare function pipelineStatus(args: {
    groupBy?: string;
    territory?: string;
    minScore?: number;
}): Promise<string>;
