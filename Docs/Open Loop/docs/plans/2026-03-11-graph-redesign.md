# Graph Redesign: Enhanced Structure for Analytical Power

> Date: 2026-03-11
> Status: Approved
> Approach: B (Hybrid Static + Extracted)

## Problem

The current graph is a document-centric bipartite model where MENTIONS (848 of 1,308 relationships) dominates. This limits analytical queries to basic entity co-occurrence. Missing: project tracking, org hierarchy, topic clustering, incident tracing, temporal analysis, weighted relationships.

## New Node Types

### Project (static catalog)
Active workstreams/initiatives. Links to Domain, People, Decisions, Risks.

### Team (static catalog)
Org structure. Supports MEMBER_OF (Person→Team) and PART_OF (Team→Team) hierarchy.

### Topic (auto-extracted)
Extracted from `### Section Headers` in meeting note summaries. No catalog entry needed.

### Incident (static catalog)
Production issues as first-class nodes with CAUSED_BY, AFFECTED, DISCUSSED_IN relationships.

## Schema Changes

### PersonDef — add fields
- `team?: string` — creates MEMBER_OF relationship
- `reportsTo?: string` — creates REPORTS_TO relationship

### DecisionDef — add field
- `project?: string` — creates DECIDED_FOR relationship

## New Relationships

| Relationship | Source → Target | Source |
|-------------|----------------|--------|
| MEMBER_OF | Person → Team | person.team |
| REPORTS_TO | Person → Person | person.reportsTo |
| PART_OF | Team → Team | team.parent |
| WORKS_ON | Person → Project | person.team + project.domain |
| DECIDED_FOR | Decision → Project | decision.project |
| THREATENS | Risk → Project | static mapping |
| CAUSED_BY | Incident → Technology | incident.causedBy |
| AFFECTED | Incident → Organization | incident.affectedOrgs |
| DISCUSSED_IN | Incident → MeetingNote | match by date |
| DISCUSSES | MeetingNote → Topic | auto from H3 headers |
| NEXT | MeetingNote → MeetingNote | auto from date sort |
| MENTIONS (weighted) | Doc → Entity | count property added |

## Parse Changes

Topic extraction from `### ` headers in summary sections (before Notes/Transcript). Normalized to title case.

## Expected Outcome

~380+ nodes, ~1,500+ relationships, 16 labels (up from 12).

## Key Queries Enabled

- Open action items by person
- Project status with linked decisions, risks, people
- Team composition and org hierarchy
- Topic frequency across meetings
- Incident root cause tracing
- Meeting timeline traversal
- Weighted entity importance ranking
