Summary

### Meeting Context

Onboarding meeting for Clint Johnson as lead engineer for the payments and revenue domain at OpenLoop. The meeting covered team introductions, project background, and technical overview of the Enterprise Service Layer (ESL) being built for Stripe integration.  

### Team Introductions

**Project Lead Background**

- Independent consultant overseeing Stripe integration project
- Previously implemented similar system at Hertz car rental company
- Heading up payments and revenue domain, which is being built from scratch

**Clint's Background**

- 12 years in healthcare technology
- Started in automotive industry with predictive analytics (sold to IHS Market/Polk Automotive)
- Worked at Amazon on embedded programming for trucking fleet data recorders
- Experience with Meharry Medical College blockchain project for claims data
- Co-founded Bridge Connector (funded by Publix family)
- Specialized in both embedded programming and web technologies

**Stripe Professional Services Team**

- Nilay: Working with OpenLoop browser team on Stripe integration, provides guidance on payment best practices and enables newer features
- Connor: Nilay's counterpart (currently out)
- Justin: Engagement manager
- Jessica: Implementation consultant handling operational functions

### Project Timeline and Discovery

- Stripe project kicked off in December
- Conducted 24 discovery sessions across all business areas in January 5-31 to understand current Stripe usage
- February: Began building stories in Linear and determining ESL assets
- Recently held first steering committee meeting

### Current State and Challenges

**Existing Architecture Issues**

- Over $1 billion running through Stripe payment gateway
- Multiple point-to-point integrations with Stripe API across partners and internal applications
- Each application currently calls Stripe API directly with their own secret keys
- No centralized architecture - described as "a frickin' nightmare"
- Two billing systems in use: Stripe billing (majority) and ChargeB (approximately 12 customers)

**Platform Usage**

- Multiple marketplace and B2B platforms using Stripe (referenced: Shopify, Squarespace, Wix, OpenAI)
- Current systems include various patient journey applications

### Enterprise Service Layer (ESL) Goals

**Primary Objectives**

- Build centralized ESL as company OKR to standardize and centralize all payment processing
- Create abstraction layer so no applications talk directly to Stripe - make Stripe a "black box"
- Enable vendor-agnostic architecture with no vendor lock-in
- Simplify partner onboarding to "minutes or just click to deploy"
- Organizations can call ESL with organization ID rather than managing secret keys directly

**API Design Approach**

- Stripe team designs telehealth-specific API shapes in TypeScript
- APIs simplified compared to cross-industry Stripe public API
- Engineers implement designs in lambdas
- Focus on consumable, well-documented APIs specific to OpenLoop's business needs

### Tools and Processes

**Linear Project Management**

- Payments and Revenue domain contains five active projects with more in backlog
- Projects include integration guide, program catalog (products and prices), and others
- Stories linked between Linear and integration guide documentation

**Integration Guide**

- Draft documentation being built similar to public API catalogs
- Includes API shapes, endpoint information, and links to Linear stories
- Plan to eventually host on Netlify

**Development Infrastructure**

- New dedicated repository set up
- CI/CD pipelines established
- Stripe team reviews code in GitHub repo

### Current Active Work

**Program Catalog Project**

- Major focus: Building catalog of products and prices by organization
- Controls which programs organizations can sell with specific products and price points

**Example Use Case: Free Trial Subscriptions**

- Customer completes intake and questionnaires
- Checkout on Stripe hosted page
- 28-day free trial enrollment
- Stripe team provides guidance on optimal implementation approach for consistent funds flow and customer experience

### Scope Clarification

**In Scope**

- Cash pay and credit card payments (majority of business)

**Out of Scope (Currently)**

- Revenue Cycle Management (RCM) handled by separate system/team (Kate/Kara)
- Insurance claims processing and X12 data
- Co-pay processing (no cash pay component in RCM business)

### Next Steps

Meeting to continue with overview of projects going live and production deployment plans

Notes

