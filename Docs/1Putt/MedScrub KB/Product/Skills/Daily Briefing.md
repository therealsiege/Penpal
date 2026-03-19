## **Problem Statement**

Physicians spend 15-30 minutes per patient reviewing charts before appointments. For a typical 15-patient day, that is 4-7 hours of preparation — often done before clinic hours or squeezed between visits. This preparation is repetitive (pull up conditions, review meds, check labs, read last note) and error-prone when rushed.

The desktop app already has a Pre-Visit Planning workflow that generates AI summaries for a single patient. But physicians don't prepare one patient at a time — they prepare for their entire day. There is no batch capability and no schedule awareness.

## **Market Analysis**

### **Market Size**

The US ambulatory care market generates approximately 1 billion office visits per year (CDC NAMCS). With 350,000+ physicians in primary care and internal medicine, each averaging 15-20 patient encounters per day, the daily pre-visit preparation problem affects every clinic day for every physician.

The clinical AI market reached $2.1B in 2025 and is projected to grow at 38% CAGR through 2030 (Grand View Research). Pre-visit intelligence is a subset, but one that maps directly to measurable time savings per physician per day.

### **Evidence Base**

| **Study / Product** | **Finding** | **Source** |
| --- | --- | --- |
| Navina (AAFP Innovation Lab) | AI pre-visit summaries reduced prep time from 14.1 min to 5.5 min per patient (61% decrease) | AAFP Innovation Lab 2024 |
| Navina (AAFP Innovation Lab) | Care gap identification increased from 72% to 93% | AAFP Innovation Lab 2024 |
| DeepScribe Pre-Charting | Cuts pre-visit charting to 3 minutes per patient | DeepScribe product data 2025 |
| AMA Physician Burnout Study | 62.8% of physicians report at least one burnout symptom; documentation is the #1 driver | AMA 2024 |
| Sinsky et al. (Annals of Internal Med) | For every 1 hour of patient face time, physicians spend 2 hours on documentation/inbox | Annals of Internal Medicine 2016 |
| MGMA Stat Poll | 73% of medical group leaders say physician burnout has increased over the past year | MGMA 2024 |

### **Competitive Landscape**

| **Capability** | **Navina** | **DeepScribe Pre-Charting** | **Epic Chart Prep** | **MedScrub Daily Briefing** |
| --- | --- | --- | --- | --- |
| Data source | EHR data (Epic integration) | Ambient audio + chart | Epic chart data | Full FHIR record via CDR |
| Batch support | Full schedule | One patient at a time | Full schedule | Full schedule (V1 manual, V2 auto) |
| Care gap detection | Yes (93% accuracy) | No | Basic | Yes (FHIR-powered) |
| High-risk flagging | Yes | No | Limited | Yes |
| EHR compatibility | Epic, Cerner, athena | Epic, Cerner | Epic only | Any EHR with FHIR |
| PHI handling | SaaS cloud | SaaS cloud | Epic cloud | Self-hosted proxy (de-identified) |
| Price | ~$300/provider/mo | Included with scribe ($2K+/mo) | Included with Epic | Included with MedScrub |
| Deployment | Cloud SaaS | Cloud SaaS | Epic hosted | Self-hosted |

### **MedScrub Differentiators**

1. **EHR-agnostic**: Works with any FHIR-enabled EHR. Competitors are locked to one or two EHR vendors.
2. **PHI stays local**: Data never leaves the physician's infrastructure unprotected. Every competitor sends PHI to their cloud.
3. **Full FHIR depth**: Uses the complete FHIR R4 resource set (Patient, Condition, MedicationRequest, AllergyIntolerance, Observation, DiagnosticReport, Procedure, Encounter, DocumentReference), not summaries from proprietary EHR APIs.
4. **Existing pipeline reuse**: Adds batch capability on top of the already-shipped Pre-Visit Planning workflow — minimal new infrastructure.

## **User Stories**

1. **As a PCP**, I want to generate pre-visit summaries for all my patients in one click, so I can prepare for my entire day in 10 minutes instead of 2 hours.
2. **As a physician**, I want to see high-risk patients flagged in my daily overview, so I know who needs extra attention before clinic starts.
3. **As a care team member**, I want a printable/exportable briefing for the morning huddle, so the entire team is aligned on today's patients.
4. **As a physician**, I want to recall yesterday's schedule setup, so I don't have to re-enter my patient list each morning.
5. **As a physician**, I want to see care gaps across my day's patients, so I can address preventive care during visits.

## **UX Flow**

### **1. Schedule Setup**

The physician opens the Daily Briefing page. They see:

