# Telehealth with Medplum

> Medplum has no native video — by design. It provides the clinical infrastructure layer (encounters, scheduling, charting, prescriptions) while video is handled externally. OpenLoop is migrating from Doxy.me to a proprietary system using Amazon Chime SDK. This doc covers the full telehealth lifecycle from repo code analysis through OpenLoop's production architecture.

**See also:** [Platform Overview](Platform%20Overview.md) | [OpenLoop Feature Map](OpenLoop%20Feature%20Map.md) | [Capability Mapping](../Migration/Capability%20Mapping.md)

---

## What Medplum Provides vs. Doesn't

| Medplum Provides | Medplum Does Not Provide |
|------------------|--------------------------|
| Encounter lifecycle management | Video/audio streaming |
| Appointment scheduling ($book, $find) | WebRTC media servers |
| FHIR resource storage (notes, vitals, Rx) | Recording/transcription |
| Bot automation (create meetings, reminders) | Virtual waiting rooms |
| FHIRcast context synchronization | Screen sharing |
| SMART on FHIR app embedding | Video quality optimization |
| AccessPolicy for participant control | TURN/STUN servers |

---

## OpenLoop's Video Architecture

### Decision Made: Amazon Chime SDK

| Attribute | Detail |
|-----------|--------|
| **Previous provider** | Doxy.me |
| **Current/target** | Amazon Chime SDK + Amazon Connect |
| **Architecture** | Custom waiting room with join links for both physicians and patients |
| **MedPlum integration** | Bots run event-driven to generate join links synchronously during appointment creation |
| **AWS-native** | Chime SDK is AWS — aligns with OpenLoop's infrastructure |

```mermaid
graph LR
    Patient["Patient App"]:::app
    Provider["Provider App"]:::app
    Video["Amazon Chime SDK<br/><i>via Amazon Connect</i>"]:::video
    WR["Custom Waiting Room"]:::video
    API["Partners API"]:::layer
    Medplum["Medplum CDR<br/><i>Encounter, Observation,<br/>DocumentReference</i>"]:::cdr

    Patient <-- "Join link" --> WR
    WR <-- "WebRTC video" --> Video
    Provider <-- "Join link" --> Video
    Provider -- "Clinical data" --> API --> Medplum

    classDef app fill:#3498DB,stroke:#2176AC,color:#fff
    classDef video fill:#E74C3C,stroke:#C0392B,color:#fff
    classDef layer fill:#F39C12,stroke:#D68910,color:#fff
    classDef cdr fill:#2ECC71,stroke:#1FA84D,color:#fff
```

### Integration Approach

1. **Video is infrastructure, not EHR** — treat it as a separate service, not part of Medplum
2. **FHIR hooks on Chime events** — session start/end automatically creates/updates Encounter resources via a MedPlum Bot
3. **Join links via Bot** — MedPlum Bot generates Chime join links synchronously during appointment creation (event-driven, not async)
4. **Appointment extensions** — store join URLs (patient + provider) as FHIR extensions on the Appointment resource
5. **Encounter class VR** — all telehealth encounters use the `VR` (virtual) class code

---

## Reference Patterns from the Medplum Repo

### Zoom Bot — The Canonical Video Integration Pattern

**Path:** `examples/medplum-demo-bots/src/zoom-bots/zoom-create-meeting.ts` (386 lines)

The Zoom bot demonstrates how to integrate any video provider with Medplum. Adapt this pattern for Chime SDK — the FHIR extension storage, Bot trigger mechanism, and lifecycle management all remain identical.

```mermaid
sequenceDiagram
    participant Sub as FHIR Subscription
    participant Bot as Video Bot
    participant Chime as Amazon Chime SDK
    participant CDR as Medplum CDR

    Note over Sub: Appointment created/updated
    Sub->>Bot: Trigger on Appointment change
    Bot->>Bot: Check appointment.status

    alt status = booked/pending
        Bot->>Chime: Create meeting session
        Chime-->>Bot: session_id, join_urls
        Bot->>CDR: Update Appointment with extensions
    else status changed (rescheduled)
        Bot->>Chime: Update meeting session
        Chime-->>Bot: Updated session details
        Bot->>CDR: Update Appointment extensions
    else status = cancelled/noshow
        Bot->>Chime: Delete meeting session
        Bot->>CDR: Remove video extensions from Appointment
    end
```

**How meeting details are stored — FHIR Extensions on Appointment:**

