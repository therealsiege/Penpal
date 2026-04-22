export interface SkillEntry {
    skillId: string;
    name: string;
    category: string;
    status: "shipped" | "active_dev" | "backlog";
}
export declare const skills: SkillEntry[];
