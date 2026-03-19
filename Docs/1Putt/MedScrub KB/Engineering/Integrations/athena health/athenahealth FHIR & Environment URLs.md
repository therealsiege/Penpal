## Environment Base URLs

- Preview: https://api.preview.platform.athenahealth.com
- Production: https://api.platform.athenahealth.com
- URL pattern: {BaseURL}/v1/{practiceid}/{endpoint}

Note: IP addresses NOT stable — do not whitelist. OAuth credentials are environment-specific.

## FHIR R4 Global Base URLs

Global URL serves ALL practices in the athena network:

- Preview: https://api.preview.platform.athenahealth.com/fhir/r4
- Production: https://api.platform.athenahealth.com/fhir/r4

## FHIR R4 Site-Specific URLs

```
Preview:    https://api.preview.platform.athenahealth.com/{practiceid}/brand/{brandid}/csg/{chartsharinggroupid}/fhir/r4
Production: https://api.platform.athenahealth.com/{practiceid}/brand/{brandid}/csg/{chartsharinggroupid}/fhir/r4
```

## Downloadable Base URL Lists

- FHIR Resource Bundle (all customers): https://service-base-urls.api.fhir.athena.io/athena-fhir-service-base-urls.json
- Global R4 CSV (daily): https://fhir.athena.io/athena-fhir-urls/athenanet-fhir-base-urls.csv
- Site-specific R4 CSV: https://external.fhir.athena.io/athena-fhir-urls/athenanet-fhir-brand-r4-urls-zipcode.csv