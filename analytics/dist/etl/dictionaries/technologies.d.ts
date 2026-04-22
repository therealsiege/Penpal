export interface TechnologyEntry {
    name: string;
    category: "protocol" | "platform" | "framework" | "infrastructure" | "ai" | "language" | "database" | "tool";
    aliases?: string[];
}
export declare const technologies: TechnologyEntry[];
