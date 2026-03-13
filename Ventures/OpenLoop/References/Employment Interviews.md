# Employment Interviews

Created: March 1, 2026 9:06 PM
Category: Engineering
Status: Reviewed
employment: Yes

Summary

### Meeting Overview

- Technical interview between Curtis Olson (CTO, OpenLoop) and Clint Johnson for a senior engineering leadership position in Nashville
- Both participants share Michigan roots and currently live in Nashville area

### OpenLoop Company Background

- **Origin and Pivot**: Originally focused on physically sending healthcare providers to underserved rural areas; pivoted to exclusive telehealth focus during COVID-19 pandemic
- **Business Model**: B2B2C white-label telehealth platform serving non-healthcare companies
- **Services**: Manages clinical network, protocols, scheduling, HR, licensing, credentialing, payments, e-prescribe, fulfillment, labs, and patient support
- **Growth**: 700% year-over-year growth historically, 460% in most recent year
- **Organizational Approach**: Currently sales-led with organic inbound sales, transitioning to product-led organization

### Candidate Background (Clint Johnson)

- **Education**: Computer science with embedded systems focus
- **Early Career**: FCA embedded programming, Control Tech vehicle data recorders, developed predictive models for automotive road load parameters
- **Healthcare Technology Experience**:
    - Built HL7 interoperability solutions and EHR connectors at Bridge Connector
    - Bought technology out of bankruptcy and founded Graded Technologies and OneUp Health
    - VP of Product at HealthVerity, built identifiable data exchange platform
    - Created eSpiral/Practice Rounds smart-on-FHIR app with CDS hooks
    - Currently Principal at Agilent Health working on preventative care for aging population
- **Technical Expertise**: Strong AWS background (former Amazon employee), TypeScript, Rust, infrastructure as code, FHIR standards

### Technical Stack Discussion

- **OpenLoop's Stack**:
    - TypeScript primary language (Python for data teams)
    - Event-driven serverless architecture using AWS
    - CDK for infrastructure as code
    - API Gateway, AppSync, Lambda, DynamoDB, Step Functions, SQS, SNS
    - EventBridge as enterprise service bus
    - PostgreSQL (Aurora) for complex access patterns
    - S3 and Athena for analytics bronze layer
- **Candidate's Experience**:
    - Extensive Medplum experience (self-hosted FHIR platform)
    - Evaluated Oyster EHR but found pricing model challenging
    - Primarily builds in TypeScript with Rust for core components
    - Experience with Next.js, Remix, React Router
    - Terraform, CloudFormation, Pulumi for infrastructure
    - Built on AWS, some CloudFlare deployment

### Engineering Practices and Velocity

- **OpenLoop's Approach**:
    - Two-week sprint cadence (aspirational, not rigidly enforced)
    - Daily 70-80 person cross-functional leadership sync for prioritization
    - Team-by-team variance in definition of done
    - Struggles with scope creep and MVP definition
    - High urgency culture treating everything as "burning fire"
- **Candidate's Philosophy**:
    - "Swiss cheese model" with multiple quality gates to maintain velocity
    - Platform teams that write production code rather than pure architects
    - Demo days for internal projects to create positive pressure
    - Managing multiple rhythms between product engineering and solution engineering

### Organizational Culture

- Daily stand-ups (synchronous on Zoom or in-person in Lima)
- Cloud Center of Excellence committee meets weekly
- Project-based daily syncs for high-priority initiatives
- Large Lima, Peru office (approximately 40 engineers), 3 US-based engineers currently
- Standing up offices in Nashville and Toronto, additional US office planned for 2026

### Key Strategic Projects

- **Medplum Migration**: Highest priority platform initiative to adopt FHIR-based EHR
    - Challenge: Most customers are not healthcare companies, so FHIR isn't ideal for them directly
    - Need abstraction layer between FHIR primitives and customer-facing APIs
- **Customer-Facing API**: Designing and building new external API with multiple 2026 milestones
- **New Team Formation**:
    - Payments infrastructure team
    - Revenue Cycle Management (RCM) technology team
    - Teams organized around value streams

### Role Expectations and Goals

- **Timeline**: ASAP - looking to establish leader before building team beneath them
- **Six-Month Goals**:
    - Establish and build engineering teams in Nashville
    - Form teams around value streams (payments, RCM, etc.)
    - Drive Medplum platform strategy and abstraction layer design
    - Hit customer-facing API milestones throughout 2026
- **Key Responsibilities**: Strategic architectural decisions, team building, hiring, project leadership

### Data and Analytics

- Current stack: S3 and Athena as bronze layer, Zello Analytics for BI (looking to replace)
- Evaluating Databricks, Snowflake, or similar data warehouse solutions
- Candidate has Snowflake SnowPro certification

### Team Structure Notes

- Peru office will remain and continue growing - not being replaced
- Regional diversification strategy with US offices
- Cultural differences: Peruvian culture less aligned with high-urgency approach
- Benefit of US-based engineers: embedded in US healthcare system context

### Action Items

- [ ]  Curtis to follow up with recruitment next steps within 24 hours (may be impacted by holidays)
- [ ]  Clint can email Curtis with additional questions for asynchronous responses

Notes

Transcript

Oh, I'm muted. Sorry. How's it going, Curtis?

I'm good. How are you? All the time. How about yourself?

Doing well, doing well. Good.

How do you hear it? I'm just going to pull up a little notepad here real quick. And there we go. Okay. Yeah, thanks for joining. I assume you're in the Nashville area?

I am, yeah, yeah. Definitely. How about you?

What about the Nashville area?

I'm in the nations.

Oh, cool. Yeah. Awesome. I'm... I am in East Nashville. I used to live in a German town, moved to East Nashville in... 2021 or 2022, I want to say. So yeah, I'm like out here. Are you are you from the national area originally?

No, I've lived here for maybe 10 years or so We're from we're from MichiganYeah. You too. Oh, you are too? Oh, that's too funny.

That's hilarious.

My sister moved down here too, and she lives in East Nashville. Um, And so it's, yeah, that's crazy.

I laugh because my wife's brother also moved down here. So, and he also lives in East Nashville now. Oh, that's great. So that is really funny. Where in Michigan are you from?

We're from like Auburn Hills area, kind of by where the palace used to be. Yeah, very cool.

I have a pretty large concentration of family sort of scattered about like regional in Michigan around there like man and uncle in Clarkson and man and uncle in, um, Lake Orion. Um, another one in, um, um, I guess they're in more like... Um,Ann Arbor, sorry, I don't know why I was running like there. So, yeah, just scattered about there. Most of them, of course, worked for, like, GM or Ford.

Yeah, totally, totally. My family just moved down here. My parents just moved down here, like, three weeks ago. No, two months ago. Wow. And my grandmother, my 95-year-old Italian grandmother, is a Mary Queen of the Angels. So I can go and see her pretty much whenever I want, and she's loving it. We didn't know if she'd like it. That's so cool.

She's made friends and she says she hasn't had a bad meal. It's just, so she's become so active and stuff. So it's just crazy. That's fantastic. I love that. That's so cool. Yeah, that's hilarious.

My wife and I are from Traverse City, so a little bit of...

We love Traverse City though.

Yeah, that's pretty close to paradise right there. At least for me.

It really is. Yeah, right. Exactly right. Yeah, that's part of why we're down here. We of course go up, most of our family is still there. So we of course go up every summer for a few weeks and Some years we'll go up for the holidays, but usually we stick around here. Cool. Well, yeah, funny coincidence there. I'll maybe like... give a sort of brief background on myself and sort of how I ended up at OpenLoop and then I'll talk about OpenLoop's past a little bit, hopefully.

It's not redundant of what you may have already heard. And I will focus most of the time on yourself. So yeah, I'm Curtis Olson. I'm the chief technology officer here. My background is mostly on the software engineering side, so I went to school for computer science and mathematics. dabbled around a number of different startups in like completely different sectors. So I did some time in the cloud compute space, FinTech, marketing platform, blockchain R&D space, did some consulting for a little while to really focus on like Um...

helping businesses be a bit more like cloud native. Of course that means a lot of different things, but really just like helping transition to more mature cloud consumption. particularly focused on kind of open loop size and up into like really, you know, enterprisey sort of Fortune 500 sort of environments. Joined OpenLoop in spring of 2020. when I joined, they were really focused on physically sending providers around the country in sort of a local tenants model to To serve patient populations that had been a bit underserved, mostly like think of like rural areas where private practices were sort of consolidated into like larger health networks.

So a member that used to drive 20 minutes to their PCP had to drive like two hours to the nearest city, right? So we're physically sending providers around the country Um... And around that time, COVID came to the US. And so we did a minor pivot first of sort of finding physicians that had had COVID and recovered. They were kind of our juggernauts that we'd send in to Cities that were kind of the hot spots and where their health systems were under a lot of stress, we'd send them in to sort of relieve as much stress as possible.

But of course what also happened around that time was a lot of A lot of things were canceled outright, but a lot of other types of healthcare were shifting towards telehealth. Some of it kind of like temporarily, but like some of it we kind of assumed would be longer term, partly because of regulatory changes, but also mostly because public perception of like the legitimacy of telehealth and sort of the healthcare process was shifting.

And so we thought that would stay. And I'd say we were pretty right about that. So yeah. So we focused exclusively on telehealth. Ever since then, now our business model is kind of like, you think about as being like B2B2C. So, our customers really are often not really in the healthcare space, per se. Some of them market exclusively in that space, but usually they don't have a healthcare background.

And so, we sort of take on that burden for them. We maintain a very large clinical network that we train across all of our different customers, all the different programs that we offer, so we can utilize them as effectively as possible. Then we We manage all of the clinical protocols, all of the scheduling, all of the HR, licensing, credentialing. We handle payments infrastructure. We handle e-prescribe, fulfillment, shipping, logistics, all of that stuff, medications, We handle labs, we handle all of the patient support, all of this through this kind of white label services and technologies sort of offering.

So yeah, that's kind of our business in a nutshell. It's been growing at a very fast pace. It has been both chaotic and exciting. and very rewarding. So yeah, we're looking to continue that. Our engineering team is roughly 40-ish people right now, mostly in Lima, Peru. We have, I think, three engineers in the U.S. that are scattered about remotely. But then we're also standing up an office here in Nashville, standing up another office in Toronto.

And then we'll probably add an additional U.S. office sometime later in 2026. Yeah, that's why you and I are here. Awesome. Unless you have questions, maybe I can hand it over to yourself or kind of an elevator pitch on your background and what got you where you are today.

Yeah. Yeah, I did some research on y'all and that thank you that was a lot more detail than I was able to find in a lot of areas. So, but yeah, I've been involved in some technology enabled service type of ventures as well, actually really similar, mainly because of timing, mainly because of regulatory and such. But I, you know, because of Michigan, I, when I graduated college, I went directly to FCA and And I went there for three weeks because one of the 23, I was an embedded programmer and as well as like a front-end engineer.

So I really like JavaScript as well, but my education was mainly focused on embedded software. So when I was hired in there, I was working on like the test cells for engines and such like that. But I was only doing that to learn. I didn't know that I wasn't actually there to like make anything. was laid out for me that I didn't know about. And so I did that for a little bit. And then I went to a company called Control Tech, which one of the direct reports to Sergio, the Fiat owner and CEO, he left and he took me.

And we went to Control Tech and I did the embedded software for these vehicle data recorders that would go underneath the seat of a car. Interesting, yeah. was actually a statistics and analytics PhD. Okay. That was his area. And he... He had these models in Excel that he was curating that had really, really high confidence for being able to predict the road load of a vehicle no matter what type of engine, weight, tires, aerodynamics, you know, anything, any detail you gave it, it could model really, really efficiently and then spit back roughly a thousand parameters that were really, really useful for engineering teams and for residents.

for the regulatory boards because they needed to be able to suggest what targets would be and all that sort of thing.

And so we were a little bit on the cusp of a lot of that stuff and electric cars and a lot of that stuff happening.

