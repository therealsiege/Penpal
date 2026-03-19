# @Thursday | Payment System Onboarding

### Action Items

- [ ]  Brian to invite Clint to daily stand-ups for payments and revenue team
- [ ]  Alex to tell Brian about adding Clint to stand-ups after this call
- [ ]  IT to provide Clint access to GitHub organization
- [ ]  Alex to grant Clint repository access once IT provides org access
- [ ]  Team to meet up in Nashville office week after next week
- [ ]  Clint to review code and schedule follow-up meeting with Alex to discuss quick wins

### Alex's Background and Move to Nashville

- Alex was born in Peru and moved to the US at age 14, living in LA from 2005-2016
- Alex is a US citizen (naturalized in 2012) and got married in 2022
- Started petition process for spouse's US immigration, which is nearly complete
- Officially became a US employee on February 17th
- Currently in Peru, returning to Nashville on the 15th
- Closing on a house on the 16th in Hermitage area
- Chose Nashville for calmer lifestyle compared to LA, more affordable housing, and spacious properties
- Visited Nashville last April on business trip and liked it

### Company Growth and Office

- Office location being finalized - looked at East Nashville location but now considering downtown Nashville
- Currently have WeWork space available for reservation
- Company has grown exponentially with new teams forming (security team is 2 months old, QA team recently stood up)
- Curtis and team were very aligned about wanting to hire Clint

### Technical Architecture Overview

**MedPlum Implementation**

- Moving from Healthie to MedPlum as clinical data repository
- Building facade layer on top of MedPlum to remove bespoke client integrations
- Clients will integrate with OpenLoop API instead of seeing underlying systems
- Security team is pushing for cloud-hosted MedPlum version rather than self-hosted
- Clint has significant prior experience with MedPlum, which was a major hiring factor

**API Gateway Architecture**

- **Internal API**: Public-facing but meant to serve internal customers like HeyRavia (acquired AI company for call center automation)
- **Partners API**: Public-facing, meant for external clients
- Both are API Gateway instances but serve different customer types
- Documentation being built in Mintlify (free instance currently, will upgrade to premium when Partners API is production-ready)

**Products Domain and Stripe Integration**

- First project is products domain serving as information API for HeyRavia
- Two-phase approach:
    - Phase 1: Internal API only for HeyRavia and internal customers to create/update/delete products, synchronized to Stripe via events
    - Phase 2: Expose through Partners API with UI for clients to manage products, preventing direct Stripe modifications
- Products stored in DynamoDB, asynchronously synced to Stripe
- Prevents clients from messing up Stripe configurations by editing directly

**Integrations API**

- Brand new, exists in staging
- Receives webhooks from external sources (Healthie, Stripe, MedPlum, Zoho Desk, etc.)
- Public routes with custom configuration from controlled clients

**Cross-Account Architecture**

- API gateways and domains are in separate AWS accounts
- Custom library handles cross-account integration using VPC link to connect private API gateway to public one in different account
- Domains are locked down - this cross-account link is the only way into those accounts
- Platform repository contains all centralized infrastructure (API gateways, Enterprise Service Bus)

### Repository Structure and Security

**Monorepo to Multi-Repo Transition**

- Originally had monorepo (clinic repo) containing clinic app frontend and all domains
- Transitioned to multiple repositories to reduce blast radius and enable team scaling
- Decision reinforced by npm supply chain attack last year

**NPM Supply Chain Attack**

- Attack compromised developer credentials and infected packages
- Made all repositories public as first phase
- Created GitHub workflow to print secrets in plain text
- Alex caught attack within two minutes and coordinated response with Curtis
- Clinic repository had biggest impact due to most traffic and contributors

**AWS CodeArtifact Solution**

- Launched AWS CodeArtifact as private NPM registry to enable package reuse across repositories
- Packages with @OLH prefix are hosted on CodeArtifact
- Allows publishing and consuming internal libraries (CDK constructs, utilities, helpers) across repos

### Engineering Processes

**Testing and QA**

- Currently have unit tests
- End-to-end testing planned for near future
- QA team is one person, 100% focused on facade layer
- Payment/revenue project testing done by engineering team due to bandwidth constraints
- Husky configured for pre-commit checks to ensure commit message compliance

