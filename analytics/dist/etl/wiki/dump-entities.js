import fs from "fs";
import { getDriver, verifyConnection, closeConnections } from "../../shared/connections.js";
import { getPeople, getCompanies, getCompetitorProducts, getTechnologies, getLeads } from "./wiki-queries.js";
async function main() {
    await verifyConnection();
    const session = getDriver().session();
    const people = await getPeople(session);
    const companies = await getCompanies(session, 5);
    const products = await getCompetitorProducts(session);
    const techs = await getTechnologies(session, 3);
    const leads = await getLeads(session, 40, 20);
    console.log(`People: ${people.length}, Companies: ${companies.length}, Products: ${products.length}, Techs: ${techs.length}, Leads: ${leads.length}`);
    fs.writeFileSync("/tmp/wiki-entities.json", JSON.stringify({ people, companies, products, techs, leads }, null, 2));
    console.log("Written to /tmp/wiki-entities.json");
    await session.close();
    await closeConnections();
}
main().catch((err) => { console.error(err); process.exit(1); });
