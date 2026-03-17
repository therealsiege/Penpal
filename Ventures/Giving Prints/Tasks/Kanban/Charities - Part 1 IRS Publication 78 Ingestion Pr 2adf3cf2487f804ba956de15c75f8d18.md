# Charities - Part 1: IRS Publication 78 Ingestion Process

Status: On Development
Assign: Clint Johnson
Details: Background Context: The IRS publishes the complete list of charities in “Publication 78” approximately monthly.  The link is always https://apps.irs.gov/pub/epostcard/data-download-pub78.zip

This table is to be the back-end master list of all charities that a customer could select. It contains approximately 1.3 million records, so it’s important that this table and later searching is optimized for speed. 

Action - Create an ingestion process to:
1. Download https://apps.irs.gov/pub/epostcard/data-download-pub78.zip on the 15th of each month.
2. Unzip and save as a new file with the date appended to the file name.
3. Archive a copy of the existing IRS table used by the GivingPrints Application. 
4. In the table currently used in production, using the EIN as the primary key, disable organizations that are no longer on the list. 
5. Add new organizations (again using EIN as the primary key). 
6. It is important to not delete information previously provided by nonprofits organization to givingprints directly as part of the “Nonprofit Signup Process” (may not yet be built) 
Release: 1.0