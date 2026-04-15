import fs from "fs";
import path from "path";
import { glob } from "glob";
import { config, resolveVaultPath, getActiveVentures, getActiveDirectories } from "../shared/config.js";
import { verifyConnection, closeConnections } from "../shared/connections.js";
import { createSchema, dropAll } from "./db/schema.js";
import { GraphImporter } from "./graph/importer.js";
import { parseMarkdownFile } from "./parsers/markdown-parser.js";
import { parseLeadFromDocument } from "./parsers/lead-parser.js";
import { parseCRMCsv } from "./parsers/csv-parser.js";
import { extractLinks, buildFilenameIndex } from "./parsers/link-extractor.js";
import { extractEntities } from "./parsers/entity-extractor.js";
import { chunkDocument, freeEncoder } from "./parsers/chunker.js";
import { generateEmbeddings } from "./embeddings/embedder.js";
import { EmbeddingCache } from "./embeddings/embedding-cache.js";
import {
  ensureCollections,
  upsertChunks,
  upsertSummaries,
  ChunkPoint,
  SummaryPoint,
} from "./db/qdrant-client.js";
import { extractWithLLM, saveExtractionCache } from "./extraction/llm-extractor.js";
import { reconcileEntities, writeNewEntitiesReport, NewEntitiesReport } from "./extraction/entity-reconciler.js";
import { seedSalesStages, trackLeadStage } from "./sales/pipeline-tracker.js";
import { mapLeadToTerritory } from "./sales/territory-mapper.js";
import { scoreLead } from "./sales/lead-scorer.js";
import { runAllAnalytics } from "./graph/analytics.js";
import {
  buildDocumentNode,
  buildFolderNode,
  buildTagNode,
  buildPersonNode,
  buildCompanyNode,
  buildTechnologyNode,
  buildEHRNode,
  buildSkillNode,
  buildRegulationNode,
  buildLeadNodeFromDoc,
  buildLeadNodeFromCRM,
  buildMarketNode,
  buildEventNode,
  buildBillingCodeNode,
  buildProgramNode,
  buildSpecialtyNode,
  buildPracticeNode,
  buildCompetitorProductNode,
} from "./graph/node-builder.js";
import {
  buildInFolderRel,
  buildParentFolderRel,
  buildTaggedWithRel,
  buildLinksToRel,
  buildMentionRels,
  buildAboutLeadRel,
  buildWorksAtRels,
  buildCompetesWithRels,
  buildLeadUsesEHRRel,
  buildOperatesInRel,
  buildHadEventRel,
  buildReportedInRel,
  resolveEHRName,
  buildEnablesBillingRel,
  buildPartOfProgramRel,
  buildEligibleForRel,
  buildPracticesAtRel,
  buildInSpecialtyRel,
  buildEligibleSpecialtyRel,
  buildHasProductRel,
} from "./graph/rel-builder.js";
import { stableId } from "../shared/utils/id.js";
import { normalizeName } from "../shared/utils/normalize.js";
import { companies } from "./dictionaries/companies.js";
import { people } from "./dictionaries/people.js";
import { technologies } from "./dictionaries/technologies.js";
import { ehrSystems } from "./dictionaries/ehr-systems.js";
import { regulations } from "./dictionaries/regulations.js";
import { skills } from "./dictionaries/skills.js";
import { billingCodes } from "./dictionaries/cms-codes.js";
import { programs, skillRevenueMap, specialties } from "./dictionaries/revenue-model.js";
import { streamNPIProspects, batchQueryNPIApi } from "./parsers/npi-parser.js";
import { parseWebIntel } from "./parsers/web-intel-parser.js";

const isClean = process.argv.includes("--clean");
const skipEmbeddings = process.argv.includes("--skip-embeddings");
const skipLLM = process.argv.includes("--skip-llm");
const skipAnalytics = process.argv.includes("--skip-analytics");
const skipNPI = process.argv.includes("--skip-npi");

// Parse --venture flags: e.g. --venture openloop --venture 1putt
const ventureFilter: string[] = [];
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === "--venture" && process.argv[i + 1]) {
    ventureFilter.push(process.argv[i + 1]);
    i++;
  }
}

