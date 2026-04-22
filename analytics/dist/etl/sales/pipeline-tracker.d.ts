import { GraphImporter } from "../graph/importer.js";
import { SalesStageData } from "../graph/node-builder.js";
/** Canonical sales stages in order */
export declare const SALES_STAGES: SalesStageData[];
/** Resolve a funnel string to a canonical stage name */
export declare function resolveStage(funnelValue: string): string | null;
/** Seed SalesStage nodes into the graph */
export declare function seedSalesStages(importer: GraphImporter): void;
/** Create CURRENT_STAGE relationship for a lead based on its salesFunnel value */
export declare function trackLeadStage(importer: GraphImporter, leadName: string, leadCompany: string, salesFunnel: string): void;
