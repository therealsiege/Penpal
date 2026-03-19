
> Why MedScrub is building the clinical intelligence layer, not a CCM platform
> Date: 2026-03-13 | Status: DECIDED
> Decision owner: Clint | Key input: Patrick Carter (CareMessage, ex-ChartSpan founder)

---

## The Decision

MedScrub will build the **AI-powered clinical intelligence layer** — the system that reads unstructured clinical documents (faxed specialist reports, scanned intake forms, PDFs in patient charts) and produces risk-stratified patient lists for screening compliance. MedScrub will NOT build a CCM billing automation platform.

This is Path B from [[CCM Market Competitive Analysis]].

---

## How We Got Here

### The Internal Analysis Said One Thing

Our knowledge graph analysis scored CCM Workflows as the #1 priority (89/100) and APCM Eligibility as #2 (88/100). The internal analysis concluded "no competitor offers CCM automation" and recommended building a Revenue Engine — enrollment workflows, monthly touchpoint tracking, billing compliance, claims pre-population.

### The Advisor Said Something Different

Patrick Carter — who **founded ChartSpan**, the nation's largest CCM program — told us to build screening compliance from unstructured data extraction. He never mentioned CCM workflows, billing codes, enrollment automation, or monthly touchpoint tracking. Not once.

When we mapped the CCM market, we found 8+ established players (ChronicCareIQ, TimeDoc, ThoroughCare, Signallamp, 1bios, Optimize Health, HealthSnap, HealthArc) — several operating for 5+ years. Our internal claim that "no competitor offers CCM automation" was only true within the narrow frame of ambient scribe competitors. The actual CCM market is mature.

### What Patrick Actually Said

From the March 6, 2026 conversation (direct quotes):

**The problem is unstructured data, not workflow automation:**
> "Where we are struggling is identifying those patients and getting the data out of the EHR... it's not a simple 'oh, age 55 and older'... How am I going to get that information? I'm going to have to crawl everything. It's probably on some PDF doc sitting on a patient intake that was on a clipboard..."

**The output is patient lists, not billing workflows:**
> "The artifact out of that is a list of all of your patients broken up by risk factor — high risk, low risk, medium risk — that need to have screenings done. You just saved probably two weeks of an individual's time."

**Screening is "have to have," SOAP notes are "nice to have":**
> "Every doctor will tell you it's a nice to have, not a have to have. But all of this population health data and sifting through that data — they have to have. It's not a nice to have. The government mandates that you do it."

**The financial hook is penalties, not revenue capture:**
> "For a single doctor, probably has tens of thousands of dollars at risk for them every year if they don't figure this out."

**This is what Agilon couldn't solve:**
> "That's something we couldn't conquer at Agilon. We just couldn't. We just weren't able to do it."

**The sales moment he described:**
> "If you walked in and you're like, 'this is what you would do to get a list of patients that need colorectal cancer screening,' and in 5-10 seconds, come back to it 20-30 minutes, let it do its thing... they will go bonkers. They'll be like, I don't care what it costs."

### Why We Trust This Advice

Patrick is giving honest advice from a friend, not steering us for competitive reasons. His credibility on this topic is uniquely high:

1. **He founded ChartSpan** — he knows what CCM automation looks like and could have said "build what I built." He didn't.
2. **He worked population health at Agilon** — he saw firsthand that unstructured data extraction for screening is the unsolved problem.
3. **He's now at CareMessage** — a nonprofit sending 60M texts/year across 7-8M patients, and they struggle with exactly this: identifying which patients need screening from unstructured EHR data.
4. He's seen this problem from three different vantage points in his career and pointed to the same gap every time.

---

## What This Means Strategically

### We Build

The **Panel Screener** — AI that reads the entire patient panel, including unstructured documents, and produces risk-stratified patient lists for screening programs. Starting with colorectal cancer screening.

This is the capability that:
- No ambient scribe offers (they're single-encounter tools)
- No CCM platform offers (they assume you already know who the patients are)
- Navina offers for enterprise ACOs/health plans, but not for independent 1-5 provider practices
- Patrick explicitly said Agilon couldn't solve

### We Don't Build

- CCM enrollment workflows
- Monthly touchpoint tracking
- Claims pre-population or charge write-back
- Billing compliance automation
- APCM tier classification

These are all things mature CCM platforms already do. If practices want that, they can use ChronicCareIQ, TimeDoc, or ChartSpan. MedScrub's intelligence layer can eventually feed into those systems — we're complementary, not competitive.

### The Sequence

1. **v0.1**: Colorectal cancer screening card — one program, one output, prove it works
2. **v0.2**: Add breast cancer, prostate, USPSTF medication recommendations
3. **v0.3**: Panel-level screening dashboard across all programs
4. **Then decide**: Do practices want us to go downstream into enrollment/billing? Or do they want us to integrate with their existing CCM platform? Let customer demand decide.

### The Positioning

MedScrub is the **"Walmart" of clinical intelligence for small practices** — the AI that reads what's buried in faxed specialist reports and scanned intake forms, and tells you which patients need what, before the payer flags it, before the penalty hits. Enterprise tools like Navina do this for ACOs at enterprise prices. MedScrub does it for the 1-5 provider practice that can't afford Navina and doesn't have payer gap files.

---

## Related Documents

- [[CCM Market Competitive Analysis]] — Why the CCM market is mature and not a white space
- [[Navina Competitive Analysis]] — Enterprise competitor validating the capability, not the market
- [[Patrick Carter — What He Actually Said]] — Full synthesis of advisor guidance
- [[v0.1 Product Spec — Panel Screener]] — What we're building first
- [[Product Strategy]] — Updated priority framework