**UI and Design**

- Current clinic app is single web application (Clinic App)
- Plan to break apart into micro frontends
- One UX designer currently on team

**Architecture Philosophy**

- Curtis's vision: All domains/services very loosely coupled
- Willing to replicate data across domains to maintain loose coupling
- Data transmitted through events
- Each domain should deploy independently with only platform infrastructure as dependency
- Challenge: Communicating this vision consistently to engineering team
- Sometimes velocity pressure and technical PMs (former developers) create dependencies counter to this vision

### Team Culture

- Team has talented people with diverse personalities (talkative and quiet but clever)
- Many product managers are very technical and were former developers
- Alex is available to help and answer questions

### Next Steps

- Clint to receive GitHub organization access from IT
- Alex will grant repository access once org access is provided
- Brian to add Clint to daily stand-ups
- Team to meet in person in Nashville office in approximately two weeks
- Clint to review code and identify quick wins for follow-up discussion

Notes

Transcript

Hey Alex, how's it going?

Good, good.

Nice to see you again. Yeah, nice to see you again too.

Yeah, are you using a microphone? I hear your sound is very low.

Oh, it should studio display. Let me... There's some weird setting. Something noise removal? Let me see if that's...

I think I can hear you better.

Okay, let me... That might not be better there, though. It says I'm in default. Let me just try to go to my settings. I might be able to turn up my sound. Yeah, I can hear you better now. Okay. Okay. How about this now?

Yeah, yeah.

It sounds better.

Cool, cool, cool. All right. Perfect. Welcome. Welcome to the company. Thank you. Welcome to Welcome Loop. I think... Curtis and myself were very excited for you to start and contribute to the teams. When we shared our thoughts about your interview, we were very aligned that we wanted you in the company. So that was good. Yeah, so now that we have more time, let me tell you a bit more about my story.

And that way we can just let it introduce ourselves as well. I was actually born in Peru and I moved to the U.S. when I was 14 years old. I lived in California in L.A., for like 11 years from 2005 to 2016. Then I moved back to Peru. And at some point I was looking for a US company because I wanted to have that culture shift again, like moving back to the US at some point. And I got married in 2022.

I'm a U.S. citizen, by the way. I got my naturalization in 2012, somewhere around that. So I'm free to just come and go whenever I want. So I got married, started like a petition process for my wife. And, you know, that takes a year or two. And we're very close to that. point where my wife can move to the US as well. So I was like asking you know Curtis and the HR team what's the possibility of me moving back to the US and you guys hired me in the US and not being hired to the Peruvian entity that you have in Peru.

So they didn't have any issues with me, they didn't have any problem and they actually thought it was like the best move for both the company and myself given the the position I currently hold. So I officially started as a US employee on February 17th.

So that is nothing. Gotcha.

And yeah, I actually, I was in Nashville like a week ago. Oh, really? I'm currently in Yeah, I'm currently in Peru and I'll be going back to Nashville on the 15th to just, you know, I'm getting everything set up there to move with my family. I'm closing on the house on the 16th, if I'm not mistaken. So I have to be there for like about two weeks. And yeah, basically getting everything prepared to move permanently to Peru.

- To Nashville. - To Nashville, oh my goodness, that's awesome. Oh, that's great. So we're gonna be neighbors too.

- Yes, yes. I will be through a hair detach.

- Yeah, yeah, my in-laws live over there. It's so convenient for the airport too. So if you have some travel planned, and the airport is now international, which I don't know how many flights are international yet, 'cause it's kind of a new thing. But the airport's been expanding and stuff too. So, you know, it's, yeah. Oh, that's so cool. Well, I can't wait for you to move here. Do you know where our office will be?

Because I think we're building an office.

I was looking with Curtis at an office in East Nashville a few weeks ago, but I think that's not available anymore. So I think we're going to an office in downtown Nashville. But I'm not sure, it's not defined yet.

- Okay, cool, cool.

- Yeah. - Wow, that's awesome. - Yeah, I'm very looking forward to my permanent move and getting to know you in person as well. I know Kerry posted a message about getting all together for lunch or something, but yeah, I guess we can do it. In two weeks from now.

Yeah, that sounds great.