Transcript

I'll walk you through the kickoff deck.

Okay.

But my background has been a consultant for my whole career. I have my own company, but he brought me in to oversee Strike because I've done something very similar at Hertz car rental company. And the Strike team introduced us actually. And so I'm overseeing those guys and kind of heading up the payments and revenue domain, if you want to call it that. which doesn't really exist right now. I mean, you're one of, as you know, you're kind of coming into it cold as well.

But they want to build out, they want to build out a whole bunch of things and we're just getting started. So what we did in December, Stripe hadn't really started yet. We kicked it off in December, but on January 5th when we came back, we did about three or four weeks of discovery sessions, like 24 discovery sessions. And we just met with all areas of the business about how they use Stripe and got through that discovery in January.

And then in February, we started to build out a bunch of stories in Linear and started to actually figure out, okay, what assets do we want to start building in the ESL? So I'll walk you through Linear as well just so you get a high-level kind of starting on this. We'll keep getting into it. But I thought in the first 30 minutes, what I could do after talking to Curtis today is It sounds like you're going to be the lead engineer for payments and revenue, and then there'll be other developers that they're going to continue to bring in.

That's my understanding.

So anyway, that's a little background on me. But yeah, what's your background?

So I've been in healthcare for maybe 12 years or so, but I... I actually come from Michigan and after graduating college I went to the automotive industry and did a predictive analytics app and then we ended up exiting and sold to what was Polk Automotive and they're now IHS Market and a bunch of other stuff. They kind of know it's in everybody's garage. After that I went to Amazon for a little bit

and helped with their, I'm actually a embedded programmer by education, but I also learned JavaScript and some of the web languages. So I kind of became a very rare type of engineer. And so went to Amazon, did some embedded programming for them, for their large trucking line, kind of like a little VDR, a data recorder would sit underneath the, the chair of the driver and it had a cellular stick in those days and it would radio back, you know, over, it would grab all the data over ODB2, which is common in pretty much every vehicle since like the 90s.

And so just radio back in real time all that data. And then they were able to do some fuel consumption and routing and all sorts of things for themselves and their suppliers. Kind of like just along the way I was consulting and I got in touch with the Meharry Medical College, which is here in Nashville. I'm from Nashville or I live in Nashville now. I've been here maybe 10 years or so. But I did a cold coin for them and the whole thing was to bake claims data inside of the cold coins.

Your claims data would follow you around your care journey. It was just an internal academic type thing, but I met the two guys that were starting Bridge Connector along the way. And that was another startup that was funded by the Publix family, the Jenkins family who owned the Publix grocery chain. So they don't really know much about health care. So we built a company for them and. We learned a lot but didn't know what we wanted to be, so kind of just like trying to tackle everything.

And then I went and helped a couple other fire type companies and kind of here we are today. So I spent a lot of time in healthcare and building type stuff for startups and larger scale organizations as well.

Very cool, yeah. Hey, Nilay. We're just doing some quick intros here.

I did mine.

And Clint finished his, so your timing's good. You want to just do a quick intro?

Yeah.

I got caught up in the changes. So, yeah, my name is Nilay. I work at Stripe. I currently am working with the Stripe browser team with OpenLoop to integrate of essentially their payments. That forms a way of building something called an enterprise service layout, which is essentially going to be like an abstraction over your payment processes, Stripe being one of them. So I help open loop with all questions related to payments, what are the best practices, industry standards, and also help them maybe enable newer features that are not available to the general public.

So yeah, that's me. I have a team with me which has Connor who's my counterpart. He does almost everything that I do. We have somebody called Justin who's the engagement manager and Jessica who's like the operational function on the first-world site.

Yeah, well, good timing. I was just going to jump into our kickoff deck. Yeah, and you know back to what I said, I'm an independent worker and then Stripe's professional services team is engaged as well under a separate state of work. And he just went through it. So this is me like, Connor's out for the last couple days, Jessica implementation consultant, and then I don't know what she taught, but Justin's sort of my peer.

