## Overview

Push-based (webhook) near real-time notifications. Newer, preferred alternative to Changed Data Subscriptions. Requires updated API Solutions contract.

## Key Features

- Push-based: webhooks, not polling
- Near real-time: p90 < 10 seconds, p99 < 1 minute
- At-least-once delivery guaranteed
- Multi-practice: single subscription covers multiple practices
- ID-only payload: must callback to get full resource
- FHIR R4 aligned

## Event Notifications vs Changed Data Subscriptions

- Delivery: Push (webhooks) vs Polling (API calls)
- Timeliness: Seconds vs depends on polling frequency
- Event context: Includes event type (Patient.Create) vs no event type
- Payload: ID-only (callback needed) vs full resource
- Multi-practice: Yes vs No (one per practice)

## MedScrub Plan

- Phase 1: Changed Data Subscriptions (works with current 2-legged OAuth)
- Phase 2: Migrate to Event Notifications when contract updated