Yeah. Yeah. And I chose Nashville not only because Curtis lives there, but also because I was looking for like a, you know, a calmer place to live in. I lived in LA for like 11 years. And first of all, it's just very expensive. And it is so, you know, it's just a huge city. I wanted like a smaller town. You know, being able to have a big spacious house that is not convoluted with other houses next to it.

Yeah, that was the... I actually visited Nashville last year in April for a business trip with the company. And that's how I got to visit Nashville and I really liked it. So that's... That's how I chose it.

You made a good choice. I know that. I wasn't from here or anything. I moved from Detroit. And now, as of this year, so my family lives here. And we have a four-year-old. My wife and I have a four-year-old. And he's a wild man. And my sister lives over in East Nashville. So I live in West Nashville. She lives in East Nashville with with her husband and they just had a baby girl two weeks ago or something like that like you know really really recent and then my parents moved down here five months ago maybe to the south side of nashville and my my 95 year old grandmother moved into assisted living right near my house so i can go up there and see her and stuff and she's

She's causing trouble, but she's getting away with it because she's 95. So, you know, it is what it is.

So this is awesome. I love this area. Yeah, I like that it's also like a growing town. And it's got a lot of potential for the near future.

Yeah, yeah. We were just talking about, I want to say like three shopping mall expansions. And they are, their roads and everything, that's what we're kind of really happy about because there's, like, some bottlenecks in the areas that they're going to expand the roads. But they're also, like, not just, like, adding a few stores. They're adding, like, whole floors to the shopping malls. So, yeah. Which I don't know if that's a good thing or a bad thing.

Make sure she doesn't walk in. I don't know if that's a good thing or a bad thing because it might cost me some money. Yeah. Right? But it's exciting. So, yeah, lots of new restaurants always popping up. Yeah. Yeah, it's a good spot to be.

Yeah. Yeah, for sure. So, yeah, let's jump right into... technical stuff. I know you had like a onboarding session with Brian. What did he tell you about the project?

There was also an individual from Stripe there, I think it's named Yan. And we just went over, so originally I thought it was gonna be RCM, I thought it was like claims data. So I kind of went in with a little bit different of a mentality. And I was like, oh, we're claims data on Stripe. Okay, this is going to be interesting. I've never done that before. And then, you know, come to find out it's all cash pay and, you know, yada, yada, yada.

It totally made sense. Part of it's me remembering a little bit, like, from implementing Stripe in the past and, you know, as a payment gateway and management tool. I think there's a... I want to say there's like a... a docker test harness or some type of test harness. Testing was painful when I was trying to get Playwright to test with with Stripe. That may have changed now, but figuring out some of that stuff was a little bit painful.

It kind of in my past life, prior art type stuff. Yeah, I think you run a... a docker... test harness tool alongside your local stack or however you do your local invoking or whatever. And that allows you to run tests, testing and stuff. But y'all have probably have more experience in some of that stuff than I do. Yeah, it's definitely, it made a lot of sense. The direction architecturally makes sense too, to kind of get rid of some of the bespoke connectivity,

to Stripe right now and put that in like one service bus layer. Maybe there would be like an SDK with it or something to help engineers, you know, kind of like, you know, tee things up to get started quickly. But it seemed like things were already cooking on it.

- Yeah, yeah. Let me show you a few diagrams that I have here. It's really more of an overall vision of where we want to go to in the next year and the next one. So let's see. Can you see next Bill Nye?

Yeah, I can. Yep. Oh, Medplum. I see that one.

I know that one. I'm sure you would get excited with Medplum. Yeah, I remember you mentioned it on the interview, so that's also a big contributing factor on our choice because you have MedPlam experience. Yeah, so we have MedPlam here and I'll start here and how we're envisioning MedPlam. And of course, MedPlam is a confidential prior at the moment since we're currently using Healthy. Yeah, understood.

But yeah, we're building like a facade layer on top of MedBlan to be able to also remove the bespoke integrations that our clients currently have within Scalpy. Because they're integrating directly with Healthy that removes flexibility from ourselves. We depend on the client to make modifications, different ways of integration. And that's because we didn't have this layer. That's how the company started.