- **Date picker** (defaults to today)
- **Patient list** (initially empty)
- **"Add Patients" button** opens a multi-select patient modal (existing PatientSelectionModal extended with checkboxes)
- For each added patient, inline fields for:
    - Appointment time (optional, e.g., "9:00 AM")
    - Appointment type (dropdown: Follow-up, Annual Wellness, Acute, New Patient, Procedure, Other)
    - Chief complaint (optional free text)
- **"Use Last Schedule"** button recalls the previous session's patient list from localStorage
- **Cost estimate** displayed: "Estimated cost: ~$0.45 for 8 patients"

### **2. Generate**

- Physician clicks **"Generate Briefing for N Patients"**
- Confirmation dialog shows cost estimate
- Progress bar: "Processing patient 3 of 8: John Smith..."
- Each patient processes sequentially (5-8 seconds each)
- Cancel button available (AbortController pattern)

### **3. Output**

- **Schedule Overview** card at top:
    - Patient count and visit type breakdown
    - High-acuity patients flagged (abnormal labs, multiple chronic conditions, recent ED visit)
    - Care gaps across all patients (overdue screenings, vaccinations)
    - Suggested schedule priorities
- **Per-patient briefing cards** (collapsible):
    - Patient name, appointment time, visit type
    - AI-generated pre-visit summary (conditions, meds, recent labs, last visit, actionable items)
    - Copy-to-clipboard button per card
    - Status indicator (done / error)
- **Export All** button: copies full briefing or downloads as text file

## **Acceptance Criteria**

### **AC-1: Patient Selection (Multi-Select)**

- [ ]  PatientSelectionModal supports `multiSelect` mode with checkboxes
- [ ]  Selected patients display with name, MRN, and remove button
- [ ]  Maximum of 25 patients can be selected per briefing
- [ ]  Modal shows selected count badge ("3 selected")
- [ ]  Existing single-select behavior is unchanged when `multiSelect` is not passed

### **AC-2: Schedule Metadata**

- [ ]  Each patient row shows optional appointment time (time picker, HH:MM AM/PM)
- [ ]  Each patient row shows appointment type dropdown (Follow-up, Annual Wellness, Acute, New Patient, Procedure, Other)
- [ ]  Chief complaint is an optional free-text field per patient
- [ ]  Patients can be reordered by drag or by appointment time sort

### **AC-3: Schedule Persistence**

