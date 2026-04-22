/**
 * wiki-synthesizer.ts
 *
 * Uses Claude to synthesize actual intelligence pages from graph data
 * and source document chunks — not just formatted property dumps.
 * Each entity type gets opinionated sections that answer "so what?"
 */
import type { WikiCompany, WikiPerson, WikiTechnology, WikiLead, WikiProduct } from "./wiki-queries.js";
export declare function synthesizeCompany(c: WikiCompany): Promise<string>;
export declare function synthesizePerson(p: WikiPerson): Promise<string>;
export declare function synthesizeTechnology(t: WikiTechnology): Promise<string>;
export declare function synthesizeLead(l: WikiLead): Promise<string>;
export declare function synthesizeProduct(p: WikiProduct): Promise<string>;
