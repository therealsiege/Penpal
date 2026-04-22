import { GraphImporter } from "../graph/importer.js";
/** Parse a location string to extract a US state */
export declare function parseState(location: string): string | null;
/** Get region for a state abbreviation */
export declare function getRegion(stateAbbrev: string): string | null;
/** Seed territory nodes and hierarchy, then link a lead to its territory */
export declare function mapLeadToTerritory(importer: GraphImporter, leadName: string, leadCompany: string, location: string): void;