This is 2011, 2012 area when this was kind of a little bit ago. And so we ended up exiting that as well. So I built a Java J2E to date it a little bit, Java J2E backend that was able to predict. A thousand parameters, sub 300 milliseconds, so it's really, really fast and efficient. And then we created a front end as well using Angular at the time, AngularJS before any of the newer stuff. And so we created a front end so people could virtually build a vehicle.

And so then IHS Market, Polk Automotive, IHS Market joined forces. They're like two multi-billion dollar companies that pretty much know anything in your garage. And they said, we want that. And so we ended up selling that to them. And I didn't know exactly what I wanted to do. So I was consulting for a little bit. And then Amazon talked to me and they picked me up to do the VDR thing again, but for their large trucking line.

And so I did that. They added stuff for that. company so I didn't get to do the web app I didn't get to do a lot of the things I wanted to do um but while I was while I was a bit stay in your lane kind of work yeah oh my gosh yes yes I'm I I only last so long and stay in your lane. So just there's stuff that there's, um,Yeah, I like to, my hands don't like to stay, my hands stay busy. But anyways, I picked up a digital coin opportunity with the Meharry Medical College here in town.

and they wanted to bake in claims data into a cold coin offering. And so we built that. And along the way, I met the folk that were building Bridge Connector. Josh Douglas and Dave Wenger. And they had built sort of a product for behavioral health that connected EHRs up to Salesforce mainly.

And so they were able to kind of do marketing and such like that.

And it was mainly targeted toward behavioral health at the start. But they had a team over in Knoxville, Tennessee. And they just had natural troubles over there. There's a little bit of a blind spot for them. So they said, hey, can you consult us and can you go over there and check things out? Give us a report on how things are, how our code is, total black box to us. So I went over there and it was like Animal House.

It was like... Awesome in the most terrible ways. I was waiting for Jeff Belushi to jump out. They had the QA guys over in one area and they had dartboards in front of their desk and real darts. And they were just throwing darts. Boom, boom, boom, boom. And the QA guys were just sitting there QAing stuff like super stressed out. And I'm like, that was the first thing I saw. I'm like, wow, that's wow.

I don't know what to call it. There was pizza under the desk from some of the best engineers. Yeah, right, right.

about what they had built. We, we, We did some tech stuff there and then we re-released the Bridge Connector toolset and then started to bring on customers again and things started to take off a bit. In 2020, so... We were backed by the Publix, the same family that does the Publix grocery chain. which is not healthcare.

And healthcare is very different from groceries and from bananas and his banana speech that he always did. Bananas come from all over the world. So he'd always tell my engineers, I was like, dude, that's bananas. In so many ways.

So, but they hadn't checked the books in like 18 months. They were the board and the investors and There's stuff that's written about the CEO that you could read about that and there's stuff that's been redacted and I don't totally know the truth about what happened. But the board wanted to close the doors, they removed the CEO. Interesting.

Sure. Yeah.

Where I ended up creating a few companies because once those doors closed, I went and bought the technology out of bankruptcy that I had originally built.

Oh, yeah.

And stood up graded technologies and one putt health to service some of those customers so they just wouldn't fall flat on their face. And then I pulled in some of myself and the chief product officer. We were silent on all this. We pulled in our best allies to just run things and keep things running. Keep things going and keep things right for the customers because a lot of the time at Bridge Connector we were pumped so full of cash, it was like $49 million in three years, and we didn't have a lot of great direction.

So we were always making a new product. Oh, we didn't know what we wanted to be when we grew up. Oh, we're going to be like a Redox and we're going to tackle HL7 interoperability and create APIs. Okay, great. No, we're going to do social terms of health. And so what it ended up being was like, a master's degree in like hard knocks healthcare type products.

Yeah, right. Rightward create and all sorts of wild cool stuff.

And a lot of it I was able to buy out of bankruptcy, but so much of it was built onJust startup business. I don't want to call it bad business because I wasn't there to make those deals.

So I don't know what the right decision was.

Yeah, right.

But not very great deals for selling those pieces off. And the board did not want to split. The board was not interested in selling technology without the deals.

Interesting, yeah.

Yeah, so we went to of America for a little bit because that was part of the whole deal with things. And then once we were able to get out of that, I helped Ricky at OneUp Health create his interoperability side, his platform. And then I went and served as the VP of product for Health Verity. So I jumped into pharmaceutical for a little bit. And then... I kind of found that product was just not, I just don't want to do product.

I like it at outskirts, and I love strategy, but I like to build, and I still like to get my hands dirty, and there's just, there was a lot of red tape there for a while at Helverity, and then they couldn't build, so I needed something built because I... I had set up an identifiable data exchange as well. So they deal in de-identified data and they have this HIPAA umbrella kind of like thing that allows people to exchange de-identifiable data with expert determination, right?

We were building this identifiable data one and I got like exam one in there, which is like 91% of pharmacy data. I had tons of epics play in there. A lot of the local, like Meehan, like a lot of the local... Sorry, um... HIEs, thinking of consortiums, a lot of local HIEs wanted to play because they're not really making money.

So they're like, okay, yes.

So I got all of them to agree to a specific form of consent, CFR 42 part two, but it was like a global consent that I could sell to the customers. And then I got them to agree on pricing. And so I was like, okay, now I need to be able to create a product to exchange all this data and exchange the orders.

And so I ended up, that's when engineering fell flat on their face.

And I said, I'm very still somewhat close with Andrews. I was very close to Andrews then. "Okay, just let me and my engineering team handle it, "and I'll bring in people from my past and they said, okay, you know, let's, you know, let's do that. And so I, that's where I broke away from them and was kind of like a consultant.

I was hoping for it to be four months and ended up being for two years just because it was hard to like, they have no, they had no expertise in identifiable data.

And so anytime they tried to bring somebody on, It became very overwhelming for them and they ended upLeaving. So we took care of that for them for a great deal of time until their engineering, their mainstream engineering could handle it. But we built a platform on top of MedPlum Which they built a really great platform gosh for I'm trying to think of who the player was, but what was great about it is they were able to save consent, the actual form of consent as well, in FIRE.

And so I was able to capture orders, save the whole order, and then allow audits and all that stuff to still happen.

So I was able to go through the same fellows, and then those orders were able to trigger downstream orders from the suppliers and everything. So we were able to automate all of it and just hand it off.

So it was one of those ones that worked out really, really well because one, we forced them to do things in FHIR.

It's like, this is how you're going to do things.

This is the input, right?

And it was also kind of on the periphery where it's not like there's mortality. It's not like there's directly connecting to hospitals. It was more we're using this to exchange data that is healthcare data, but we also need the guidance and ruling and regulatory stuff around that.

Yeah.

So, and then I, you know, I kind of like to build stuff. So most of my stuff from then until where I'm at now had been consulting stuff or I built the eSpiral tool, which is we've now called it practice rounds, but that's been given off to the infirmary health system and they're now nurturing that. It's a smart and fire tool, smart and fire app with CDS hooks capabilities to put data back in front of the physician.

And then I currently am a principal at Agilent Health. And I don't know how this came about because I'm just now starting to open my ears up and start to look. But, and I love being a single contributor there, but we've been going through layoffs and preventative care for the... For the aging population, it's tough to make money in with utilization and all that stuff right now. So there's been some difficulties.

Thankfully, I'm very insulated from it. But... There's also, when counterparts leave and stuff, even though I'm insulated from it,That doesn't mean there's not more work hitting my table and some of it's not so interesting.

So my ears have started to break up in the past few weeks and it's funny how this has come about. So yeah, that's pretty much my story in a nutshell. Yeah, good timing. Yeah, very good timing.

Yeah, super interesting. I'm curious, you mentioned Medplum too. I'm curious how your experience with Medplum was, if you enjoy using this product.

Yeah, I rolled my own med plum. So, yeah, I ended up rolling my own self-hosting.

And I really like that. They're super helpful. They're so involved. I think I'm on their Discord and stuff. And I think Reshma is like never. She's like always there. Yeah. They have really great engineering there. They have a really great product. They only have like three engineers.

They work a ton.

They are going to grow. But yeah, they're very small. I think they're going to hire like 10 or 15 more people. Oh, good.

Okay. Good for them. I really like them.

My counterpart at Helverity went to a competitor of theirs that's been rebranded a few times that's a little bit more in an open loops world. They're called Otter and Oyster EHR now, but they're a Firebase EHR that's done some telehealth medicine modules in there. I was actually looking at them mainly because Gamble went to them, but I was looking at them when I was looking at Medplum with their pricing.

And they're like, it was like, it was like you pay each invocation. It was like, wait, wait, how much am I going to pay? It was just like consumption. It was just really wild.

And it's led by this guy.

Oh yeah. I see the oyster EHR pricing. Yeah.

Interesting.

That, that, that, that threw me off. And so, oh, they're on, on AWS as well. So it was very natural.

built by actually a couple of engineers there i had a past life at amazon so there's a connection there so it's like oh sure that's funny yeah i kind of want to use y'all's stuff but but i what like what is this pricing yeah i can't sell i can't sell this price yeah that's there no exactly that's that's the problem yes you can't then offload it to your customers right Oh, man. So they had some cool modules.

They had some pretty cool telehealth capabilities, at least when I saw them last. And that was their main direction was telehealth and pediatrics, kind of helping in those focuses.

Got it.

So, yeah. Yeah, really super interesting background. And you mentioned AWS too. Do you have like reasonable AWS familiarity? Is that like the reason to build things?

Yeah, I worked there for a few years and then I still, I don't know if my certification is still alive. I build on AWS primarily. Some of my stuff's on CloudFlare, like Medscript's on CloudFlare. It deploys to AWS still though, of course, if you want. I built a PHI proxy to scrub PHI for, I have an app that needed to, to work with consumer LLMs, but I didn't want the users having to send their PHI over.

So I built like kind of like a scrubber for that. And then it turned into, hey, more people need that than just me. So I kind of just opened it up free to 501c3s and such. So, but I built that on Cloudflare. I mainly build in TypeScript. I really like Rust. So sometimes I use Rust for core pieces. But for the most part, I build it in TypeScript because it's so easy to hire and train.

team on it.

So, you know, and it's like, it's cross the stack, right?

So I can have them running the node on the backend and then running a front end with react and whatnot.

And then, you know, there's all sorts of components that are, that are built for, built for that stuff. So it's super, super ubiquitous. Yep. Yeah.

Sometimes I like to play in like some of the lower level stuff just because that was my past maybe, you know?

Yeah. Right. Exactly. Yeah. Can't throw it all away.

Right. But I guess I'm more of a product. here now, you know, when I think about it, like that's been the big thing is like I've been businessified or something, you know?

Right, exactly, exactly. And then like... TypeScript primarily is a roster mix-in. Are you doing anything with infrastructure as code type stuff? Yeah. What types of...

So back a little bit ago, I helped build a product called Stackery, which was mainly infrastructure as code for serverless type tools. And this was when servers were first kicking off. AWS ended up buying it. So we disbanded some of the people. Chase and the core team went to AWS. I was more on the healthcare side of things. I was building RetroHook, which is an HL7 engine built on top of Stackery.

So I was speaking as a collaboration.

Infrastructure as code, Terraform, love CloudFormation. It's kind of how the world runs in AWS.

Pulumi is really cool.

Some of the newer ones. Let's see. In the front end, I really like Next.js right now. It's so speedy. I like having an API built in.

Big fan of Remix. Some of my stuff is on Remix.

I've not tried Remix, but it looks good.

Oh my gosh.

So I've been following Kent C. Dodds and Tanner Lindsley for a lot of my career on the TypeScript, JavaScript side. And that's how the Remix thing came about. And it was this thing called the, he now does the Epic stack, but there's a thing called the Grunge stack and it's no longer supported. But that's what I built Eastfire on. And it has, architect built in for handling AWS. So it's like got this really nice wrapper, you know, kind of like a CDK wrapper for your infrastructure's code.

And then it also has kind of like a best practices web React front end. And that's partly why that team wrote it. That team's actually the team that wrote React Router. And React Router's kind of been like a cycle, right? It's been like everybody loved React Router 3, then they went to React Router 4 and everybody hated it.

And then React Router 6 and then React Router 3 again. So just like this whole thing.

