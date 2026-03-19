# Security & Compliance Checklist

This document outlines mandatory security requirements and validation steps for all new applications, major releases, and critical system changes.

**Note:** If this is an AI-enabled solution (including GenAI/LLM features), the [**OpenLoop AI Use Case Intake Form**](https://docs.google.com/spreadsheets/d/1q4DicFwqLLL2hfgmAURqDVEuYqm3aBUd/edit?usp=sharing&ouid=105074172918253972424&rtpof=true&sd=true) must be completed and submitted with the **evidence/approvals** for this checklist.

## 1\. Data Classification

Clearly define and document the sensitivity of all data being handled:

* **PII** – Personally Identifiable Information  
* **PHI** – Protected Health Information  
* **PCI** – Payment Card Information

Ensure data handling, storage, and transmission controls align with classification level and regulatory requirements.

If this is an application, release, or system change that will process personal information of any kind, the OpenLoop Privacy Impact Assessment form must be filled out as well.

## 2\. Threat Modeling

Conduct a formal threat modeling session (e.g., **STRIDE**) to:

* Identify potential attack vectors  
* Evaluate trust boundaries  
* Assess data flows  
* Document mitigations for identified risks

Threat modeling must be completed prior to production deployment.

## 3\. Authentication & Authorization

### Identity & Access Management

* Integrate with **Okta** for centralized authentication  
* Enforce **Least Privilege** access principles  
* Require **Multifactor Authentication (MFA)** for all user accounts

### Privileged Access Management

* Implement **Privileged Access Management (PAM)** for administrative accounts  
* Require **MFA for all administrative access**  
* Regularly review privileged access assignments

## 4\. Encryption Standards

Ensure encryption is enforced at all times:

* **Data-at-Rest:** AES-256  
* **Data-in-Transit:** TLS 1.2 or higher

Verify encryption configurations during architecture review and before release.

## 5\. Secure Development Practices

### SAST (Static Application Security Testing)

* Automated code scanning for vulnerabilities (e.g., SQL Injection, XSS)  
* **No new critical or high vulnerabilities introduced**

### SCA (Software Composition Analysis)

* Scan for vulnerable open-source libraries  
* Validate license compliance  
* **No new critical or high vulnerabilities introduced**

### Secret Management

* Verify no API keys, passwords, or certificates are hardcoded  
* Use approved secret management solutions

### DAST (Dynamic Application Security Testing)

* Run automated scans against the application in staging  
* **No new critical or high vulnerabilities introduced**

### Peer Review

* Mandatory **security-focused code review** for all critical path changes

## 6\. Endpoint & Runtime Protection

* Ensure **Falcon or Wiz EDR/Runtime Sensor** is installed and operational  
* Confirm sensor health prior to production release

## 7\. Vulnerability Management

* Ensure all applications and hosts are scanned via:  
  * **Wiz**  
  * **CrowdStrike Spotlight**  
* Remediate findings according to severity-based SLAs

## 8\. Logging & Monitoring

* Enable comprehensive **audit logging** (who, what, when)  
* Forward logs to the **SIEM**  
* Validate log integrity and retention policies

## 9\. Penetration Testing

* Schedule formal penetration testing for:  
  * Major new releases  
  * Significant architectural changes  
* Track and remediate findings prior to full production rollout

## 10\. Domain Registration & CTI

* Report any new domains to: [**SecOps@openloophealth.com**](mailto:SecOps@openloophealth.com)  
* Ensure inclusion in the Cyber Threat Intelligence (CTI) monitoring program

## 11\. Data Protection

* Encrypt data at rest and in transit with at least AES-256

12\. Third-Party & Data Sharing Governance

* Identify all new or changed vendors, subprocessors, and external integrations.  
* Confirm required agreements are executed (e.g., BAA/DPA/data sharing terms), as applicable.  
* Record approved data sharing purpose, permitted uses, and retention/return requirements.

13\. Customer Terms & Approved Claims

* Confirm customer terms are finalized and aligned to the product behavior being released.  
* Review and approve any “HIPAA/security/privacy” statements and customer-facing commitments.

14\. Consent & User Transparency

* Inventory tracking/recording features enabled by the release (analytics, session replay, call recording, etc.).  
* Implement required notices and consent flows for customer-facing experiences.  
* Test opt-out/withdrawal mechanisms and document evidence of expected behavior.

15\. Data Rights & Retention

* Define retention and deletion requirements for all new or changed data types.  
* Implement deletion and vendor offboarding procedures (return/destroy), where applicable.

16\. Resilience & Operational Readiness

* Define availability targets and service tier for the system or feature being released.  
* Test rollback and recovery procedures for stateful or high-impact changes.

17\. Consumer Protection & Disclosures

* Substantiate health-related or performance claims with documented supporting evidence.  
* Include required disclosures for testimonials, endorsements, or promotions (Federal Trade Commission requirements as applicable).

18\. Accessibility (Customer-Facing)

* Meet WCAG 2.1 AA for customer-facing flows changed by the release.  
* Attach accessibility test evidence and document known issues with severity.  
* Assign a remediation owner and target date for any non-blocking findings.

