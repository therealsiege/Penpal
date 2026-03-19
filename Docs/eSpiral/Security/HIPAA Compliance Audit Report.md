# HIPAA Compliance Audit Report

**Audited Entity**: eSpiral Healthcare

**Auditor**: Grizzly Development Solutions

**Audit Date**: May 26, 2025

**Prepared by**: Grizzly Development Solutions Compliance Team

**Report Version**: 1.1

---

## **1. Overview**

---

Grizzly Development Solutions conducted a focused HIPAA compliance audit of eSpiral Healthcare, a healthcare technology company developing clinical decision support tools that integrate with EHR systems using FHIR and CDS Hooks standards.

The purpose of the audit was to evaluate eSpiral’s implementation of safeguards required under the HIPAA Security and Privacy Rules, with consideration given to the company’s size and operational structure. The audit included review of cloud infrastructure, access controls, data protection, and supporting documentation. eSpiral leverages Vanta to automate monitoring and evidence collection.

### **2. Audit Scope**

---

**In Scope:**

- AWS infrastructure (Lambda, API Gateway, S3, DynamoDB)
- Authentication and access control (Auth0, OAuth 2.0)
- Use of FHIR and CDS Hooks protocols
- Security policies and supporting documentation
- Workforce training records
- Vendor and BAA management
- Use of compliance monitoring tools (Vanta)
- CI/CD pipelines, build tooling, and release processes
- Management of software dependencies, including vulnerability scanning and version control

**Out of Scope:**

- Physical security (fully remote team)

## **3. Summary of Observations**

| **Area** | **Status** | **Notes** |
| --- | --- | --- |
| **Risk Analysis** | ✅ Satisfactory | Risk register is maintained in Vanta. Categories and mitigation steps are documented. |
| **Access Management** | ✅ Satisfactory | Auth0 is configured with SSO and MFA. Access permissions are reviewed regularly. |
| **Audit Logging** | ✅ Satisfactory | Logging is enabled across AWS services. Logs are retained and reviewed as needed. |
| **Data Protection** | ✅ Satisfactory | Data is encrypted at rest and in transit. No unnecessary storage of PHI was identified. |
| **Application Protocols** | ✅ Satisfactory | FHIR and CDS Hooks are implemented according to standard specifications. |
| **Workforce Training** | ✅ Satisfactory | All personnel have completed required HIPAA and security training. Completion is tracked in Vanta. |
| **Incident Response** | ✅ Satisfactory | A written response plan is in place, with roles and procedures clearly defined. |
| **Contingency Planning** | ✅ Satisfactory | Backups are configured and managed. Recovery procedures are documented and accessible. |
| **Vendor Management** | ✅ Satisfactory | Business Associate Agreements are executed for applicable vendors. Vendor access is controlled and reviewed. |
| **CI/CD & Software Supply Chain** | ✅ Satisfactory | CI/CD pipelines are in use. Tools are in place to check for dependency vulnerabilities. Package versions are controlled, and deployment processes are documented. |

## **4. Recommendations**

---

**High Priority:** Document and test a formal disaster recovery process, including periodic restore testing.

**Medium Priority:** Conduct and document an incident response simulation (e.g. breach tabletop exercise).

**Low Priority:** Formalize vendor risk assessments in addition to maintaining BAAs.

## **5. Conclusion**

---

eSpiral Healthcare has implemented controls consistent with HIPAA’s Security and Privacy Rule requirements, considering the current size and scope of the organization. Standards-based interoperability, cloud-native architecture, and automated compliance tooling reduce operational and regulatory risk.

Grizzly Development Solutions considers eSpiral to be **substantially compliant** as of the date of this assessment, with minor gaps to address in contingency and response procedures.