/**
 * office_leaderboard MCP tool — Returns ranked agent list by XP with season info.
 */
export declare const officeLeaderboardSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            period: {
                type: string;
                enum: string[];
                description: string;
            };
        };
        required: never[];
    };
};
export declare function officeLeaderboard(args: {
    period?: string;
}): Promise<string>;
