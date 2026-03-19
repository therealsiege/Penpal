# CDS Hooks & EHR Events

## **Origin: The PAMA Act of 2014**

The **Protecting Access to Medicare Act (PAMA) of 2014** laid the groundwork for **Clinical Decision Support (CDS) interventions** by requiring providers to consult CDS mechanisms when ordering advanced imaging services. This legislation opened the door for innovations in **CDS Hooks** and **Practice Advisories**—tools that help providers make informed, compliant, and data-driven decisions.

## **What are CDS Hooks?**

Imagine you’re a primary care physician reviewing a patient’s chart, and a non-intrusive notification pops up: “This patient is overdue for a diabetes screening.” That’s the power of **CDS Hooks**.

CDS Hooks are web-based callbacks triggered by clinician workflow events (e.g., opening a patient’s chart, prescribing a medication). They send real-time **FHIR-based decision support insights** directly into the provider’s workflow.

### **How CDS Hooks Work**

1. **Trigger Event**: The provider performs an action (e.g., opens a patient chart, prescribes a drug, orders a lab test).
2. **FHIR Query**: The EHR sends patient-specific context to a CDS service.
3. **CDS Service Response**: The service evaluates the data and returns a **card-based recommendation**, which can be informative (e.g., an alert) or actionable (e.g., a suggested order).
4. **EHR Displays the Card**: The provider sees the recommendation within the EHR UI.

## **What are Practice Advisories?**

Practice advisories are **configurable CDS notifications** that surface **clinical recommendations** based on predefined rules. Unlike hard stops or intrusive alerts, practice advisories allow providers to make informed decisions without workflow disruptions.

### **How CDS Hooks and Practice Advisories Work Together**

- **CDS Hooks enable event-driven interoperability**, triggering advisories when predefined clinical conditions are met.
- **Practice advisories deliver tailored recommendations** within the EHR UI, minimizing provider abrasion.
- **Write calls from practice advisories** allow structured clinical actions (e.g., ordering a test, prescribing a medication) with minimal clicks.

## **Hurdles to Widespread Adoption**

### **1. Lack of Mainstream Support**

