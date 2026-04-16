/**
 * ACGME Residency Program Scraper
 *
 * Scrapes the ACGME Accreditation Data System (ADS) for residency programs
 * in target states and specialties. Each program yields:
 *   - Program name, org code, address, phone, email, website
 *   - Program Director name + appointment date
 *   - Coordinator name, phone, email
 *   - Accreditation status, approved/filled positions
 *   - Participating site names
 *
 * Data source: https://apps.acgme.org/ads/Public/Programs/Search
 *
 * Usage:
 *   npm run acgme:scrape
 *   npm run acgme:scrape -- --dry-run
 *   npm run acgme:scrape -- --state TX --specialty fm
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { chromium, type Browser, type Page } from "playwright";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ACGMEProgram {
  orgCode: string;
  programName: string;
  specialty: string;
  city: string;
  state: string;
  address: string;
  zip: string;
  website: string;
  phone: string;
  email: string;
  directorName: string;
  directorSince: string;
  coordinatorName: string;
  coordinatorPhone: string;
  coordinatorEmail: string;
  accreditationStatus: string;
  accreditationDate: string;
  approvedPositions: number;
  filledPositions: number;
  trainYears: number;
  participatingSites: string[];
  sponsoringInstitution: string;
  scrapedAt: string;
}

// ── ACGME ID Maps ────────────────────────────────────────────────────────────

const STATE_IDS: Record<string, string> = {
  AL: "1",
  CO: "6",
  NC: "34",
  TN: "44",
  TX: "45",
};

const SPECIALTY_IDS: Record<string, { id: string; label: string }> = {
  fm: { id: "14", label: "Family medicine" },
  im: { id: "18", label: "Internal medicine" },
};

const STATE_ABBRS: Record<string, string> = {
  "1": "AL",
  "6": "CO",
  "34": "NC",
  "44": "TN",
  "45": "TX",
};

// ── Scraping ─────────────────────────────────────────────────────────────────

const SEARCH_URL = "https://apps.acgme.org/ads/Public/Programs/Search";
const DELAY_BETWEEN_DETAIL = 1500; // polite crawl delay

async function searchPrograms(
  page: Page,
  stateId: string,
  specialtyId: string,
): Promise<{ orgCode: string; name: string; specialty: string; city: string; href: string }[]> {
  await page.goto(SEARCH_URL, { waitUntil: "networkidle" });
  await page.selectOption("#stateFilter", stateId);
  await page.waitForTimeout(1500);
  await page.selectOption("#specialtyFilter", specialtyId);
  await page.waitForTimeout(500);
  await page.click('button[type="submit"]:not(#searchByOrgBtn)');
  await page.waitForTimeout(5000);

  return page.$$eval("#programsListView-listview tbody tr", (trs) =>
    trs
      .map((tr) => {
        const cells = tr.querySelectorAll("td");
        const link = tr.querySelector('a[href*="Detail"]');
        return {
          orgCode: cells[0]?.textContent?.trim() || "",
          specialty: cells[1]?.textContent?.trim() || "",
          name: cells[2]?.textContent?.trim() || "",
          city: cells[3]?.textContent?.trim() || "",
          href: link?.getAttribute("href") || "",
        };
      })
      .filter((r) => r.orgCode && r.href),
  );
}

function parseDetailText(body: string, stateAbbr: string): ACGMEProgram {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

  const getField = (label: string): string => {
    const regex = new RegExp(label + "\\s*:?\\s*$", "im");
    const idx = lines.findIndex((l) => regex.test(l));
    return idx >= 0 && idx + 1 < lines.length ? lines[idx + 1].trim() : "";
  };

  // Parse header: "ORGCODE - PROGRAM NAME"
  const headerLine = lines.find((l) => /^\d{10}\s*-\s*/.test(l)) || "";
  const orgCode = headerLine.match(/^(\d{10})/)?.[1] || "";
  const programName = headerLine.replace(/^\d{10}\s*-\s*/, "").trim();

  // Second line: "Specialty - City, ST"
  const headerIdx = lines.indexOf(headerLine);
  const subLine = headerIdx >= 0 ? lines[headerIdx + 1] || "" : "";
  const specialty = subLine.split("-")[0]?.trim() || "";
  const cityState = subLine.split("-").slice(1).join("-").trim();
  const city = cityState.replace(/,\s*[A-Z]{2}\s*$/, "").trim();

  // Address
  const addressLine = lines.find((l) => /^\d+\s+\w/.test(l)) || "";
  const stateLine = lines.find((l) => /^[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/.test(l)) || "";
  const zip = stateLine.match(/(\d{5}(-\d{4})?)/)?.[1] || "";

  // Website
  const website = lines.find((l) => /^https?:\/\//.test(l)) || "";

  // Phone & email
  const phone = getField("Phone") || "";
  const emailLines = lines.filter((l) => /@/.test(l) && l.includes("."));
  const email = emailLines[0] || "";

  // Director
  const dirIdx = lines.findIndex((l) => l === "Director Information");
  const directorName = dirIdx >= 0 && dirIdx + 1 < lines.length ? lines[dirIdx + 1] : "";
  const directorSince = getField("Director First Appointed");

  // Coordinator
  const coordIdx = lines.findIndex((l) => l === "Coordinator Information");
  const coordinatorName = coordIdx >= 0 && coordIdx + 1 < lines.length ? lines[coordIdx + 1] : "";
  let coordPhone = "";
  let coordEmail = "";
  if (coordIdx >= 0) {
    const coordSection = lines.slice(coordIdx, coordIdx + 10);
    coordPhone = coordSection.find((l) => /^\(\d{3}\)/.test(l)) || "";
    coordEmail = coordSection.find((l) => /@/.test(l)) || "";
  }

  // Accreditation
  const accStatus = getField("Accreditation Status");
  const accDate = getField("Effective Date");

  // Positions
  const approvedStr = getField("Total Approved Resident Positions");
  const filledStr = getField("Total Filled Resident Positions");
  const yearsStr = getField("Accredited Length of Training");

  // Sponsoring institution
  const sponsoring = getField("Sponsoring Institution");

  // Participating sites
  const siteIdx = lines.findIndex((l) => l === "Participating Site Information");
  const sites: string[] = [];
  if (siteIdx >= 0) {
    for (let i = siteIdx + 1; i < lines.length && i < siteIdx + 60; i++) {
      const match = lines[i].match(/^\d+\s+\d{6}\s+(.+?)(?:\s+Yes|\s+No)/);
      if (match) sites.push(match[1].trim());
    }
  }

  return {
    orgCode,
    programName,
    specialty,
    city,
    state: stateAbbr,
    address: addressLine,
    zip,
    website,
    phone,
    email,
    directorName,
    directorSince,
    coordinatorName,
    coordinatorPhone: coordPhone,
    coordinatorEmail: coordEmail,
    accreditationStatus: accStatus,
    accreditationDate: accDate,
    approvedPositions: parseInt(approvedStr) || 0,
    filledPositions: parseInt(filledStr) || 0,
    trainYears: parseInt(yearsStr) || 0,
    participatingSites: sites,
    sponsoringInstitution: sponsoring,
    scrapedAt: new Date().toISOString(),
  };
}

async function scrapeDetail(page: Page, href: string, stateAbbr: string): Promise<ACGMEProgram | null> {
  // Navigate via JS click within session (direct URL navigation blocked by ACGME)
  await page.evaluate((h) => {
    const link = document.querySelector(`a[href="${h}"]`) as HTMLAnchorElement;
    if (link) link.click();
  }, href);
  await page.waitForTimeout(3000);

  // Check if we landed on the detail page
  if (!page.url().includes("Detail")) {
    // Try direct navigation as fallback
    const fullUrl = new URL(href, "https://apps.acgme.org").href;
    await page.goto(fullUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
  }

  const text = await page.evaluate(() => document.body.innerText);
  if (text.includes("Please return to the search page") || text.length < 200) {
    return null;
  }

  // Get raw text and parse outside browser context (avoids tsx/esbuild __name issue)
  const bodyText = await page.evaluate(() => document.body.innerText);
  return parseDetailText(bodyText, stateAbbr);
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function scrapeACGME(opts?: {
  states?: string[];
  specialties?: string[];
  dryRun?: boolean;
}): Promise<ACGMEProgram[]> {
  const targetStates = opts?.states || Object.keys(STATE_IDS);
  const targetSpecialties = opts?.specialties || Object.keys(SPECIALTY_IDS);
  const dryRun = opts?.dryRun ?? false;

  console.log("=== ACGME Residency Program Scraper ===");
  console.log(`States: ${targetStates.join(", ")}`);
  console.log(`Specialties: ${targetSpecialties.join(", ")}`);

  const browser = await chromium.launch({ headless: true });
  const allPrograms: ACGMEProgram[] = [];

  try {
    for (const stateKey of targetStates) {
      const stateId = STATE_IDS[stateKey];
      if (!stateId) {
        console.warn(`  Unknown state: ${stateKey}, skipping`);
        continue;
      }

      for (const specKey of targetSpecialties) {
        const spec = SPECIALTY_IDS[specKey];
        if (!spec) {
          console.warn(`  Unknown specialty: ${specKey}, skipping`);
          continue;
        }

        const page = await browser.newPage();
        console.log(`\n  Searching: ${stateKey} / ${spec.label}...`);

        const listings = await searchPrograms(page, stateId, spec.id);
        console.log(`  Found ${listings.length} programs`);

        if (dryRun) {
          listings.forEach((l) => console.log(`    ${l.orgCode} - ${l.name} (${l.city})`));
          await page.close();
          continue;
        }

        // Scrape each detail page by clicking within the search session
        for (let i = 0; i < listings.length; i++) {
          const listing = listings[i];
          console.log(`    [${i + 1}/${listings.length}] ${listing.orgCode} - ${listing.name}`);

          // Click the View Program link via JS (unhide disabled columns first)
          let detail: ACGMEProgram | null = null;
          try {
            await page.evaluate((h) => {
              // Unhide all hidden cells/links so we can click them
              document.querySelectorAll("td, a").forEach((el) => {
                (el as HTMLElement).style.display = "";
                (el as HTMLElement).style.visibility = "visible";
              });
              const a = document.querySelector(`a[href="${h}"]`) as HTMLAnchorElement;
              if (a) {
                a.style.display = "inline";
                a.click();
              }
            }, listing.href);
            await page.waitForURL("**/Detail**", { timeout: 10000 });
            await page.waitForTimeout(1500);

            const bodyText = await page.evaluate(() => document.body.innerText);
            if (!bodyText.includes("Please return to the search page") && bodyText.length > 200) {
              detail = parseDetailText(bodyText, STATE_ABBRS[stateId] || stateKey);
            }

            // Go back to search results
            await page.goBack({ waitUntil: "networkidle", timeout: 10000 });
            await page.waitForTimeout(1000);
          } catch {
            // Navigation failed — re-do the search to get back to results
            try {
              await searchPrograms(page, stateId, spec.id);
            } catch { /* give up on this one */ }
          }

          if (detail) {
            // Fill in from listing if detail parsing missed it
            if (!detail.orgCode) detail.orgCode = listing.orgCode;
            if (!detail.programName) detail.programName = listing.name;
            if (!detail.specialty) detail.specialty = listing.specialty;
            if (!detail.city) detail.city = listing.city;
            allPrograms.push(detail);
          } else {
            console.log(`      (detail page blocked, using listing data)`);
            allPrograms.push({
              orgCode: listing.orgCode,
              programName: listing.name,
              specialty: listing.specialty,
              city: listing.city,
              state: STATE_ABBRS[stateId] || stateKey,
              address: "",
              zip: "",
              website: "",
              phone: "",
              email: "",
              directorName: "",
              directorSince: "",
              coordinatorName: "",
              coordinatorPhone: "",
              coordinatorEmail: "",
              accreditationStatus: "",
              accreditationDate: "",
              approvedPositions: 0,
              filledPositions: 0,
              trainYears: 0,
              participatingSites: [],
              sponsoringInstitution: "",
              scrapedAt: new Date().toISOString(),
            });
          }

          // Polite delay between requests
          await page.waitForTimeout(DELAY_BETWEEN_DETAIL);
        }

        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n  Total programs scraped: ${allPrograms.length}`);
  return allPrograms;
}

/** Save scraped data to JSON for caching / inspection. */
export function saveACGMEData(programs: ACGMEProgram[], outPath: string): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(programs, null, 2));
  console.log(`  Saved ${programs.length} programs to ${outPath}`);
}

// ── CLI Entry ────────────────────────────────────────────────────────────────

if (process.argv[1]?.match(/acgme-scraper\.(ts|js)$/)) {
  const dryRun = process.argv.includes("--dry-run");

  // Parse --state and --specialty flags
  const states: string[] = [];
  const specialties: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === "--state" && process.argv[i + 1]) states.push(process.argv[++i].toUpperCase());
    if (process.argv[i] === "--specialty" && process.argv[i + 1]) specialties.push(process.argv[++i].toLowerCase());
  }

  const outPath = path.resolve(process.cwd(), "data/acgme-programs.json");

  scrapeACGME({
    states: states.length ? states : undefined,
    specialties: specialties.length ? specialties : undefined,
    dryRun,
  })
    .then((programs) => {
      if (!dryRun) saveACGMEData(programs, outPath);
    })
    .catch((err) => {
      console.error("ACGME scrape failed:", err);
      process.exit(1);
    });
}
