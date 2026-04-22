export declare const leadDetailSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            leadId: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function leadDetail(args: {
    leadId: string;
}): Promise<string>;
