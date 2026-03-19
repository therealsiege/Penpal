# CDS Hooks Endpoint Security

For CDS Hooks endpoint security:

The following details are from Epic’s Test System, the iss and JKU will be unique to each customer FHIR server (environment) using eSpiral.

We can expect: 

The FHIR server will be sending a JWT with the following headers:

- aud = [https://espiral.healthcare/fhir/cds/advisory](https://espiral.healthcare/fhir/cds/advisory)
- iss = https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/R4
- sub = af25285e-eba8-4043-91ab-c4cac0353c51 in non-prod, e56295d1-728a-4206-b096-8d0530710277 in prod

JKU that holds the public key to verify our signature will be held at: [https://vendorservices.epic.com/interconnect-amcurprd-oauth/oauth2/keys/2/FE995F997147FEC54B14D9B079164D2D](https://vendorservices.epic.com/interconnect-amcurprd-oauth/oauth2/keys/2/FE995F997147FEC54B14D9B079164D2D)

The audience being our server, and the issuer being epic vendor services in this example. The sub is the clientID of the environment they are trying to connect to. Either production or non-production.