- [ ]  "Use Last Schedule" restores patient list, appointment times, and types from localStorage
- [ ]  Schedule is auto-saved to localStorage after any modification
- [ ]  Schedule is keyed by date (restoring yesterday's schedule for today pre-fills the patient list)

### **AC-4: Cost Estimation**

- [ ]  Cost estimate updates in real-time as patients are added/removed
- [ ]  Cost per patient uses `estimateWorkflowCost` with the `pre-visit-summary` template
- [ ]  Format: "Estimated cost: ~$X.XX for N patients"

### **AC-5: Batch Generation**

- [ ]  "Generate Briefing for N Patients" button is disabled when patient list is empty
- [ ]  Clicking Generate shows confirmation dialog with cost estimate
- [ ]  Progress bar shows "Processing patient X of Y: [Patient Name]..."
- [ ]  Each patient processes sequentially using the existing 5-stage pipeline
- [ ]  Per-patient errors are captured and displayed but do not halt the batch
- [ ]  Cancel button aborts processing via AbortController; completed results are retained

### **AC-6: Per-Patient Output**

- [ ]  Each patient gets a collapsible BriefingCard showing: name, appointment time, visit type, status
- [ ]  Expanded card shows AI-generated pre-visit summary with conditions, medications, recent labs, last visit, actionable items
- [ ]  Each card has a copy-to-clipboard button that copies that patient's summary
- [ ]  Error state cards show the error message and a "Retry" button

### **AC-7: Schedule Overview**

- [ ]  After all patients process, a Schedule Overview card is generated using the `daily-briefing-header` template
- [ ]  Overview includes: patient count, visit type breakdown, high-acuity patient flags, care gaps across all patients, suggested priorities
- [ ]  Overview card appears above per-patient cards

### **AC-8: Export**

- [ ]  "Export All" button copies the full briefing (overview + all patient summaries) to clipboard
- [ ]  "Download as Text" option saves the briefing as a `.txt` file
- [ ]  Exported content includes date, patient names, appointment times, and summaries

### **AC-9: Navigation**

- [ ]  Daily Briefing appears in the Tasks grid with `CalendarDays` icon, status `'active'`
- [ ]  Route `/tasks/daily-briefing` loads the DailyBriefing page
- [ ]  Page is lazy-loaded

## **Technical Approach**

### **Schedule Data Source**

**V1 (ship now):** Manual patient selection from Medplum CDR via multi-select modal. This works with every EHR and sidesteps the FHIR Appointment.Search limitation (Epic requires a `patient` parameter — you cannot query "all appointments for a provider today" via standard FHIR).

**V2 (future):** Auto-populate from CDR Encounters. Once EHR sync services populate Encounters into Medplum, query `Encounter?date=today&type=AMB&_sort=date` via existing `medplum:search` IPC handler.

### **Batch Processing**

- Sequential processing (not parallel) to avoid proxy session conflicts and LLM rate limits
- Per patient: executes the `pre-visit-summary` skill via `executeSkill()` (generic 5-stage pipeline)
- Schedule overview executes the `daily-briefing-header` skill on concatenated results
- Both skills are defined as `.skill.json` files in `desktop/src/skills/`
- Per-patient errors captured but do not stop batch (continues to next patient)

### **FHIR Resources Per Patient**

Same as existing Pre-Visit Planning:

- Patient, Condition, MedicationRequest, AllergyIntolerance, Observation (vitals + labs), DiagnosticReport, Procedure, Encounter, DocumentReference

### **Key Files**

| **File** | **Purpose** |
| --- | --- |
| `src/skills/pre-visit-summary.skill.json` | Per-patient briefing skill definition |
| `src/skills/daily-briefing-header.skill.json` | Schedule overview skill definition |
| `src/renderer/lib/skill-executor.ts` | Generic pipeline executor (`executeSkill()`) |
| `src/renderer/lib/skill-registry.ts` | Loads and indexes skill JSON files |
| `src/renderer/lib/workflow-manager.ts` | `executeDailyBriefingWorkflow` (batch orchestration) |
| `src/shared/briefing-types.ts` | Shared types for briefing data |
| `src/renderer/components/PatientSelectionModal.tsx` | Multi-select patient modal |
| `src/renderer/components/workflows/BriefingCard.tsx` | Collapsible patient card |
| `src/renderer/pages/DailyBriefing.tsx` | Main page |


## **Dependencies**

| **Dependency** | **Status** | **Impact** |
| --- | --- | --- |
| Skill SDK (skill-executor + skill-registry) | Shipped | Generic pipeline executes `pre-visit-summary` and `daily-briefing-header` skills
| PHI proxy de-identification/re-identification | Shipped | Required for every patient in the batch |
| Medplum CDR patient search | Shipped | Patient selection modal already queries CDR |
| PatientSelectionModal component | Shipped | Extended with multi-select mode |
| `estimateWorkflowCost` utility | Shipped | Used for cost estimation display |
| AbortController pattern | Shipped | Used in existing workflows for cancellation |

## **Success Metrics**

| **Metric** | **Target** | **Measurement Method** |
| --- | --- | --- |
| Prep time per patient | < 1 minute (vs. 14 min baseline) | User survey at 30 days |
| Briefing generation time (15 patients) | < 2 minutes | In-app timing telemetry |
| Care gaps identified | > 90% of known gaps surfaced | Manual audit of 50 briefings vs. chart review |
| Daily active usage | > 60% of active physicians use it daily within 30 days | Analytics event tracking |
| Error rate per patient | < 5% of patients fail to process | Error telemetry |
| Schedule recall usage | > 30% of sessions use "Use Last Schedule" | Analytics event tracking |

## **Out of Scope (V1)**

- Automatic schedule import from EHR (V2)
- Real-time appointment status updates
- Integration with CDS Hooks (`appointment-book` or `patient-view`)
- Team-based briefing sharing (single physician only in V1)
- SDOH data integration (future, per AMA framework)
- Smart Phrases / macro expansion in summaries
- Integration with team messaging (Slack, Teams)

## **Risks and Mitigations**

| **Risk** | **Likelihood** | **Impact** | **Mitigation** |
| --- | --- | --- | --- |
| Large schedules (20+ patients) take too long | Medium | Medium | Show progress bar, allow cancel, persist partial results, cap at 25 patients |
| LLM costs for large batches | Low | Medium | Show cost estimate before generation, confirm before starting |
| Stale CDR data (patient not synced recently) | Medium | High | Show "last synced" indicator per patient, flag stale data (> 7 days) |
| PHI proxy session conflicts during batch | Low | High | Sequential processing with unique session per patient |
| Manual patient entry is tedious | High | Medium | "Use Last Schedule" recall, V2 adds auto-population from CDR |
| Summary quality varies by data completeness | Medium | Medium | Show data completeness indicator per patient, note when key resources are missing |

## **V2 Roadmap**

1. **Auto-populate from CDR Encounters** — query `Encounter?date=today&type=AMB` once EHR sync is live
2. **CDS Hooks integration** — `appointment-book` hook triggers pre-visit summary generation automatically
3. **Team briefing sharing** — export to shared location, role-based access
4. **SDOH overlay** — integrate social determinants data per AMA framework
5. **Smart Phrase output** — format summaries as Epic Smart Phrases for direct insertion
6. **Trend analysis** — highlight longitudinal trends (worsening A1c, rising BP) in per-patient cards