```json
{
  "resourceType": "Appointment",
  "status": "booked",
  "extension": [{
    "url": "https://openloop.health/telehealth",
    "extension": [
      { "url": "session-id", "valueString": "abc-123-meeting" },
      { "url": "patient-join-url", "valueString": "https://video.openloop.health/join/abc123" },
      { "url": "provider-join-url", "valueString": "https://video.openloop.health/host/abc123" }
    ]
  }]
}
```

**Key patterns from the Zoom bot (apply to Chime):**

1. **Secrets via `event.secrets`** — credentials stored in Bot configuration, not in code
2. **Idempotent updates** — checks for existing session extension before creating. Updates if exists, creates if not.
3. **Full cleanup on cancellation** — deletes the video session AND removes extensions from the Appointment
4. **Extension namespacing** — nested extensions under a parent URL keep the Appointment clean

---

### Appointment Reminder Bot — Video Link Distribution

**Path:** `examples/medplum-demo-bots/src/appointment-bots/send-appointment-reminders.ts`

Runs on a cron schedule (daily at 7:00 AM). Extracts video join links and sends reminders:

```typescript
// Extract join URL from Appointment extensions
const joinLink = appointment.extension?.find(
  (e) => e.url === 'https://openloop.health/telehealth'
)?.extension?.find(
  (e) => e.url === 'patient-join-url'
)?.valueString;

// Build reminder message with video link
let message = `Hi ${firstName}, reminder: appointment with ${providerName} at ${appointmentTime}.`;
if (joinLink) {
  message += `\n\nJoin your visit: ${joinLink}`;
}

// Create Communication resource (triggers SMS bot downstream)
await medplum.createResource({
  resourceType: 'Communication',
  status: 'in-progress',
  subject: createReference(patient),
  payload: [{ contentString: message }],
  basedOn: [createReference(appointment)],
});
```

**Pattern:** Bot creates a `Communication` resource. A second bot subscribed to Communication sends the actual SMS (via Twilio) and updates status to `completed`. This is the Medplum event chain pattern — bots triggering bots.

---

### Async Encounters — Chat-Based Telehealth

**Path:** `packages/docs/docs/communications/async-encounters/async-encounters.md`

Medplum has first-class support for asynchronous telehealth. Each async session (SMS chain, chat thread, email exchange) maps to FHIR as:

```mermaid
graph TD
    E["Encounter<br/><i>class: VR</i>"]:::encounter
    C1["Communication<br/><i>Thread Header</i>"]:::comm
    C2["Communication<br/><i>Message 1</i>"]:::comm
    C3["Communication<br/><i>Message 2</i>"]:::comm
    C4["Communication<br/><i>Message 3</i>"]:::comm

    C1 -->|encounter| E
    C2 -->|partOf| C1
    C3 -->|partOf| C1
    C4 -->|partOf| C1

    classDef encounter fill:#2ECC71,stroke:#1FA84D,color:#fff
    classDef comm fill:#3498DB,stroke:#2176AC,color:#fff
```

**Key rules:**
- One `Encounter` per session, `class` = `VR` (virtual)
- Thread header `Communication` links to Encounter via `Communication.encounter`
- Individual messages link to the thread header via `Communication.partOf`
- Multi-patient sessions use parent/child Encounters (parent = session, children = per-patient)

**OpenLoop relevance:** Many service lines (weight management, dermatology, mental health) use async messaging heavily. This replaces Healthie's in-app messaging with FHIR-native threading.

---

### Chat Demo — Creating Encounters from Threads

**Path:** `examples/medplum-chat-demo/src/components/actions/CreateEncounter.tsx`

Turns an ad-hoc conversation into a tracked clinical encounter:

```typescript
const defaultEncounter = {
  resourceType: 'Encounter',
  status: 'in-progress',
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'VR',
    display: 'virtual',
  },
  subject: getEncounterSubject(communication),     // Extract Patient from recipients
  participant: communication.recipient,             // All thread participants
  period: await getEncounterPeriod(communication),  // First message → last message
};
```

- **`getEncounterPeriod()`** calculates start/end from message timestamps
- **`getEncounterSubject()`** filters recipients for `Patient/` references
- After creating the Encounter, PATCHes the Communication to link it

---

## Encounter Lifecycle

**Path:** `examples/medplum-provider/src/utils/encounter.ts`

