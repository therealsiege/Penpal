## Overview

Two methods to write clinical notes back to Epic: FHIR DocumentReference.Create (simpler) or HL7v2 Incoming Transcriptions interface (richer document types).

## Method 1: FHIR DocumentReference.Create

MedScrub's primary write-back method. Write plain text clinical notes (SOAP notes) to encounters via FHIR R4 API.

- Create a DocumentReference resource with content attachment
- Link to encounter via context.encounter reference
- Supports plain text and structured content

## Method 2: HL7v2 Incoming Transcriptions

HL7v2 interface for filing transcribed clinical notes. More complex but supports richer document types and clinical workflows.

### Key Segments

- TXA-2: Document type (maps to Epic note types). Critical for correct filing.
- TXA-12: Unique document number (for updates/addendums)
- OBX-5: Note content (plain text or RTF)
- PV1: Patient visit info for encounter resolution

### Encounter Resolution

Epic resolves which encounter to file the note against using: Visit Number (PV1-19), CSN, date/time matching, or department. Most reliable: send CSN or Visit Number directly.

### TXA-2 Document Type Mappings

- Map your note types to Epic's document type codes
- Work with each customer to configure appropriate mappings
- Common types: Progress Note, H&P, Consultation, Discharge Summary

### Sandbox Testing

- Sandbox endpoint available for HL7v2 interface testing
- Test with sample patients in Vendor Services sandbox

## MedScrub Recommendation

Use DocumentReference.Create for SOAP notes — simpler, FHIR-native, works with existing OAuth 2.0 backend auth. Reserve HL7v2 for complex document workflows if needed later.