Yeah, right, exactly. They're the guys who did Remix.

And then they got bought by Shopify and Shopify has like put some money into them and everything. And they've really focused on like browser best behavior. negative functionality. And sometimes you have to wrap your head around a little bit differently around like the binding and the way interactivity works because you don't just like build everything in a state. A lot of times like you'd have a zoo stand or you'd have something like to just handle it all in state.

But this way, it's more server side rendered and stuff like that. So it has its benefits, but it can be a little bit of a learning curve on the Remix side.

Sure, yeah, good to know.

Yeah, I do want to play with your mix. I do typically tend to reach for Next. We use Next for a few projects internally. We have some spas as well. Let's see what else. Oh, and we do use CDK, I guess. I don't know how much you know about our tech stack, but... I didn't until today. Okay, so I'll give you a quick rundown on our tech stack. I know we're at a time we're a little bit past if you have to go tell me.

I'm good. Okay, all right. So our stack is TypeScript primarily. We have some data teams that do make use of Python quite a bit. But our platform and our application, yeah, that's all TypeScript. We make use of CDK. Our architecture is an event-driven architecture, so it's... Very loosely coupled, it's all serverless or almost entirely serverless. Typical, so everything's organized by domains. Each domain owns their stack that it's an independently deployable unit.

Um... The domain, typical composition of a domain is like API gateway, some AppSync, Lambda, Dynamo, Step Functions, SQS, SMS. Um... What else? We do a lot...

Sorry, what? Any Fargate yet?

We have used Fargate to host some open source software solutions, like Retool might be using Fargate, or maybe that's Kubernetes. We have a few Fargate tasks running, but not really for anything that we build ourselves. At least not yet. I imagine there will be some things. But it is like in our like approved technologies list, you know? So I do like Hargate quite a bit.

Well, Lambda's only do HTTP.

So if you have to do like MLP or if you have to do anything like, you know, a little bit closer to TCP that maybe, More esoteric healthcare special.

Yeah, right. Some of those silly ones.

It's an awesome tool for that.

Yeah, I believe it. I absolutely believe it. Yeah, so that's kind of our second. I'd say we lean very cloud-native, so anything we can offload to the cloud service provider, we do. We make a lot of use of vanpidge pipes for point-to-point type things. I really like API destinations and all those sorts of things as well. What else? Yeah, we make a lot of use of DynamoDB. We love Dynamo. If we do need something with more complex access patterns, we'll reach for Postgres, usually Aurora flavor of Postgres.

Um... Yeah, I'd say that's kind of it in a nutshell. I don't think I'm missing anything major. I think the most critical piece though is our enterprise service bus. We use EventBridge for that. So I'd say that's the most critical piece of technology for us. Yeah. How does analytics work?

I don't know if that prompts any questions.

Or anything specific for analytics? Yeah, so right now, I would say we have-so we use like S3 and Athena as kind of our bronze layer. Right now we're shopping around for what we want to use as a more data warehouse type function. For BI processes, we're using... It's just a tool that we have. We actually hate it. Everybody wants to move away from it. We're using Zello Analytics right now. It's a terrible product.

Don't ever use it. We've had a Tableau license in the past. Don't know what direction we're going to go there. We've been kicking the tires on Databricks a little bit. So I don't know if you're familiar with Databricks, but that's a great tool as well. At some point we'll end up with a Databricks or Snowflake or a... you know, they're all slightly different from one another and have their own pros and cons, right?

So we're kind of in the process of making that selection right now. So definitely in our future.

Yeah.

Definitely right in line with where I've been. Somehow, maybe it's just coincidentally, the companies that I've been involved with have always landed on Snowflake. So I've ended up getting my Snowflake, SnowPro certification, all that stuff.

Oh, cool. But Databricks has always been in the discussion. I just haven't been able to use it.

Same. Same. That's exactly the same for me. I kind of want to now just because I haven't yet. We'll probably do some proof of value if we can. Do some experimentation. I'm just, um, something more about like, um, teams and like velocity and that sort of thing. What? How do you best balance like you know, keeping velocity as high as possible, but also keeping like engineering excellence, sort of not sacrificing it too much, right?

Like how do you find that like golden black zone? What have you found to be a useful means for trying to, you know, walk that balance?

Hmm, gosh, it's a different game now because AI, and some of these coding tools. So we have a number of things that I've done in the past, and it's kind of morphed as we've grown. We've mainly had a platform team that kind of specializes in that type of thing. I didn't like at the time having architects that didn't write code and work in the production code and they were kind of just releasing stuff for developer experience.

I didn't find that to be as effective, Having people own projects that they would raise their hand for and say hey this is what I'm working on and some of the some of the the motive was having like a demo day where they can show things off to their peers and such. And that kind of helps put a little bit of like, I don't want to say positive pressure, maybe positive pressure on getting some of those things together.

In terms of like, In terms of quality, it's mainly been like Swiss cheese model. Throw together as many gates as you can so that you can move rather quickly. Where things start to break down a little bit in my past is I've had to manage multiple rhythms. So where we'd have our production engineering team that is running on sprints, they're going, they kind of have the rhythm, they know how to do things, but then we'd get something come out, of left field from solution engineering, from delivery, from QA, which some QA is obviously was on product engineering team.

So that would kind of like interrupt things like where does that boat go in the sprint? How do we prioritize that? So for me, I've had to kind of like manage the rhythms really well. And so maybe think of it a little bit more on a macro level where I've had like a SWAT team to be able to handle some of those things to kind of my product teams. So there's been a bit of that and some extra meetings to help handle the soft handoffs and such.

But I don't want to say I have aOf Magic Bullet, it's very comprehensive for the team and the composition, but it's also But, B, I would say this, kind of like having a Swiss cheese approach, you know, you have like a lot of really good layers in there. Nothing's perfect because you can't focus on one thing. That seems to be the best thing for keeping velocity and keeping, you know, cards moving down and getting them into the void state.

Do you all have a definition of dogmare?

Not as rigid as I would like. And I think it's sort of similar to what you were touching on, right? It's like with like the rhythm piece, right? Is it, it differs a little bit team by team sort of based on like the PM and the lead there, right? So that scenario where I think like some tightening would be really beneficial. Um, I think, too, something we struggle with and sort of suffer from is, you know, just like any other organization, is the scope pre-problem.

And that can often muddy what done means, right? Because maybe a stakeholder comes in who's not as comfortable with iterating or not as comfortable shipping an MVP that doesn't. To some might feel incomplete, right? But to most people, it's like a good opportunity for a feedback loop. Yeah. Right? And so I think like not as much maybe... rigidity or sort of not as strong a backbone on like carving off what an MPP actually should be.

So yeah, I think for a number of different reasons.

Yeah, exactly. For a number of different reasons, we struggle with that. Those are just a couple of them. It's so natural. Yeah. Yeah.

Yeah, absolutely. Um... Any, like, you know, we've gone over quite a bit. Thank you for that. I appreciate that. Any other, like, questions I can answer for you that maybe haven't been answered thus far?

How do y'all do your day-to-day?

How do y'all get together? What's the culture like in engineering and such?

Yeah. I know we're, yeah, I've got time, but...

Yeah, yeah, I've got a little bit, yeah. So, yeah, day-to-day, I would say I'll start, like, organizationally and I'll sort of zoom in. Um, Organizationally, we are a high urgency sort of organization. And what I mean by that is we treat everything like it's like a burning fire and we have to put it out. Right. that is both really good and also bad in some ways. Sometimes it means we're not focusing on the right thing.

But often it means we're just making progress in a lot of different directions simultaneously, which is really good. I think that's kind of our superpower. There's a core... This is maybe the craziest part of our business. There's a core group of people that meet every single day for an hour and it's like 70 or 80 people on Zoom. That is how the business prioritizes day to day. And it seems crazy, but it's highly effective.

Basically members of, like, leaders of pretty much every team are expected to be there. What this allows us to do though is day-to-day pivot where we need to to address high impact areas across multiple departments. That said, it also, once again, can be a potential point of cause for distraction. The primary purpose is to just give constant visibility to leaders of what's happening across the business so that they can prioritize within their team as effectively as possible.

From there, products and engineering is kind of a unit that operates... Right now, through kind of a two-week sprint sort of cadence, I would say it's not well carved off in those time boxes, but that's kind of like the aspirational goal is that we can commit something for long enough to make some decent progress on it before getting pulled away. Day-to-day within product and eng, most, again, this differs a little bit sort of team by team, but typically they have daily stand-ups with eng leaders Sometimes they're async, but usually they're synchronous on Zoom.

Um... And also, we have our Lima Roo office where a lot of them just do it in person. And then we have a couple other sort of committees that meet. We have a Cloud Center of Excellence Committee that meets once a week, which is basically like most senior engineering leadership that just makes sure that like, our cloud strategy is like staying on path and on target and like, you know, addressing challenges as they arise and finding solutions to those problems.

Then we have some kind of project-based project like sort of ceremonies almost. So right now, one of our big efforts is Medplub. We are looking to, yeah, we're looking to use Medplub. So we have like daily syncs on that project. And we're also designing and standing up a new customer facing API as well. So that team also has like a daily sync right now. Those are like the two, highest priority and highest impact projects.

Very large projects, but high impact projects that we're sort of obsessing over right now. And so with this role, that's what we're looking to continue to build on is how we resource towards those projects in the same way and also how we make strategic business and architectural decisions to guide us to that end state that we desire.

Yeah. Oh, lovely. That's... Music to my ears. Is this a product-led organization, would you say?

We're trying to shift it to that. Historically it has been sales led. But, like... We don't see that as a sustainable future. It's been great this far, don't get me wrong, but... Exactly. I don't know if I've talked about growth yet. We've been growing at a 700% year-over-year rate, which has been awesome, but also insane. This past year has been more tame at 460%, but it's still nuts. We've definitely been sales-led.

The funny thing about our sales-led, though, when I say that is most of our sales are organic inbound. And so... It's technically sales-led because they're not coming to us necessarily for our products, but they're coming to us for our operating capabilities. Yeah. Our product is the thing we want to put between our customers and our operating capabilities, right? So that's what I mean when I say we want to shift towards that product-led org.

And once we have that in place, With our exact same model, I would call us a product-led organization at that point, but we're just not there yet. So lots to build to do that, you know? That's awesome. That's awesome.

I'm so interested and so excited. I know I have a lot more questions, but they're probably not super important for right now.

Um, You're welcome to email me as well if an asynchronous response would suffice.

What's y'all's timeline like? Fast.

Like, ASAP. And I think context too, like, We're looking to establish a leader here and then build up the team beneath. So I really don't like hiring a team and then finding somebody to manage them. So that's kind of like, that's part of the urgency and priority here is we really want to get this office stood up with the right sort of leader in place and then start building the team with that leader, not assigning random people to them.

So it's a big part of the role. Sounds great. Sounds great.

Yes. That happened quite a bit at Bridge Connector. And we've filtered through, I don't know, I filtered through quite a few engineers and still have a Rolodex of people that I work with that are quite good. And we could possibly interview them as well and see if they're the right fit.

But yeah, that's definitely a...

a part of the job that I like doing. Excellent.

Yeah, we'll do it. Cool. Anything I can answer for you before we go?

No, I think I'm good. I've got a really good view of things. It's more if you have any questions for me on things. Is there like a six month goal that you have or something for this role? Like a team established, specific technologies taken over type thing? Um...

Yes, so team established is part of it. I think What's interesting here too is we're standing up a few new teams. Where those teams reside is a little bit TBD, but we know that we need teams to own things like our payments infrastructure. We know we need teams to own... RCM is going to be a growing area of business for us in the future. We've mostly done all of that manually with our back-of-house RCM team.

So really integrating some better technology implementations. It's likely going to be another team, whether that folds into the payments one, finance or something more broad, DPD again. We have a lot of net new sort of business functions we're going to need to stand up. engineering teams for. establishing teams that can formulate around sort of value streams, that's definitely a goal. And then the other goals are going to be, you know, we have a number of, if I could describe them to you now, they would seem probably quite arbitrary, but we have a number of sort of like milestones in this new customer-facing API that we want to hit over the course of 2026 in a few different phases, as well as...

