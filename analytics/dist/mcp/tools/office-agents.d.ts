/**
 * office_agents MCP tool — Returns all agent states from the game.
 */
export declare const officeAgentsSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {};
        required: never[];
    };
};
export declare function officeAgents(): Promise<string>;