async function main() {
  const activeVentures = getActiveVentures(ventureFilter.length > 0 ? ventureFilter : undefined);
  const activeDirs = getActiveDirectories(ventureFilter.length > 0 ? ventureFilter : undefined);
  console.log("Penny Knowledge Base → Memgraph + Qdrant Import");
  console.log(`Vault: ${config.vaultPath}`);
  console.log(`Mode: ${isClean ? "CLEAN (drop + reimport)" : "UPSERT (merge)"}`);
  console.log(`\nActive ventures (${activeVentures.length}):`);
  for (const v of activeVentures) {
    console.log(`  ${v.name}: ${v.directories.length} directories`);
    for (const d of v.directories) console.log(`    - ${d}`);
  }
  if (skipEmbeddings) console.log("  Skipping embeddings (--skip-embeddings)");
  if (skipLLM) console.log("  Skipping LLM extraction (--skip-llm)");
  if (skipAnalytics) console.log("  Skipping MAGE analytics (--skip-analytics)");
  if (skipNPI) console.log("  Skipping NPI enrichment (--skip-npi)");
  console.log();

  // 1. Connect
  await verifyConnection();

  // 2. Clean if requested
  if (isClean) {
    await dropAll();
  }

  // 3. Create schema
  await createSchema();

  const importer = new GraphImporter();

  // 4. Seed dictionary nodes (companies, people, technologies, etc.)
  console.log("\n--- Seeding dictionary nodes ---");
  for (const c of companies) importer.addNode(buildCompanyNode(c));
  for (const p of people) importer.addNode(buildPersonNode(p));
  for (const t of technologies) importer.addNode(buildTechnologyNode(t));
  for (const e of ehrSystems) importer.addNode(buildEHRNode(e));
  for (const r of regulations) importer.addNode(buildRegulationNode(r));
  for (const s of skills) importer.addNode(buildSkillNode(s));

  // Phase 4: Seed revenue intelligence nodes
  for (const bc of billingCodes) importer.addNode(buildBillingCodeNode(bc));
  for (const p of programs) importer.addNode(buildProgramNode(p));
  for (const sp of specialties) importer.addNode(buildSpecialtyNode(sp));

  // Phase 3: Seed sales stages
  seedSalesStages(importer);

  await importer.flushNodes();

  // 5. Build cross-entity relationships from dictionaries
  console.log("\n--- Building dictionary relationships ---");
  importer.addRels(buildWorksAtRels());
  importer.addRels(buildCompetesWithRels());

  // Phase 4: Revenue intelligence relationships
  console.log("\n--- Building revenue intelligence relationships ---");

  // BillingCode → Program
  for (const bc of billingCodes) {
    importer.addRel(buildPartOfProgramRel(bc.code, bc.program));
  }

  // Program → Specialty (eligible specialties)
  for (const prog of programs) {
    for (const spec of prog.eligibleSpecialties) {
      const matchedSpec = specialties.find(
        (s) => s.name.toLowerCase() === spec.toLowerCase()
      );
      if (matchedSpec) {
        importer.addRel(buildEligibleSpecialtyRel(prog.programId, matchedSpec.name));
      }
    }
  }

  // Skill → BillingCode (ENABLES_BILLING)
  for (const bridge of skillRevenueMap) {
    for (const code of bridge.billingCodes) {
      importer.addRel(buildEnablesBillingRel(bridge.skillId, code, bridge.revenueRole));
    }
  }

  // 6. Walk vault directory → Folder nodes + PARENT_FOLDER
  console.log("\n--- Walking vault directories ---");
  const allDirs = new Set<string>();

  // Glob per active venture directory for precise control
  let mdFiles: string[] = [];
  for (const dir of activeDirs) {
    const matches = await glob("**/*.md", {
      cwd: path.join(config.vaultPath, dir),
      ignore: config.skipDirs.map((d) => `${d}/**`),
    });
    mdFiles.push(...matches.map((f) => path.join(dir, f)));
  }
  // Deduplicate in case of overlapping directories
  mdFiles = [...new Set(mdFiles)];

  // Collect all directories
  for (const file of mdFiles) {
    let dir = path.dirname(file);
    while (dir && dir !== ".") {
      allDirs.add(dir);
      dir = path.dirname(dir);
    }
  }

  // Create folder nodes and parent relationships
  for (const dirPath of allDirs) {
    const name = path.basename(dirPath);
    const depth = dirPath.split(path.sep).length;
    importer.addNode(buildFolderNode(dirPath, name, depth));

    const parentPath = path.dirname(dirPath);
    if (parentPath !== "." && allDirs.has(parentPath)) {
      importer.addRel(buildParentFolderRel(dirPath, parentPath));
    }
  }
  await importer.flushNodes();

  // 7. Build filename index for Obsidian-style link resolution, then parse
  buildFilenameIndex(mdFiles);
  console.log(`\n--- Parsing ${mdFiles.length} markdown files ---`);
  const tagSet = new Set<string>();
  const docRelPaths = new Set<string>(); // for link resolution later
  const pendingInternalLinks: { source: string; target: string }[] = [];

  // Phase 1: Chunking + embedding data collection
  const allChunks: { doc: ReturnType<typeof parseMarkdownFile>; chunks: ReturnType<typeof chunkDocument> }[] = [];

  // Phase 2: Documents for LLM extraction
  const docsForLLM: { relPath: string; rawContent: string; documentType: string }[] = [];

  // Phase 3: Lead scoring data
  const leadScoreUpdates: { leadName: string; leadCompany: string; score: number }[] = [];

  // Phase 5: NPI enrichment data
  const leadsForNPI: Array<{ name: string; company: string; state: string }> = [];

  for (const relPath of mdFiles) {
    const absPath = path.join(config.vaultPath, relPath);
    const doc = parseMarkdownFile(absPath);
    docRelPaths.add(doc.relativePath);

    // Document node
    importer.addNode(buildDocumentNode(doc));

    // IN_FOLDER relationship
    const folderPath = path.dirname(doc.relativePath);
    if (folderPath !== "." && allDirs.has(folderPath)) {
      importer.addRel(buildInFolderRel(doc.relativePath, folderPath));
    }

    // Tags
    for (const tag of doc.tags) {
      tagSet.add(tag);
      importer.addRel(buildTaggedWithRel(doc.relativePath, tag));
    }

    // Lead parsing
    const lead = parseLeadFromDocument(doc);
    if (lead) {
      importer.addNode(buildLeadNodeFromDoc(lead, doc.relativePath));
      importer.addRel(buildAboutLeadRel(doc.relativePath, lead.name, lead.company || ""));

      // Lead → EHR
      if (lead.emr) {
        const ehrName = resolveEHRName(lead.emr);
        if (ehrName) {
          importer.addRel(buildLeadUsesEHRRel(lead.name, lead.company || "", ehrName));
        }
      }

      // Phase 3: Track sales stage
      if (lead.salesFunnel) {
        trackLeadStage(importer, lead.name, lead.company || "", lead.salesFunnel);
      }

      // Phase 3: Map territory
      if (lead.location) {
        mapLeadToTerritory(importer, lead.name, lead.company || "", lead.location);
      }

      // Phase 3: Score lead
      const score = scoreLead({
        createdAt: lead.createdAt || "",
        notes: lead.notes || "",
        bio: lead.bio || "",
        emr: lead.emr || "",
        htnMember: lead.htnMember,
        businessArm: lead.businessArm || "",
        salesFunnel: lead.salesFunnel || "",
        priority: lead.priority || "",
        jobTitle: lead.jobTitle || "",
        type: lead.type || "",
        location: lead.location || "",
      });
      leadScoreUpdates.push({ leadName: lead.name, leadCompany: lead.company || "", score });

      // Phase 5: Collect for NPI enrichment
      if (lead.company && lead.location) {
        const stateAbbr = extractStateAbbr(lead.location);
        if (stateAbbr) {
          leadsForNPI.push({ name: lead.name, company: lead.company, state: stateAbbr });
        }
      }

      // Phase 4: Practice node + Lead → Practice + eligibility
      if (lead.company) {
        importer.addNode(buildPracticeNode({
          name: lead.company,
          specialty: lead.type || "",
        }));
        importer.addRel(buildPracticesAtRel(lead.name, lead.company, lead.company));

        // Link practice to specialty if type matches
        if (lead.type) {
          const matchedSpec = specialties.find(
            (s) => normalizeName(s.name) === normalizeName(lead.type!)
              || normalizeName(lead.type!).includes(normalizeName(s.name))
          );
          if (matchedSpec) {
            importer.addRel(buildInSpecialtyRel(lead.company, matchedSpec.name));
          }
        }
      }

      // Phase 4: Lead → Program eligibility based on specialty
      const leadSpecialty = (lead.type || lead.jobTitle || "").toLowerCase();
      for (const prog of programs) {
        if (prog.eligibleSpecialties.some((s) => leadSpecialty.includes(s))) {
          importer.addRel(buildEligibleForRel(lead.name, lead.company || "", prog.programId));
        }
      }
    }

    // Entity extraction (skip leads to avoid noise from template fields)
    if (doc.documentType !== "lead") {
      const entities = extractEntities(doc.rawContent);
      importer.addRels(buildMentionRels(doc.relativePath, entities));
    }

    // Link extraction
    const links = extractLinks(doc.rawContent, doc.relativePath);
    for (const link of links.internal) {
      pendingInternalLinks.push({
        source: doc.relativePath,
        target: link.target,
      });
    }

    // Phase 1: Chunk document (for Qdrant embeddings only)
    const chunks = chunkDocument(doc.relativePath, doc.rawContent);
    if (chunks.length > 0) {
      allChunks.push({ doc, chunks });
    }

    // Phase 2: Collect for LLM extraction
    if ((config.llmExtractionDocTypes as readonly string[]).includes(doc.documentType)) {
      docsForLLM.push({
        relPath: doc.relativePath,
        rawContent: doc.rawContent,
        documentType: doc.documentType,
      });
    }
  }

  // Free tiktoken encoder memory
  freeEncoder();

  // Create tag nodes
  for (const tag of tagSet) {
    importer.addNode(buildTagNode(tag));
  }
  await importer.flush();

  // 8. Resolve internal links → LINKS_TO
  console.log("\n--- Resolving internal links ---");
  for (const { source, target } of pendingInternalLinks) {
    if (docRelPaths.has(target)) {
      importer.addRel(buildLinksToRel(source, target));
    }
  }

  // 9. Parse CRM CSVs per venture
  console.log("\n--- Parsing CRM CSVs ---");
  const allCrmPaths = activeVentures.filter((v) => v.crmCsvPath).map((v) => v.crmCsvPath!);
  for (const csvRelPath of allCrmPaths) {
  const crmPath = resolveVaultPath(csvRelPath);
  if (fs.existsSync(crmPath)) {
    const crmRecords = parseCRMCsv(crmPath);
    console.log(`  [${csvRelPath}] Found ${crmRecords.length} CRM records`);

    for (const crm of crmRecords) {
      importer.addNode(buildLeadNodeFromCRM(crm));

      // Lead → EHR
      if (crm.emr) {
        const ehrName = resolveEHRName(crm.emr);
        if (ehrName) {
          importer.addRel(buildLeadUsesEHRRel(crm.name, crm.company || "", ehrName));
        }
      }

      // Phase 3: Track sales stage from CRM
      if (crm.salesFunnel) {
        trackLeadStage(importer, crm.name, crm.company || "", crm.salesFunnel);
      }

      // Phase 3: Map territory from CRM
      if (crm.location) {
        mapLeadToTerritory(importer, crm.name, crm.company || "", crm.location);
      }

      // Phase 3: Score CRM leads
      const score = scoreLead({
        createdAt: crm.createdAt || "",
        notes: crm.notes || "",
        bio: crm.bio || "",
        emr: crm.emr || "",
        htnMember: crm.htnMember,
        businessArm: crm.businessArm || "",
        salesFunnel: crm.salesFunnel || "",
        priority: crm.priority || "",
        jobTitle: crm.jobTitle || "",
        type: crm.type || "",
        location: crm.location || "",
      });
      leadScoreUpdates.push({ leadName: crm.name, leadCompany: crm.company || "", score });

      // Phase 5: Collect CRM leads for NPI enrichment
      if (crm.company && crm.location) {
        const stateAbbr = extractStateAbbr(crm.location);
        if (stateAbbr) {
          leadsForNPI.push({ name: crm.name, company: crm.company, state: stateAbbr });
        }
      }

      // Phase 4: Practice + eligibility for CRM leads
      if (crm.company) {
        importer.addNode(buildPracticeNode({
          name: crm.company,
          specialty: crm.type || "",
        }));
        importer.addRel(buildPracticesAtRel(crm.name, crm.company, crm.company));

        if (crm.type) {
          const matchedSpec = specialties.find(
            (s) => normalizeName(s.name) === normalizeName(crm.type!)
              || normalizeName(crm.type!).includes(normalizeName(s.name))
          );
          if (matchedSpec) {
            importer.addRel(buildInSpecialtyRel(crm.company, matchedSpec.name));
          }
        }
      }

      const crmSpecialty = (crm.type || crm.jobTitle || "").toLowerCase();
      for (const prog of programs) {
        if (prog.eligibleSpecialties.some((s) => crmSpecialty.includes(s))) {
          importer.addRel(buildEligibleForRel(crm.name, crm.company || "", prog.programId));
        }
      }
    }
  } else {
    console.log(`  [${csvRelPath}] CRM CSV not found, skipping`);
  }
  } // end CRM per-venture loop

  // 10. Update lead scores as node properties
  console.log("\n--- Updating lead scores ---");
  for (const { leadName, leadCompany, score } of leadScoreUpdates) {
    // Add score to existing Lead node via a property update node
    importer.addNode({
      label: "Lead",
      properties: {
        id: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
        leadScore: score,
      },
    });
  }
  console.log(`  Scored ${leadScoreUpdates.length} leads`);

  // 11. Phase 5: NPI Enrichment
  if (!skipNPI) {
    console.log("\n--- Phase 5: NPI Enrichment ---");

    // 11a. Enrich existing leads via NPI API
    if (leadsForNPI.length > 0) {
      console.log(`  Enriching ${leadsForNPI.length} leads via NPI API...`);
      const npiMatches = await batchQueryNPIApi(leadsForNPI);

      for (const [key, npiRecord] of npiMatches) {
        // Update existing Practice node with NPI data
        const orgName = npiRecord.organizationName || key.split("|")[0];
        importer.addNode(buildPracticeNode({
          name: orgName,
          npi: npiRecord.npi,
          address: npiRecord.practiceAddress,
          taxonomyCode: npiRecord.taxonomyCode,
          practiceCity: npiRecord.practiceCity,
          practiceState: npiRecord.practiceState,
          practiceZip: npiRecord.practiceZip,
          isSoleProprietor: npiRecord.isSoleProprietor,
          enumerationDate: npiRecord.enumerationDate,
          specialty: npiRecord.taxonomyDescription,
        }));
      }
      console.log(`  Enriched ${npiMatches.size} practices with NPI data`);
    }

    // 11b. Source new prospects from NPPES CSV (if file exists)
    if (config.npiFilePath) {
      try {
        const prospects = await streamNPIProspects();
        let newProspects = 0;

        for (const prospect of prospects) {
          const name = prospect.organizationName || `${prospect.providerLastName}, ${prospect.providerFirstName}`;
          if (!name || name === ", ") continue;

          importer.addNode(buildPracticeNode({
            name,
            npi: prospect.npi,
            address: prospect.practiceAddress,
            taxonomyCode: prospect.taxonomyCode,
            practiceCity: prospect.practiceCity,
            practiceState: prospect.practiceState,
            practiceZip: prospect.practiceZip,
            isSoleProprietor: prospect.isSoleProprietor,
            enumerationDate: prospect.enumerationDate,
            specialty: prospect.taxonomyDescription,
            source: "npi-registry",
          }));
          newProspects++;
        }
        console.log(`  Added ${newProspects} NPI-sourced prospect Practice nodes`);
      } catch (err) {
        console.warn(`  Warning: NPI CSV streaming failed:`, (err as Error).message);
      }
    }
  } else {
    console.log("\n--- Skipping NPI enrichment (--skip-npi) ---");
  }

  // 12. Phase 5: Web Intel Ingestion
  console.log("\n--- Phase 5: Web Intelligence Ingestion ---");
  const webIntelRecords = parseWebIntel();
  if (webIntelRecords.length > 0) {
    for (const record of webIntelRecords) {
      importer.addNode(buildCompetitorProductNode(record));

      // Link to existing Company node if it exists in our dictionaries
      const companyMatch = companies.find(
        (c) => normalizeName(c.name) === normalizeName(record.company)
          || c.aliases?.some((a) => normalizeName(a) === normalizeName(record.company))
      );
      if (companyMatch) {
        importer.addRel(buildHasProductRel(
          companyMatch.name,
          record.product || record.company,
          record.company,
        ));
      }
    }
    console.log(`  Ingested ${webIntelRecords.length} competitor product records`);
  }

  // 13. Final graph flush
  console.log("\n--- Final graph flush ---");
  await importer.flush();

  // 14. Phase 1: Embeddings + Qdrant
  if (!skipEmbeddings && config.openaiApiKey) {
    console.log("\n--- Phase 1: Generating embeddings + Qdrant upsert ---");
    await ensureCollections();

    const embeddingCache = new EmbeddingCache(config.embeddingCachePath);
    let totalChunks = 0;
    let cachedChunks = 0;

    // Process chunks in batches by document
    const chunkPoints: ChunkPoint[] = [];
    const summaryPoints: SummaryPoint[] = [];

    for (const { doc, chunks } of allChunks) {
      const docId = stableId("Document", doc.relativePath);

      // Embed chunks
      const chunkItems = chunks.map((c) => ({
        key: `chunk:${c.documentPath}:${c.chunkIndex}`,
        text: `${c.headingPath}\n\n${c.content}`,
      }));

      const chunkResults = await generateEmbeddings(chunkItems, embeddingCache);
      for (let i = 0; i < chunkResults.length; i++) {
        const result = chunkResults[i];
        const chunk = chunks[i];
        if (result.cached) cachedChunks++;
        totalChunks++;

        chunkPoints.push({
          id: stableId("DocumentChunk", chunk.documentPath, String(chunk.chunkIndex)),
          vector: result.embedding,
          payload: {
            documentId: docId,
            documentPath: chunk.documentPath,
            documentType: doc.documentType,
            headingPath: chunk.headingPath,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
          },
        });
      }

      // Embed document summary (using content preview)
      const summaryItems = [{
        key: `summary:${doc.relativePath}`,
        text: `${doc.title}\n\n${doc.contentPreview}`,
      }];
      const summaryResults = await generateEmbeddings(summaryItems, embeddingCache);
      summaryPoints.push({
        id: docId,
        vector: summaryResults[0].embedding,
        payload: {
          documentId: docId,
          documentPath: doc.relativePath,
          documentType: doc.documentType,
          title: doc.title,
          contentPreview: doc.contentPreview,
        },
      });

      // Batch upsert to Qdrant every 50 documents
      if (chunkPoints.length >= 500) {
        await upsertChunks(chunkPoints);
        chunkPoints.length = 0;
      }
      if (summaryPoints.length >= 50) {
        await upsertSummaries(summaryPoints);
        summaryPoints.length = 0;
      }
    }

    // Flush remaining
    await upsertChunks(chunkPoints);
    await upsertSummaries(summaryPoints);

    embeddingCache.save();
    console.log(`  Embedded ${totalChunks} chunks (${cachedChunks} from cache)`);
    console.log(`  Embedded ${allChunks.length} document summaries`);
  } else if (!config.openaiApiKey) {
    console.log("\n--- Skipping embeddings (OPENAI_API_KEY not set) ---");
  }

  // 15. Phase 2: LLM Entity Extraction
  if (!skipLLM && config.anthropicApiKey && docsForLLM.length > 0) {
    console.log(`\n--- Phase 2: LLM entity extraction (${docsForLLM.length} documents) ---`);

    const newEntitiesReport: NewEntitiesReport = {
      companies: [],
      people: [],
      technologies: [],
      markets: [],
      events: [],
    };

    const seenMarkets = new Set<string>();
    let extractedCount = 0;

    const CONCURRENCY = 10;

    function processExtractionResult(
      doc: { relPath: string },
      result: Awaited<ReturnType<typeof extractWithLLM>>,
    ) {
      // Reconcile entities
      const reconciled = reconcileEntities(result.entities);
      for (const entity of reconciled) {
        if (entity.isNew) {
          const report = { name: entity.name, context: entity.context, confidence: entity.confidence };
          if (entity.type === "company") newEntitiesReport.companies.push(report);
          else if (entity.type === "person") newEntitiesReport.people.push(report);
          else if (entity.type === "technology") newEntitiesReport.technologies.push(report);
        }
      }

      // Process markets
      for (const market of result.markets) {
        if (!seenMarkets.has(normalizeName(market))) {
          seenMarkets.add(normalizeName(market));
          importer.addNode(buildMarketNode({ name: market }));
          newEntitiesReport.markets.push({ name: market, sources: [doc.relPath] });
        }

        for (const entity of result.entities) {
          if (entity.type === "company") {
            importer.addRel(buildOperatesInRel(entity.name, market));
          }
        }
      }

      // Process events
      for (const event of result.events) {
        importer.addNode(buildEventNode({
          type: event.type,
          description: event.description,
          date: event.date,
          sourceDocumentId: stableId("Document", doc.relPath),
        }));

        importer.addRel(buildReportedInRel(event.description, event.date || "", doc.relPath));

        for (const company of event.companies) {
          importer.addRel(buildHadEventRel(company, event.description, event.date || ""));
        }

        newEntitiesReport.events.push({
          description: event.description,
          type: event.type,
          date: event.date,
        });
      }
    }

    // Process in concurrent batches
    for (let i = 0; i < docsForLLM.length; i += CONCURRENCY) {
      const batch = docsForLLM.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (doc) => {
          const result = await extractWithLLM(doc.relPath, doc.rawContent);
          return { doc, result };
        }),
      );

      for (const settled of results) {
        if (settled.status === "fulfilled") {
          processExtractionResult(settled.value.doc, settled.value.result);
          extractedCount++;
        } else {
          console.warn(`  Warning: LLM extraction failed:`, settled.reason?.message || settled.reason);
        }
      }

      if (extractedCount % 50 < CONCURRENCY) {
        console.log(`  Processed ${extractedCount}/${docsForLLM.length} documents`);
      }

      // Save cache periodically
      if (i % 200 === 0 && i > 0) {
        saveExtractionCache();
      }
    }

    saveExtractionCache();
    await importer.flush();

    // Write new entities report
    const reportPath = resolveVaultPath("analytics/new_entities.json");
    writeNewEntitiesReport(newEntitiesReport, reportPath);
    console.log(`  Extracted from ${extractedCount} documents`);
  } else if (!config.anthropicApiKey) {
    console.log("\n--- Skipping LLM extraction (ANTHROPIC_API_KEY not set) ---");
  }

  // 16. Phase 3: MAGE Analytics
  if (!skipAnalytics) {
    await runAllAnalytics();
  }

  // 17. Print stats
  importer.printStats();

  // 18. Optional: sync to Graphite Atlas
  if (process.argv.includes("--sync-atlas") && process.env.GRAPHITE_ACCESS_TOKEN) {
    console.log("\n--- Syncing to Graphite Atlas ---");
    const { syncToAtlas } = await import("./atlas-sync.js");
    await syncToAtlas();
  }

  // Cleanup
  await closeConnections();
  console.log("\nImport complete.");
}

// US state name → abbreviation mapping for NPI enrichment
const STATE_ABBRS: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
};

function extractStateAbbr(location: string): string | null {
  const lower = location.toLowerCase().trim();

  // Check for full state name
  for (const [name, abbr] of Object.entries(STATE_ABBRS)) {
    if (lower.includes(name)) return abbr;
  }

  // Check for 2-letter abbreviation at end (e.g., "Dallas, TX")
  const match = location.match(/\b([A-Z]{2})\b/);
  if (match) {
    const abbr = match[1];
    if (Object.values(STATE_ABBRS).includes(abbr)) return abbr;
  }

  return null;
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
