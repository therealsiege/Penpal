Summary

### Action Items

- [ ]  Watch for invites to AWS IAM Identity Center, development account, GitHub, WIZ, Linear, Excalidraw, and other tools
- [ ]  Clint to invite new team member to workshop with MedPlum team
- [ ]  Clint to connect new team member with Brian (PM for payments) and send DM intro
- [ ]  Clint to add new team member to 10:30 AM daily meeting
- [ ]  Clint to provide Cursor access and Cloud Code seat when available
- [ ]  Schedule follow-up meeting for early next week or possibly tomorrow

### Tools and Access

- **AWS Development Account**: Personal development account for deployments; invite will arrive but provisioning takes 30-45 minutes
- **LocalStack**: AWS emulation for running cloud-native resources locally; not fully implemented across all projects yet but being rolled out
- **Excalidraw**: Primary tool for working diagrams; Figma used for polished board-level diagrams
- **WIZ**: Cloud security posture management system with IDE extensions to highlight infrastructure code misconfigurations during development
- **Linear**: Project management tool with AI integrations; platform team uses Jira but development team staying on Linear for now

### AI Development Tools

- **Cursor vs. GitHub Copilot**: Can choose preferred option
- **Cloud Code**: Procurement in progress; seats will be available soon
- **OpenCode with Bedrock**: Alternative to Claude Code using AWS Bedrock models; benefits include better performance and 10% cost savings through AWS enterprise contract
- **OpenCode workflow**: Recommend using plan mode to refine tasks before execution to prevent going off the rails
- **AI governance**: OpenCode through Bedrock may be a loophole in AI governance approval; to be discussed in next committee meeting
- **Healthy MCP server**: EHR partner provides MCP server for local development with GraphQL API and additional tools

### Project Focus Areas

- **MedPlum Projects**: Team wants to leverage new team member's MedPlum experience; MedPlum team providing hands-on support during migration
- **Payments Platform**: Major project requiring attention alongside MedPlum work; enterprise service layer (ESL) being built with Stripe pro-serve agreement
- **Initial Focus (Next 2 Weeks)**: Absorbing business knowledge and context; connecting with Brian (payments PM) to understand where help is needed most
- **Workload Balance**: Keep tight feedback loop with Clint if feeling spread too thin between payments and healthcare domains

### Video Integration