We have a technical account manager and some other folks you'll see in Slack that are from Stripe that do the day-to-day break-fix and all that. And then on our side, we just had our first steering committee. This is kind of the executive steering committee and the delivery teams. I won't go through all this right now. I'm kind of boring. But here's what we're trying to build. Our OKR and our objective team.

And it's one of the OKRs that the leadership is tracking is to build a CSL and really centralizing everything and standardizing everything. So all of the partners of OpenLoop on the platform, as well as all the internal applications, when they call Stripe, they call the Stripe API directly. So there's all these bespoke webs of point-to-point integrations all over the place. And each application doesn't really...

There's a bunch of other architectural flaws. If you talk to Jamie Gray, who's heading up product, there's just the same platform company yet, right? But one of the things that Stripe looks at is that they've got many, many marketplaces and B2B platforms on their platform, right? So there's Shopify, there's Squarespace, there's all Wix. I mean, all these guys are using it. Even OpenAI is using it for subscriptions.

So we have Stripe's payment functionality as a payment processor, right? But we also have their subscription billing system. So we also have ChargeV as well. We only have about 12 customers or so on ChargeV. Almost everything is on Stripe billing. So, yeah, over a billion dollars is running through Stripe on the payments. So even if they use ChargeV, they still use the Stripe gateway, the payment gateway to make those payments.

And it's a frickin' nightmare. There's just a ton of... of integrations and as we did those discovery sessions that I told you about in January, you know, it's kind of overwhelming the amount of crap that we're going to have to build into the ESL, but we're starting. But this is just new capabilities, blah, blah, blah, you know, telehealth specific. One of the things I think I put it on here when I said it, but it's...

We're trying to have no vendor lock-in, meaning that this is going to be agnostic, right? So we can plug and play different ones in here. Simple concept, everybody's done it, we'll go through that. We did look again in this, all the payment experiences across all the different applications, all these were part of the interviews, just going and finding from onboarding. And our goal is to get that in minutes or just click to deploy, just click it and create new organizations and new partners on the fly.

There's all the patient journeys that go through all the different systems, so on and so forth. But we're trying to make Stripe a black box down here at the bottom. None of these applications will talk to Stripe anymore when we're done. So what we've done, flipping it to linear, I don't know about you, but I hadn't used linear before either. I was a Jira guy.

I've used it a little bit, but not heavily.

Okay. Okay.

So you'll probably get familiar over here under product and engineering is called payments and revenues. So this is as they try to define bounded context around different domains. Our domain is here and what I've got inside of here are the actual projects that we're working on. So there's five in flight, some that are being worked on, more in the backlog and it keeps growing. And our timeline is The first thing we started working on is basically an integration guide.

So just like Stripe and any of the software platforms and tasks out there, they've got their own public catalogs. So what's happening in there is this is the draft of the integration guide and there's a little preamble and then it just jumps right into different shapes of different APIs. So what these guys do at Stripe is they will design it. They'll shape out in TypeScript the API, which then an engineer here takes and puts it in the lambdas and whatever.

We've got our own, they've set up the CI/CD pipelines. We've got our own repo now. So the beginning, things are coming into place, but as we talk about doing things, it gets documented here so that we can probably put this in Metlify or something at some point and actually put it out as a, you know. So that's where this is headed. One of the things that they're doing is let's take an API like I'll try to find a quick one here.

Like get all the products for an organization. So right now we want to make it to where we have an abstraction layer for the API keys, the secret keys and stuff like that, where each application doesn't have to have the secret key. They can simply call the ESL with the organization that they're working with, like MedV or Future Health or whoever, and go do that. And you can see the endpoint information.

But we have links to linear in here too. So you can go hop over and see this and then see in linear the actual, okay, if you want to create a product, you know, this is what it looks like and things like that. That's kind of how we're linking these two things together. So when you look in linear and you go back and you look at our domain of payments and revenue, you look at all the projects that we've got, you can then kind of click on