So now we're building, we're moving to MedPlum and also building this facade layer at the same time so that our clients can integrate with OpenLoop. And that's all they'll see. They won't see what's on the background. They won't see MedPlum, Healthy, or whatever we want to use in the future. They'll just see Open loop and open loop API. So so make sense And we're trying to do the same with stripe So, yeah, the first project that we're working on is a product domain and we call them domains You can you could see them as micro services or something similar but we call them domains and

And let's assume, I don't have editing rights on this Figma, but let's assume that this is the products domain. And this products domain will first serve as an information API for Hayravia. Hayravia is, have they told you about Hayravia?

No, no, I don't think so.

So yeah, Hayrabia is an AI company that we acquired like last year, I believe. They were providing us with AI and automations for a call center, you know, patient support and patient outreach. So automating the calls and the outreach. And we decided to acquire them.

Nice. Okay, cool.

Cool. Yeah. So now HeyReg is part of OpenLoop and we work close hand in hand with HeyReg. And they would be like the first clients for this API. Oh, okay. And that's why we're sending out this internal API and If you see the name, you would say, "Oh, it's an internal API, so that means it's like a private API gateway or something." It really isn't a private API gateway. It's just a... And it's not up-sync.

It's actually just a normal API gateway. Okay. It's actually public-facing, but, you know, protected by API keys or whatever you want to use. Okay. But it is called internal API because it's meant to serve internal customers.

Like the white label kind of gating? Like it's their white label customer, and so they want to configure their experience for their patients?

Yeah, it's correct. Yeah, it's basically like any internal customers that needs our data or our information can consume this internal API, and this internal API will... forward those calls to whatever domain we have connected to this. On the other side we have Partners API which is also an API Gateway instance. This one is meant more for our clients. Well, both are public facing, both are exposed on the internet, but this one is meant for clients and this one is meant for internal clients.

Okay. So, yeah, questions so far.

Yeah, so I assume that we're just going to use MedPlum's API to serve up the fire facade and the RBAT controls there. So if we roll around MedPlum, we kind of get that for free. I don't know if that's already existing.

Yeah, we're not currently planning to implement a fire facade. I know MedPlam uses FHIR, but we find it a bit difficult for clients to implement against FHIR.

So I think that's like a big health system type thing, right? Yeah. Is there a data model or like a contract for these APIs, the internal API and the partner API? Like how do we abstract that healthcare stuff into like a way that they don't have to understand healthcare? to be able to use it really easily?

Yeah, I think we have Mintlify.

Mintlify, oh nice, okay cool, cool, cool. Mintlify is the best one, the best documentation one.

Yeah, let me just, since I moved from Peru to the US, I was signed a new laptop so I cannot find all my links and stuff. Give me just one second.

It's crazy how much effort goes into building out a new development machine.

Yeah, yeah. So yeah, we have like a free instance of Mintlyfy where we are trying to document all the endpoints and APIs that we're building on top of METALOM. So I'll send you this link. And this is meant to be like a first step on getting the premium version of Mintly Files stood up.

Okay.

Once we have like a production-ready version of Partners API, we should be able to send up the premium version of Mintly Files.

Okay, cool.

But yeah, that's on the Partners API side. Okay. But we're now building the internal API and that's what the products API will be exposed through.

Okay, gotcha, gotcha.

And yeah, let's assume that this is the products API. We have, of course, a few Lambdas that will make all the operations. We have a DynamoDB table that's storing products. And then we are making this an asynchronous operation to sync that information to Stripe.

Oh, right, right. So you can get around that catalog issue in Stripe where customers are editing it through the Stripe dashboard instead and things kind of get a little wild because they break things by doing that, right? So we're going to provide a UI to them or is it just they're going to connect to the API? Do we give them a UI as well?

The plan, so it's going to be two phases here. The first phase is going to be just the internal API for Hey Arabia and other internal customers. So they are able to create, update or delete products here on this domain. That will get synchronized to Stripe through events. That's the first phase. The second phase is to actually expose this through partners api as well so that means exposing it to our clients so our clients will be given a ui that's connected to this service yeah do all the operations on this service and then that gets synchronized to stripe in an asynchronous way okay gotcha are there is there like

How do the front ends work? Is there micro front ends? Is there one front end for everything?

