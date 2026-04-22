export declare const vaultWriteSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            path: {
                type: string;
                description: string;
            };
            content: {
                type: string;
                description: string;
            };
            createIfMissing: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function vaultWrite(args: {
    path: string;
    content: string;
    createIfMissing?: boolean;
}): Promise<string>;
