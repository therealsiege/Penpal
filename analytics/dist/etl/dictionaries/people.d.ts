export interface PersonEntry {
    name: string;
    company?: string;
    role?: string;
    title?: string;
    aliases?: string[];
}
export declare const people: PersonEntry[];