Right now we have just one web application for everything, but the plan is also to just break that apart.

Okay, okay, gotcha.

Okay, cool. Yeah, and it's called Clinic App. I'm not sure if you saw it already.

Not yet, no.

We need that Open Look Help. Let's log into staging one. Okay. So... And I'll send you the link as well. Thank you. When I first joined, I had my email named like this and then they changed the email to alex.nima. I think this is the correct one.

Do you have a password manager? Oh yeah, I see.

Yes, I do have a password manager. Thanks for reminding me. I changed my password so it's And I saved it here. Nice.

I would not be able to survive.

We used one password.

Yeah, and I wouldn't be able to survive without my one password. I would be locked out of everything.

Yeah. No, I don't want to edit it. So yeah, this is Clinic App, our Clinic App, and I think the second phase would be to make a UI available here where clients can log in, see their products, create them, modify them directly to our own domain, our own service, and then that will get into Stripe. And that way they don't mess up the Stripe configurations.

Right, right, right. Yeah, exactly, exactly. We'd update our side too.

Yeah, and that way they don't also integrate directly with Stripe. And we have more control over what they can do.

Yeah, yeah, totally.

So yeah, questions? Questions?

Does the integrations API exist already? Or is that improper? Yes. It does, okay.

Yes. Well, it exists in staging. It's brand new. It's brand new, okay. And the purpose of the integrations API is to actually just receive webhooks from external sources, such as Healthy, Stripe, Medland, when we have them. Yep, yep. We also use Soho Desk. - Okay. - Any external that you can think of.

- Okay, so it's a bunch of routes with custom configuration 'cause they're public routes, I guess, that are coming from a client that we control, so to say? - Yes, correct. - Okay, that makes sense. Okay, cool. Oh, this is all clicking for me. And Medplum works so well for this. Medplum fits into this really, really well. And we can just build bots, event-driven bots for integrating with other things.

Like, say, for instance, we do need, like, catalog data in MedPlum. Let's just say we want to have our own extension in MedPlum that serves as, like, the record that kind of goes with the patient everywhere and, you know, et cetera. You know, I'm kind of just, like, spitballing a little bit. We could do that with bots and just have everything event-drivenly integrated you know, updating itself and it would all just work kind of cohesively.

Yeah. Yeah.

Um, I did see, that's a postgres I believe, right? You're that Amazon Aurora you have there. That's referring to the MedPump postgres.

Correct. Okay, cool. Yeah. Uh, that's if we actually host it. Um, but I think we're going for the cloud version.

Oh really? Oh, I like hosting. Yes. Oh, gotcha. I like the control of hosting.

Yeah, I think it's a decision from the security team. We also have a brand new security team that is like two months old. Yeah, you will see that the company has just grown exponentially. And that's why we're having brand new teams all over the place. But yeah, I think that the security team is pushing for like the cloud version.

- Okay, okay, well, yeah, that makes sense. Especially if we have the budget. That's partly what I like about MedPlum too is it's like so available that I've been able to use it in so many projects, no matter the size of the project, it's just kind of become like my go-to clinical data repository. And so I just have like kind of, I don't know, I just have a lot of prior art in that area. So it's very much, you know, close to home.

- Yeah, yeah. Yeah, that's great. All right, let's jump to the code. - All right. - Do you already have access to the GitHub organization?

- Not that I know of. Let me check my email. It may have come over. No, I don't think so. Not yet.

Okay. I'll just send you the links anyway. And when you have access, you can go. Um, I T will give you access to the organization and then you could just ping me and I can give you access to the repository. So it's a two phase, um, access. Makes sense. Operation. Cool. Um, so we recently started like, uh, at the beginning we had, a monorepo, which is this one, the clinic repo. And this contained like the clinic app, the front end application, all the domains that I was telling you about.

But I managed to convince Curtis that a monorepo wouldn't be like the best way Solution, if we want to scale and have a lot of teams.

Yeah.

And like the final nail in the coffin was that we actually got attacked last year with that supply chain attack. Were you able to see that? Let me.

No, I don't know which one.

