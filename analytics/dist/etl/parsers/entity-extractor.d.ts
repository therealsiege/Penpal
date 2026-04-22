import { CompanyEntry } from "../dictionaries/companies.js";
import { PersonEntry } from "../dictionaries/people.js";
import { TechnologyEntry } from "../dictionaries/technologies.js";
import { EHREntry } from "../dictionaries/ehr-systems.js";
import { RegulationEntry } from "../dictionaries/regulations.js";
import { SkillEntry } from "../dictionaries/skills.js";
export interface ExtractedEntities {
    companies: CompanyEntry[];
    people: PersonEntry[];
    technologies: TechnologyEntry[];
    ehrSystems: EHREntry[];
    regulations: RegulationEntry[];
    skills: SkillEntry[];
}
export declare function extractEntities(content: string): ExtractedEntities;