```mermaid
graph TD
    A["createEncounter()"]:::fn
    A --> AP["Create Appointment"]
    A --> EN["Create Encounter<br/><i>status: planned</i>"]
    A --> SL["Create Slot<br/><i>status: busy</i>"]
    A --> CI["Create ClinicalImpression<br/><i>Chart note</i>"]
    A --> PD["Apply PlanDefinition<br/><i>Creates Tasks + ChargeItems</i>"]

    U["updateEncounterStatus()"]:::fn
    U --> S1["planned → arrived<br/><i>Appointment: arrived</i>"]
    U --> S2["arrived → in-progress<br/><i>Appointment: checked-in<br/>period.start = now</i>"]
    U --> S3["in-progress → finished<br/><i>Appointment: fulfilled<br/>period.end = now</i>"]
    U --> S4["any → cancelled<br/><i>Appointment: cancelled</i>"]

    classDef fn fill:#9B59B6,stroke:#7D3C98,color:#fff
```

**`createEncounter()` does all of this in one call:**

1. Creates `Appointment` with participants and time
2. Creates `Encounter` referencing the Appointment
3. Creates `Slot` (if Schedule provided) to mark the time as busy
4. Creates `ClinicalImpression` for the provider's chart note
5. Applies `PlanDefinition` via `$apply` — auto-generates `Task` and `ChargeItem` resources

**Status sync:**

| Encounter Status | Appointment Status | Auto-set Fields |
|-----------------|-------------------|-----------------|
| `planned` | (no change) | — |
| `arrived` | `arrived` | — |
| `in-progress` | `checked-in` | `period.start = now` |
| `finished` | `fulfilled` | `period.end = now` |
| `cancelled` | `cancelled` | — |

---

## Charting During Telehealth Visits

**Path:** `examples/medplum-provider/src/components/encounter/EncounterChart.tsx`

Two-tab interface:

**Tab 1 — Notes & Tasks:**
- `ClinicalImpression` for unstructured SOAP notes (auto-saved with debounce)
- `Task` list for care plan items (generated from PlanDefinition)
- Chart note status: Unsigned → Signed → Signed & Locked
- Signature recorded via `Provenance` resource (legal attestation)

**Tab 2 — Details & Billing:**
- `ChargeItem` management for encounter billing
- `Claim` auto-created from ChargeItems
- Encounter metadata (status, period, participants)

```mermaid
sequenceDiagram
    participant P as Provider
    participant UI as EncounterChart
    participant CDR as Medplum CDR

    P->>UI: Write SOAP note in ClinicalImpression
    UI->>CDR: Auto-save (debounced)
    P->>UI: Click "Sign"
    UI->>CDR: Create Provenance (agent = Practitioner)
    Note over CDR: Status: Signed
    P->>UI: Click "Lock"
    UI->>CDR: Update Provenance (locked = true)
    UI->>CDR: Complete all open Tasks
    Note over CDR: Status: Signed & Locked (immutable)
```

---

## Scheduling

**Path:** `packages/docs/docs/scheduling/`

| Resource | Purpose |
|----------|---------|
| `ActivityDefinition` | Defines appointment types (e.g., "15-min telehealth follow-up") with default constraints |
| `Schedule` | Provider/location/device availability. One Schedule per actor. |
| `Slot` | Time blocks — only created for booked or blocked times (implicit availability model) |
| `Appointment` | The booked visit. Links to Schedule, Slot, and eventually Encounter. |

**Server operations:**

| Operation | Purpose |
|-----------|---------|
| `$find` | Find available slots for a given Schedule, date range, and service type |
| `$book` | Book an appointment (creates Slot + Appointment atomically) |
| `$hold` | Temporarily hold a slot during checkout |
| `$cancel` | Cancel an appointment and release the slot |

**OpenLoop relevance:** The implicit availability model (time is free by default, Slots only created for booked/blocked time) is efficient for 20K+ providers.

---

## FHIRcast — Real-Time Context Synchronization

**Path:** `packages/docs/docs/fhircast/`

Medplum implements FHIRcast STU3 — lightweight pub/sub for synchronizing clinical context across apps via WebSockets.

```mermaid
graph LR
    EHR["Provider App<br/><i>Context Source</i>"]:::src
    Hub["FHIRcast Hub<br/><i>Medplum Server</i>"]:::hub
    App1["Video Widget"]:::sub
    App2["Charting Panel"]:::sub
    App3["Rx Module"]:::sub

    EHR -->|"Patient-open<br/>Encounter-open"| Hub
    Hub -->|WebSocket| App1
    Hub -->|WebSocket| App2
    Hub -->|WebSocket| App3

    classDef src fill:#E74C3C,stroke:#C0392B,color:#fff
    classDef hub fill:#F39C12,stroke:#D68910,color:#fff
    classDef sub fill:#3498DB,stroke:#2176AC,color:#fff
```