that transition to Medplum. That one is mostly being owned by our platform team, and that's probably the most relevant component when you and I talk, it's like what our strategy is for platforming on MedPlemon. um And most of our customers are not like healthcare companies, right? So Medplum presents an interesting challenge in that like FHIR actually isn't great for our customers, but we really want to be able to utilize it, right?

So we need an abstraction layer as well. And I think there's a lot to be done on that, on what that abstraction layer looks like and how we use the sort of FHIR primitives to build the sort of operating model that we want our business to run on, right? So I think that's, you know, helping plot that forward is probably the most concrete one for the next six months, I would say. Awesome. So what happens to the protein They'll remain and we'll continue to grow that as well.

We have some catch up to play with the other teams. But yeah, we're not looking to replace them by any means. It's a little bit of regional diversification. It also just really helps to have-well, I would say, I think something that Peruvian culture doesn't lend itself well to is a very high degree of urgency, right? Just like across the board, that's not like a cultural component there.

We haven't had teams there yet. It's always an interesting learning experience with offshore.

Yeah, you always learn, right, the tendencies of a particular culture. There's always exceptions, of course. We have some very high performers there, don't get me wrong. But across the board, I'd say it's more difficult to get that sort of uniformity and sense of urgency. Also, like, being immersed and embedded in the US healthcare system, it's helpful context to have when you're building in the health system, you know, so.

Suffixes and names and, yes. Yes, exactly. We've seen those issues. How did you, was that an offshore, was that a partnership before that kind of just came aboard or how did that even?

So, yeah, so initially we had worked with a company that sort of specializes, They handle kind of the HR component of like finding contractors there. So we had done that and then we ended up buying out those contractors from their contracts through that agency. And then we set up a legal entity there. So they're technically full-time employees of OpenLoop. through our, you know, open loop sort of Peruvian subsidiary.

So, yeah, it's been good. You know, really... Great like attrition rates honestly There's a pretty good haven of folks that have worked for US tech companies as well based there, which is helpful. So it's not all completely foreign to them, which does help. It's a pretty good relationship.

Awesome.

I better stop because I'll keep going.

Yeah, like I said, email me and I'm happy to reply asynchronously. Anything you think of. I think you should have my email address. If not, ask whatever recruiter you've been working with and they'll be able to provide you my address. It might be on the website as well, honestly. Sounds great. Cool. Thanks, Glenn. Really enjoyed this conversation. I'll reach out. They're usually pretty fast. My first 24 hours, I don't know how holidays will impact timelines, but they're usually quick.

So expect to hear from them soon. Sounds good. Enjoying it. Awesome. My first 24 hours, I don't know how holidays will impact timelines, but they're usually quick. So expect to hear from them soon. Sounds good. Enjoying it. Awesome. Thanks. Have a good day. You too. Happy holidays. Yeah.
		

Summary

### Position Overview

- Role sits between the CDO and engineering managers, primarily supporting teams in Peru (Lima)
- Company has engineering presence in Nashville, North Carolina, Texas, with plans for Canada
- Role involves translating strategy into execution and providing day-to-day team support

### Candidate Background and Preferences

- Currently at a large company but seeking to return to startup environment
- Previously led own Greenfield area/app at current company, which initially felt like startup-style work
- Feeling constrained at large company - difficult to have voice heard and see clear impact despite maintaining critical financial software
- Learned that startup life is where he feels most effective
- Previously worked at Bridge Connector and Health Verity (pharmaceutical software/data company)
- Has both engineering and product leadership experience - served as VP of Product at Health Verity

### Communication with Non-Technical Stakeholders

- Uses visual tools extensively - whiteboard and diagramming for explaining technical concepts
- Implements documentation-driven development alongside code
- Creates engineering wikis using tools like DocuSource and Material Make Docs
- Writes markdown files with each pull request that become part of private documentation website
- Documentation serves multiple teams (solution engineers, product, sales, sales engineering) and helps them do their jobs better
- Approach provides transparency and reduces stress in C-level meetings by having accurate, searchable reference material

### Leadership Style and Offshore Experience

- Prefers small pods of 3-5 engineers with clear decision maker
- Has extensive offshore team management experience across multiple regions
- Led two teams in Ukraine doing platform extensions
- Managed team of three from Andela (Africa-based) - described as some of best engineers he's worked with, served as developer experience team
- Created SWAT team / tier support system to help onboard and support offshore teams
- Emphasizes importance of well-defined work and "definition of done" for offshore teams, especially across time zones
- Recognizes offshore requires more planning, prep work, and guardrails to be strategic

### Role Fit and Strengths

- Considers bridging technical and business strategy his core strength
- Started as full-stack engineer but found technology itself repetitive - more interested in how technology solves business problems
- Took product role at Health Verity specifically to develop soft skills and strategic thinking
- Technical background allows him to be effective in product roles where others struggle
- Sees himself as "product guy slash engineer" who thrives in the middle
- Can help bridge common communication gaps between product and engineering

### Company-Specific Interest

- Excited about MedPlum technology the company plans to use
- Has interacted with MedPlum team for a long time and wanted to see them succeed
- Self-hosted their tool and been familiar with it for years
- Views non-financial benefits as significant factor

### Compensation Discussion

- Expectation: $250-300k total package
- Company range: ~$200k base plus bonuses and equity
- Clint confirmed this works for him - doesn't expect full range as base
- Wants equity stake and "skin in the game" as part of startup experience
- Expressed flexibility given interest in company and technology

### Next Steps

- Interviewer to discuss candidates with team early next week (by Wednesday latest)
- Next stage would be interview with Christian, the COO/co-founder
- Christian is direct and very involved despite not being technical
- [ ]  Interviewer to send availability link email to Clint
- [ ]  Clint to submit availability for next week

Notes

Transcript

on compensation before moving you forward with the next steps.

Okay, that sounds great. Does that sound good? Yeah. Okay.

Most definitely.

Perfect.

So to start, how would you describe the culture and base in their most recent roles? Um...

The culture at the place that I've...

The culture and faith. We're a startup, so obviously we have a fast...

I'm really a startup person, and I'm trying to get back to that area. I've been helping a really large company, and that's nice because... Well, at first it was nice because it seemed like there was a really great safety net and a lot of security with the job and the market and everything. But that's not always the case because layoffs can happen. And so there's been a little bit of a fear of layoffs.

Thankfully, I'm insulated from that or I've been insulated from that. But there's still, and part of what got me to join a larger organization was because I had my own Greenfield area, my own app, all of it was my own area. So I felt like I would be able to kind of have my own pace and keep things going. And the product director at the time was a really good friend and also came from startup life. So was very used to that.

I've since that he's left gone on to another another startup and I've just really been feeling the pain there of not not being in startup life and kind of feeling like my hands are tied my voice isn't always heard and it's really hard to It's really hard to feel like you're helping the company have success. I know I'm in a critical role and the piece of software that I maintain and that I built is really critical to their financial success.

But it's also really difficult because there are so many different initiatives. There's so much going on in this really large company that it's hard for everybody to kind of get together and get their feet in the same direction. And I know that's partly just the nature of it being a large company and that's really just not for me, I guess. So I kind of learned the hard way that startup life is... is kind of the place where I like to be and I feel most effective.

Okay, okay, that's cool. I can definitely relate to that.

Okay, so up to the next question. Like one thing that's really important in this role is clear communication, especially with non-technical stakeholders. So how do you explain something complex technical to people, again, who are engineers, like the COO, the CEO, for example?

No problem. So for me, I'm very visual. Even though I'm a programmer, I'm a very visual thinker. I really love the whiteboard. And so I've kind of gravitated towards tools like that to be able to show the work, show what's going on, so that we can kind of piece it apart and look at it and point at it. I found that to be like a really, really helpful tool for me. And in that same space, theme all of my engineers have have been have been not only writing test-driven development, but they've been writing documentation-driven development.

Which is something that I started doing maybe five or six years ago when I was building the Bridge Connector Engineering org. I really wanted, I wanted everyone to understand. A lot of it was our team needed to support solution engineers, needed to support product, needed to support sales, sales engineering, needed to support so many individuals in doing their job. And the better they understood things from whatever their vernacular was, the more successful we were as a company.

So I focused a lot on the product is not just the code. The product is also the documentation around it. The knowledge base, it's a whole combination of things. That's not just your Node.js or your React front end. And so we've gotten in rhythms where we start our release notes and we write documentation, a markdown file, alongside our code. And so each time a new pull request goes in, there's documentation that goes alongside it.

And it actually, I call it blog post-driven development doing with those markdown files is I write an automation to put those in a website, a private website. We use DocuSource. I've used Material Make Docs back 10 years ago or so. But we basically create an engineering Wikipedia. You could kind of think that's exactly about our product, exactly about what we're doing, the decisions we made, why, what the product's capable of, all the way down to those technical decisions.

And then there are some tools within like DocuSource, where you can bring in some really cool search like Algolia and some other things. And it becomes a kind of a living, breathing site that not only do engineers use, but other people would ask for access to because it helped them do their job better. And so we were kind of trying to create those ripple effects. And so a lot of those artifacts and deliverables and things like that, meetings with C-levels because it's, you know, we start with a diagram or we start with a small presentation and then, you know, that allows me to hone in on what they want to really talk about sometimes.

And so then I have a lot of material to kind of dive in, double click, et cetera, and be able to show kind of a little bit more where the rubber meets the road, so to say, or get into some details that I may not know because I may not have been the person who wrote the code. And so I can still see what that engineer was thinking. Is that on par? It gives a lot more transparency into things than just looking at git commits and pull requests and stuff like that.

And from a developer experience standpoint, it's really, really well accepted. They really like it. They have found that it's very useful for them in the past and there are a number of ways to do it. It's just you got to start somewhere and get that snowball going so that you have that you know that safety net of information that's really really accurate that you can look on when you're in meetings and you know kind of keeps the stress down.

Okay, okay, okay. That's a really good answer. Thank you for sharing that. Now, How would you describe your leadership style? And do you have experience working with offshore engineering teams? Because I don't know if Cortes mentioned that, but... We have engineers in the US and also offshore in Lima.

Yeah, in Lima, right? In Peru? Yeah. I like small pods, three or five. I like to have a decision maker. So that usually is the key driver in why I do that. But there's also some cultural things that are just part of learning and learning about that team and learning how they operate best. What's great about it is with offshore teams, you can bolster really, really quickly if you're ready. And so a lot of that requires a lot more prep work and a lot more communication.

And then with offshore teams, you You really want to have the work in the definition of done really well described. A lot of times they may be working in a different time zone, sometimes not. For me, it was a lot of times it was a different time zone. And so I may not be available or I may not want to be available at 3:30 AM or something when they run into that issue. So I wanna already have that thought out.

And so there's a lot more planning and prep work to make sure that they have success. But then, you know, for us, we also had a SWAT team, which that's what we called it there. I'm trying to think of it's like a tier one support, tier two support. But we had an engineering team that I stood up just to help our internal teams, both abroad and onshore. And so there was somebody on call as well to kind of help with that.

early on as we started to onboard teams because we'd onboard five engineers and they would have a directive but they're like learning all this new code base they're learning how to interact with our core code they're learning about the product and the requirements they're learning about our business and there's just so much there that that I created kind of like a liaison to also help you know onboard those teams and that would kind of fade off and you know we'd onboard another team and Let's see, we had three, we had two teams in the Ukraine that I had doing...

lighter engineering work, you'd say, not platform work, creating stuff on top of the platform work that we had already created. So extending our work. And then I also had a team from this company called Andela, which they mainly source from Africa And we had a team of three in there and they were some of the best engineers I've ever worked with. So they were kind of like our developer experience team.

They were able to work on things that were really, really complicated and I was able to just let them run without a lot of purview, without a lot of oversight. They just, back of the napkin didn't matter and that's just what worked for them. They had a really strong lead and so and they were small team. So I actually still keep in contact with them. So They were they were my favorite team, you know But yeah, but offshore offshore is a little bit different than I'm sure a little bit different communication style a little bit different rhythm You can still scrum you can still do sprints You can still do a lot of that stuff But you gotta have a little more guardrails a little bit a little bit more in place otherwise you're gonna be your you as a as a manager you you may biting off a little bit more than you can chew.

