# Charities - Part 3: Charity Signup

Status: Not started
Assign: Clint Johnson
Details: In a previous requirement, we started ingesting IRS Publication 78, which is the list of all active nonprofits, their legal name, EIN and City, State. This next requirement builds on that. 

IRS Publication 78 lacks important details that we need the Nonprofit Organizations to provide to us. 

We need to create a workflow for Charity organizations to sign-up, claim their EIN and add critical details. 


Step 1: User Registration, including create account, verify email, etc. The registration should prompt the user to use an email address with the organization’s domain name, if one exists, for faster verification.

Step 2: Once the user is verified, the user then requests to claim the EIN of a charity from Publication 78. As part of the claiming process, the user must add the following information:
a) Organization Common Name, AKA or DBA;
b) Organization mailing address
c) Organization website
d) Organization phone number
e) a link to donate funds
f) Organization’s brief mission description (to be used on GivingPrints website)
g) upload a logo
h) select a category (10 categories listed in previous Customer Charity Selection requirement, but also include an “Other” dropdown)
i) the user’s affiliation to / job function at the nonprofit
j) Additional Notes (an optional textbox)

If the EIN has already been claimed, alert the user and provide the name of the individual who has claimed the organization, and require:
k) Explain the conflict regarding the previous user who has claimed the organization.


Step 3:  Claiming the organization does not automatically link the user to that organization. An Admin must approve it first.

In the Admin UI, create a table of pending Organization Signups (Claims).  Include all the details that the user completed in Step 2. Also use Prorepublica’s API to pull in the mailing address. 
https://projects.propublica.org/nonprofits/api   Make this address visible to the Admin. This serves as a quick verification by comparing the the address provided by the Charity user matches the official address. 

Once approved, then the Charity User becomes affiliated with the Nonprofit Organization (Charity). It should be possible for multiple users to be affiliated with the same organization. 
Release: 1.5