**Telehealth use case:** When a provider opens a telehealth encounter, FHIRcast notifies the video widget, charting panel, and e-prescribe module to all load the same patient/encounter context simultaneously.

**Supported events:** `Patient-open`, `Patient-close`, `Encounter-open`, `Encounter-close`, `DiagnosticReport-update`, `DiagnosticReport-select`

---

## SMART on FHIR — Embedding Apps

**Path:** `packages/docs/docs/integration/smart-app-launch.md`

Medplum implements SMART App Launch 2.0.0. For telehealth, this enables embedded clinical tools (decision support, medication lookup) to launch with patient + encounter context.

**Custom identifiers for OpenLoop:**

```json
{
  "launchIdentifierSystems": [
    { "resourceType": "Patient", "system": "https://openloop.health/patient-id" },
    { "resourceType": "Encounter", "system": "https://openloop.health/visit-id" }
  ]
}
```

This lets SMART apps use OpenLoop's internal IDs instead of Medplum FHIR IDs — critical for the Partners API.

---

## Complete Visit Flows

### Synchronous Video Visit

```mermaid
sequenceDiagram
    participant Pat as Patient App
    participant API as Partners API
    participant CDR as Medplum CDR
    participant Bot as Medplum Bots
    participant Vid as Amazon Chime SDK

    Note over Pat,Vid: 1. SCHEDULING
    Pat->>API: Request appointment
    API->>CDR: $find available slots
    CDR-->>API: Available times
    API-->>Pat: Display availability
    Pat->>API: Book slot
    API->>CDR: $book (creates Appointment + Slot)
    CDR->>Bot: Subscription triggers video bot
    Bot->>Vid: Create Chime session
    Vid-->>Bot: session_id, join_urls
    Bot->>CDR: Update Appointment with video extensions

    Note over Pat,Vid: 2. REMINDERS (24h before)
    Bot->>CDR: Cron: search upcoming Appointments
    Bot->>CDR: Create Communication with join link
    CDR->>Bot: Subscription triggers SMS bot
    Note over Pat: Patient receives reminder + join link

    Note over Pat,Vid: 3. VISIT
    Pat->>Vid: Join via waiting room
    Note over Pat,Vid: Provider joins from Provider App
    CDR->>CDR: Encounter status: in-progress, period.start = now

    Note over Pat,Vid: 4. CHARTING (during visit)
    Note over CDR: ClinicalImpression, Observations, Conditions
    Note over CDR: MedicationRequest, ServiceRequest

    Note over Pat,Vid: 5. WRAP-UP
    CDR->>CDR: Encounter status: finished, period.end = now
    Bot->>CDR: Create ChargeItems from PlanDefinition
    Note over CDR: Provider signs & locks chart note
```

### Async Messaging Visit

```mermaid
sequenceDiagram
    participant Pat as Patient App
    participant API as Partners API
    participant CDR as Medplum CDR

    Pat->>API: Send message (symptom description)
    API->>CDR: Create Communication (thread header)
    Note over CDR: No Encounter yet — just messaging

    Pat->>API: Send follow-up message
    API->>CDR: Create Communication (partOf thread header)

    Note over CDR: Provider reviews thread
    CDR->>CDR: Create Encounter (class: VR, status: in-progress)
    CDR->>CDR: Link Communication.encounter → Encounter
    CDR->>CDR: period.start = first message timestamp

    Note over CDR: Provider responds with clinical guidance
    API->>CDR: Create Communication (provider reply, partOf thread)

    Note over CDR: Provider completes encounter
    CDR->>CDR: ClinicalImpression, MedicationRequest (if needed)
    CDR->>CDR: Encounter status: finished
    CDR->>CDR: period.end = last message timestamp
```

---

## FHIR Resource Map by Visit Phase

### Pre-Visit

| Resource | Purpose | Key Fields |
|----------|---------|------------|
| `Schedule` | Provider availability | `actor`, SchedulingParameters extension |
| `Slot` | Booked time block | `schedule`, `status: busy`, `start/end` |
| `Appointment` | Scheduled visit | `participant`, `start`, video extension |
| `Communication` | Reminder messages | `payload`, `basedOn: Appointment` |

### During Visit

| Resource | Purpose | Key Fields |
|----------|---------|------------|
| `Encounter` | The visit record | `class: VR`, `status`, `period`, `participant` |
| `ClinicalImpression` | SOAP note | `encounter`, `description`, `finding` |
| `Observation` | Vitals / measurements | `code` (LOINC), `value[x]`, `encounter` |
| `Condition` | Diagnoses | `code` (ICD-10), `category`, `encounter` |
| `Communication` | Chat messages (async) | `encounter`, `partOf`, `payload` |