NPM supply chain attack. It was... I think it was... Oh, this one, yeah. The... the shh... Ulud Supply Chain Attack. Oh, I don't remember. So basically, um... Basically an attacker got access to like developers credentials in NPM and they were able to upload infected packages. So one of our engineers had a package that was impacted and one of those packages was in the clinic repository. Where is it?

Yeah, it is clinic repository. And this was like an automated attack. It wasn't anything manual. The first thing that the attack did was make all our repositories public. So that was... That's crazy. Yeah. So I saw it in like Two minutes after all our repositories were made public, I didn't have owner permission to the organization, but after that, Curtis gave it to me and we're two or three owners now.

So all the repositories were made public. I immediately pinged Curtis. We started reverting all the changes that the attack was doing. Oh my. Like the second phase of the attack was they created a GitHub workflow that basically read any environment within the repository and printed secrets. Printed secrets in plain text. Yeah. So yeah.

You know, GitHub should block that. There's no reason to print out the secrets at all. Why would anybody, if you need to update, it's security, just you have to delete it and put a new one in. You know, that's just like what it is.

Yeah. I mean, that's how it's managed from the settings. You cannot see the secret, you cannot update it. But you can still print the secret on a workbook, yeah? Yeah, like they should be filtering that. Yeah, if you mean it and want to print it, you can print it on a job. Yeah, that shouldn't be possible from a security perspective. But anyway... The first repository that was made public was this one and I guess the attacker had like an automated way to see which repository has the most traffic, the most contributors, like which was the repository that was the biggest one.

So this was the one that was made public first, had a bunch of secrets printed out and that's when Curtis thought that You know, making, having a monorip which is gives you a bigger blast radius for attack.

Yeah, yeah.

And breaking that apart is, you know, if something gets compromised, it's a smaller blast radius.

They don't get everything. Yeah, yeah. Yeah. Maybe they only get a small piece if they puke it in. Yeah, that makes sense.

Totally. Yeah, that's how we started Breaking this repository apart, creating new repositories, building new stuff. And like the main idea of this monorepo was to have centralized packages that all the application within this repo would be able to use such as constructs, you know, CDK constructs.

Oh yeah, yeah. Kind of like a software development kit.

Yeah. Common configuration, utilities, helpers. anything you can think of anything that's reusable yeah you would be able to use it either in these domains or in the applications yeah so we had to find a way to make this still possible so I launched AWS Code Arifat That way we can create our own libraries, packages, and publish them and still be able to reuse libraries from multiple repositories.

So like you just do that and then it comes in as a Lambda layer and through the infrastructure or how do you bring it in?

So yeah, let me show you. In this CI city repositories where I host the CDK code for the for artifact repository. - Okay. - And how Core Artifact works is like having your own private NPM registry. So you're able to push libraries to that private repository and then from another repo you can-- - You can pull a-- - So for example, in this repository I just configured the NPM RC file. to point to my private Core Artifact Registry and then we can download the packages that are published there.

Nice.

Yeah. And so...

And then you can just bump new versions, right? And then you just pull it in through NPM.

Yeah. So any package that you see with the prefix at O-L-H, it's a private repository that's posted on Core, in fact.

Love it. Love it. Yep. I've done that before. Love that. Yeah. What's in Husky? Are we just doing, like, lint and type checks in Husky? Are we doing tests? Are we doing, like, playwright tests or anything like that in Husky?

We're doing, like, pre-commit checks. to make sure that commit messages are compliant with what we have defined. - Okay. - Yeah, like making sure that just general guidelines are followed.

- Okay, gotcha, okay, cool.

- Before committing, yeah. And going back to payments and revenue and Stripe, Given that we started using multiple repos and going back to this diagram, all these API gateway instances are in one repository called the platform repository, the platform account where we have all the centralized infrastructure. This layer is on another repository that's Its only responsibility is to house the facade layer code.

Okay.

And then we have a payments and revenue repository that's meant to be in monorepo, but only for the layer that will sit on top of Stripe.

Okay, gotcha, gotcha. For that, like, for the wrapper around the event service bus, I guess? Yes. The Enterprise Service Bus?

Yeah, the Enterprise Service Bus is also on the platform repository and on the platform account. Okay, gotcha. This is a shared infrastructure. Yeah, okay. So yeah, on the platform repository, like I was saying, we have created the... We have the integrations API, internal API, and partners API. So this is the internal API that we will be using for that payments layer. It's all created here. And this just works like magic.

