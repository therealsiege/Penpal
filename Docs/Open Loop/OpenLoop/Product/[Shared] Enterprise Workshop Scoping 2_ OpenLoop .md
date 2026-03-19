# Enterprise Workshop: OpenLoop

## Objective

Achieve proof of value by delivering a **business-ready MVP** within 1 week. This MVP should de-risk major elements of OpenLoop’s implementation. 

## Format

This workshop will be tailored to the specific enterprise needs of OpenLoop. It will primarily consist of working sessions and pair programming sessions, each of which will have a **specific, concrete deliverable** that accretes towards OpenLoop’s production application.

Each working session will typically be in the morning, with time afterwards for engineers to continue their implementation. **To get the most value from this workshop, Medplum recommends that managers allocate “deep work” time for their team following each session.**

## Clinical MVP

To orient workshop sessions and define scope, Medplum and OpenLoop will align on a “clinical MVP”, which is the target deliverable for the workshop. 

## *What is the minimal end-to-end clinical user workflow that you would like to build within 1 month?*

An OpenLoop client can:

* Access Openloop’s Main MWL Intake Questionnaire, which represents all the information Openloop needs to capture to see a patient   
* Configure client-specific MWL intake Questionnaire resources   
* View their patients’ Questionnaires and QuestionnaireResponses (multi-tenant isolation)  
* Be alerted by Openloop when Openloop changes their Main MWL Intake Questionnaire 

An Openloop developer/admin can:

* Write a Medplum Bot to convert a client-specific Questionnaire’s QuestionnaireResponse into Openloop’s Main MWL Intake Questionnaire’s QuestionnaireResponse  
* Write a Medplum Bot to convert Main MWL Intake QuestionnaireResponses into clinical FHIR resources   
* Provision new tenants for new clients 

## Sessions

