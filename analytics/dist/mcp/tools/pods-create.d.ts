export declare const podsCreateSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            task: {
                type: string;
                description: string;
            };
            preset: {
                type: string;
                description: string;
            };
            cwd: {
                type: string;
                description: string;
            };
            priority: {
                type: string;
                enum: string[];
                description: string;
            };
            candidates: {
                type: string;
                description: string;
            };
            maxSelfFixes: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function podsCreate(args: {
    task: string;
    preset?: string;
    cwd?: string;
    priority?: string;
    candidates?: number;
    maxSelfFixes?: number;
}): Promise<string>;