We created a library that's able to, you know, these API gateways and these domains are in different accounts. So we created an API layer that's, We create a library that's able to make the cross-account integration between this internal API and a true private API that this domain stands up.

Oh, wow. Okay, okay. So those are in separate AWS accounts?

Yes.

Oh, wow. Okay, okay.

So we use... a VBC link to be able to connect a private API gateway to a public one that's in a different account. And that's all handled by this little library. Let me show you the code. So we have the internal API here that's on the platform account and on the platform repository that creates the public API gateway. And then on the... Let's... do this one let's take the facade layer for Babylon as an example okay and then all I do is call my um olh constructs package call the yeah call the secure app construct in that package um

No, sorry. It's actually here. I call the domain stack construct from my library. This creates my domain called patients in this case. And then I go to the app, the actual CDK app. I create that, I instantiate that patient stack. And that construct actually has the configuration for doing that cross account link. So here I just set the role that I need on the other account, the API ID of that public API gateway, the region, the VPC endpoint, the VPC link, and any other configuration that I need.

And this config just handles the rest.

Nice, nice. Is this the only way into those accounts? Are they pretty much locked down outside of this?

Yes.

Oh, that's cool. Okay, gotcha. Gotcha. Okay, that's cool.

Yeah. So the first phase of the payments and revenue stuff is not like this just because, you know, timeline constraints and people wanting things fast. But the next phase is to actually migrate to this same space. schema or this the same integration. You will see that for example the products one it is extending the domain stack but it's not using the REST API configuration yet. So really everything they have to do is just enable this and do the configuration and hit load.

- Okay. - Yeah. - Nice, nice.

- Yeah, so yeah, that's the plan.

- How does automated testing work with this? Is there like a stubbing out or how do y'all handle that when it's like cross account and stuff like that? Do we run automated tests on the system or?

- We have unit tests at the moment. Of course we're trying to do end-to-end testing, but that's going to be something to be planned in the near future. We also recently stood up a QA team. That's only one person at the moment. So we're bandwidth constrained.

Okay, sounds good. So most QA is done by the team?

Yes, correct.

Okay, gotcha. So in terms of definition of done, does it do like each of the linear tickets or what? I think they're linear right now, but do each of the tickets go to product then? Like for UAT, like how do they get signed off on and said, oh, this is good?

Yeah. That's a good question. For the facade layer, we do have our QA guy 100% focused on that. For the payment stuff, we don't currently have someone assigned from the QA team, considering there's only one engineer at the moment. We try to do the testing ourselves. But it's something maybe something that we can, you know, discuss and have a vision on how QA should be done.

Okay. Sounds good.

Yeah. And like, this is purely technical stuff at the moment. So there isn't really like an urgent need for QA, but there's going to be when we start using it.

Yeah. Yeah. And definitely, Probably don't need products involved in as much when there's not UI changes. Do we have like a graphic design team or do we have anything like that?

There's one UX designer, if I'm not mistaken. But yeah, we don't have a big UX UI team.

Okay. Okay. Okay.

Gotcha. Yeah.

Okay.

Sounds good. Which is something, probably something that we should have, right?

I don't know. More creative leeway for us.

Yeah, yeah. But yeah, like I was saying, the first phase is to just have this API stand stood up and serve the reggaeteam. And the second phase will be to actually expose it to - External planes.

- Yeah, yeah, that sounds good. So are, and I assume there's like a list of products we'd want to seed in there? Or has that already been done?

- Oh, you mean like actual spread catalog?

- Into the catalog, yeah, into the catalog, I guess.

- Yeah. I think for like from an MVP perspective, they're going to do it like one by one. But the plan is to... I assume we should be able to do mass uploads at some point. Yeah, yeah. Like having a spreadsheet that follows a certain format and then we can just upload it and populate the database.

Yeah, yeah. Because I was thinking there's a base of this is how we normally set up a catalog and then we would copy that into... like a customer or partner wants a specific one, they would just be modifying theirs. And that would be a way, yeah, I don't know, just brainstorming a little.

