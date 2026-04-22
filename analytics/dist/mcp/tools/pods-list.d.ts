export declare const podsListSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            status: {
                type: string;
                description: string;
                enum: string[];
            };
        };
        required: never[];
    };
};
export declare function podsList(args: {
    status?: string;
}): Promise<string>;
