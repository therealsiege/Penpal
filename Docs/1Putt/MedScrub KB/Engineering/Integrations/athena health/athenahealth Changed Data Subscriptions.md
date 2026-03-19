## Overview

Polling-based changed data feeds. Subscribe → poll GET /{feedtype}/changed → messages auto-deleted after 24hrs. Poll at least hourly. Unused subscriptions auto-removed after 7 days.

## Workflow

1. Subscribe: POST /{feedtype}/changed/subscription
2. List: GET /{feedtype}/changed/subscription
3. Retrieve: GET /{feedtype}/changed (removes from queue)
4. Unsubscribe: DELETE /{feedtype}/changed/subscription

## Key Feeds for MedScrub

- 📌 /appointments/changed — Check In → encounterID (PRIMARY SYNC TRIGGER)
- /patients/changed — Add, Update, Merge, Delete
- /labresults/changed — Add, Update, Close (SOAP Objective)
- /imagingresults/changed — Add, Close (SOAP Objective)
- /orders/changed — Create, Update, Deny
- /chart/healthhistory/problems/changed — ProblemAdd, ProblemUpdate
- /chart/healthhistory/medication/changed — Add, Update, Delete
- /chart/healthhistory/allergies/changed — Add, Update
- /prescriptions/changed — Add, Delete, Update, Refill

## All Available Feeds

### Ambulatory

Appointments, Patients, Problems, Medications, Allergies, Family History, Vaccines, Orders Created, Orders Signed Off, Prescriptions, Patient Cases, Imaging Results, Lab Results, CCM Enrollment, Claims, Providers, Provider Numbers, Referring Providers, Referring Provider Numbers

### Inpatient

Hospital Visits, Hospital Stays, OR Cases, Surgery Cases, Charge Codes

## Best Practices

- Messages >24hrs auto-deleted (may be lowered to 1hr)
- Subscription changes take 10-20 min to take effect
- Retrieving data removes from queue (debug flag to keep)
- Large practices: use department filtering, limit 1000
- Never exceed GET/{feedtype}/changed per minute
- POST to subscribe is one-time — don't re-subscribe unless deleted