You have to be very strategic.

Okay, okay. Well, that was fun. That's a lot of countries like Africa, Ukraine. Yes. Yeah. Yeah. I mean, we have a team in India, but they are not engineers. They are like the patient support team. But yeah, engineers, we have, well, we're building one in the US in Nashville.

And also like in another other state, the states, I think North Carolina and Texas. We're also looking into Canada and obviously here in theThe approval office. Mm-hmm. Okay, so that's cool. Now, this role sits between the CDO and the engineering managers. The new managers are here, like most of them are here in Peru. How comfortable are you acting as that bridge, translating like the strategy into execution and supporting the team day to day?

I would say that's my strength. I started off as an engineer and a full-stack engineer, and I really, really liked the technology. But I guess I kind of got bored with the technology really quickly. Technology feels very repetitive. And so don't get me wrong, I do like to write code. But the way that the technology works for the business and the way that the technology solves a problem, more interesting to me and telling that story.

And so that's partly why I spent time in product. So I took a kind of a deviation and I went and worked for Health Verity, a pharmaceutical software company and data company. And I worked as a vice president of a product mainly because I wanted to focus on that area. And I thought that would be a great area of growth for me. One, you know, in growth in my soft skills and growth in my strategy and understanding the landscape.

market but I also thought that I'd be really effective there because the build stuff the engineering stuff that's all That's all like... Very much, you know, waters that I've been playing in for many years. So a lot of what some of the technical product folk were somewhat struggling with, that was my strength coming in. So I was able to focus on some of the things that allowed me to really advance myself and become a much more well-rounded person.

Product engineer, you know, like product guy slash engineer, you know, kind of. But that's like that's my bread and butter as I sit in the middle. And that's where I like to be.

That's great because what usually happens a lot of the time is that the product doesn't communicate well or the engineers don't communicate well with the product. So Often, yeah, we have a lot of communication issues there, so it's always good to have someone that is in the middle, who is familiar and who can speak. who can speak like the same language. And draw pictures. I can, I can, I can do that.

Okay, okay.

Now, my final question would be, like, before we move forward, obviously, I want to make sure we're aligned in compensation so there are no surprises later on. What are your salary expectations for this role?

I'm kind of expecting it to be, you know, just kind of competitive around, you know, $250, $300 as, like, an overall package. But there's just, like, so many ways to slice and dice that. And I'm flexible. I really like the company. I really like what y'all are doing. And I really like MedPlum, which is some of the technology that you're looking to bring in, which is also part of it. Yeah, that's also like really close, near and dear to my heart.

That team is, I've interacted with that team for quite a long time and I've really wanted to see them have success. I actually didn't use them at Health Verity. So I've self-hosted their tool. I've definitely been around them and their stuff for a while. So there's a lot of benefit to me. here that goes past the financial thing. So if we can make it work, I would be very flexible on my side. Okay.

So, Orange is around like $2,000, a little bit more.

That's as a base, plus bonuses, plus equity. Does that work for you?

Yeah, you said, I'm sorry, you said $200,000 U.S.? Yeah, that makes sense. That's kind of why I was like, well, I know I'm worth like in this type of role, I'm worth like 250 to 300, but there's like equity and there's all these other things. Like I don't expect that as base. So that, yeah, that totally makes sense. And going into the startup realm, I want to go into the startup realm because I want to be a part of the risk a little bit.

I want to have some skin in the game. And so while I do have stock at this company, It doesn't really feel that great when the stock's not doing well either, you know? So just like the timing of it and everything, it just, when y'all reached out, it just really made a lot of sense.

Okay, okay, perfect. That's everything from my side.

Thank you so much for your time today. I don't know if you have any questions for me.

Oh no, just mainly just next steps. Yeah.

Okay, so Next week, I'm going to have like a quick segue for this, obviously to talk about the candidates and to see who is going to pass to the final step, the stage that is the interview with Christian, who is our COO. He's one of the co-founders.

He's not a technical person, but he's very much involved in the creation.

So obviously he's going to have a lot of questions. He's...

really direct to the point.

So yeah, we're going to see who is going to pass to that stage. So I think we're going to have some news for you like early next week. Wednesday, tops. I don't think it's going to take much.

Sounds good. My timeline is flexible. I can, I can get the golf clubs out if, you know, if, if, if things are right. Um, so yeah, um, just, just let me know and I'll, I'll be around. I can, I can answer questions, whatever, you know, anything, anything that can be helpful. I'm, I'm, I'm around.

I'm going to send you actually an email with a link so you can put your availability so we can have like your availability for next week.

Sure. No problem.

Yeah. Yeah, that's going to help a lot. So once I have like a meeting with Curtis, then we can set up like any interviews like really quick. Sounds great. Love it.

Okay. Thank you, Clint. Okay. Thank you, Clint. It was really, really nice talking with you. Likewise. And I hope you have a great year. You too. Take care.
		

Summary

### Meeting Overview

Technical systems design interview between Alex Nima (Director of Engineering at OpenLoop) and Clint Johnson for an engineering leadership position.  OpenLoop has experienced significant growth, with employee size increasing approximately 255% from the previous year. 

### Candidate Background

**Automotive Industry Experience**

- Began career at Fiat Chrysler Automotive, then moved to Control Tech startup
- Developed Vehicle Data Recorders (VDRs) that plugged into ODB2 ports and transmitted real-time vehicle data over cellular signals
- Built predictive analytics engine for Novation Analytics with 99%+ confidence models for automotive parameters
- Products sold to Aptiv and IHS Market
- Worked at Amazon on large vehicle data recording and transmission systems

**Healthcare Technology Experience**

- Bridge Connector: Grew engineering team from 12 to 37 people including data scientists, site reliability, DevOps, and distributed teams in Ukraine and Africa
- Company dissolved after CEO removal and missing funds discovery
- Purchased some technology assets from bankruptcy and maintained customer relationships
- 1Up Health: Built integration services and API work for FHIR Engine based on AWS Fireworks
- Health Verity: Led product development for identifiable data marketplace, created data exchange using Medplum with 50%+ hit rate
- Built Medplum instance on Fargate platform to support MLP and X12 protocols beyond HTTP
- Current role: Principal Engineer at Agilon Health managing FHIR app and Epic integration

### Technical Discussion

**AWS Architecture Decisions**

- **Lambda vs Fargate vs EC2**: EC2 preferred when data persistence needed during scaling; Fargate for workloads exceeding 15 minutes or requiring non-HTTP protocols (MLP, X12); Lambda for burst workloads with simpler CI/CD
- **AWS HealthLake limitations**: Missing critical adapters like MLP for live clinical data feeds, unlike Azure and GCP offerings
- Built RetroHook (HL7 V2 workflow engine) as no-code platform on AWS Marketplace to address these gaps
- AWS Fireworks lacks user management and resource-based access controls, creating opportunities for third-party solutions

**S3 Cost Optimization**

- Primary recommendation: Cold storage configuration for infrequently accessed files
- Noted AWS S3 costs are significantly higher than alternatives like Cloudflare R2 (20% of S3 cost)

**API Design for Variable Traffic**

- Hybrid approach: REST API for intensive read operations, separate ETL pipeline for heavy writes
- API Gateway with Lambda providing good read scalability through fan-out architecture
- Writes routed through webhook endpoint to Lambda-based ETL flow writing to OLAP data store
- Manager-worker Lambda pattern for handling bursts using promises or set-and-forget flows
- Target latency: Under 300 milliseconds for combined operations

**Microservices Communication**

- Preferred approach: Private API routes with authentication (API keys or other schemes)
- Lambda-to-Lambda communication through API Gateway endpoints
- REST API Gateway v2 preferred over HTTP Gateway for endpoint-level CORS configuration
- Alternative patterns discussed: Direct database access (anti-pattern), event-driven architecture with Redis

**Performance Optimization**

- Cold starts handled through Lambda warmers or migrating to Fargate with minimum instance configuration
- CAP theorem considerations: Must choose two of consistency, availability, and partition tolerance/latency

**Design and Architectural Patterns**

- Hub-spoke (star) pattern most frequently used for healthcare integrations and extensible platforms
- Primarily event-driven architecture since 2017
- Monolith-first approach that naturally evolves into microservices as products grow
- Cautioned against starting with 1000 microservices due to complexity and operational overhead

### AI in Software Development

- Positive outlook on AI tools, primarily using AWS CodeWhisperer (Cloud Code) for past two years
- Command line interfaces for conversing with code are "really, really powerful"
- AI workflow: Pull GitHub issues via MCP, have agent solve with high confidence on focused asks, create isolated branches for human review before PR
- Engineers remain responsible for code quality and must be able to sign off on AI-generated work
- MCP (Model Context Protocol) enables integration with GitHub, sequential thinking, and entity relationship graph data storage
- AI has improved product workflow, ticket writing, and code understanding

### Role and Company Details

**Position Overview**

- Leadership role overseeing a business-critical initiative
- Will lead team starting with at least two current engineers with institutional knowledge
- Expected to hire and grow the team from this foundation

**Company Structure**

- Engineering team started in Peru (2022) with 10 engineers initially
- Currently 95% of engineering in Peru, expanding Nashville presence to mitigate risk and increase diversity
- Clear product and engineering partnership model, considered "just one team"
- Well-defined company vision and path for next 2-3 years

**Success Factors**

- Requires strong understanding of both business mission and technical depth
- Must translate between business vision and technical teams effectively
- Product and engineering have aligned priorities based on core business and company vision

**Engineering Maturity**

- Definition of done has evolved significantly with growth
- Now includes specialized teams: SRE, QA, Security
- Critical initiatives require security team sign-off

Notes

Transcript

Hi Alex, how are you? Good, good. How are you? Can you hear me okay?

I can hear you a bit, no. Oh, okay. Yeah.

Huh, it won't let me adjust it. Let me get to my system settings really quick.

That's what we're like, I just increased my... Upper volume, right?

I'm just gonna do a little bit just because you're also doing something on your side. Okay, is that okay? Did I go too crazy? Okay. That's better. Okay, cool.

Awesome. All right. First of all, it's very nice to meet you. I think the recruiters might have told you a bit more about the The purpose of this interview, which is More inclined towards a systems design interview? So I'll try to make this a conversation and feel free to have questions or anything to do, I want to know. So first of all, I'll introduce myself. I'm Alex Nima, Director of Engineering here at OpenLoop, acting in the company For close to three years now.

It's been a great journey so far, I think. The company is at a steady pace for growth. Um... I think our employee size has grown from About 255% from last year, so that's great. Yeah, it's been great so far. So, I'll give you some minutes to introduce yourself, tell me a bit more about your experience, your technical knowledge as well, and anything that you may think is...

Okay, I'm gonna look here. Okay, three minutes after, I'm gonna try to keep this to six minutes because I can kind of get a little too far into the weeds. So I come from Michigan, Detroit, Michigan actually, and I graduated with computer science up there and right away I went to Fiat Chrysler Automotive and within three weeks, My boss's boss's boss needed an embedded engineer that also knew front end development to help him with a startup that he broke away and started.

And that was called Control Tech. We ended up doing control tech and worked out really, really well. We sold to a company called Aptiv and what we did was we had these devices called VDRs, vehicle data recorders, to be short for that, and they would plug into ODB2, which is pretty much in every vehicle since 1994 maybe, and they would in real time record all that data. I wrote all the software for the VDRs.

And that software would, over a cellular signal, would radio in real time all of that data back. And what it enabled, what the company with that product enabled their customers to do, was to bring all of their testing outside of the fuel cells, was what we used to call them at Chrysler. At Fiat Chrysler. And basically, so they were able to test drive vehicles and get all that same real-time data that they were looking for when they were actually in this enclosed environment, which brought in different environmental testing that was hard to do in those cells.