While **Josh Mandel**, the creator of CDS Hooks, has done a fantastic job promoting the standard, **broad community adoption has been slow**. The best resource today remains [CDS Hooks](https://cds-hooks.org/).

### **2. Lack of EHR Vendor Testing Support**

Most major EHRs, including **Epic**, have **limited vendor testing environments** for CDS Hooks-enabled apps. Our experience required **$380/hour for screen-sharing tests using Epic’s Vendor Services sandbox**, which was critical before deploying our app into provider networks.

### **3. EHR Vendor-Specific Implementation Variability**

The phrase **“Once you’ve seen one Epic instance, you’ve seen one Epic instance”** couldn’t be more true when working with **CDS Hooks, Practice Advisories, and Epic’s HCC Registry**.

- **CDS Hooks allow advisory cards**, but **Epic can also generate practice advisories natively**.
- This can cause **collisions** and **configuration nuances** that only surface after an initial install.

## **HTI-2 & The Future of CDS Hooks**

The **HTI-2 (Health Data, Technology, and Interoperability) Rule** from **ONC** will **mandate broader support for CDS Hooks and practice advisories**, making EHR vendors more accountable for adoption.

We strongly advocated for **more vendor-supported testing tools and documentation** in our public comment:
➡️ [Read our HTI-2 comment here](https://www.regulations.gov/comment/HHS-ONC-2024-0010-0022).

## **Final Thoughts**

Both SMART on FHIR and CDS Hooks represent the next evolution of **seamless, intelligent, and user-friendly healthcare interoperability**.

- **SMART on FHIR** makes EHR-integrated apps more accessible.
- **CDS Hooks & Practice Advisories** deliver timely, relevant guidance directly within provider workflows.

As **FHIR adoption accelerates**, leveraging these technologies will be **critical in reducing clinician burden and improving patient care**.

# **Building with CDS Hooks - 10 Things I Wish I Knew Beforehand**

### **Origin: The PAMA Act of 2014**

The **Protecting Access to Medicare Act (PAMA) of 2014** laid the groundwork for **Clinical Decision Support (CDS) interventions** by requiring providers to consult CDS mechanisms when ordering advanced imaging services. This legislation opened the door for innovations in **CDS Hooks** and **Practice Advisories**—tools that help providers make informed, compliant, and data-driven decisions.

### **What are CDS Hooks?**

Imagine you’re a primary care physician reviewing a patient’s chart, and a non-intrusive notification pops up: “This patient is overdue for a diabetes screening.” That’s the power of **CDS Hooks**.

CDS Hooks are web-based callbacks triggered by clinician workflow events (e.g., opening a patient’s chart, prescribing a medication). They send real-time **FHIR-based decision support insights** directly into the provider’s workflow.

### **How CDS Hooks Work**

1. **Trigger Event**: The provider performs an action (e.g., opens a patient chart).
2. **FHIR Query**: The EHR sends patient-specific context to a CDS service.
3. **CDS Service Response**: The service evaluates the data and returns a **card-based recommendation**, which can be informative (e.g., an alert) or actionable (e.g., a suggested order).
4. **EHR Displays the Card**: The provider sees the recommendation within the EHR UI.

## **What are Practice Advisories?**

Practice advisories are **configurable CDS notifications** that surface **clinical recommendations** based on predefined rules. Unlike hard stops or intrusive alerts, practice advisories allow providers to make informed decisions without workflow disruptions.

### **How CDS Hooks and Practice Advisories Work Together**

- **CDS Hooks enable event-driven interoperability**, triggering advisories when predefined clinical conditions are met.
- **Practice advisories deliver tailored recommendations** within the EHR UI, minimizing provider abrasion.
- **Write calls from practice advisories** allow structured clinical actions (e.g., ordering a test, prescribing a medication) with minimal clicks.

## Skip to 2024

I was **showing off some FHIR capabilities** with a pre-visit chart review tool we had built. It **sparked interest** and led to me spearheading a **FHIR application** to help them close gaps in value-based care operations.

The product team **wanted a SMART on FHIR app**—great, I’ve done that before.

But then the documentation they gave me leaned towards **custom Practice Advisories**, which I had not built before.

> “We want to wow our Epic customers by showing them the art of the possible.”
> 

That’s when **CDS Hooks-enabled Practice Advisories** entered the picture. It seemed **like I had a glimpse into the future of what HL7v2 could be**—triggering alerts and decision support **automatically**, based on provider actions.

Eager to **dive in headfirst**, I quickly learned that **CDS Hooks is both incredible and uniquely painful**.

---

## **Here are 10 things I wish I knew before getting too far.**

### 1️⃣ Different from SMART on FHIR

I came in expecting **CDS Hooks** to be an extension of **SMART on FHIR apps**—they aren’t.

- **CDS Hooks is event-driven**: The EHR calls your service when something **happens**.
- **SMART apps are user-driven**: The provider must manually **launch them**.

It’s easy to mix them up, but they actually **complement** each other.

The game-changer? **Epic’s August 2024 Launch Cards now allow a CDS Hook to launch a SMART app directly!**

👉 **CDS Hooks fires before the clinician makes a decision—SMART on FHIR fires when they seek information.**

### 2️⃣ They allow you to generate custom **interactive practice advisories**

The **best feature of CDS Hooks?** You can create **Practice Advisories**—custom pop-ups inside the EHR that provide **interactive decision support**.

- You can **show alerts, suggest actions, and even pre-fill forms**.
- Unlike basic alerts, **these are configurable by the clinician**, reducing frustration.
- They allow **custom workflows tailored to different health systems**.

Epic already has its **built-in Practice Advisories**, so **you have to integrate carefully** to avoid conflicts (more on that later).

### 3️⃣ Low provider abrasion—your app launches when events of interest happen

One of the **biggest advantages** of CDS Hooks:

💡 **Your app surfaces exactly when it’s needed—without forcing clinicians to search for it.**

- If a provider **prescribes a high-risk medication**, you can warn them instantly.
- If a patient meets **sepsis criteria**, you can suggest interventions in real time.

It’s **less annoying than constant alerts** and allows **passive guidance** rather than interruptions.

👉 **Good CDS Hooks design = low friction, high impact.**

### 4️⃣ One Epic Instance ≠ Another

> “Once you’ve seen one Epic instance, you’ve seen one Epic instance.”
> 

This is **especially true for CDS Hooks**.

- **Different Epic customers configure Practice Advisories differently.**
- **Hook support varies by Epic version and customer settings.**
- **Custom scripting can modify how hooks fire.**

👉 **If you build for one Epic system, don’t assume it will work for another.**

### 5️⃣ **Practice Advisories Can Clash with CDS Hooks**

Epic already has **built-in Practice Advisories**—which means:

🚨 **If your CDS Hook isn’t configured carefully, it might overlap with existing alerts.**

- **Duplicate warnings** = annoyed clinicians.
- **Too many alerts** = ignored CDS Hooks.
- **Some Epic customers disable CDS Hooks in favor of their own advisories.**

👉 **Before implementing CDS Hooks in Epic, understand their existing alerts first.**

### 6️⃣ Most EHR Vendors don’t really support CDS Hooks (yet)

**HTI-2 is mandating support by 2028, but adoption is still low.**

👉 **Check your target EHR’s actual support before committing to CDS Hooks.**

### 7️⃣ **EHR Vendors Don’t Leverage Service Discovery at All 😞**

In a perfect world, **CDS Hooks services should be dynamically discoverable**—just like a FHIR server.

👉 **If you’re planning for service discovery, don’t.**

### 8️⃣ **Expect to Pay $380/hr for Epic Testing**

Epic’s vendor services **sandbox environment is quite limited** for full CDS Hooks testing.

Problems with Epic's vendor services sandbox:

- One card at a time, doesn't support multiple cards.
- Can't configure look and feel.
- Can't test interactivity such as suggestions/actions.

To properly test:

✅ You need to pay **$380/hour** for Epic **Vendor Services (VS) testing**.

👉 **Budget for testing early. It’s not free, but it's a good experience and the calls are productive.**

### 9️⃣ **Write-Back Calls Are First-Class in Epic, But Nobody Uses Them**

Did you know that **CDS Hooks can actually write data back into the EHR**?

No need for extra steps to get conditions onto the **problem list, today's encounters, or even medications**.

### 🔟 **Launch Cards (August 2024)**

Before **August 2024**, a CDS Hooks card could only **display information and provide simple interactivity**.

🚀 **Now, with Epic’s Launch Cards, a CDS Hook can launch a full SMART on FHIR app inside the EHR!**

This is **huge** because:

- You can **seamlessly transition from a CDS Hook alert to a full app**.
- Clinicians **don’t have to search for external tools**—they launch automatically.
- It **bridges the gap** between event-driven alerts and full interactive workflows.

---

### 🎯 **Final Thoughts**

Would I build a **CDS Hooks app again**? **Yes—but with different expectations.**

✅ **Budget for testing upfront.**

✅ **Avoid assuming EHR implementations are consistent.**

✅ **Push for vendor improvements and testing support.**

CDS Hooks **is powerful**, but it’s still early even though it's been around.

If you’re getting into it now, **hopefully, these lessons save you some pain.**

👉 **What have you learned while working with CDS Hooks?**

📌 [Hopefully more support will follow - HTI-2 comment](https://www.regulations.gov/comment/HHS-ONC-2024-0010-0022).