- Yeah. But yeah, we don't have like a UI at the moment for this. - Right. - It's probably going to be worked on soon, but yes, it's not live yet.

- Okay, okay. And so are we just using the API right now and like through Postman or something and going to configure things for customers while that's being built?

Yeah.

Yeah. Sounds good. Makes sense.

So yeah, that's basically it for the payments and revenue project. Have you met the engineers that are working on that yet? No, I haven't. Yeah, I'll... Did Brian invite you to like their daily stand-ups or something?

Um, I don't think so. I think I just got invited to the, the operations one to get business context. Um, I don't have a, I don't have any stand-ups or anything.

Okay. Yeah. I'll, I'll, I'll tell Brian, I'll tell Brian after, after this call. But, um, Yeah, we just have talented people here. It's so good to work with all of them. And you'll see all kinds of different personalities. People that are very talkative, people that are quiet but very clever and bright. It's great.

I'm excited. It's been such a great fit. from like a people aspect so far. And that's the biggest thing. That's the longevity thing.

Yeah, for sure. All right. Do you have any additional questions?

Not totally yet. Not yet. I don't think so. There's just a lot of information going on. So I'm processing a lot. But all of it makes a lot of sense to me. And I definitely am starting to see areas where I can be really effective and help out a lot. And that also makes me feel really good about this decision and all this stuff going through, right? It's more effective where I work too.

Yeah. And maybe just like one final thought. Like Curtis's vision is always to have All domains or services are very loosely coupled. That means, you know, we can sacrifice storage, meaning we can replicate data if needed in each domain. But they need to be very loosely coupled. And that means, you know, transmitting data through events and replicating the data, doing it as much as we can to make them very loosely coupled.

No problem. And that's, I think it's proven a bit difficult to, like, transmit that same vision to the whole engineering team because we've seen, you know, dependencies across domains. And, like, the idea and the vision is You should be able to deploy a single domain independently without having any dependency on another domain, except for the platform infrastructure, which all domains should depend on.

But other than that, we should be able to deploy the product's domain, the patient's domain, or any other domain that you can think of independently of one another.

Is it a quest for velocity that cause that to break down at times where engineers like, "I just gotta get this done quick." - I would say it's both velocity and

miscommunication sometimes.

Okay, yeah, of course. Yeah, that makes sense. Gotcha. Gotcha. Okay.

But, yeah, I think the goal is to be able to, you know, transmit that to the engineers, engineers have that vision well spread out. And so they're able to stand up for that as well because you'll find that a lot of PMs or most of our PMs product managers are very technical. They actually were developers in their previous jobs. So they want to, you know, I want to do it this way or I want to, I don't know, it's faster this way and that pressure sometimes goes to the engineers and so they follow it and that's not what we want.

Right, right, yeah, yeah, yeah. Well, actually That is the downside of having a really technical product manager is they have to give some creative leeway, I guess, to the engineers, architectural leeway, etc. Yeah, I can understand that for sure.

All right. Yeah, that's what I have to share. Feel free to shoot me a message if you need more information, if you need help. Anything, really.

- Thank you. Sounds good. Well, once I get access, I'll dive in and I'll start pinging you. - Great. - Yeah, maybe we can meet up again and see what some quick wins are that I can add to things. If I can just throw some ideas out there and see if they stick after looking at the code and stuff.

- Yeah, yeah. And also we should be able to meet in the office. - A week after next week.

- Oh, it'll be ready?

- Like, we have a WeWork space that we can always go to. It's not like officially ready, but we can always reserve it.

- Okay, cool, okay.

Sounds good. - Yeah, like I've been to the office with Curtis two weeks ago. It was just one day. We reserved it for just one day. - Nice. - But yeah, we can just meet up and, you know, Have some lunch or anything.

Sounds great. Awesome.

All right. Welcome again. Thank you. Just shoot me a message if you need me.

Thank you so much.

Talk to you soon. All right. Bye-bye. Talk to you soon. Bye.

You know, your pata was really, I am so silly, I am so silly. I do like to be very silly. Oh, I got a delivery at the door.

Let's go get it.

You want to? Is it for me? No, it's for Dada, but I can't use it yet because my computer's not here for it. I ordered a new computer, but the stand... What for?