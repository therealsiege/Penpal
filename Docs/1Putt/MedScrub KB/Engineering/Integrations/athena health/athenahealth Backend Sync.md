## Changed Data Subscriptions (Polling)

Subscribe to event feeds, poll GET /{feedtype}/changed to retrieve. Messages auto-deleted after 24 hours. Unused subscriptions auto-removed after 7 days. Retrieve at least once per hour.

### Key Feeds for MedScrub

- /appointments/changed — Check In event gives encounterID (primary sync trigger)
- /patients/changed — demographics sync (Add, Update, Merge, Delete)
- /labresults/changed — for SOAP Objective section (Add, Update, Close)
- /imagingresults/changed — for SOAP Objective (Add, Close, Add Result)
- /orders/changed — order tracking (Create, Update, Deny)
- /chart/healthhistory/problems/changed — problem list (ProblemAdd, ProblemUpdate)
- /chart/healthhistory/medication/changed — med list (Add, Update, Delete)
- /chart/healthhistory/allergies/changed — allergy list (Add, Update)
- /prescriptions/changed — prescriptions (Add, Delete, Update, Refill)

### Best Practices

- Messages older than 24 hours auto-deleted (may be lowered to 1 hour)
- Subscription changes take 10-20 minutes to take effect
- Retrieving data removes it from queue (debug flag to keep)
- For large practices: use department filtering, default limit 1000
- Never exceed GET/{feedtype}/changed per minute

## Event Notifications (Webhooks — Preferred)

Push-based, near real-time (p90 < 10s, p99 < 1 min). At-least-once delivery. Multi-practice support. ID-only payload (callback for full resource). Requires updated API Solutions contract.

## Recommended Architecture

### Phase 1: Changed Data Subscriptions

Works with current 2-legged OAuth setup. Subscribe to appointments/changed → on Check In event → pull encounter data via FHIR APIs → generate SOAP note → write back via DocumentReference (needs write scope).

### Phase 2: Event Notifications

Migrate to push-based webhooks when contract allows. Lower latency, multi-practice support, no polling overhead.

## Comparison: athena vs Epic Sync

- Epic: Bulk FHIR Group Export (ndjson, batch) + DocumentReference.Create for write-back
- athena: Changed Data Subscriptions (polling) or Event Notifications (webhooks)
- Both support FHIR R4 for reads
- athena proprietary APIs (Athenanet.MDP.*) offer richer data than FHIR alone
- athena Event Notifications is push-based (near real-time) — Epic has no webhook equivalent