You know really any one of these like the big one that's being worked on right now is the program catalog which has all the products and prices in it so for a given organization so we they're only allowed to sell this program under with these products with these price points when you click into any one of these that you can then see all the issues that the developers were working on.

Right okay.

So that's going from a kickoff deck to kind of grounding us in how we work. and what we're doing as requirements and things come up as we're trying to surface requirements.

So I'll stop there.

Any questions about that?

That's very clear and straightforward. I guess my question kind of comes first off like scope related. Do we process any insurance claims? Is there X12 data or anything from an insurance level? side that we're doing or is everything from a patient's credit card?

I guess. - Great question. The simple answer is it's cash pay, credit card pay. - Okay. - The majority of the business. There is a part that we have not gotten involved in called RCM, Revenue and Cycle Management, right? And so there's a lady, Kate or something, I have not met with her yet. At some point we'll probably engage there, but there's no, for the copay part and the part that the customer might have to pay.

That's not in our remit right now. I don't even know which system does that.

Okay. Okay. So there is a system out there that's doing that for part of our business. Okay.

Gotcha. Gotcha. Yeah. But, you know, what I wrote down on that one is there's no cash pay involved in that business.

That's interesting.

So there's no co-pay.

Does that mean there's no co-pay?

That's what doesn't make sense to me. That's what I wrote down when I sort of got the download. I said, hey, you should go over and talk to Kara. And I was like, yeah, but you said there's no cash pay in it. There's no...

like payments i'm like i'm not gonna do it i'm too busy yeah yeah um huh there's gotta be but okay huh interesting all right well so when i first when this meeting got scheduled i was that was what i was thinking was in my mind was rcm and then we started talking i was like wait a minute where's the insurance okay so this totally makes sense i've done some strife before i don't think i've ever done anything at this level so um

It'll be really helpful to have the Stripe team involved in that, but this totally makes sense. Gateways makes all that stuff makes sense to me. I've been through a lot of those nuances a few times, I guess. So, yeah, so I'm totally on board.

Yeah, and that's why we've got these guys. By the way, Neely is awesome, and Connor, the other guy, are really great. If you imagine... The Stripe API, you go out to their public API, it's cross industry. It's too much payload in and out of an API, right? It's just how do I use this thing? What feature flags do I turn on and off and all that crap. And what they do is just keep it real simple like, okay, this is all you guys need.

And these API shapes they're building are just super consumable, easy to understand, well documented. And that's what their job is, just say, to cut through the noise and say, oh, you're trying to do this? Well then, like, you're trying to create a, let's take an example. They want to create a subscription with a free trial period for the first 28 days. So a customer comes in, goes through the whole intake, answers all the questionnaires, all that stuff.

And at the end, they hit a checkout page to check out. That's a straight actual page, a hosted page. They go there, they put their credit card info in, and then there's this free trial enrollment. And there's a lot of ways to do free trials. And what Stripe can end up doing is saying, based on how you do it, here's how you should call the API. This is how you should do it. So that they're common and consistent from a funds flow standpoint, customer experience standpoint, all that stuff.

And so that's what they do is they cut out a lot of the noise and they say, look, we're creating telehealth specific platform, telehealth platform specific APIs that match OpenLoop's business for all our partners and write all that. And so we don't, you and I are Others I've been working with strike for a long time, but we don't have to know stripe That's where we lean on these guys really hard and then the engineers You know are looking at a story and linear and these guys have already shaped it and helped and are there to help the developers You know get it right they review the get repo.

So Nealey will log in and you know, make sure hey This looks good and sign off on it things like that.

Awesome.

Awesome Yeah So

Yeah, that's where we're at. I can tell you if you want now or we can do it later, is I can give you an overview of the projects that are going live and what's going into production. So, you know, we started on January 5th and we...