Some of those fuel cells are like little buildings or they're rooms in a building, and they can go to like minus X degrees Celsius. Like they can get really cold. They can get really hot. They can do a lot of that stuff, but they're very expensive. So that was like the first product and then I helped start the sister company which was, and sold, which was called Novation Analytics and we did a predictive analytics engine for automakers and suppliers.

And so I built a Java, a J2E, this is many years ago, I built a J2E engine that would predict a thousand different parameters based on models that we had built that were greater than 99% confidence. So you could build, and what it was really predicting under the hood is it's kind of like calculus too. It was just predicting integration. It was predicting, if you remember school, high school even, it's just predicting the amount of force it takes to push a vehicle down the road, the ABC coefficients.

So all it was doing was boiling down to that, no matter if you put in a hydrogen engine, electric engine, an old school V8, whatever transmission you wanted. You could define the weights based on the characteristics of the car and the tires, all that stuff. All those details come into all of that calculation. And those are really, really important to companies, not just on a per car basis, but But they become really, really important because the EPA, the California Air Research Board, NHTSA, those like government boards started to use our software to define the regulations for the fleets, which is like their whole group of cars.

And so everybody wanted to buy the subscription, whether they were a tire maker, a brake supplier, you know, or if they were like a large automotive company. And so I ended up, we ended up selling to IHS Market, which kind of knows, They're the company who bought Polk Automotive as well, but they kind of know what's in your garage and they've known that for many years. So I ended up going to Amazon for a little bit and doing large trucking.

vehicle data recording software transmission, similar to what I did at Control Tech, but for large vehicles. And then while I was, I moved to Nashville, and while I was working in Nashville, I got connected with some people who were doing a project at the Meharry Medical College. And it was a digital currency cold coin, but the cool part about it was we were baking in claims data, insurance data into that cold coin so your insurance data would kind of flow with the patient as they logged in.

Um... That turned out to be pretty cool. It was just an academic thing for them. It didn't really go out further than that. But I met the people who were starting Bridge Connector at that time. And so I I originally signed a contract with them to do a tech due diligence. And it turned into, we have an engineering team in Knoxville. There's kind of a black box over there. This is more than just looking at the code.

Can you go over there? And so I was a little bit reluctant at first, but I went over there. It was wild. They were throwing darts at a dartboard that was right in front of the QA team. And so the QA team's like doing QA work all scared, like it was just kind of wild, right? There was pizza underneath some of the desks. It was just absolutely crazy. And then I was looking for the lead and come to find out the lead was working multiple jobs.

So the lead engineer wasn't even there. So, it turned out to be a Let's see, there were 12 of them there, six of them stayed. They kind of turned into, like, they were more web developers. I kind of helped them learn some of the newer healthcare stuff. And still they focused on the web side of things, but they were They grew into creating more business-to-business enterprise software. Some of them didn't make it through some of the trials.

And then I ended up growing the team to 37 or so with some data scientists, some analytics, site reliability, a couple of DevOps guys, and then a few teams of engineers. And then we also had... A team in... Actually two teams in the Ukraine use soft serve and then one team in Africa that team of three really small team super super powerful team that we got from Andela which is like ILike a new spin on, and team augmentation.

So I did a bit of that, grew that stuff. There is quite a bit written about Ridge Connector. There's a lot of Yes. The CEO was removed. Myself and the chief product officer were called into our very first board meeting and we were told about that and we were told that they're going to dissolve the company and sell off the technology assets. And so they're keeping on us to do that, myself and the guy's name is Matt Wimberly who ran product at that time.

Um... The CEO had already been removed and we came to find out that money was missing. So we raised all this money. We just raised series B I just did two diligence due diligence for series B and I got like no sleep So I was I was I felt so burnt like just partly by by that whole thing of like how did this rollercoaster just happen? It was an emotional decision the people who backed Bridge Connector, they were the board and the investors, which is kind of an interesting conflict.

But, um... They also weren't used to healthcare. Their initial success was the public grocery chain. So they did all the Publix groceries in like the South, whatever, however many states that's in. I know it's in Nashville, but I believe it's in other states. And so healthcare sales cycles, all of this type of thing was new to them. But it's also a benefit for me because, in a way, because I got to learn a lot.

This company didn't know what they wanted to be when they grew up. So We built a lot of really cool apps and then We ended up selling most of them off. A couple I ended up buying because they were tied to deals that were sweetheart deals that the CEO made that were kind of like losing deals. And so I bought the technology out of bankruptcy, brought those customers on so they wouldn't fall flat on their face.

And then I bought my closest people, the chief delivery officer and the guy who ran my swap team, who did like all the implementations and support work. So they've ran it. I've been silent for the past four years or so. And it's worked out pretty well. So there's been kind of a little bit of a journey from Bridge Connector, but it ended up okay in the end. After that I went and helped build 1Up Health with Ricky.

So I did all of the integration service work for that API work for their Fire Engine. which is really just fireworks, AWS fireworks with a little bit of like UI, resource-based access controls and stuff like that that AWS didn't provide out of the box, which is kind of why AWS's offering wasn't successful was because there's like critical gaps in creating like an EHR offering. And then I ran product for Health Verity for a little while, which was so...

I thought we were more of a product software company when I started, but we're more of like, they're more of like a data exchange company that sits under an umbrella of expert determination for like HIPAA, right? It's de-identifying data. So, and this is actually relevant, so I'll dovetail on this, but what the main initiative that I was brought in was actually a five-year initiative for them, was they were trying to build an identifiable data market because they were finding that de-identified data was erased as a data.

And so they wanted to move out of that and move into identifiable data, but that was not something they were really used to, so they brought me aboard. I built a couple things. So first I had to do a bunch of product work and biz dev work. And I got like ExamOne, Waystar, a number of EHR conglomerates to participate in a data exchange in which they all said that they would retrieve data based on a global HIPAA consent So it was based on RCF 42 part 2 and they also would return data in the same way.

And so I got them all to do that together and we created a marketplace that was like super super powerful for pharma data and even EHR data. It was like greater than a 50% hit rate because we were tied into the HIEs and stuff like that. So that helped out a lot. Um... But what I used for all that exchange was MedPlan. And so I know that you all have an interest in MedPlum. And so that's where I think there's actually some connection there.

I rolled my own MedPlum instance, which is mainly a Fargate platform. Fargate's really great for if you want to go past HTTP. And so if you need to do MLP or any of those X12, any of those other TCP protocols, you really can't do those on a Lambda. So Fargate becomes a really natural option for that. So I rolled this data exchange on Medplum that ended up helping Helverity move into a totally different market.

I wanted to create some other software. I didn't really want to be in product as much. I wanted to be more in engineering. Yeah. And so I flipped to a consultancy. I planned on it only being two months, and it ended up being two years because they couldn't get the right people in for a while and it just became difficult to hand it off. And since then I've kind of built a few other things and Apparently I The job I currently work is I'm a principal engineer at Agilon Health.

And I manage and create a, I've created a fire app and I have a team that manages that. Um... It's a large publicly traded company that's gone through some layoffs. I'm pretty insulated from that, from the layoffs. Epic is the largest business a funnel and that's what my team handles. So it'd be really bad if they didn't have us working on it. But it's, you know, It's not a startup and I miss, there's a lot of things that I miss about Bridge Connector.

There's some things I don't miss, don't get me wrong, but I'm kind of in a lot of ways I've been searching for that for like five, six years and Open Loop seems, when y'all came through, like it just seems in a lot of ways like a good version of that. So I'll pause there, but that's kind of a little bit of my story and everything.

Yeah, that all sounds great. I'm very curious about your experience with AWS that you mentioned already a few services and Kind of like a combination of your experience with AWS, MedPlan and the EHR offering that they have. I'm curious to hear about your thoughts about the The AWS EHR offering, because we did explore that option some time ago, but we also found that it misses something still. Which AWS offering?

Was it Waterworks or were you thinking of the HealthLake stuff?

Yeah, I think it's that one. The HealthLake stuff? Yeah. I like HealthLake outside of the adapters. And this is where Azure and others went out is because they have adapters, especially GCP. They have an MLP adapter. So you can connect to live clinical data feeds really, really quick and easy. Whereas with AWS, That's something that you're solving on your own? And that's partly in a lot of ways why I built RetroHook.

was I built a product that's an HL7 V2 workflow engine. And it uses, it has an MLP engine. It has an MLP adapter, I should say. It's kind of an engine because it's its own Fargate, right? And it has its own networking and all that stuff. But I built that, and it's on AWS Marketplace, but I built that specifically because a lot of the AWS tooling doesn't go that last mile and there's not a great option for it.

So it turns a lot of healthcare companies off from AWS. And that's, to me, that's why it becomes a little frustrating. I would have rather AWS took on that type of a thing, but I ended up taking it a little bit different because I built it as like a no-code platform. So you can go into the UI and just, you can actually deploy your own infrastructure. So you can deploy your own serverless slash Fargate, which is serverless technically, but your own auto-scaling serverless infrastructure into your cloud.

under your umbrella. And then from there, you open up a workflow engine that's just a React app. And you upload what your data, you know, the shape of your data, and then it starts to help you build an ETL. And then you save that ETL and whenever data comes in, it runs that ETL and everything's lovely. So you can solve for it. And I don't want to like sell you like, oh, you got to buy retro hook. You got to buy retro hook.

But there's a gap there. And I felt that gap so much that I ended up building something internally that I released onto the marketplace and I released externally to other people as well. Um... Nice. S3 for documents? It's like, okay, great. You've already covered two of the major gaps. But now how do I handle user management? It's like, oh, sorry, we don't do that. How do I handle resource-based access controls?

Nope, we don't do that. We're just going to give you an API. That's it. It's like, okay. And that's partly where, and when the CMS thing hit in 2012, 2017 That's where companies rode that wave. Companies like 1Up Health, Smile CDR is one of the biggest ones that AWS promotes. Oh gosh, um, Medplum is a little later, they're newer, so they didn't really ride the wave as much, but... There's a few companies that kind of did a wrapper around AWS Fireworks and Fireworks didn't really involve and it just kind of deprecated.

So you can find documentation on like an old GitHub about fireworks.

And Fireworks is out there. It has just been like...

Rebranded by the community in a way because but because there were you know and AWS probably could have made money off of it because you can think there there are businesses that are surviving growing but That's kind of AWS's... mistake in some ways and maybe it's maybe that focus is good but I've seen it even while I was there I saw it where they just leave stuff on the tables like that's not our business And it's just like, well, there's value there.

So, you know. Yeah.

So let's talk a bit more about AWS architecture and just a question When would you choose, let's say, a Lambda over Fargate or even ECS with EC2 instead of Fargate?

Oh yeah, that's a good question. So a couple of really quick ones is if you're going to roll, like recently, some things are anecdotal, so I'll just give you examples. I did a graph thing recently, graph database thing recently, and I used Memgraph, and I really like Memgraph, but their cloud offering doesn't have Mage installed, and I need Mage for all the normal graph-like algorithms. But I think they don't install it because it's two gigabytes.

It's a weird thing. The Enterprise one, and this is like a side project, right? So I don't want to spend money. So the Enterprise one is 25 grand to start for a year. I'm like, oh man, I don't want to do that. Just so I have Mage and all this stuff. So I ended up rolling my own and I had to choose EC2 because I didn't want my data being dropped with Fargate's scalability, which is nice when you need to have a compute type system, to it, you kind of need to go with an EC2.

So that's one good example of why you may choose EC2 over Vardate. Vardate over Lambda is like--So I would say the main thing for me comes down to healthcare and the access patterns and if I need to go past HTTP. It's rare that I need something that is longer running than 15 minutes. It's rare that I need something that scales more than a lambda. But if that is the case, then Fargate's another natural option for that.

The downside of Fargate for me has always been The The CI/CD. The CI/CD is heavier for Fargate. I really like Docker, so it's not a Docker issue, it's just like all the CloudFormation or whatever, the CDK or Terraform that you're having to write and maintain and manage For Fargate, that's a little bit of the trade-off to me. There's some annoyance, some risk there. And so that's why I really like Lambda in some cases.

You know, there are little bursts, right? As opposed to Fargate. But that's really high-level type stuff.

