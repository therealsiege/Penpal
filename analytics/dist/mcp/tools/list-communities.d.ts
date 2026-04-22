export declare const listCommunitiesSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            limit: {
                type: string;
                description: string;
            };
            entityType: {
                type: string;
                description: string;
            };
        };
        required: never[];
    };
};
export declare function listCommunities(args: {
    limit?: number;
    entityType?: string;
}): Promise<string>;
