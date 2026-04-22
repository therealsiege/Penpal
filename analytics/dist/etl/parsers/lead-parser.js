import { stripEmoji } from "../../shared/utils/normalize.js";
export function parseLeadFromDocument(doc) {
    if (doc.documentType !== "lead")
        return null;
    const m = doc.metadata;
    return {
        name: doc.title,
        company: m["Company"] || null,
        location: m["Location"] || null,
        jobTitle: m["JobTitle"] || null,
        type: m["Type"] || null,
        salesFunnel: m["Sales Funnel"] || null,
        priority: m["Priority"] ? stripEmoji(m["Priority"]) : null,
        emr: m["EMR"] || null,
        leadSource: m["Lead Source"] || null,
        bio: m["Bio"] || null,
        notes: m["Notes"] || null,
        nextAction: m["Next Action"] || null,
        businessArm: m["Business Arm"] ? stripEmoji(m["Business Arm"]) : null,
        htnMember: m["HTN Member"]?.toLowerCase() === "yes",
        previousAttempts: m["Previous Attempts"]?.toLowerCase() === "yes",
        linkedIn: m["ProfileUrl"] || m["LinkedIn"] || null,
        email: m["Email"] || null,
        createdAt: doc.createdAt,
    };
}
