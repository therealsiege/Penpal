# Facility and Procedure Scheduling Mapping Markets: Managing the overbooked-yet-underutilized paradox

**Date:** February 26, 2026

**Categories:** Facility and Procedure Scheduling

---

Colin DuRant

_This is part of Elion's weekly market map series where we break down critical vendor categories and the key players in them. For more, become a member and sign up for our email [here](https://elion.health/#signup)._

Operating room time costs roughly [$37 per minute](https://jamanetwork.com/journals/jamasurgery/fullarticle/2673385). That makes the OR the most expensive operational real estate in a health system, and in most organizations, it's governed by block schedules that were designed decades ago and are maintained through a combination of institutional politics, phone calls, and spreadsheets.

The mismatch between the clinical sophistication inside the room and the operational sophistication managing the room is stark: Multi-million dollar robotic suites are coordinated by charge nurses playing phone tag and dry-erase boards that are obsolete ten minutes into a shift.

The financial exposure goes beyond wasted minutes. Health systems routinely report surgical backlogs. Patients wait weeks and surgeons are frustrated by limited access, while systems simultaneously sit on significant blocks of unused OR time. A system can be both functionally short on capacity and measurably underutilized at the same time. It’s a paradoxical problem that only gets resolved with better governance of procedural capacity and the staff and equipment tied to them.

[Facility and procedure scheduling solutions](https://elion.health/categories/facility-procedure-scheduling/products) plan and coordinate the use of constrained procedural resources, including ORs, procedure suites, infusion chairs, and shared clinical spaces like IR and cath labs. These solutions sit inside or layer on top of the EHR to handle block allocation, case booking, duration forecasting, day-of adjustments, and capacity analytics. This is distinct from [patient scheduling](https://elion.health/categories/patient-scheduling/products) (routine ambulatory appointment booking), [clinical workforce scheduling](https://elion.health/categories/clinical-workforce-scheduling/products), and enterprise patient flow or bed management.

# Why the EHR is insufficient for facility and procedure scheduling

The common executive assumption is that the EHR handles scheduling. It does…in the same way that a general ledger handles financial planning. The EHR is the system of record; it stores the schedule, manages the booking transaction, and produces the legal documentation.

What the EHR typically lacks is optimization logic. It records what was booked, not what _should_ be booked. For example, it can tell you that OR 3 is assigned to Dr. Smith on Tuesday mornings. But it can't tell you that Dr. Smith has used only 58% of that block over the past six months, that releasing it would let it be filled by a high-acuity service line with a growing waitlist, or that today's posted cases are sequenced in a way that virtually guarantees overtime.

This gap matters because the OR typically accounts for [over 40% of hospital revenue and nearly 30% of total expenditures](https://jamanetwork.com/journals/jamasurgery/fullarticle/2673385). When idle time runs at $37 per minute and clinics report losing [up to 35% of potential surgical cases](https://jamanetwork.com/journals/jamasurgery/fullarticle/2775620) to scheduling friction, the cost of the gap between "system of record" and "system of optimization" is significant.

## The OR scheduling block problem

The utilization paradox (backlogs coexisting with underuse) is often a process failure, not a result of insufficient system capabilities. Block time, or recurring time slots assigned to a surgeon or service line, is the dominant model for allocating OR capacity. While the logic is sound in principle, in practice, block schedules calcify. Surgeons protect blocks they don't consistently fill. Release rules are either too loose (time goes unused) or too aggressive (which leads to clinician dissatisfaction). Reallocation decisions are politically charged enough that many organizations avoid them entirely, defaulting to informal negotiation instead of data-driven policy.

The vendors making the most headway in this category are the ones that reframe the problem. Instead of asking "how do we schedule cases faster," they ask "how do we surface underutilized capacity early enough to redirect it, without triggering clinician pushback?" The answer usually involves predictive models that identify likely-unused blocks weeks in advance and automated "nudges" that give surgeons the option to release time before it's taken. This can be a softer intervention than top-down reallocation, and one that generates data for the governance committee to act on.

One underappreciated dimension: Accurate duration data is the foundation that everything else depends on. Case duration estimates in EHRs are frequently based on surgeon self-reports or static averages, and the gap between estimated and actual duration is a primary source of schedule breakdown.

Some vendors are now using ambient sensing or computer vision to capture objective timestamps for when the patient actually enters the room, when the incision starts, and when turnover begins The difference between optimizing on EHR timestamps and optimizing on ground-truth event data is often the difference between a model that works in a pilot and one that works in production.

## Infusion is a different problem wearing the same name

It's worth flagging that infusion scheduling, while technically within this category, operates under fundamentally different constraints than OR scheduling. An infusion chair is useless without a compounded drug ready to administer, and drug readiness depends on pharmacy workflow, payer authorization, and specialty drug acquisition timelines.

The binding constraint isn't the chair. It's the synchronization of the chair with the drug and the nurse. Most infusion centers experience a predictable "midday peak" between 10 AM and 2 PM because morning scheduling clusters treatments without accounting for pharmacy prep time. Leveling that workload through template optimization—spreading start times to match compounding capacity—is the primary value proposition of scheduling tools in this space, distinct from the block governance and duration prediction problems that define OR scheduling.

# Vendor landscape

The facility and procedure scheduling market segments by where a vendor intervenes in the scheduling workflow and its relationship to the EHR.

## EHR-native scheduling modules

EHRs like [Epic](https://elion.health/products/epic) (OpTime for surgery, plus dedicated infusion scheduling), [Oracle Health](https://elion.health/products/oracle-cerner) (Cerner), and [MEDITECH](https://elion.health/products/meditech-expanse) provide the foundational booking, resource assignment, and schedule propagation layer. They handle the transaction: creating the appointment, assigning the room, emitting the HL7 SIU messages that downstream systems consume. They are stable, deeply integrated, and difficult to displace.

What EHRs generally lack is prescriptive optimization to predict which blocks will go unused, recommend case sequences to minimize overtime, or dynamically adjust templates based on historical demand patterns. For many community hospitals, the EHR module is sufficient. For IDNs trying to squeeze more throughput from existing capacity, it's necessary but not enough.

## Capacity optimization overlays

These SaaS platforms ingest EHR data and layer predictive and prescriptive intelligence on top. [LeanTaaS](https://elion.health/products/leantaas-iqueue) (iQueue for Operating Rooms and iQueue for Infusion Centers) is one of the most widely deployed, offering block utilization forecasting, open-time marketing, and infusion template optimization. [Qventus](https://elion.health/products/qventus-surgical-growth-solution) takes a similar AI-driven approach to surgical growth and block release automation. One health system [described it as](https://www.healthleadersmedia.com/technology/automated-or-scheduling-addresses-key-hospital-pain-point) an "OpenTable for surgery scheduling." [Opmed.ai](http://opmed.ai/) focuses on AI-powered OR scheduling and block planning. [Optum](https://elion.health/products/crimson-ai) (via its Crimson AI-powered Surgical Capacity module) brings predictive analytics and utilization management, often paired with its broader advisory relationship. These vendors compete on the quality of their predictions and the behavioral design of their surgeon-facing interventions (the "nudge" that gets a surgeon to release unused time without a fight).

## Day-of coordination and ambient intelligence

A separate set of problems emerges once the day begins. Day-of coordination tools track case progress, manage turnovers, and insert emergent add-ons, adjusting for the inevitable deviations from the posted schedule. [LiveData](https://elion.health/products/livedata-periop-manager-analytics) (PeriOp Manager, OR-Schedule Board) provides real-time schedule boards and coordination tools that replace manual whiteboards, giving perioperative teams situational awareness across rooms and departments. [Apella](https://elion.health/products/apella-io) combines ambient OR intelligence—sensors and computer vision that capture real-time workflow events—with its Horizon scheduling optimization product, addressing the ground-truth data problem that undermines other optimization tools. This segment is where the "data foundation" argument plays out: you can't optimize what you can't accurately measure.

## Specialty, ASC, and practice platforms

Generalist perioperative tools often fail in specialized environments where scheduling is inseparable from clinical workflow. [Cathtivity](https://elion.health/products/cathtivity) bundles cath lab procedure scheduling with documentation and inventory tracking; the link between what's on the shelf and what's on the schedule is the product's core value. [Birth Model](https://elion.health/products/birth-model-ob-platform) uses AI-predicted delivery timing to schedule inductions and C-sections in OB units. On the ASC and practice side, [HST Pathways](https://elion.health/products/hst-pathways) provides an all-in-one platform (scheduling, charting, billing) purpose-built for ambulatory surgery centers, where schedule variance has outsized financial impact. [SurgiStream](https://elion.health/products/surgistream) and [Surgimate](https://elion.health/products/surgimate) focus on the upstream case-request handoff from the surgeon’s office to facility, the friction point where IDNs lose cases to competitor systems because booking is too slow or too manual. [IMO Health](https://elion.health/products/imo-core-periop) (IMO Core Periop) operates as a cross-cutting data layer, enriching surgical dictionaries to improve procedure description accuracy, which directly affects case duration estimates and downstream billing.

---
*Source: [Elion Health](https://elion.health/resources/facility-procedure-scheduling-market-map)*