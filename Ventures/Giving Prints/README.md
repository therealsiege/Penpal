### Links
Vercel: [https://vercel.com/giving-prints/app](https://vercel.com/giving-prints/app)
PostHog: [https://us.posthog.com/project/209093](https://us.posthog.com/project/209093)
Neon: https://console.neon.tech/app/projects/young-cloud-44017590?branchId=br-odd-heart-aepnp0ez 
**Stripe**: https://dashboard.stripe.com/test/dashboard
Cloudflare: [https://dash.cloudflare.com/ae706f3f85997a0a1f695210ea3f1d47/home/domains](https://dash.cloudflare.com/ae706f3f85997a0a1f695210ea3f1d47/home/domains)
ReSend: [https://resend.com/emails](https://resend.com/emails)
Github: [https://github.com/Giving-Prints/App](https://github.com/Giving-Prints/App)

### Intro Email

Hi Clint - THANK YOU for taking a look at this!

Here’s the [OneDrive Folder](https://1drv.ms/f/c/7027c2e0ced2e1d5/Es4Rf1jE4pFElPytIj3xjL8ByD2ywPNcvqfVilXLIftQJw?email=clint%40grizzlydevelopment.com&e=CpSLxj) (link) to the old GivingPrint code and resources.

My plan over the next 2 weeks is to revisit all the pieces I need to relaunch GivingPrints (code, printer, charities). If everything lines up, I’ll get all the legal stuff setup.

Sadly, it looks like I let my Jira project expire from inactivity, which was a good log of all functional requirements.  So here’s a high level overview.

**Business model:**

- Similar to [Shutterfly](https://www.shutterfly.com/t/holiday-cards/), [Minted](https://www.minted.com/holiday-photo-cards) or [TinyPrints](https://www.tinyprints.com/minimalist--holiday-cards), except focused on holiday cards only (at least for now; possibly forever).
- The twists are:
    - Fewer card designs (too many options is overwhelming; instead curate just the top designs); all 5x7 probably.
    - Simplified pricing (exact details TBD; I’m sorting out costs now)
    - Only 1 paper option - premium quality only; and probably no fancy edges cut options.
    - In the brand area on the back bottom of cards, the cards proudly display what charity cause the customer supported by purchasing the card.

**As a Customer:**

1. The mobile-first website is clean and intuitive, and focuses on card ordering: Step 1 select card design, Step 2 customize, Step 3 select charity, and Step 4 submit payment/shipping. Ideally the landing page is Step 1 for card creation - but I need to quickly understand the charity value proposition (perhaps as a modal).
2. Each card often has a few permutations of design (change color schema or words “happy holidays” vs “merry Christmas”)
3. Card Photo editor: try to do as much of the editing within the card itself, rather than off to the side. Hidden to the customer, every card includes “printer bleed” - an area about 1/8” all around intended to be allowance for printers to trim the card.
4. Select Charity from a list of charities
5. Preview my final card design front and back.
6. Complete my order (shipping, payment) easily.
7. TBD - Address upload to pre-label recipients: excel upload or enter in website (magical experience would be selecting contacts directly from phone contacts that have a mailing address)
8. Share via social media (free advertising; but careful not to allow customer to just send a digital version of the card and not buy paper cards - perhaps preview of card from an angle) + something like “I just ordered my premium holiday cards from GivingPrints, which donates 20% of all profits to charities. I chose Charity X (tags charity) because…."
9. Optional create account to save for future reordering & check on order status: The original architecture of competitors often required customers to first create an account to load photos first and save work. Ideally, I’d like to move this friction to the end… where the account is automatically created based on email address order and passkey.

**As an Admin, I need to...**

1. be able to manage card designs
2. manage orders and export daily/nightly to the printer
3. integrate into a solution like Shopify for ease of payment collection (incl. ApplePay and Google Pay), shipping/tracking notifications, and discounted shipping rates through UPS/Fedex.
4. Manage charities (users, logos, descriptions)
5. And because this is startup mode, I may need a graceful way to limit orders if we were to get too many orders… such as push fulfillment dates out automatically knowing that we could only create so many cards at one time.

**As a Charity Admin, I need…**

1. a way to see anonymized orders placed and donations due to them daily.

