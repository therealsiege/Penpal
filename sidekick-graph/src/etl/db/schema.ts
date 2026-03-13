import { getSession } from "../../shared/connections.js";

const CONSTRAINTS = [
  "CREATE CONSTRAINT ON (n:Document) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Folder) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Tag) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Person) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Company) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Technology) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:EHRSystem) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Skill) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Regulation) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Lead) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Market) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Event) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:SalesStage) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Territory) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Practice) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:BillingCode) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Program) ASSERT n.id IS UNIQUE",
  "CREATE CONSTRAINT ON (n:Specialty) ASSERT n.id IS UNIQUE",
];

const INDEXES = [
  "CREATE INDEX ON :Document(title)",
  "CREATE INDEX ON :Document(documentType)",
  "CREATE INDEX ON :Person(name)",
  "CREATE INDEX ON :Company(name)",
  "CREATE INDEX ON :Lead(salesFunnel)",
  "CREATE INDEX ON :Lead(priority)",
  "CREATE INDEX ON :Lead(name)",
  "CREATE INDEX ON :Lead(leadScore)",
  "CREATE INDEX ON :Technology(name)",
  "CREATE INDEX ON :EHRSystem(name)",
  "CREATE INDEX ON :Folder(path)",
  "CREATE INDEX ON :Market(name)",
  "CREATE INDEX ON :Event(type)",
  "CREATE INDEX ON :Event(date)",
  "CREATE INDEX ON :SalesStage(name)",
  "CREATE INDEX ON :SalesStage(order)",
  "CREATE INDEX ON :Territory(name)",
  "CREATE INDEX ON :Territory(type)",
  "CREATE INDEX ON :Practice(name)",
  "CREATE INDEX ON :Practice(npi)",
  "CREATE INDEX ON :BillingCode(code)",
  "CREATE INDEX ON :BillingCode(program)",
  "CREATE INDEX ON :Program(name)",
  "CREATE INDEX ON :Specialty(name)",
];

export async function createSchema(): Promise<void> {
  const session = getSession();
  try {
    for (const stmt of [...CONSTRAINTS, ...INDEXES]) {
      try {
        await session.run(stmt);
      } catch {
        // Constraint/index may already exist — Memgraph throws on duplicate
      }
    }
    console.log("Schema constraints and indexes created");
  } finally {
    await session.close();
  }
}

export async function dropAll(): Promise<void> {
  const session = getSession();
  try {
    await session.run("MATCH (n) DETACH DELETE n");
    console.log("All data dropped");
  } finally {
    await session.close();
  }
}
