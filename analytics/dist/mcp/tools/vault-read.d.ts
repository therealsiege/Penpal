export declare const vaultReadSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            path: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function vaultRead(args: {
    path: string;
}): Promise<string>;
