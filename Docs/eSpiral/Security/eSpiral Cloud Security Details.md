# eSpiral Cloud Security Details

Hi Terry, 

Yes attached are the signed copy of the checklist as well as a few diagrams. 

Regular vulnerability scans and penetration tests:

- **Vulnerability** **scans** are run in two ways: 
1. We leverage **GitHub dependabot tooling** to perform daily scans. These scans create GitHub issues for out team to remedy. 
2. These vulnerability checks also run on **every** pull request into the **main** branch which deploys to production.
- **Penetration** **testing** is handled with the help of Aikido ([https://www.aikido.dev/](https://www.aikido.dev/)), we run these quarterly and on major releases (adhoc). Aikido is installed in our cloud infrastructure and provides insights/fixes for cloud and application needs.
- Data
    - All data is treated as PHI, encrypted in transit and at rest. Almost all of the data is cleared when the session is closed but some can remain encrypted in storage for up to 1 year. Data is stored encrypted in DynamoDB, and S3 storage (larger data)
    - The data in the EHR is not modified by eSpiral, eSpiral doesn’t ask for write access to FHIR resources. Advisories are temporarily stored in eSpiral encrypted storage until viewed or 1 year from creation.

Vanta supports our HIPAA compliance efforts

- The third party risk assessment is in progress and ends July 1,2025. We are without a report until then.

We are awaiting the audit to finalize with HIPAA, we have not seen the need for GDPR, FDA or Cures Act. Please advise if you see the need for additional compliance validations.

Clint Johnson

eSpiral Healthcare

```
flowchart TB
 subgraph Serverlesss["🌀 eSpiral"]
        Auth["FHIR Oauth Authorizer<br>(Lambda)"]
        Lambda["SSR App<br>(Lambda)"]
  end
 subgraph subGraph1["Encrypted"]
        DynamoDB[("DynamoDB")]
        S3[("S3")]
        Secrets[("Secrets Manager")]
  end
 subgraph subGraph2["🔒 AWS Cloud VPC"]
        API["API Gateway"]
        Serverlesss
        subGraph1
  end
    User(["Clinician"]) <--> EHR["Infirmary<br>Epic EHR"]
    EHR <-- HTTPS --> API
    API <-- Validate JWT --> Auth
    Auth <--> Secrets
    Lambda <-- Valid Requests --> API
    Lambda <-- AWS SDK V3 --> S3 & DynamoDB

     DynamoDB:::encrypted
     S3:::encrypted
     Secrets:::encrypted
    classDef encrypted fill:#f9f,stroke:#333,stroke-width:2px

```