### Post-Visit

| Resource | Purpose | Key Fields |
|----------|---------|------------|
| `MedicationRequest` | Prescriptions | `medication`, `dosageInstruction`, `encounter` |
| `ServiceRequest` | Lab/imaging orders | `code`, `subject`, `encounter` |
| `DocumentReference` | Visit summary / recording | `content`, `context.encounter` |
| `ChargeItem` | Billable service | `code`, `context: Encounter` |
| `Claim` | Insurance claim | `item`, `provider`, `diagnosis` |
| `Provenance` | Chart note signature | `agent`, `recorded`, `target` |
| `Task` | Follow-up items | `focus: Encounter`, `status` |

### Telehealth Encounter Example

```json
{
  "resourceType": "Encounter",
  "status": "finished",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "VR",
    "display": "virtual"
  },
  "type": [{
    "coding": [{
      "system": "http://snomed.info/sct",
      "code": "448337001",
      "display": "Telemedicine consultation with patient"
    }]
  }],
  "subject": { "reference": "Patient/abc-123" },
  "participant": [
    {
      "individual": { "reference": "Practitioner/def-456" },
      "period": { "start": "2026-03-03T10:00:00Z", "end": "2026-03-03T10:25:00Z" }
    }
  ],
  "period": {
    "start": "2026-03-03T10:00:00Z",
    "end": "2026-03-03T10:25:00Z"
  },
  "reasonCode": [{
    "coding": [{
      "system": "http://snomed.info/sct",
      "code": "44054006",
      "display": "Diabetes mellitus type 2"
    }]
  }]
}
```

---

## Scaling (250K+ Visits/Month)

At ~8,300 visits/day, ~350/hour peak:

| Concern | Approach |
|---------|----------|
| Video session creation | Bot creates Chime sessions on Appointment creation (not on join). Sessions pre-exist before visit time. |
| Concurrent sessions | Amazon Chime SDK scales independently of Medplum. AWS-managed media infrastructure. |
| Bot throughput | Medplum Bots run on AWS Lambda. Subscription-triggered bots scale horizontally. 350 creates/hour is trivial. |
| Extension storage | Video metadata (join URLs, session IDs) stored as Appointment extensions. No additional tables. |
| Reminder throughput | Cron bot runs daily, searches upcoming Appointments, creates Communications in batch. |

| Metric | Target | Medplum Capability |
|--------|--------|-------------------|
| Concurrent encounters | 1,000+ | ECS Fargate auto-scaling, Aurora PostgreSQL |
| Encounter creates/min | 100+ | FHIR REST API, batch Bundles for bulk operations |
| p95 API latency | <500ms | ElastiCache Redis for search caching |
| Encounter storage | 3M+/year | Aurora PostgreSQL, S3 for documents |

### Multi-Tenant Isolation

Each OpenLoop client is a Medplum `Project`. Chime sessions can be:

1. **Shared** — one Chime configuration, session metadata scoped by Project via AccessPolicy
2. **Per-client** — each client has their own Chime/Connect credentials stored in Bot secrets
3. **Hybrid** — shared infrastructure with white-labeled join URLs

---

## Recommendations

### Phase 0 (Weeks 1-4)

1. **Define extension schema** — standardize the FHIR extension URL for video metadata (e.g., `https://openloop.health/telehealth`)
2. **Choose sync vs async** — determine which service lines use synchronous video vs async messaging

### Phase 1 (Weeks 5-12)

3. **Build Chime bot** — adapt the Zoom bot pattern for Amazon Chime SDK. Keep the FHIR Subscription trigger, extension storage, and lifecycle management.
4. **Build encounter workflow** — port `createEncounter()` / `updateEncounterStatus()` into the Partners API
5. **Implement reminder pipeline** — appointment reminder bot → Communication → SMS bot chain
6. **Wire FHIRcast** — connect video widget to encounter context via FHIRcast WebSocket

### Phase 2 (Weeks 13-24)

7. **Load test** — target 1,000 concurrent encounters, 350+ appointment creates/hour
8. **Async encounters** — deploy Communication → Encounter pipeline for messaging-based service lines

### Phase 3 (Weeks 25-36)

9. **SMART app embedding** — enable third-party clinical tools within the telehealth experience
10. **Recording integration** — store video recordings as DocumentReference resources linked to Encounter
11. **Analytics** — encounter duration, wait times, completion rates from Encounter period data
