# Installation Guide V2

The eSpiral chart review tool can now be used in Epic based EHR systems upon request. The following steps will help you install the application and create the integration records necessary for launch within the Epic EHR. Please ensure your organization has agreed to the open.epic API Subscription Agreement, and that you have security access to “Purchase Apps”.  For more information see the Potential Prerequisites section at the bottom.

---

### Step 1: Download eSpiral

First, you’ll need to goto the Epic on FHIR portal located at [fhir.epic.com](http://fhir.epic.com) and sign in with your Epic UserWeb credentials. 

---

### Step 2: Confirm Download

To confirm the client record was successfully downloaded, return to the [Downloads page](https://fhir.epic.com/Download). The eSpiral application should now appear on this page along with a request status out to eSpiral, which should be automatically approved and available for configuration of the integration records.  This download essentially syncs the app's client record to the community member's Epic environments, allowing APIs listed on that client to be authorized by their server.

Epic community members can see the "Notes for Epic Customers" section at the top of the page for details on how to verify that a client record now exists in their Epic environments.

---

### Step 3: Create FDI Records

FDI records let Epic integrate with third-party application software. These records are most commonly used to launch Smart on FHIR applications from Hyperspace. Using a similar approach, you can launch eSpiral by creating a new FDI record and linking it to the activity records below. The FDI record contains the URL string that launches eSpiral from Hyperspace.

Open the Web Integration activity and create and name a new Integration (“eSpiral on FHIR Launch”).
Configure your new record with the following settings:

### eSpiral Smart Launch Integration

eSpiral is deployed in two steps, one for the Smart Launch App and another to enable the practice advisory module which relies on CDS Hooks.

| Integration Type | Smart on FHIR |
| --- | --- |
| URL | [https://espiral.healthcare/fhir/auth/launch](https://espiral.healthcare/fhir/auth/launch) |
| Client ID (Production) | `e56295d1-728a-4206-b096-8d0530710277` |
| Client ID (Sandbox) | `af25285e-eba8-4043-91ab-c4cac0353c51` |
| Launch Type | External Window |
| Authentication Method | Smart on FHIR |
| Context tokens | `patientId=%EPTID%&userId%EPICUSERID%` |

### **CDS Hooks Service Integration**

| Endpoint | `https://espiral.healthcare/fhir/cds/advisory` |
| --- | --- |
| Client ID | `e56295d1-728a-4206-b096-8d0530710277` |

**Prefetch** (Service Discovery: `https://espiral.healthcare/fhir/cds`)

```json
{
  "status": "ok",
  "code": 200,
  "services": [
    {
      "hook": "patient-view",
      "title": "eSpiral Advisory",
      "description": "eSpiral Advisory",
      "id": "advisory",
      "prefetch": {
        "patient": "Patient/{{context.patientId}}",
        "practitioner": "Practitioner/{{context.userId}}"
      }
    }
  ]
}
```

**JWT Claims**

| aud | `https://espiral.healthcare/fhir/cds` |
| --- | --- |
| iss | [`https://ssproxyprod.infirmaryhealth.org/epicFHIR/api/FHIR/R4`](https://ssproxyprod.infirmaryhealth.org/epicFHIR/api/FHIR/R4) |
| sub | `2e7f9cb7-8e11-40ab-a27b-50fcf82b7a29`  |

**Context**

patient: `%EPTID%`, practitioner: `%USERPROVFHIRID%`, encounter: `%CSN%`, dob: `%DOB%`, 

userId: `%SYSLOGIN%`

**We will need the following:**

- The jku (JSON Web Key Set URL)

---

## Reference

### **Potential Prerequisites**

Note: To download client records for additional apps, the community member's staff with the "Purchase Apps" security point can search using the app’s client ID, which must be obtained from the developer.

Note: Epic members who wish to use the FHIR APIs with a third-party application registered on the Epic on FHIR website must sign the open.epic API Subscription Agreement.

### Links

- [Epic Documentation](https://fhir.epic.com/Documentation?docId=epiconfhirrequestprocessstepbystep)
- [HL7 Guide](https://build.fhir.org/ig/HL7/smart-app-launch/app-launch.html)