Yeah, I definitely feel that pain. We've tried Fargate because of certain requirements such as self-hosting some tools and we definitely need Fargate for that. And it's really a pain to be able to maintain infrastructure with infrastructure that's There's sometimes errors and glitches here and there. And it's kind of hard to manage. The drifts. On the other hand, it's so much more simple.

Yeah, totally, totally. I recently tried to spool up a self-hosted version version of post hog. I absolutely love post hog just for like side project stuff. It's a really cool newer analytics type thing. What I didn't realize was it was half a terabyte to self-host it.

So I started going with that and it turned into 500 megabytes. I'm like, why am I doing this this way again? So that one, that one bit me. Yeah.

I have a question about S3. I know you mentioned S3 a few minutes ago. What do you usually do to optimize costs on S3? Because you might have some files that are 3-4 years old and you don't usually access those files. So what would you do in that case to be able to... optimized costs and retrieval in general?

Yeah, so like right off the top it'd probably just cold storage. That'd be like the first thing that I would do. That might actually be the only thing I would do. I would just see how that would work out with just some configuration. If we needed to build a UI, it depends on if there's other access patterns and stuff like that that are outside of people who normally access AWS, there may be a couple things that would have to be done, but I think that might be a pretty easy one with just what AWS has built in.

Um... Are these S3s like the ones Snowflake sits on or anything like that? Is it OLAP S3s?

Yeah, it could be old.

Okay, so sometimes the programs have things built in, but they usually use cold storage as well. So unfortunately, AWS costs for S3 are kind of bloated. I don't know if, have you looked at other providers? I'm not saying to move off it or anything like that. I just, it was like, hit me like a train when I saw R2 was like 20% of the cost of S3 from Cloudflare. And, you know, Cloudflare is not like a big player in healthcare or anything, so it's not, you know, an easy thing to probably, you know, like try to get people to buy in on.

But that's like substantial. Like, why is that to be so expensive?

That's really frustrating.

For sure. Sure. Yeah. Let's switch to another topic more related to APIs. Sure. or services in general. Let's imagine that we have an API or a service that has different write and read speeds. How would you design that system?

Different writes and reads speeds. Yeah.

Or not speed, sorry. I meant traffic, not speed.

Oh, okay, okay, okay. Is it read-heavy or write-heavy? Does it vary based on the schedule?

It can vary based on the hour.

So it really needs to support both? Yeah.

But sometimes read is higher than write and sometimes write is higher than read.

Yeah, yeah, yeah. So, um... I would probably go with some type of a hybrid system, just kind of from a high level. I would do REST API to be able to handle your intensive read operations, maybe support an app or something like that. You could also do a WebSocket if you really wanted to. Gosh, like when you open, like WebSocket's kind of like a Ferrari or something. It's super fast, but you can lose control really easily, right?

There's a lot of... code you write for like network and other things that can happen in the application layer which can be frustrating to say the least. But then on the other side for heavy write type stuff is just kind of like an ETL. and getting that into S3s and then processing those off is a really simple way to do it that I've done in the past. kind of scale from there. is kind of my approach.

So I like to do best of both worlds but in a simple way and then just iterate from there. So maybe API Gateway. A Lambda can provide pretty decent read capabilities because you're going to scale out. If you're on Node or if you roll your own, you can even be faster with like Bon or Deno. But if you're on Node, 2 gig Lambdas, there are two gigs, right? There are single processing two gigs and they fan out.

So you're going to get really good read capabilities. The only thing that you may have an issue with is cold startups on a Lambda. And you may run into an issue with API Gateway and the 30-second timeout, but if you're running into 30-second timeout issues, that's probably a much larger issue than API Gateway. So, but then writes would probably go right back to that same API gateway, just a webhook endpoint that would hand them off to an ETL flow that would just be, you know, could be just Lambda generated, super simple, keep it the same, but separate Lambdas that would then end up writing to either a secondary data store.

An OLAP data store would be really nice for that type of a thing. I come from the Snowflake world, so it's kind of like, you know, my mind is like, don't say Snowflake, don't say Snowflake, Snowflake, but Snowflake's very natural for analytics for me. I even got a certification in it just because I really liked it at the time and stuff. Still like it. I don't like the cost of it, but... You know, it is what it is.

Get what you pay for sometimes.

I know you all are talking about Databricks.

That's a little different though also. You know, there's a lot more you can do with Databricks in some ways. But I haven't really gotten to work with Databricks as much just because it's never been a decision of the companies that I've worked at. So, um, so Kind of like one of those things I've wanted to work with them Um... But yeah, so just kind of like a two-flow system, API Gateway should be able to handle most of that traffic.

is there in terms of burst traffic all of it you know it's gonna it's gonna auto scale so and if you have two different streams coming in you know one stream that's handling Like the app, you know, your read and writes, or excuse me, your read type stuff, your real-time app data. And then you have, you know, one compute, you know, that fans out or has, you know, there's another pattern that I use that I'm kind of thinking about and not...

Not. explicitly saying, but you can kind of do that manager worker Lambda flow, where you can have a manager Lambda that sits behind the API gateway and then just invokes worker lambdas in like a set it and forget it flow or a promise flow, which right, we're in JavaScript, so promises, those are like natural for us. TypeScript, JavaScript, you know, same kind of things, you know. So, but that allows you to, you know, either set it and forget it and then just, you can have a dead letter queue or you can have something, you know, SQS in the middle type of a thing to get it to your data store and, you know, maybe your data store's 10 seconds behind, but you don't have to have like a really large gap between your writes, and your reads, you can have a pretty small latency between those two.

Okay, sounds good. And you mentioned Lambda's cold starts. How do you handle those? How do you make sure that you don't have a lot of cold starts? Introduce a lot of latency.

You can create a warmer. I've done that before.

You just have some of the things.

Right, that's that's like really tried and true it works really well is to have is to have a warmerUm. The upside of that really is just to move to Fargate. That's probably the best thing to do for cold starts, is to move to Fargate and don't let it scale all the way down. You can do some configuration in Lambda to prevent scaling all the way to zero, but I think you're still going to get some additional latency with Lambda that you don't get with Fargate.

I have to look into exactly what spools up or what still needs to spool up in Lambda.

Um...

that doesn't infargate. I have to look at it. That's eluding me right now.

Yeah, no worries. Um, Let's see. Let's suppose that we have a set of microservices and let's say that two of them need to communicate between each other. Um... What ways do you usually do to have that communication in place between those? to microservices.

Well, Probably I'm going to ask some questions about those microservices first, just to see if there's already Communication, you know, if there's already communication that I can leverage,Yeah. Is there already an API gateway or are we talking like Lambda to Lambda communication?

Yeah, let's... Let's suppose that we have an API gateway. And there's two Lambdas that could We serve as two microservices, let's suppose. um And those two Lambdas are exposed through the API Gateway and then each Lambda has its own database. Let's suppose it can be anything. It could be a Dynodb table, it could be an Aurora database, whatever you want to. As soon And we need to have Let's say that we have a patient's microservice and an orders microservice.

And then we need to have the information of the orders. of the patients. And the orders need to be communicated to the patients' microservice How would you do that communication?

So let's talk about it. So we've got an app that connects to an API gateway and that app needs to be able to get a patient, but also with their order history or something. And that's managed through another microservices type thing. So what would be a really natural pattern would be to have a private, you know, have API routes and you can do all sorts of different authentication schemes, you want to go into it, right?

If you're only, you know, if you're doing something light, you can just do like an API key from that Lambda that sits in the patient area to be able to communicate with the API gateway to be able to grab the data, excuse me, to be able to grab the data on the order history. And then all that can happen in a promise that gets resolved before the API gateway needs to return data back to the front end application.

Let's say it's a Next.js app or a React app, right? And so then, right, so then when the person that's up in the building, the billing area, they pull the patient's record. They say, oh, you had this biopsy done. We just got this. We had to get this service order from our other,from our MedPlum data store that sits up here and holds that for us. So it hit that endpoint all within a promise, grabbed that data, the whole goal is less than 300 milliseconds type of a thing, and then returned that data all as one package, preferably JSON, back to the front end so that it can use that data.

And so you could provide a number of different endpoints that are Well, with API Gateway, the API Gateway kind of handles the routing, and you can do that with like a swagger. Like it takes swagger. It takes a number of different specifications, and it also depends on which API Gateway you choose. So you can choose REST or you can choose HTTP, and HTTP is about 30% faster, but that doesn't really matter that much because it's only talking about the API Gateway response.

It's not talking about the whole trip. HTTP over REST, but then you can't do certain things, like you can't lock down endpoints with their own core Of course. There's certain endpoint to endpoint configuration you can't do that you can do in the REST API Gateway v2. So there's a little bit of trade-off there, but I rarely do I see a benefit to use HTTP over REST because it's nice to be able to have that configuration at the endpoint level.

At the resource group level, yeah.

Yeah, for sure. And that's basically like a direct communication, right? Just invoking the endpoint directly and having that information sent to you or all that information. At that moment just a promise right?

You just make a post call. Yeah, right. Yes kind of like eat your own dog food Is that drive to eat your own dog food or something?

I forget what the term is for that yeah, and Do you see any other way to have that data from let's say the orders microservice into the patient's microservice?

Um, yeah, yeah, uh... Yeah, there's probably a, half dozen different ways to do it. I'm trying to think of if there's a simpler one with what we were talking about.

So post call to the API.

Maybe not a simpler one, but just maybe a more complicated one that can be can be useful as well.

Um... So...

Let's see. What would be useful?

You could also like Let's suppose that we have both Lambdas deployed in the same account, you could literally just point that Lambda to the other microservices. the other microservices database, but you would be incurring in an anti-pattern, right? Because you're supposed to have Yeah, your data is isolated.

Yeah. MCP is like a really nice gate where you can define things that are going to happen before they hit your AI tooling. And then also you can inject logic on the back end on the return. Like if they're like, hey, give me somebody else's data. You can like spot check that on the return with your tools to make sure that they're not breaking any of those types of rules and stuff. So it's this really similar pattern, kind of using HTTP or MCP as like that gate between your data layer.

There's compute tied to it, but your data layer and your... interfaces, I guess. All sorts of interfaces? Yes.

Yeah, yeah. For sure. I was actually referring to that. Not that I want to have data in a Redis instance, but that form of communication meaning an event-driven system or architecture that you can communicate between microservices. And related to that, have you heard about the CAP tier? The cat fear.

You might have to refresh me on the cat theorem.

It's related to consistency, availability, and partition or latency. Okay, okay. Which, Yeah, which is related to this type of architecture where you cannot have the three of them at the same time. You can choose from the two.

Yeah, you can choose only two. And that goes to sales too.

So a lot of the discussions come to abstractions and working with sales and product and stuff like that. So it's like surfacing those as three levers.

Yeah, exactly.

Enlightency, I just think of speed. you want it you know it's kind of the that third one for me Yeah, yeah, correct.

So in an event driven architecture, you usually have to choose between, you have to choose two from those three. So yeah, that was the main talking point. Um... Maybe one more question. What design patterns have you used and you think are the most important ones in your tool set?

Oh man, in healthcare? Um... I would say the star pattern is like really, really heavily used. For me and the work that I'm doing, I'm usually, or like a, it makes kind of like a spoke hub type pattern. I'm usually creating a core set of code or I have a team that's creating a core set of code and then I have other teams extending that. And so those contracts become really, really important. And I think that becomes really, really important because...

Healthcare on-ramps integration always seemed to surface. And so being able to solve those elegantly is really, really important for the platform. And so that star pattern, that hub spoke pattern seems to always surface in some way or another. And it becomes really powerful for me. So I feel like I've used that always. Almost at every healthcare company I've been at in some way or another whether it's a You know the core and some adapters or whether it's even like data side with like maps and getting teams to build maps that the platform runs, but you know writing something that's extensible in those ways is probably like The one that I use most often?

In terms of like abstractions, Yeah, most of the stuff I do is event driven, I would say. Um... In the past that's kind of the area that I stick in. Is event driven type stuff. Um...

Let's see. Yeah. Yeah, that's pretty much the end.

