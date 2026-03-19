import fs from "fs";
import { parse } from "csv-parse/sync";
import { stripEmoji } from "../../shared/utils/normalize.js";
import { parseDate } from "../../shared/utils/dates.js";

export interface CRMRecord {
  name: string;
  company: string | null;
  location: string | null;
  jobTitle: string | null;
  type: string | null;
  salesFunnel: string | null;
  priority: string | null;
  emr: string | null;
  leadSource: string | null;
  bio: string | null;
  notes: string | null;
  nextAction: string | null;
  businessArm: string | null;
  htnMember: boolean;
  dealSize: string | null;
  email: string | null;
  linkedIn: string | null;
  createdAt: string | null;
}

export function parseCRMCsv(filePath: string): CRMRecord[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  // Strip BOM
  const content = raw.replace(/^\uFEFF/, "");

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as Record<string, string>[];

  return records
    .filter((r) => r["Name"]?.trim())
    .map((r) => ({
      name: r["Name"].trim(),
      company: r["Company"]?.trim() || null,
      location: r["Location"]?.trim() || null,
      jobTitle: r["JobTitle"]?.trim() || null,
      type: r["Type"]?.trim() || null,
      salesFunnel: r["Sales Funnel"]?.trim() || null,
      priority: r["Priority"] ? stripEmoji(r["Priority"]) : null,
      emr: r["EMR"]?.trim() || null,
      leadSource: r["Lead Source"]?.trim() || null,
      bio: r["Bio"]?.trim() || null,
      notes: r["Notes"]?.trim() || null,
      nextAction: r["Next Action"]?.trim() || null,
      businessArm: r["Business Arm"] ? stripEmoji(r["Business Arm"]) : null,
      htnMember: r["HTN Member"]?.toLowerCase() === "yes",
      dealSize: r["Deal Size"]?.trim() || null,
      email: r["Email"]?.trim() || null,
      linkedIn: r["LinkedIn"]?.trim() || r["ProfileUrl"]?.trim() || null,
      createdAt: parseDate(r["CreatedTime"]) || null,
    }));
}

export interface ReferenceRecord {
  name: string;
  category: string | null;
  url: string | null;
  status: string | null;
  tags: string | null;
  notes: string | null;
  employment: boolean;
  createdAt: string | null;
}

export function parseReferencesCsv(filePath: string): ReferenceRecord[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const content = raw.replace(/^\uFEFF/, "");

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  return records
    .filter((r) => r["Name"]?.trim())
    .map((r) => ({
      name: r["Name"].trim(),
      category: r["Category"]?.trim() || null,
      url: r["URL"]?.trim() || null,
      status: r["Status"]?.trim() || null,
      tags: r["Tags"]?.trim() || null,
      notes: r["Notes"]?.trim() || null,
      employment: r["employment"]?.toLowerCase() === "yes",
      createdAt: parseDate(r["Created"]) || null,
    }));
}
