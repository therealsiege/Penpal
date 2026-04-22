export declare const discoverConnectionsSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            from: {
                type: string;
                description: string;
            };
            to: {
                type: string;
                description: string;
            };
            maxHops: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function discoverConnections(args: {
    from: string;
    to: string;
    maxHops?: number;
}): Promise<string>;
