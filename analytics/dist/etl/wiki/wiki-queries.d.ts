/**
 * wiki-queries.ts
 *
 * Cypher queries that fetch high-value entities and their relationships
 * from Memgraph. Uses WITH clauses between OPTIONAL MATCHes as required
 * by Memgraph's Cypher implementation.
 */
import type { Session } from "neo4j-driver";
export interface WikiCompany {
    name: string;
    type: string;
    funding: string;
    hq: string;
    people: Array<{
        name: string;
        role: string;
    }>;
    products: Array<{
        name: string;
        category: string;
        pricing: string;
    }>;
    competitors: string[];
    technologies: string[];
    documents: Array<{
        title: string;
        relativePath: string;
    }>;
}
export interface WikiPerson {
    name: string;
    company: string;
    role: string;
    title: string;
    documents: Array<{
        title: string;
        relativePath: string;
    }>;
    companies: string[];
}
export interface WikiTechnology {
    name: string;
    category: string;
    companies: string[];
    documents: Array<{
        title: string;
        relativePath: string;
    }>;
}
export interface WikiLead {
    name: string;
    company: string;
    location: string;
    jobTitle: string;
    type: string;
    emr: string;
    leadScore: number;
    businessArm: string;
    stage: string;
    nextAction: string;
    notes: string;
    createdAt: string;
    practices: Array<{
        name: string;
        npi: string;
        specialty: string;
    }>;
    events: Array<{
        type: string;
        description: string;
        date: string;
    }>;
}
export interface WikiProduct {
    name: string;
    company: string;
    category: string;
    pricing: string;
    features: string;
    customerCount: string;
    positioning: string;
    funding: string;
}
/** Companies with 3+ relationships (people, products, competitors, or document mentions) */
export declare function getCompanies(session: Session, minRels?: number): Promise<WikiCompany[]>;
/** All people in the graph (usually curated via dictionary seeding) */
export declare function getPeople(session: Session): Promise<WikiPerson[]>;
/** Technologies mentioned in 2+ documents */
export declare function getTechnologies(session: Session, minDocs?: number): Promise<WikiTechnology[]>;
/** Top leads by score (minimum 30) */
export declare function getLeads(session: Session, minScore?: number, limit?: number): Promise<WikiLead[]>;
/** All competitor products (always curated, small set) */
export declare function getCompetitorProducts(session: Session): Promise<WikiProduct[]>;