| Session | Topics | Prerequisites | Deliverables (per Developer) | Motivation/Advanced Topics |
| :---- | :---- | :---- | :---- | :---- |
| Day 1: Capturing Intake | Questionnaires Terminology Services  | Read [FHIR Basics](https://www.medplum.com/docs/fhir-basics) Read [Search Documentation](https://www.medplum.com/docs/search/basic-search) Read [Questionnaires](https://www.medplum.com/docs/questionnaires)  Read [Terminology Services](https://www.medplum.com/docs/terminology/medplum-terminology-services)  | Create Openloop Main MWL Questionnaire Each developer picks a client-specific intake, and creates the corresponding Questionnaire  | How to store intake information in FHIR  [Questionnaire Structured Data Capture](https://www.medplum.com/docs/questionnaires/structured-data-capture) |
| Day 2: Parsing Client-Specific Intake to Main MWL Questionnaire and FHIR Clinical Data | Bots  Charting | Read [Bots](https://www.medplum.com/docs/bots/bot-basics)  Review [Charting Basics](https://www.medplum.com/docs/charting)  Read [PlanDefinition$apply](https://www.medplum.com/docs/api/fhir/operations/plandefinition-apply)  | Each developer creates Bots to parse client-specific QuestionnaireResponses into Main MWL Questionnaire  Create Openloop Main MWL Questionnaire Parsing Bot to convert Main MQL Questionnaire to FHIR  Instantiate intake clinical ops tasks via PlanDefinition  | How to normalize intake information into FHIR resources [Tasking for Clinical Operations](https://www.medplum.com/docs/careplans/tasks) |
| Day 3: Representing Tenants  | MSO and Multi-Tenancy  | Read [Multitenant Access Control](https://www.medplum.com/docs/access/multi-tenant-access-policy)  Review [MSO Example App Video](https://www.medplum.com/blog/multi-tenant-mso) | Decide on which roles are needed, and what data those roles need access to  Set up tenanting resources  | How to keep patient data separate between tenants while keeping templating resources consistent and customizable  |
| Day 4: Enrolling Clients and Practitioners  | Patient Compartment  Access Policies | Read [Assigning Data to Tenants](https://www.medplum.com/docs/access/multi-tenant-access-policy#step-2-assigning-data-to-tenants) Read [Access Policies with Tenant Parameterization](https://www.medplum.com/docs/access/multi-tenant-access-policy#create-accesspolicies-with-parameterized-variables) | Enroll example patients in tenants  Create AccessPolicies for Practitioners and Clients  | Enrolling patients in tenants and parameterizing access  |
| Day 5: Pre-filling Intake Questionnaires for existing patients  |  | Optional Topics:  [Appointment Booking](https://www.medplum.com/docs/scheduling#key-resources) in Medplum [Multiplayer Chart Editing](https://www.medplum.com/blog/plumcon-2025-materials#seen-health) and [Websocket Connections](https://www.medplum.com/docs/react/use-subscription) |  | Consult on pre-filling QuestionnaireResponses for existing patients in new verticals  Go over real-time intake validation infrastructure  |

## Open Questions

#### Intake 

- Does disqualification validation (i.e. determining if the intake responses include disqualifying information) happen server-side or application-side currently?   
- What powers the Intake UI currently? Is logic handled server-side or application-side? Some other framework? 

#### Tenanting

- What kinds of roles will need access to Medplum data? Assuming:   
  - Practitioners   
  - Clients   
  - Patients (?)   
- For a given client, what patient data should that client have access to? All PII, no PHI? Some PHI?   
- For a given practitioner, which patients’ data should that practitioner have access to? Patients that practitioner is seeing? All patients for clients that the practitioner is assigned to? Some other cut of patients? 

## Recordings

# **Openloop Workshop Day 1 \- March 16**

[**VIEW RECORDING \- 53 mins (No highlights)**](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16)

## **Meeting Purpose**

[Onboard the OpenLoop team to Medplum and FHIR for a new project.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=587.0)

## **Key Takeaways**

* [**Medplum is a FHIR-native platform** that solves the "terrible choice" between inflexible EHRs and building compliant software from scratch.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=634.0)  
* [**The immediate task is to model OpenLoop's Medical Weight Loss questionnaire** in Medplum, replacing the current Healthy storage.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=2205.0)  
* [**FHIR data modeling uses three pillars:** `Structure` (resources), `Terminology` (codes/ValueSets), and `Lifecycle` (resource states).](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1030.0)  
* [**The team will use the Medplum TypeScript SDK** for API access, leveraging its built-in auth and convenience.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1459.0)

## **Topics**

### **The Problem: Inflexible EHRs vs. Building from Scratch**

* [Healthcare developers face a "terrible choice":](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=634.0)  
  1. [**Inflexible EHRs:** Poor APIs, generic UIs, and proprietary data models.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=634.0)  
  2. [**Building from Scratch:** High cost, long timelines, and complex compliance.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=668.0)  
* [Medplum offers a middle path: a developer-friendly, FHIR-native platform.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=683.0)

### **The Solution: Medplum Platform Overview**

* [**Architecture:** A FHIR data store with built-in access policies, subscriptions, and bots (AWS Lambdas).](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=695.0)  
* [**API:** All data is accessible via a FHIR REST API or GraphQL endpoint.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1397.0)  
* [**SDK:** A TypeScript SDK wraps the REST API, simplifying development.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1459.0)  
* [**Component Library:** A React Storybook library is available for building UIs.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=712.0)

### **The Standard: FHIR Basics**

* [**FHIR (Fast Healthcare Interoperability Resources):** An open-source spec for healthcare data.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=829.0)  
* [**Core Benefits:**](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=847.0)  
  * [**Interoperability:** Enables seamless data exchange with partners (labs, pharmacies).](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=847.0)  
  * [**Complexity:** Handles complex healthcare relationships (e.g., parent-child data access).](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=881.0)  
* [**Data Modeling Pillars:**](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1030.0)  
  * [**Structure:** Which FHIR resources to use (e.g., `Patient`, `Observation`).](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1035.0)  
  * [**Terminology:** How to tag data with standard codes (e.g., LOINC, ICD-10) for analysis.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1035.0)  
  * [**Lifecycle:** How to represent resource states as they change in a workflow.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1035.0)  
* [**Resource Types:**](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1113.0)  
  * [**Request:** "Please do this" (e.g., `MedicationRequest`).](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1113.0)  
  * [**Event:** "This happened" (e.g., `Observation`, `Encounter`).](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1113.0)  
  * [**Definition:** "This is a template" (e.g., `Questionnaire`, `PlanDefinition`).](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1113.0)

### **Hands-On: Modeling the Medical Weight Loss Questionnaire**

* [**Goal:** Replace the current Oaks intake funnel's Healthy storage with Medplum.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=2205.0)  
* [**Process:**](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=2321.0)  
  1. [**Define Structure:** Use a `Questionnaire` resource as the template for the intake form.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=2332.0)  
  2. **Define Terminology:** For choice-based questions (e.g., comorbidities), create custom `ValueSet` resources.  
     * [**Tool:** The `medplum-value-set-selector` example app simplifies creating these ValueSets from standard code systems (e.g., ICD-10).](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=2700.0)  
  3. [**Record Response:** Store a patient's completed form as a `QuestionnaireResponse` resource.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=2332.0)  
* [**Implementation Note:** The team will reuse the Oaks funnel's client-side rendering and validation logic, focusing only on the final data post to Medplum.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=2580.0)

## **Next Steps**

* [**All Developers:**](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=3000.0)  
  * [Clone the Medplum repo and run `npm run build` and `npm ci`.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=1705.0)  
  * [Create a `Questionnaire` resource in the "OpenLoop dev" project to model the Medical Weight Loss intake form.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=3004.0)  
  * [Create any necessary custom `ValueSet` resources for choice-based questions.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=2696.0)  
  * [Post questions to the shared Slack channel.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=3089.0)  
* [**Cristina:**](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=3079.0)  
  * [Add all workshop participants to the shared Slack channel.](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?tab=summary&timestamp=3079.0)

## **Action Items**

* **Send FHIR basics/search/Questionnaire/terminology docs to Clint** \- [WATCH (5 secs)](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?timestamp=1875.9999)  
* **Ensure team builds Medplum Questionnaire for MWL intake; create 1 QuestionnaireResponse** \- [WATCH (5 secs)](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?timestamp=2989.9999)  
* **Add all attendees to shared Slack channel** \- [WATCH (5 secs)](https://fathom.video/share/DZdavw6kc_x8kN8F_BYMyNCh2aRThs16?timestamp=3068.9999)