Yeah, sounds good. And besides design patterns, what about architectural patterns? We've talked about microservices, event-driven What other architectural patterns do you usuallyYour eyes.

Yeah.

I've been a part of Monoliths before. Um... And they can be done well. You can have a nice monolith. But for the most part, my work has been in microservices and serverless since 2017 area, naturally because of the tools I've been working, naturally because the products I've been building and naturally because of the Um... The way that the tooling Um... Maybe just when I plugged in into the community, I started helping with a company called Stackery.

When I was moonlighting walls at Bridge Connector, and actually walls at Bridge Connector I built on Stackery. So I brought Stackery in when they were beta because I wanted to do serverless stuff but I also needed CICD. There weren't a lot of good options for that back in that time. And so Stackery was starting off, but Stackery couldn't do Fargate, Stackery couldn't do NLP, it couldn't do a lot of that stuff.

And so I ended up moonlighting with some of that type of stuff. So I really went heavy into serverless and microservices. So it's probably been almost a decade since I've really worked on a monolith, I guess. It's not that I'm opposed to them, it's just kind of like... where I plugged into the community, I guess. I'm not against that at all. Yeah.

And when would you use an actual monolith?

Well, so... Like...

I guess I came out with Med Scrub recently and I guess you could call the proxy No, the proxy's kind of microservices now. So the proxy I built, I built a PHI proxy and I did it originally just as an HTTP API. And so it was kind of a monolith. It just would redact fire data and then It went to JupiterCon and was shown off at JupiterCon for their health exchange. And they said, okay, well, can you do MCP?

And can you do unstructured data? I'm like, okay, well, that's like a way bigger ask. Unstructured data is. So let me figure that out. And so I ended up doing a Swiss cheese type of approach to it. And so I pulled out three different other services. So it ended up turning into a microservice. And then they turn into microservices as the product grows. And maybe I start everything off as a monolith actually to try to keep it simple in a way.

And it turns into microservices. It's kind of just how it goes. You know, like...

kind of deliberate, but not declaratively deliberate, you know what I mean? Yeah. And I needed like SpaceyNur, I needed BioBird, I needed Stanford's entity resolution tool. And so all of those were like models and things of their own. And so I needed to run those all in my Docker Compose.

And so that turned into being a microservices, but I was really trying to give you an example of a monolith because at one point it was a monolith. It just... It just turned into microservice.

Yeah, yeah. Actually, that's... I've seen that pattern more than I can imagine. And I think it's really just how the business moves. It's You don't usually need to have like 1000 microservices to start a business or to start a startup.

No, that's risky. That's not good.

Yeah, and it's really risky. It introduces a lot of complexity, a lot of overhead on the operation side. So people usually just create a monolith and then from there evolve into a microservice when the company matures or the organization matures. So yeah, that's actually a great way to... to portray that evolution. You're squirming there. And maybe one final question before I forget. What's your opinion on the use of AI nowadays?

We've introduced AI everywhere and a lot in our everyday programming responsibilities as engineers.

Yeah, yeah. Um... Hmm.

What I like the most about it is almost, I'm really positive about it. Um, There are some cautions, but I... I don't know how many hours I'm in. I feel like I'm two years into using Mainly cloud code since it's beta that's been my favorite tool. I've used cursor a bit as well and sometimes you have companies you have like you're kind of like given specific tools to use, but for the most part, you know, having a command line interface that you can ask and talk with the code about is really, really powerful.

And it's not as much of like, hey, do this task, which is also cool because you can do that, especially with like MCP because you can tie up your Your code agent or a collection of code agents, like if you use CloudSquad or something like that, But you can tie them to your issues or something like that and have like very specific focused issues. Have it, you know, solve that issue, make a PR back into the branch or something like that and then you can review it.

I feel like the development engineering flow has changed and you can get a lot more done really, really quickly if you go about it with like Yeah. And then there's like other... So you can tie it up to like... playwright and stuff right off the gate, which it's astoundingly great. It's seeing images and figuring out problems there, which is, it's amazing at that. So like giving it images is really, really powerful.

But you can also get to validate itself and write tests and stuff like that. So there's some really cool, there's a really cool flow that to me is kind of like the holy grail and it's, It's kind of like you can pull an issue with GitHub MCP into your agent, and then you can have your agent solve it with high confidence as long as it's a small ask, a very focused ask. It may not get it right, but you can kind of rev to try to get it on the right track.

And then what's cool about it is you can create a branch just for that issue. I'm just saying a GitHub. I'm saying a specific flow, a specific example. But then you can create like this specific branch that's isolated to that issue that you can go ahead then and check out and do any human interaction, you know, kind of human in the middle type work that you may need to do before a pull request even, you know, before you even make a pull request.

You're still... responsible for the code and every engineer should still be responsible for the code, but there shouldn't be, other than like, BAAs, contracts, stuff like that, which that can slow down the use or an adoption of an AI tool. But if that AI tool is approved by the company, it should be able to be used by the engineers as long as they're able to use it. with knowledge and able to sign off their name on it.

'Cause it's still their work. So, you know, using a It's not another... human, it's a transformer. Using a text transformer tool. It's a tool. Using a tool is very helpful and I think For a lot of areas in code, especially application development, writing maps for integrations, oh my gosh, there's so many areas where it's so powerful. It's hard to make It's almost hard to play the devil's advocate and say we shouldn't use this.

But that's also me, I've been really leaning into it over the past four or five years maybe. And so I'm drinking the Kool-Aid. And I feel like my development workflow It's not really as much a development workflow, it's like a product workflow in a way. has gotten much better. I learn more about the code. I can write better tickets from a product perspective. There's just been a lot of benefit and I don't even know where it's going.

But MCP is kind of the coolest thing. Not only is there GitHub, there's sequential thinking, there's a tool that you can use for pulling all of your data into a graph. So you can have like an entity relationship graph data storage of all of your code. And that's really, really powerful because it's not having to like glean, you know, glean like it's not having to look upon like unstructured data to try to figure out insights and stuff.

So as you work, it learns more and more really, really strong opinion about your code base. And that becomes really, really powerful. Can't ignore those either. Shoot, you might. My wife has the flu. My son has the flu.

It's like 18 degrees right now. It's a crazy week. Yeah, I've seen the news.

It's all over the place. Yeah. Perfect. I wanted to have these last couple of minutes for you to ask me any question that you may have, anything you want to know about the company, the team.

Yeah, yeah, I've got a handful of questions if that's okay.

I wrote it down ahead of time.

So for engineering leaders, how do y'all push back on, we'll say product and sales? What are the strategies y'all use to kind of like, I guess say no.

Um, I would say a lot of the decisions are based on priority. It depends on the core business and where we want to move forward. move as a company and where we want to be like The end of year, next year, two, three years. Dave. There's a new initiative that maybe doesn't align with that vision, then we Maybe it's a sign that we should say no to that new initiative. Of course, if it's something that, you know, kind of aligns, but it's kind of derailing from the vision, it could be...

Taken perhaps, but... Maybe not given as much priority as the other initiatives that are actually very aligned with the company's vision. So yeah, I would say that's the main driver for making decisions on whether to take or not new initiatives from the business or any stakeholder.

Do you feel thrash at all between priorities or between initiatives?

Not really, I think Maybe in the past, where we were trying to figure out where we want to be as a company. in the next couple of years but I think the division is very clear now. We are We have a well-defined path and of course we can always adapt to whatever comes up in the future. I think we always have to be adaptable to anything that comes up. Other than that, we have a well-defined path where we want to be as a company, both in terms of the business and from the technology perspective as well.

And yeah, I think that's a great a great motivation for us to keep going in the right direction.

Has the definition of done evolved over time with that growth?

Or how did that work now?

Yeah, it had grown. It had grown because at the beginning we were just Several engineers did everything, did everything from code, infrastructure, QA, even user testing at some point. So the definition of done was pretty much do the feature, make sure that it works with a couple of use cases, and that's it. But now we're growing and we have an SRE team, we have a QA team, we have a security team. Pretty much The whole software development cycle has a specialized department.

Each team has now specialized in its own Um... You know. path and that definition of that has um grown a lot because we now expect to have proper QA, we now expect to have proper scalability and sometimes when the initiatives are critical we expect to have A sign up from the security team. So yeah, it has certainly changed.

And is that also part of the growth? It looks like, Y'all are becoming more of a product-led organization. Is there a product team that kind of globally manage this? Do they more consult?

How do the interactions go with them?

Yeah, there's a product team and they actually manage the product mission. And as a product team, they, you know, Handle priorities, handle the how and why and Engineering can always propose ideas, push back if needed. We kind of consider ourselves to be The product and engineering team, just one team, and not like separate teams that working in sales. Yeah, so yeah.

Okay, cool. Cool.

There's like so many different flavors of how it's done. And a lot of companies claim to be product led, but they're kind of masquerading around. I know we're about over time. Can I ask you one more question?

Yeah, please.

So in terms of this position here, What's the, in the initiatives, what's the biggest, you know, MedPlum and stuff like that, what's the biggest risk to this role in the next six months or year or so?

Biggest risk... Oh, you mean risk of success?

Risk to success, yeah, for somebody in this position.

Um... I would say... not having like a clear understanding of both the business mission as well as the Engineering. and by engineering I mean Perhaps not having the right amount of technical knowledge, which I think you have a high degree of knowledge. On that regard, But yeah, I would say those two. The higher you go in an organization, the more business oriented you have to be, but at the same time if you're in the engineering world, you need to have that technical knowledge to be able to translate the business vision to the technical teams and vice versa.

be able to, you know, evidence any problem or anything that you want to change on that technology and be able to support it to the product or the stakeholders. But yeah, I would say The best thing that someone in this position should do is have both well-founded and be able to communicate in both worlds. Misses.

How does the interaction go with Peru and versus the Nashville team? I know there's hiring involved. How do I interact with Peru? Are you getting a team as well or am I expected to hire 40 people the next year?

How does that work?

Um, I think there'sCheck real quick. I think the plan for this position is to have one team That is, that will like oversee a very critical initiative that we have. Yeah. And I cannot tell you a lot of details about the initiative, but there's a very business critical initiative that we're looking for this position to be able to lead. and lead the team working on this initiative. And it's going to have At least two current engineers that we'll be able to have that institutional knowledge and from there hire more people and we can transfer that knowledge and then grow a solid team.

Awesome. But yeah, that's the plan.

There's been some ambiguity there. Thank you. Okay.

Well, super exciting. This is a diamond in the rough type of opportunity. So if there's any questions or anything that you'd like more clarification on from me, sometimes I say things and I've got more going on up here than what's happening. So it may come jumbled out and out of, you know, you know, just being nervous or something. So yeah, just please let me know and I'd be happy to answer any questions.

Oh, and I didn't answer a question about Peru. Let me tell you a bit more about that story. The company started hiring in Peru in 2022, I believe, if I'm not mistaken. And at the beginning there were like 10 engineers and aboutTwo. engineers in the US and of course our CTO is based in Nashville as well. Um... And then we started hiring more people in Peru, but, You know, it's kind of risky to have all the engineers, pretty much 95% of the engineering department in a single location that is not the US.

So we're trying to mitigate that risk and as well making, you know, It shows a small diversity in the team as well. It's not like we're going to close. Yeah, it's not like we're going to close the office in Peru. It's that we want to grow the team.

Yeah, that makes total sense.

And make it more diverse and mitigate the risk of having everything in a single location. Cool.

I didn't know if I was starting from scratch. So knowing there's a couple that have some of that knowledge about the culture, about how we do things in engineering, all those things is really, really helpful. I have... I have people that I've worked with, and so I can help. Yeah, I can really speed up hiring as well, just being in Nashville and working with engineers here. So I can kind of bring them to the table too.

But yeah, that's super helpful. Yeah, and I know that the food team has been doing, well, y'all have grown like, what, 460% year over year or something? Yes, correct.

So no matter what gets thrown at them, it sounds like they've just been handling without an issue.

you Yeah, yeah, for sure. All right. Thank you very much for your time. All right. Thank you very much for your time. It was a pleasure to meet you and hopefully we'll see you soon. Yeah, sounds good. Take care. All right. Take care.