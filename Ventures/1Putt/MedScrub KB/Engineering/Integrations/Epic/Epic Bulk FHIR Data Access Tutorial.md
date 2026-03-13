## Background

The FHIR Bulk Data Access specification (Flat FHIR) gives healthcare organizations the ability to provide external clients with large amounts of data for a population of patients formatted as FHIR resources. Epic supports only Group Export (not system-level). Version 1.0.1 of the spec for R4.

## Good Use Cases

- One-time load of data in preparation for continuous exchange using other methods
- Monthly loads of a targeted set of data (e.g., patient demographics and allergies)
- Weekly export of dynamic patient groups (e.g., discharged patients with certain diagnosis)
- Weekly loads of small patient populations (<100) for registry submissions

## Poor Use Cases

- Data synchronization with data warehouses
- Periodic loads of large amounts of clinical data
- Incremental data loads

## Sandbox Configuration

Sandbox base URL:

```
https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/R4
```

Sandbox Group FHIR ID:

```
erd-k5wp0SqFCjLk8D7EiLeywKzgTtejnBzjrlbcx3Vs3
```

## Kicking Off a Bulk Data Request

Basic export (all default USCDI resources):

```
GET {base}/Group/erd-k5wp0SqFCjLk8D7EiLeywKzgTtejnBzjrlbcx3Vs3/$export

Headers:
  Accept: application/fhir+json
  Prefer: respond-async
```

With _type filter (recommended — limits to specific resources):

```
GET {base}/Group/{groupFhirId}/$export?_type=Patient,MedicationRequest,Medication
```

### Parameters

- _type — comma-delimited list of FHIR resource types. Limits scope, improves response time. Only way to get Binary resources.
- includeAssociatedData — set to "LatestProvenanceResources" to include Provenance
- _typeFilter — FHIR search queries to filter results (Nov 2023+). Must use with _type. URL-encode reserved chars.

### _typeFilter Examples

Inpatient medications only:

```
/$export?_type=MedicationRequest&_typeFilter=MedicationRequest%3Fcategory%3Dinpatient
```

Vital signs from 2023 + lab results from 2022+ + active problems:

```
/$export?_type=Observation,Condition&_typeFilter=Observation%3Fcategory%3Dvital-signs%26date%3D2023,Observation%3Fcategory%3Dlaboratory%26date%3Dge2022,Condition%3Fcategory%3Dproblem-list-item%26clinical-status%3Factive
```

### Requirements & Restrictions

- Default: one request per group per client per 24 hours
- 14-day window to download results before auto-deletion
- Requests are NOT incremental — all data collected before any returned
- Must be authorized for Bulk Data APIs + R4 search for each requested resource type

## Checking Request Status

The kick-off response's Content-Location header contains the status URL:

```
GET https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/BulkRequest/{requestId}
```

- Empty body = still processing. X-Progress header shows approximate progress.
- Poll every 10 min for <100 patients, every 30 min for >100, or use exponential backoff
- Completed response contains output[] with file URLs per resource type

## Viewing Resource Files

- Separate file per resource type (ndjson format)
- Max ~3000 resource instances per file (splits into multiple if larger)
- Same client+user that kicked off must request files
- Files don't differentiate by patient — all patients in each resource file

## Error Codes

- 59130 — Resource not authorized (client lacks permission)
- 59100 — Unsupported parameter in request
- 59136 — Unsupported resource type
- 59176 — Resource too large for ndjson (use Binary.Read separately)
- 59007 — File auth failed (no user associated with request)

## Deleting Requests

DELETE same URL as status API. Epic recommends deleting after retrieving all files to free storage. Deleting before completion doesn't count against request limit.

## Best Practices

- Always use _type to limit resources — decreases response time and storage
- Use _typeFilter to narrow further (e.g., only active conditions)
- Delete requests after retrieving data
- Groups of 1000 patients or fewer recommended
- In production, customers generate Group FHIR IDs via utility — work with them on patient criteria