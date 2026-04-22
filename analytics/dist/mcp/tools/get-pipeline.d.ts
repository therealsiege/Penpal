export declare const getPipelineSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            stage: {
                type: string;
                description: string;
            };
            businessArm: {
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
export declare function getPipeline(args: {
    stage?: string;
    businessArm?: string;
    minScore?: number;
}): Promise<string>;
