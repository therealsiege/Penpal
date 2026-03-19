export interface PersonEntry {
  name: string;
  company?: string;
  role?: string;
  title?: string;
  aliases?: string[];
}

export const people: PersonEntry[] = [
  { name: "Patrick Carter", company: "Agilon Health", role: "advisor", aliases: ["Patrick", "J. Patrick Carter"] },
  { name: "Maurice Hill", company: "Optum", role: "advisor", aliases: ["Maurice"] },
  { name: "Rob Trachtman", role: "advisor" },
  { name: "Shiv Rao", company: "Abridge", role: "competitor_exec", title: "CEO" },
  { name: "Clint Johnson", company: "MedScrub", role: "founder", aliases: ["Clint"] },
  { name: "Matt Wimberly", role: "collaborator", aliases: ["Matt"] },
  { name: "Maria", company: "Vim", role: "contact" },
  { name: "Marcus", company: "Agilon Health", role: "contact" },
  { name: "Brandon", role: "contact", title: "Grant Writer" },
  { name: "Fred Sharpe", company: "Oral Health CDS Venture", role: "lead" },
  { name: "Alex", company: "OpenLoop", role: "colleague" },
  { name: "Polus Mui", role: "contact", aliases: ["Polus"] },
  { name: "JP Polak", company: "Commons Project", role: "contact", aliases: ["JP"] },
  { name: "David LiCause", company: "HealthcarePriceTool", role: "customer", aliases: ["David"] },
  { name: "Josh Spencer", company: "BastionGPT", role: "competitor_exec", title: "CEO & Founder" },
];
