/**
 * office_rooms MCP tool — Returns room layout with agent assignments and occupancy.
 */
export declare const officeRoomsSchema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {};
        required: never[];
    };
};
export declare function officeRooms(): Promise<string>;
