# eSpiral Healthcare API Call Report

## Overview

eSpiral Healthcare is a resident manager application that integrates with Epic’s Electronic Health Record (EHR) system through SMART on FHIR standards. The application launches within Epic’s environment using OAuth 2.0 authentication, retrieves patient clinical data through FHIR R4 APIs, and provides clinical decision support through CDS Hooks. The primary workflow involves practitioners launching the app from within Epic, authenticating via SMART on FHIR, viewing patient history and labs (H&L) in a spiral visualization, and receiving advisory cards directly in the Epic interface to support team-based learning and pre-visit chart reviews.

## SMART on FHIR Authentication

The application implements a confidential client OAuth 2.0 flow with the following characteristics:

**Authentication Flow:**
1. **Launch** (`fhir.auth.launch.tsx`): Receives Epic launch token, decodes JWT to identify issuer (Epic App Orchard or Infirmary Health), fetches FHIR metadata to discover authorization endpoints
2. **Authorization** (`fhir.auth.redirect.tsx`): Exchanges authorization code for access token, retrieves practitioner identity from ID token, fetches initial patient data

**Scopes Requested:**
- `launch` - Context for EHR launch
- `openid` - OpenID Connect for user identity
- `fhirUser` - Access to the current user’s FHIR resource
- `Patient/*.read` - Read access to all Patient resource data
- `Practitioner/*.read` - Read access to all Practitioner resource data
- `Condition/*.read` - Read access to Condition (problem list) resources
- `Observation/*.read` - Read access to Observation resources

**Security Implementation:**
- Uses PKCE (Proof Key for Code Exchange) for enhanced security
- Implements proper state parameter for CSRF protection
- Stores access tokens securely with expiration tracking
- No refresh token implementation observed (sessions expire with token)

## FHIR Resource Calls

[Untitled](../References/eSpiral%20Healthcare%20API%20Call%20Report/Untitled.csv)

### Alternative API Strategies

The application implements sophisticated fallback mechanisms when primary FHIR endpoints are inaccessible (particularly for organizations that restrict Condition resource access):

1. **Primary**: Direct Condition resource query
2. **Fallback 1**: Observation with LOINC code 11450-4 (Problem list)
3. **Fallback 2**: List resource with problem list category
4. **Fallback 3**: Encounter diagnoses and reason codes
5. **Fallback 4**: DiagnosticReport conclusion codes

This multi-layered approach ensures the application can function across different Epic configurations and permission models.

## CDS Hooks Usage

**Hook Implementation:** `patient-view`

**Endpoint:** `/fhir/cds/advisory`

**Service Configuration:**
- **ID**: `advisory`
- **Title**: “eSpiral Advisory”
- **Description**: “Team-based learning through patient chart review”
- **Prefetch Requirements**:
- `Patient/{{context.patientId}}` - Current patient data
- `Practitioner/{{context.userId}}` - Current practitioner data

**Card Generation Process:**
1. Receives patient context from Epic during patient chart opening
2. Queries internal advisory database for relevant educational content
3. Generates CDS cards with clinical advisories based on patient conditions
4. Returns cards with proper indicators (info/warning/critical)
5. Includes override reasons for user feedback (“Helpful”/“Not Helpful”)
6. Stores card interactions for analytics and improvement

**Response Format:**
Cards include summary, detail, source attribution, and links to the full eSpiral application for deeper analysis. The system maintains state to support Epic’s test harness requirements (GET request support).

## Rationales (“Why these calls matter”)

- **Patient Demographics** (Patient resource): Essential for accurate patient identification and preventing medical errors. Displayed prominently to ensure providers are reviewing the correct patient’s chart.
- **Problem List** (Condition/alternatives): Forms the core of the spiral visualization, allowing residents to quickly understand the patient’s medical complexity and comorbidities. Critical for pre-visit preparation and identifying potential drug interactions or complications.
- **Chief Complaint** (multiple sources): Provides immediate context for why the patient is seeking care, helping prioritize review of relevant conditions and guiding the clinical discussion during rounds.
- **Practitioner Identity** (Practitioner/PractitionerRole): Ensures proper attribution of actions, maintains audit trails, and personalizes the learning experience based on the user’s role and specialty.
- **Claims Data** (ExplanationOfBenefit): Offers insights into the patient’s healthcare utilization patterns and helps identify gaps in care or unreported conditions from billing diagnoses.
- **CDS Advisory Cards**: Delivers just-in-time education directly within the Epic workflow, supporting evidence-based practice and continuous learning without disrupting clinical care.

## Non-FHIR External APIs

| Service | Endpoint | Purpose | PHI Transmitted |
| --- | --- | --- | --- |
| **Mailchimp** | `api.mailchimp.com/3.0/lists/*/members` | Newsletter subscription for waitlist | No - only contact information for marketing |

## Security & Compliance Notes

### PHI Data Flow

1. **Inbound**: PHI flows from Epic to eSpiral during SMART launch and FHIR API calls
2. **Storage**: Patient data is stored in encrypted AWS DynamoDB tables with row-level access controls
3. **Display**: PHI is rendered client-side with no external analytics or tracking on patient pages
4. **Audit**: All data access is logged with practitioner ID and timestamp

### Access Control

- **Scope Enforcement**: Application only requests read-only scopes, preventing data modification
- **Token Management**: Access tokens expire per Epic’s configuration (typically 60 minutes)
- **User Context**: Each session is bound to a specific practitioner and patient context
- **No Delegation**: Application does not support delegated access or proxy users

### Data Minimization

- Only fetches data necessary for the spiral visualization and advisory generation
- Does not persist full FHIR resources, only extracted relevant fields
- Implements automatic data expiration policies in DynamoDB

## Gaps or TODOs

1. **Refresh Token Support**: Current implementation doesn’t handle token refresh, requiring re-authentication after token expiration. Consider implementing refresh token flow for longer sessions.
2. **Bulk Data Access**: No implementation of FHIR Bulk Data Access API, which could improve performance for population health analytics.
3. **Subscription/Webhooks**: No real-time data updates via FHIR Subscriptions. Charts show point-in-time data from launch.
4. **Write Operations**: Application is read-only. Future versions might benefit from writing back educational notes or care recommendations.
5. **Additional Resources**: No integration with MedicationRequest, AllergyIntolerance, or Immunization resources which could enhance clinical decision support.
6. **Error Handling**: While fallback strategies exist for Condition access, similar redundancy could be implemented for other resources.
7. **Performance Optimization**: Consider implementing resource bundling or GraphQL for FHIR to reduce API call volume.
8. **Consent Management**: No explicit consent resource checking observed. Verify if Epic handles this transparently or if explicit consent validation is needed.

## Epic Open API Compliance

All FHIR resources accessed by eSpiral are documented in Epic’s Open FHIR API:
- ✅ Patient, Practitioner, PractitionerRole
- ✅ Condition, Observation, Encounter
- ✅ ServiceRequest, DiagnosticReport
- ✅ ExplanationOfBenefit, List
- ✅ CDS Hooks (patient-view)

The application correctly implements Epic’s vendor services endpoints and follows Epic’s guidelines for SMART on FHIR applications.

---

*Generated: January 2025 | eSpiral Healthcare | Version: Based on current codebase analysis*