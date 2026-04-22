export declare const podsStatusSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            workflowId: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function podsStatus(args: {
    workflowId: string;
}): Promise<string>;
