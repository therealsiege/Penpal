export declare const findEntitySchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            name: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                description: string;
            };
            venture: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function findEntity(args: {
    name: string;
    type?: string;
    venture?: string;
}): Promise<string>;