- **Current State**: Migrating from [doxy.me](http://doxy.me) to proprietary system using Amazon Chime SDK connected to Amazon Connect instance
- **Architecture**: Custom waiting room with join links for both physicians and patients
- **MedPlum Integration**: MedPlum bots can run event-driven to generate join links synchronously during appointment creation

### Current vs. Future Architecture

- **Current State**: Customers build against multi-tenant Healthy EHR; OpenLoop has custom provider UI abstracting Healthy and internal backend; limited control over customer integrations and missing data components
- **Future State**: Partner API as ingress point with MedPlum as EHR system of record and payments platform abstracting Stripe/ChargeBee/Braintree; event-driven architecture maintained
- **Event Gateway**: Transforms events from disparate sources, removes vendor implementation details, publishes canonical OpenLoop events to Enterprise Service Bus

### System Architecture

- **API Surface**: Multiple APIs including internal, customer-facing, and integrations APIs
- **Domain Organization**: Preference for broad domains with subdomains (macro services) rather than microservices; each domain owned by a team as bounded context
- **Communication**: Domains communicate primarily through Enterprise Service Bus; some exceptions for data that doesn't make sense to replicate (e.g., organization service)
- **Data Storage**: Primary databases handle transactional reads/writes; analytics services may use separate infrastructure like OpenSearch

### Customer Persona and API Design

- **Primary Customers (85%)**: Performance marketers who are non-technical; good at patient acquisition and engagement but need abstracted REST API rather than FHIR
- **Secondary Customers**: Employers (e.g., Health Equity for HSA/FSA) and potentially large health systems in future
- **FHIR Strategy**: Future health system customers will want FHIR; plan to surface through API key access to MedPlum instance
- **Data Replication**: MedPlum will be system of record for clinical data; payments data will be replicated into MedPlum for holistic visibility and potential FHIR access

### Company Context

- **Resource Constraints**: Company has been under-resourced since day one; only ~10 engineers until December 2024/January 2025
- **Rapid Growth**: Hired ~40 engineers in one month; code base was clean initially but rapid acceleration introduced tech debt
- **Recovery Mode**: Currently balancing new initiatives (Partners API, payments, MedPlum migration) with recovering code quality through next-gen platform work
- **Repository Migration**: Moving from monorepo to separate repos per domain with separate AWS accounts to prevent cross-domain dependencies and enforce boundaries

### Culture and Expectations

- **Problem Solving**: Everyone expected to identify and own solutions to problems; encouraged to share ideas without staying in lane
- **Daily Meeting**: 10:30 AM meeting helpful for gaining business context and seeing what's breaking; temporary addition for onboarding
- **Tooling Flexibility**: Company willing to provide whatever AI/development tools needed for efficiency

Notes

Transcript

So first thing, you're going to probably get a flood of invites to things today. I think yesterday you probably would have gotten your AWS IAM Identity Center one. You'll also today get a development account that's just yours. You can see my dog. Yeah, I'm sorry.

The cone. We don't enjoy the cone. We have a 12-year-old dog. It's been many times with the cone. Yeah, it's a tough one. He feels extra needy to you, so he's like shoving me around. So yeah, you'll get your own... Like your own AWS account, development account, you can deploy stuff there. Okay. So you'll see an invite to that. You'll probably get the invite.

Too early, like it takes like 30 or 45 minutes for it to provision, but it'll say like, hey your new account exists and you won't be able to log in yet, so don't be surprised when that happens. We also make a lot of use of, well, we're starting to, I should say. Have you used LocalStack before? No, I haven't used LocalStack, no. Okay, so it's basically like an AWS new label, which can be handy for, like, running cloud-native resources locally.

Yeah, yeah. So, that can be really great. We don't have it really working. Local stack, okay. So, we'll get you out of that too. Cool, cause local invoke with Lambda is like just not enough, you know? No, right, exactly, exactly. So, I don't think it's fully developed with all projects yet, but I think we're starting to have a good sort of runbook to get it working with projects, so...

And I think the first project you'll be on is one that doesn't yet have it, but I think I asked the Dems the other day if they'd set it up and I don't know if they've had a chance to get to it yet. But it'll make development, just like the feedback loop, so much better. They'd rather have stuff re-deployed to your dev account over and over. Yeah. So you get that. We also use Excalidraw, if you're familiar with that. Oh, yeah. For diagramming and stuff.

Oh, yeah. Love Excalidraw, yeah. Awesome. And then you'll get access to all of our shared diagrams and stuff. We have a, man. We have all of our working diagrams there, and the diagrams that I shared, like the board and outside, like audit people, that's all in Figma.

I export and share those sometimes, but they're not as useful or valuable as the ones in Excalibur. Also, if you feel like you could use something a little more polished, let me know and I can export those for you or I can give you a frequency. What else will you get today? GitHub access, if you don't already have that.

Probably WIS, which I don't know if you'll get an invite for, but it'll probably show up in your Okta dashboard. WIS is like a cloud security posture management system. So the main reason you'll have access to it is not because you ever need to go in there and address findings.

Like every once in a while, we might assign one to you. But for the most part, they have a. If you use like an IDE, like, oh, this is another one you'll get access to. If you use an IDE, like a cursor or VS Code or something, they have an extension where it'll highlight, like, infrastructure's code misconfigurations while you're developing.

So you don't have to, like, wait until it's deployed to get that feedback. That's cool. So that can be really handy too. Yeah, it's kind of a shift-left thing. Awesome. Yeah, cursor so AI you have a couple options You get you can choose if you'd prefer to have github copilot or if you'd prefer to have cursor, okay We are also I'm gonna throw another couple options at you. We're also

This one's not available yet, but it will be available soon. We are in the procurement process with Improfic, and we do have some Cloud Code seats factored in there, if that's more your style. Yes. Cursors to Cloud Code's number one for me, yeah. Yeah, yeah, I'm the same way.

I use both. Like, it just depends what I'm doing, but... Okay, so... When we get that procurement deal pushed through, I'll make sure you get a Cloud Code seat. Something I've been doing lately, which I've really been enjoying, is using OpenCode with Bedrock. So through your development environment, you'll have access to Bedrock models.

So you could create a Bedrock API key and use that in OpenCode if you wanted. And I could use Opus? Do you use Opus in there? You can use Opus. I do, but it's so expensive. So I've been just rolling with Sonnet. It's been pretty good with OpenCloud through Bedrock. The thing I like about doing it through Bedrock is I find flawed code during the day on weekdays gets slow.

And it can take a long time to do simple tasks. But through Bedrock, it's like totally different compute infrastructure. And it's just snappy all the time. So I've been really enjoying that. Is the cost the same, or? So it's it's the same as far as price per token or price per million tokens okay but we do technically through our AWS enterprise contract we do actually technically get 10% off

So it's, I mean, that's a marginal difference. But it's technically slightly cheaper. Yeah, OK. OK, cool. So if I connect to Bedrock, not only do I get better performance, but it's also potentially 10% off. Yeah, exactly. Cool, OK. And if you've not used OpenCode2, because I just started using it recently.

I finally caved and thought I'd try it. It is, I was telling somebody yesterday, it's like a double-edged sword of like, it's so good because it doesn't, it doesn't ask you for permission at every turn of the way. Oh. But it's also a little terrifying for that very reason. Yeah, yeah. Right?

So, um, yeah. Do you sit in plan mode? Do you sit in plan mode and just like, you know, like really dial it in before you let it do anything? Refine it. Yeah, exactly. That's exactly what I do. I'm a little terrified that it's just going to go off the rails and like do it something.

Yeah, yeah. But it is good. I definitely recommend giving it a shot. Um, I don't know that it's, like, we haven't run it through our, um, our

I don't know if it's in the AI governance committee yet, but it's kind of a loophole because it's through Bedrock and Bedrock is kind of approved for us, so I don't know. I gotta bring that one up in the next meeting. You'll get, I'll invite you to, it sounds like maybe there's value in inviting you to Cursor. And then when we get our Cloud Code seats, I'll invite you to that as well. Our main goal is really to just like,

I don't know about you, but my workflow has shifted to almost entirely AI, and I was a pessimist for a while, but I found workflows that just work, and so I am willing to throw whatever tooling you need at you to be the same way and be as efficient. So you just let me know, as we get these tools rolled out, where you feel gaps and that sort of thing, and we'll see if we can fix them.

Let's see, other things you'll need access to... Are we on Jira yet? So we're not on... So the platform team, the org mostly uses Jira for... For like our enterprise ticketing stuff our product team is going to JIRA We're still on linear. We have some deep linear like integration stuff. So we're probably not gonna migrate yet Okay, it'll probably be a while Which I prefer linear anyway

And so that's another place where you'll get access to Linear if you haven't already. Linear is great with AI stuff too. You can do both cursor and cloud agents from there. You can just mention Slack channels and tell it to create a ticket for you. I need to get a look at your MCP JSON and see what you're using. Yes, I can give you some tips on that too.

Our primary, our current, okay, so this is something that we're gonna have to talk about for forward-looking stuff like projects we'll be working on because you have a lot of MetFlim experience. Yeah. I don't know if you view that as a good thing or a bad thing, but I want to leverage it however we can. I like MedPlum. I really like it. You like MedPlum, okay, so it's a good thing. Good. I want to leverage your MedPlum knowledge as much as we can.

Sure. And so I want to involve you in those projects as much as possible. We do, however, also have a big payments project that will need your attention. And so just a heads up there, it's probably going to be a little bit of a mixed bag. And I'm fully aware that those are two very different domains, payments and EHR type stuff.

So if you get overwhelmed or if you feel spread too thin, just shout. You and I will keep a tight feedback loop. I don't want you to feel like. You know, like burnt out or like you just can't focus enough in one area to be as effective as you'd like. So you just keep me posted on that. I also want to look, I think we have a workshop with them.

The MedPlum team are awesome. They are like hand-holding us entirely through this MedPlum journey. It's so helpful. I don't see it on the counter. I'll have to ask when it is and I'll make sure you get on that. Okay. But anyways, the reason I thought of that, our current EHR partner...

Healthy, who we still have some deep, deep integrations with them that we're going to have to see through for a while. They do have an MCP server that you can run locally. And that's really helpful. I mean, it's a GraphQL API. So it sort of is an MCP server right off the bat.

But it does have some tools as well that make it a little bit more useful than just So that's one I use a lot Yeah, I'll show you some of the other ones that I use too. I'll dig them up who provides video for us Do we use healthy internals? Oh, that's a great question. So we were using a tool called doxy.me. Oh, yeah, yeah, I know them. We have since been migrating from Doxy to a more proprietary system connected to our Amazon Connect instance. And so it uses the Amazon Chime SDK for powering video there.

Oh, is Chime staying? We have a custom waiting room thing. I thought they were getting rid of Chime. They got rid of the Chime product, but they're keeping the Chime SDK around. to connect to that for the video integration. So probably so that what like from a.

From a, like, I don't know, appointment entity or appointment resource, you could link out to them. Exactly, yeah, on both sides, right? On the physician side and on the patient side. Sure, yeah, that's nice. Question. I don't know much about Mad Plum. I'm not very involved in that project, but you just triggered a question for me. Yeah. Because this is something we face ourselves, right?

Do bots run like asynchronously like as a reaction to something happening or are they part of a lifecycle hook where like for example if you were going to create join links for a patient and for a provider Would that be part of the appointment creation life cycle, so that when an appointment is done being created, you get back those join links right away? Yeah, you can do both. Or would it be like an asynchronous trigger? No, you can, yeah, it's event driven.

Okay. Yeah, so, yeah, you'd get it right away, yeah.

Something we struggled with with our customers was because, so this is this is a big pain point actually, and this is just a broader product discussion, so this is like kind of a good topic for us to cover for just context for you, so We're going through a lot of transformations right now. One of them is the EHR that we're using. We are trying to get to MedBlum. The other is that the way our customers implement with us really sucks. They...

I'm just going to draw. We're going to go straight to Excalibur because I'm a visual person. And I can show you these things, Nassim, instead of having to talk about them without aid. Go get my Zoom, or my Google Meet, make sure to screen.

And let me go back over to that window. You can see Scaladro OK? Yep. Cool. So OK, so we have Our customers have their own patience. They will often build some web page. And then we have...

We have the Healthy EHR. And this is like a multi-tenant EHR. So every time we stand up a new customer, we create a new org within Healthy. And that's like our customer's org. So patients visit a customer website. The customer has built their system against.

It has been edited to include proper punctuation. We have our own UI, which is basically a sort of different themed and much more efficient for our providers UI for healthy. And it also has some dependency on our back end, and it's sort of like. It extracts away both of those things to make a sort of unifying experience for what the providers need to do and what patient support teams also need to do. From there, so like we'll just, we'll stop here on the current state. This is what it looks like now.

And there's a lot of benefits to this. This was really great when we were like early and young and like didn't have the resources to build our a lot of our own stuff. We just build integrations effectively. But we also like have very little control of like

How customers integrate. And there's a lot of data components that are missing in Healthy that make it really hard for us to do our jobs. And so, rather just try to like shove an API between us and Healthy, we realized like we'd rather have something like Metblum that gives us like the primitives that we can use to abstract away our business problems without having to reinvent the wheel on all of those, which we'd have to do a lot of with Healthy.

So what our new model will be is we have sort of this whole start. Except the ingress point will be what we're calling our partner's API. But it will effectively be us. And we then may have, not healthy, but WebPlum in the background. So this is like, some project is integrating with WebPlum as our EHR. We're also building a payments. This is the other one that you'll be highly involved in, which is our payments platform, which is like kind of Stripe in the background.

All right. We're trying to abstract away the actual payment processor similar to the EHR and because we want to be able to support multiple in the future as well. So we'll start with Stripe, we'll add support for ChargeBee later, maybe Braintree later as well. So that when our customers are processing their patient's payments, they're also doing that through our API.

We also handle product management for them, product lifecycle management, all that stuff. Et cetera, et cetera, right? So this is the model we're trying to shift to. Still staying event-driven, of course. We're going to keep our core architecture stuff. We're just not going to be doing it off of the EHR like that. Yeah, yeah. A little more like this, you know?

Yeah, yep. Which is fine. Yep. We have an event gateway thing that we built, too. I'll fill you in on that later, that sort of takes events from these disparate sources. Transforms them, and again, removes the implementation details of that vendor, and puts them back on our Enterprise Service Bus as canonical OpenLoop events. Is there an OpenLoop data model?

Yes, but it's like very fragmented and not like not well documented So we do like one of the other we just we just zoom in on this Look at what this looks like. So this might actually be a good time to do We'll do Figma later. So let's just look at how we conceptually organize our system. We have an API surface area. This is often multiple APIs. We might have an internal API, a customer-facing API, integrations API. We treat all of these things separately.

We have sort of what we refer to as domains. My preference, generally, is that we keep domains kind of broad. And have subdomains within them so rather like instead of like micro services having like macro services right where a domain sort of represents like a business unit or business sort of value No, it's just like less overhead a team can own an entire sort of bounded context and really become experts in that domain Instead of instead of like having way too many services to manage

So then we have sort of like these domain pieces. We then have what we call our enterprise service bus. Okay, so that's how they're all communicating amongst each other. Exactly. There are some cases where like... It doesn't make sense to, where like you need some data from another system and it, and like generally I say like store a local cache of that data, update it like eventually consistently from through events if you need it. There's some cases where like that just doesn't make sense right like the organization service is maybe a good example of that where like.

If every other domain needs some information about an organization, it probably doesn't make sense to replicate it like 40 times. It probably just makes sense to reach out to the organization service if you need that information. So there are times where we sort of break that rule, but it's just, you know, use your best judgment.

But you're exactly right where communication is basically like... Like this. And like, you know, maybe in some places this arrow points both directions, right? Yeah, yeah. But this is the general thought. And then we have other types of services where like, it's truly just one way where like we have, for example, we have a.

Okay, that's the whole meaning of the analytics. Okay. Yeah. Okay. Okay. Maybe you spin up like an open search cluster there and you like do something through that. But like your primary database should be responsible for receiving like transactional reason rights, right? What do customers expect from the API data contract?

Do they expect buyer or do they expect like a JSON API that's ours? Do we have control of that? Excellent question. So, our customer persona is primarily non-healthcare companies. And so, perfect question to ask. They would throw up if we showed them FHIR. Yes, okay. I hate FHIR, but I love FHIR too. I just, you know, yeah. So, like, the sort of responsibility of us here is to abstract away the details of FHIR and give them a standard REST API that they, as marketers, will feel comfortable using.

I would say, like, our customer persona breakdown is very skewed if you do it by volume. But just across the board, our customer persona breakdown would be something akin to 85% are performance marketers. They're really good at marketing, building a brand, establishing that brand identity and persona.

They're really good at top-of-funnel patient acquisition. Keeping patients engaged and providing a good experience. That's like, that's like 85% of our customer base and that's probably 90, 90 plus percent of our actual patient volume is through those customers. We have others that are starting to grow with things like like the employer space, so like health equity is a customer of ours.

They do like HSA, FSA type stuff and like It has been edited to include proper punctuation. We definitely will, though, at some point, and I don't know when, we will have customers who are like, if we sign a big health system, right? That's gonna be like a year and a half sales cycle, but it may happen someday where we sign a big health system customer, and they're absolutely gonna want FHIR.

So I think we want to have a way to surface that information through FHIR, even if it's just through, even if it's through, like, I am trying to think of the best way to like draw this out, but even if it's through some like interchange Yeah, we can give them an API key to our med plum API

So they can hit our MedPlum by right. Yeah, yeah. So that brings up another important thing, which is like, while MedPlum will definitely be the system of record for a lot of our. For pretty much anything clinical, it'll be like our system of record. There will be things where we want to replicate information into MedPlum for sort of sake of posterity or for that use case where like payments being a good example. Yeah. MedPlum will not be our system of record for payments, but we likely want to like...

Have a Stripe ID or something, right? Yeah, we want to like replicate some of that information into the MedPlum instance likely so that A, it's sort of holistically visible there and then B, if we get to the point where people need to pull information, want to pull information from MedPlum, they can get a better picture of like the actual

Yeah, yeah, like a fire extension or something that's for open loop something like that. Yeah. Yeah. Yep, exactly What else? What other questions do you have that we can do in this initial rapid-fire session? Oh, wow. Let me look at my notes. I've been kind of building a little bit of a knowledge base based on some of what I've already heard from discussions and stuff like that.

So what should I be focused on for the next two weeks or so? Yes, next two weeks primarily is... Business knowledge and understanding, just absorbing context. A, that's the sort of like intangible side. The more tangible side. I'm going to get you connected with the PM who's leading payments right now.

He is a, he's actually like a contracted PM that we have, who's like an expert in this domain. Awesome. We are also engaged with Stripe with a pro-serve agreement right now to build out what's canonically referred to at OpenLoop as the payments ESL or enterprise service layer.

So if you see ESL, that's what that's referring to, it's the payment system. I'm gonna get you connected with him. He's just really, we did some engineering sort of reorganization and shuffling around. Most of our teams are short-staffed. I guess that's the other, that's the other like disclaimer I'd give you here is like we are playing from behind.

We've been under-resourced for since day one of this company. I don't know if I told you during the interview cycle but we had only about 10 engineers up until December of 24 and January of 25. And then we hired, like, 40 engineers in, like, a month, which, like, I would say, yeah, it was. And I would say, like, our code base was, like, it was actually, like, clean and pretty well organized.

It didn't do a lot, because we were pretty resource constrained. But it was pretty good, and we didn't have a lot of tech debt. And then we accelerated like crazy. I told everybody what this was going to happen, so it was no surprise to anyone, thankfully.

But what happened was we did accelerate in what we delivered for some things, but we also regressed the quality of our code base and introduced a lot of tech debt right away. And now we're sort of in this recovery mode. So while we have these new efforts of this new partner, this what we call the Partners API, the customer-facing API, we're setting up this new payment system. We're trying to migrate to a new EHR. We're also going through, as part of this exercise, I should say the supporting function of this entire exercise, is what we've also internally called our next-gen platform, which is doing all the same things.

It's the exact same architecture, We used to have a monorepo. You'll get access to this monorepo at some point, but I don't want to scare you, so I'm not going to give you access to it yet. It contains a lot of these, which was fine until a lot of these new hires started saying, like, oh, we have this Dynamo table over here.

I'm just going to like... I'm going to add a parameter and I'm going to go read from that table real quick. And when people started doing that, we were like, okay, okay, okay. We're going to pump the brakes here. And so now every domain has its own repo. It gets deployed to its own AWS account.

So we're going through that transition through this. We're just making it harder to go across these bulkheads. Yeah, yeah, get rid of some spaghetti. That people don't introduce us. Yeah, and we're doing it by separate repos, separate accounts. We're just making it as hard as possible to make that escape.

Yeah, I love it. Yeah, yeah. Oh, yeah, that's some additional context. Like social engineering in a way to guardrails, yeah. Exactly right. It's all part of culture. So, yeah, I'll connect you with Brian. OK, great. He'll get you set off on that. We'll get you, like I said, GitHub access today. We'll get you access to the payments repository. I'll try to set up some check-ins between you and that, like, Eng team.

I'm not sure what their, like, cadence looks like for product and check-ins or stand-ups or anything. So. We'll just get you integrated into that workflow and see where Brian, that PM, needs your assistance most. I know he has a couple of different initiatives that could use some help, so. Cool. Yeah, that's what we'll start with. I'm probably going to also add you to a couple of random.

Actually, I'm definitely going to add you to a meeting that we have, assuming you can attend it at 10.30 AM daily, or every weekday. This will probably be a temporary addition. It's really helpful for gaining context in the business. So you can just see, like.

With things that you're not immediately working on, it's really good to get insight into what's breaking and where we need help. I think something we talked about during our interviews, everybody here is sort of expected to just help try to solve problems.

And so we're very much not the type of company where it's like, you stay in your lane, you don't solve that problem. You can step on toes. It's like if you have an idea, shout it from the rooftop. Cool, I like that. So we like people that just like identify solutions to the problem and own it, right? And so like it doesn't even have to be you that does it, but if you have an idea like don't hesitate to like own it. It'll probably be a little while to feel like you have enough business context to even do that.

So like no pressure, just letting you know that's that's like the point of that meeting. So I'll add you to that. And it, like I said, it'll probably be a temporary ad. I don't want to like drain your time with that meeting if it's not valuable, but I think initially when you join, I think it can be really helpful because you get to see a lot of business problems.

So awesome. Should I schedule another one of these for sometime next week? I think so, yeah. I'd like to keep, or maybe even like if you have a chance to like get in get in touch with Brian today, maybe we can even meet tomorrow. Okay. We'll see, like, if it's not gonna be valuable to you, I don't want to use up your time, but I do also want to make sure we don't leave too big of gaps between when we meet this early on. So let's just play by ear, like, at the latest, let's meet early next week, and then tomorrow, if it's valuable, we can do that too.

Sounds good. Cool. All right, I'm going to go try to meet up with Carrie really quick. So like I said, watch for those invites to that meeting. And then watch for the invites to the other tooling as well. And then I'll send a DM with you, Brian, and a couple others to make an intro. Awesome. Cool. Exciting stuff. Thank you so much. Yeah, thank you. Excited to get you rocking and rolling. Yeah, man.

Thank you.