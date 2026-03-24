# Charities - Part 2: Customer Selection

Status: On Development
Assign: Clint Johnson
Details: Action: Build a Charity Selection step for Customers as part of the Card Customization workflow.

The Charity Selection step should include 3 options for a Customer to select a charity:
1. search by EIN, Charity Name (which is powered by the Publication 78 from the IRS). See Notion Card: Charities - Part 1: Org Signup.

2. Featured Charities (these are the ones that promote GivingPrints). As Admin, I should be able to manage this in the Admin Ui.

3. By Category: 10 categories with a curated list of charities (I let ChatGPT curate a list of 60 charities) — see attached.  As Charities signup, probably should allow them to self-opt into a category, which then adds them to the “by category search”). As Admin, I should be able to manage in the Admin UI. 

Lastly, once a charity is selected, the UI should display a preview of what the card back will look like, which includes the GivingPrints logo and the text “Profits from this card supported [Charity Name].”  (see card back branding details Notion Card)

Background Context / Reference:
https://www.tisbest.org/charities/ does a great job with helping customers select a charity. (UI could be improved, but the functionality workflow is logical.)

Release: 1.0

[2025 Categorized Charities.csv](Charities%20-%20Part%202%20Customer%20Selection/2025_Categorized_Charities.csv)