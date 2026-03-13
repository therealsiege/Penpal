Created: January 24, 2026 12:03 PM
### Project Portfolio Overview

Clint provided an overview of multiple projects currently in development, with varying levels of maturity and revenue generation:  

- **Graphite Atlas** - Primary focus project, partnership with Nigel Glenday (Masterworks founder), currently has paying retainer that will increase, equity-based venture
- **eSpiral/Practice Rounds** - Residency program visualization tool for Infirmary Health, recently demoed to CEO Orman who asked to invest, has equity component
- **Med Scrub AI** - De-identification proxy tool for PHI/PII in healthcare and tech settings, currently seeking design partners
- **RetroHook/Medhook** - HL7 integration platform being handed off to Nataro, with Medhook variant being developed for Cyrus Barraza

### Graphite Atlas Focus

**Product Description**

Graphite Atlas is a graph-based knowledge management and visualization tool that combines features of Airtable with visual mapping capabilities, using Memgraph database and designed for LLM integration    

**Current Status**

- Onboarding design partners with 25+ potential customers ready to sign
- Recent customer interest includes embedding the tool into their own products
- Currently a one-person development effort that needs to scale

**Business Model**

- Monthly retainer from Nigel that covers bringing Tim onboard and will increase
- Equity-based compensation structure (equity only comes after paying customer signs)
- Focus on keeping team small and trusted

### Technical Stack & Architecture

**Primary Technologies**

- Next.js for full-stack development (API and React frontend)
- Memgraph graph database (custom deployment to avoid enterprise pricing)
- PostgreSQL via Neon for user workspaces and views
- Vercel for deployment and hosting
- TypeScript throughout

**Frontend Frameworks**

- Tailwind CSS for styling
- Zustand for state management
- React Flow (now XY Flow) for canvas visualization
- TanStack (Query, Form, Table) libraries
- Shadcn UI components

**Backend & Infrastructure**

- Prisma ORM for database interactions
- Custom Memgraph deployment on EC2 with API Gateway and Lambda for auth
- Mage add-on (2GB) for graph algorithms
- PostgreSQL in Neon (free tier currently)

**Development Tools**

- Cloud Code or Cursor for AI-assisted development (will expense either option)
- Playwright for testing
- Husky for pre-commit hooks
- MCP (Model Context Protocol) servers for enhanced AI capabilities
- PostHog for analytics and user tracking

**Development Workflow**

- Issues created and managed in GitHub
- AI-assisted development with isolated branches for single issues
- Pull requests reviewed before merging to dev
- Deployment to preview environments ([dev.graphiteatlas.com](http://dev.graphiteatlas.com) for dev branch)
- Each branch gets unique preview URL

### Repository Structure

**Main Repository: Atlas**

- Next.js full-stack codebase containing both API and frontend
- This is the primary repository Tim will work in

**Supporting Repositories**

- **CLI** - Python-based, managed by Nigel, contains web directory with useful styling patterns
- **Ground Calm** - Custom Memgraph deployment with auth, backups, and API wrapper
- **MCP** - Model Context Protocol server for AI integration
- **Status Page** - Monitoring dashboard

### Working Relationship & Expectations

**Trust-Based Approach**

- No hour tracking required, focus on accomplishments
- Full autonomy and trust in Tim's capabilities
- Small team of trusted individuals only

**Communication**

- Primary communication via Grizzly Dev Slack initially, will set up channel for collaboration
- Optional in-person pairing sessions at locations between both parties
- Weekly or as-needed meetings

**Compensation Structure**

- Current retainer covers bringing Tim onboard
- Retainer will increase as project grows
- Equity discussions pending as angel investors come in and terms are finalized
- Potential for hourly work on Medhook at $150/hour

### Current Feature Priorities

**Immediate Needs**

- Chat/LLM integration with Navigator interface
- View persistence (dragged points and zoom/pan state should persist per view)
- Airtable-like features for bottom table interface
- Sidebar improvements

**UI Issues Identified**

- Zoom button styling (rounded corners and element overlap)
- General UI polish and de-AI-ification of generated interfaces

### Partner & Customer Context

**Nigel Glenday (Graphite Atlas Partner)**

- Serial entrepreneur, UVA grad, founded Masterworks
- Very polished and sharp business operator
- Hands-on with product, influenced by DHH/Basecamp philosophy of simplicity
- Works in Airtable and Mermaid diagrams, wanted better tooling

**Design Partners**

- Meeting with product owner who wants to embed Atlas in their tool
- Goal to secure 5 design partners before major commitments
- Some could turn into bigger opportunities

### Other Projects Context

**eSpiral/Practice Rounds**

- Started as visualization tool for Dr. Clarkson (82-year-old inventor)
- CEO Orman asked to invest after demo
- Matt manages product side, bringing residents onboard
- Tickets will come in for UI and backend work

**Med Scrub AI**

- Three-layer de-identification approach using spaCy, Stanford medical NER, and BioBERT
- Achieves 99% confidence with low latency
- Desktop app for easy hospital IT deployment
- Mobile app connects via QR code to hospital proxy
- Targeting Infirmary Health first, reached out to Brad Malin (regulatory expert)
- Pricing: consumption-based credits or $25K perpetual license
- Could potentially rebrand for non-healthcare PII use cases

**RetroHook/Medhook**

- Handed off to Nataro who helped build Redox
- Medhook variant being created for Cyrus Barraza (HTTP version)
- Negotiating perpetual license with feature work billed hourly

### Onboarding Process

**Account Access Needed**

- GitHub (determine which account to use, can hide organization memberships)
- Notion workspace
- Vercel
- Neon database
- PostHog analytics
- Slack workspace

**Documentation & Agreements**

- NDA and BAA required (extensions of existing contracts)
- W9 needed
- Onboarding page in Moonlight KB with technical details

**Getting Started**

- Review onboarding documentation and codebase
- Schedule pairing sessions to work through initial issues together
- Start with isolated issues in main Atlas repository
- No immediate work expected, focus on context-building first

### Action Items

- [ ]  Tim to provide GitHub account information
- [ ]  Tim to sign NDA, BAA, and provide W9
- [ ]  Clint to add Tim to GitHub, Notion, Vercel, Neon, PostHog, and Slack
- [ ]  Clint to provide Cloud Code invite or expense Cursor subscription
- [ ]  Tim to review onboarding documentation in Moonlight KB
- [ ]  Tim to review Atlas codebase and current issues
- [ ]  Schedule pairing sessions to work through initial issues together
- [ ]  Clint to update Med Scrub domain/UI references

Notes

Transcript

I don't know how that happened. Okay, cool. So, you were saying before I accidentally hit the back button?

I was like, I don't have anywhere to go to today.

It's a good day for this, actually, yeah. Keep getting NES emails. Like they're like trying to like really like say, hey, we're on top of it. Don't worry. You know, type of thing.

Cool, we'll see.

Elsie. So things are a bit in nebulous and that's partly just like where we play and partly me and kind of getting things together a little bit. All right. But, I'm getting better and better every day. So let me just... So I sent you... I also sent you a link. Let me... Hop over to that. Um. And let me share my screen here.

Oh, the moonlight one? Yeah. Unlike KB...

Let's see, yeah. And so that's the main knowledge base. This for now.

Oh, this one's different.

Oh, this is different?

Oh, no, no, that's it. That's it. Yeah. Okay, cool. Okay.

I'll put this next steps meeting recording. I'll put it in our... Do I not have one yet? Okay, let me... Um. It already knows what I want to do. Okay. And then I'll drop those pages in there, which will be a transcript. It'll be the audio. It'll be the whole recording from this session. So if you need to look back at anything, you can. Um,Sounds good. So some of these projects have started at different times and they're kind of in the incubator stages and they're really starting to get traction.

And so there's a couple of things here that are happening is They're going to be expanding. And so I need to ramp up, but also I'm, I want to keep things small and only people I trust. I don't want any of... my partner's hiring or I kind of want to do all that stuff And I don't think there's a lot of hiring really to be done. I think a small team can knock out a lot of this stuff and put them in really good places.

And so I want to really control that. And so that's part of why we're starting this conversation where it might seem a little bit early, but there's money coming in, there's work to be done. There's many benefits to this. Okay. So I don't care about your tracking hours. I just wanted to know that you had enough time to help. Yeah. So that's that's you know, I totally trust you. And it's all about like what we can accomplish, because that's what that's what brings more in.

The main things that we're working on right now, and when I say we, it's really Matt and myself, it's that Matt is not on Graphite Atlas. Graphite Atlas is myself and Nigel Glenday who created Masterworks, which is an art Gosh, it's a hole. investing platform and marketplace, it's kind of wild. But he has this idea of Graphite Atlas and we've created it. He pays a retainer to One Putt Health. for us to manage the project.

That retainer is going to go up. That retainer basically covers me bringing you out. But that return is going to go up. And so it's a lot of work, it's been a lot of work and I'll show you why. But it kind of requires a little bit of a tag team approach in some of it. It doesn't require but it would be helpful. And as it grows, it's just, it's quite an interesting ask. The next one is eSpiral. That one, you'll hear me refer to as practice rounds a lot because that's what Matt is productizing it as.

That's for the residency programs in Infirmary Health. Dr. Clarkson is the director of those programs and he kind of It's his baby in a way. We have equity and we also get retainer from that. So also we have equity in Graphite Atlas. So the company is equity in Graphite. So everything we do has a little bit of equity as well. which is helpful. And we can talk about that after a little bit. Sounds good.

So the eSpiral thing, it started off as a visualization tool for Dr. Clarkson to be able to rapidly look at all the patients coming in and oversee things. And now it's turned into something much more. In the last meeting we demoed to The CEO of Olive Infirmary Health, his name's Orman. and his team, and it was so wellReceived that he asked to invest in itOh wow. Yeah, so which is actually kind of funny because Dr.

Clarkson is like, hey, what is the next step? What do we do? And that's been the thing.

It's like, how do we attract investors in this one?

Because you kind of need a bit of a war chest, one, and then having infirmary health system have some skin in the game and be... Angel investors slash customers really aligns interests well. So that's happening. Matt's father-in-law plays golf with Ormond, and he hasn't even flexed that yet. So there's also that sitting in Matt's back pocket. Matt, for the most part, runs the product side of eSpiral.

and we're bringing residents on. So it's kind of an onboarding thing. And tickets are going to come in for that for UI, back end, et cetera. And we can talk about that. But that's like we can push that off a little bit. So we just can focus on graphite Atlas today I'm just kind of giving you a look at the landscape, and then I'll let you run on the documents. I'll give you access to things. And then everything's going to be targeted towards Graphite Atlas and really just one repo.

Because the Atlas repo, or the, excuse me, the graph repo is the Memgraph thing. I manage that. It's all taken care of right now. You're more than welcome to get involved in it, but there's not much work to do. I'll show it to you. There's not much work to be done in that. Okay. But it's very helpful because us rolling our own Memgraph Got us out of the enterprise pricing. And we couldn't use cloud, the Memgraph cloud offering, because it doesn't have some of the tools like Mage installed, and it can't handle labeled property graphs, which is what our system's based on.

And I'll get into why we do that and all that stuff in a little bit.

What do you mean by Memgraph?

Memgraph is a database that you probably haven't heard of. It's very similar to Neo4j. And these are graph databases, and they're a whole different world of databases. And the reason why they haven't been so popular is mainly because... of Um... Politics, I guess? Potentially, allegedly Peter Thiel and selling tabular databases to governments and large businesses and really getting a wedge in that way.

And so we've seen more of that style database. What's great about graph databases is they are the way we speak. They're in entities and relationships. And they're the way that LLMs think. They're extremely powerful for LLMs. So for working with Atlas, so and I'll get into some of the competitors and like why Graphite Atlas is so cool. and why we're so much more in it for the equity than we are just like five grand a month for a whole, like I would have negotiated much more than that, you know, for all the work that's gone into it.

You know, there's a big payoff in the end. There's risk to everything, but this is one's a good one to bet on. And this guy here, He's a UVA grad. He's... I think this is serial entrepreneur. This will be like his third or fourth successful venture Part of it's like an opportunity to work with him. Like he is Really polished, really sharp. Um... Yeah, he's really good. Matt's really good. Matt's...

leveled up even from Bridge Connector in many ways. Um... So, and then Dr. Clarkson, this is his third or fourth invention. The last invention was a pair of skis, which sounds so funny, but he's 82 years old and he still downhill skis. So he's a wild man. So you'll meet some characters in this a bit. We do have some internal ventures going. The Med Scrub AI tool Right now you'll see things in it that I'm building.

I'm building a mobile app. And I'm building a desktop app, which is pretty much done. But it's a proxy that can be deployed in a hospital. It can be deployed in a tech system. It can be deployed in any infrastructure. It's basically Docker based and it serves as a filter for PHI before you interact with external things. So you could have a lower environment and be like, "Hey, I want to integrate with other tools, but I don't want to send PHI out.

Let me put Med Scrub in front of it." Or you could be like, "Hey, I want to interact with LLMs. I want to use consumer LLMs and I've got customers putting data in a text box." I want to clean that before it goes. And so there's an angle there mainly for startups and then for hospitals with doctors that are using LLMs for Clinical care, I guess you'd say, in the clinical care setting. That's becoming more and more common and they're just kind of ignoring the risk in most cases.

So there's some There's some product market fit. We know there's a problem. We know what's happening. We know there are potential customers, but I don't have a customer sign just yet for that. So that's why it's kind of like down here, we'll deal with it later. But that's something that I can bring you into later on because I think that would be something of interest. Okay. It's got, yeah, this desktop.

So just kind of overview. It's got a desktop, a dashboard. That's the proxy that's loaded up. You can use a playground. It de-identifies text. You can manage it. The desktop is mainly for hospitals. because I wanna be able to really get, I wanna make it super easy for them to install this. I don't want any barriers. And I'm going right to the IT team and I'm going to say, because I already know that there are doctors using, I already know there are doctors breaking HIPAA there.

And I know there are some residents doing it too. So I'm going to say, hey.

I mean, even in Scribe America, or yeah, right now, like they're slowly just taking away AI access to every single employee. Interesting. Right now, because. It's just like putting rules up and everywhere. And like, I could see how this exactly would be a plus for, for, or a lot of teams that need to, they want to use all that data, but they can't touch it. Exactly.

And your LLM mightClaude and chat to TP today and it might be something else tomorrow. And so that's partly why this approach is nicer. This approach is difficult because for the, so the proxy runs, it's got, Three and a half layers, basically. It has some proprietary algorithms, and then it has a spaCy nerve for entity resolution, and then it uses the Stanford medical entity resolution, and then it uses BioBERT for entity resolution.

And it does all those steps. It's kind of like a Swiss cheese model. It does all those steps to get the confidence of 99%. It does all those steps with low latency. Part of what the difficulty was, was building something with a lot of open source models and open source tools, but that's something that's portable so that it can be run anywhere. And then the mobile app, It just connects via a QR code.

So a doctor gets in the hospital, he downloads the mobile app, He scans a QR code. And then right then and there, he's able to use that hospital's med scrub and that hospital will give him redacted data and then the hospital will also via session will Restore that data on return so that he sees it as he should. So I'm going to Infirmary Health first. I've got some ties there. And then I also, I've reached out to Brad Malin Um...

When I was at Hal Verity, he was working with The data scientist at Health Verity, why can't I think of his name right now? Anyways, I can't think of his name, but out of Florida. But they worked on some like large set De-identification stuff, like white paper stuff, And actually Brad Malin wrote a lot of the regulatory ruling. And so I want to get him incentivized on it. I just sent him an email, I told him I'm buying coffee, you know, just like, you know, send some links kind of thing.

See what happens. Kind of doubt anything's going to happen from that. But trying to push on all angles and-This is what I really think is a good time to do this and a good time to make this bet. So I'm trying to... Free up some time to do that. And so once you kind of feel comfortable and get on board and can start handling some of the Graphite Atlas stuff, I can move more on to like doing some of that stuff.

And then hopefully, you know, once I get a design partner or two, that becomes a a revenue positive type thing. And we can figure out how to How to better handle it? Um... But there's no like cut season that there's no giving any cuts to Nigel. There's no giving any cuts to right like with Nigel. Nigel owns the main share of Graphite Atlas. With eSpiral, Dr. Clarkson owns the major share of Graphite Atlas.

So like that's, right? And then the last one I've been working on for years is RetroHook. I've handed that off to Nataro. You may remember him from Bridge Connector. He's had a pretty successful consulting thing. He actually helped build Redox, which is in a lot of ways a predecessor to, in terms of abstractions, it's a predecessor to RetroHook. It's an API for HL7. Workflow Builder and API for HL7.

He's got some... design partners etc that he's incubating relationships with So he got sick this week and I was sick. before so we haven't been able to catch up recently. And And then the other one with RetroHook is, and you'll see that I've got another thing thing here called Medhook, which is kind of like retro light. Um... Cyrus Barraza? He built a business, an integration business, since Bridge Connector.

He worked under Matt at Bridge Connector. I don't know if you remember him as well. I remember Cyrus.

Very detailed. Yeah. We were on the same team. For a while.

Oh, nice. He's really good, but he has... a line of business that could use like basically an HTTP version of of RetroHook, like not MLP HL7, just HTTP. And so... He's basically... He was thinking he was going to pass $150 an hour. To do he's like name your hourly rate. I'm like dude. You're a friend like like I don't really do hourly like that Just I'm trying to get away from that all together. Like it just doesn't align incentives very well.

And so So now it's turned into Matt's negotiating with him. Matt's at Disney World right now. But Matt's negotiating the perpetual license cost. So I'm cutting a version of Retro called Medhook Um... Over the next couple of weeks, I'm going to sell it to Cyrus. And then whenever he has feature work, Then he's gonna pay us hourly to do that And so I'll just-OK. Give you that $150 an hour if that's what, you know, if you end up doing it or, you know, we'll figure that out.

So there's like a lot of different flavors of what's happening. And I know it's a lot to like... wrap your head around but you don't have to because all this is One, being recorded, and two, there's documents and we've got time. There's been years in the making. so So don't sweat it at all. Okay. Basically, kind of where I want to get you started, and I'm going to show you the products and code base in a second for Graphite Atlas, we'll focus on that.

But there's a couple tasks to do just to get you going. I need to add you to the accounts. And so I think this is the GitHub I'm going to add as your main GitHub.

I don't know if I wanna add that one. Okay. I'm not sure how.

In what? So if you go into GitHub, Let me go to, is there a browser? Okay, let me go to maybe this one. Okay. So if you go to GitHub, let's just... let's go to my github Okay. So I have all these orgs showing right here. Is that what you're worried about?

Yeah, probably.

So you don't have to show, yeah, you can hide all that stuff. So if I go here, grab this, and I'm going to open an incognito one, I think I have a couple hidden. Yeah, you'll see that I have a few that are hidden. that I don't show. Okay. Let's see, I like House or X. I don't show that I'm helping them. This is my dad's stuff. I'm not sure that I'm doing that. Uh... I don't know. Do you like this one?

Maybe there's a couple more. Oh, the new one. Yeah, so, You have to set them as... See how it... I'll go here. This one-oh, that's not it. I got to be in this window. So let me go here. I'll go to this one. Retro hook, if I got a people. And then if I go me then I've got it as public Matt's not showing his so I can set it public or private. It defaults to private.

Okay.

And you're totally fine if you want to create a new GitHub, but what What is nice about not doing that is Is your all your All of your... activity will will be shown. It won't be shown to like where it's going, but it'll be shown in your graph. So you get more activity shown, it just wouldn't show where it's going. But yeah, if you would like, just put whichever one you'd like down here. That's kind of why I put this section here was so that you could just put whatever email, if you want to use a different email or whatever.

Yeah, I guess that's fine then. I'll just... Make sure it's in private mode.

Okay. And I can probably double check too, because I can look from my side and just make sure that I don't see you. Yeah. Yeah. Yeah.

So that's the account stuff.

That's a little bit of us working together I guess. There's some agreements and mainly these agreements like the NDA and stuff are An extension of the contract already have. So with Graphite Atlas and with eSpiral, those are the two main ones. So the BAA and the NDA. And then I need your W9, probably put that up here. If you need help doing that, I can help you with that. That's no problem. Oh, onboarding.

So if you click this link here, It'll basically bring you to this page here. Which just kind of tells you about like, hey, this is what this is. This is what Atlas is the repo. It's the... It's full stack, but it does hold the Memgraph database. It actually doesn't hold either database because the Postgres database is in neon. So it doesn't hold any of the databases, but it holds the The API, because NEC JS can handle APIs.

and it holds the react front end. Okay. So, and then these are the frameworks that we use. So ZooStand, Tailwind, we use Racked Flow pretty heavily. And then if you've heard of Taylor Lindsay, He wrote Tan Stack. And we use TanQuery, we use TanStack Form, TanStack Table. I really like his work. He's very close to Kent C. Dodds. They come from Utah. And they put a lot of work in. Like, all they do is write code.

They don't, they don't definitely don't drink or anything. They just write code. Just write code. Yeah, yeah. Kent C. Dodds is really, really good. And Tanner Lindsay, those are, Lindsley, those are like... Um, influencers, I would say, in the space, in the node React space, I guess I would say. Okay. And there's some of the ones I've followed for probably 10 years now. I mean, the other one's Guillermo Ranch, which he did MooTools, and he also did Next.js and Vercel.

which There's opinions and there can be like, you know, Like, hmm. Like I've had different opinions a little bit than I do now. Like what he's done for business, like you could like totally shit on Guillermo, But like what he's done from like an abstraction and business level in terms of like opening up tools to Developers that are new, he's been One of the most influential in computer science. at like bringing Code to the masses and an indoctrinated people Yes...

Some people could say like maybe like best practices aren't always like you could argue best practices. in some ways. Yeah. But like... He's built billion-dollar companies and His tools, like the Vercel system, which is what graphite is on, Just in like the six months that we've built on it has evolved so much. For a while I was like, oh, am I going to be on Amplify or Vercel? I was like, man, there's a couple of Vercel features that I really like.

And Vercel is really snappy. I was like, dang, man, like performance on Vercel is killing AWS. And then... Vercel also supports Bun right out of the box, and I'm about to flip to Bun, and Bun's performance is... What does that do?

It's a runtime that replaces Node.

Its performance is Like... I don't know. It's like 30% of the latency maybe. It's so fast. It's so fast. So there is a...

Is this in the same league with like Veet and stuff like that?

It runs Veet. One is like, it replaces Node altogether. Oh, okay. It's a drop in replacement of node, and there's another flavor of that, right? I am Dahl, who's the creator of Node, also wrote Denno. which is like inside out or whatever. And that's kind of like the, you'll see a little dinosaur. for Deno and that's another runtime that's really, really new and super fast. TypeScript out of the box, a lot of built-in features, but it hasn't like, Node is so ubiquitous and so widely used It hasn't like super taken off and Bun was just What?

Or whatever, but... Anthropic by Claude. And they use it in their SDK. It runs the SDK. So Bond is going to get a lot of love from the community and from these companies because of it. So there's those parts of it that I'm paying attention to a little bit. Um. Postgres is really nice. It's got a lot of features. There's also like Supabase and Surreal DB we're talking about. Postgres is great especially if you don't have to deal with serving it up on AWS or managing yourself and that's why I'm using Neon.

It's just like you go in the tables, they all make sense. If you need add-ons, you pop them in there. For the most part, we're in the free tier. It's been really great and it connects things to the Memgraph layer. So when a user builds a workspace and their views and their little thing, you know, their dashboard or not their dashboard, their workspace, it connects everything. It holds as the container for all the Memgraph stuff.

How does Memgraph compare to GraphQL?

GraphQL is a query like GraphQL. They're very different. At least in my view of things. And I'm learning more and more every day. But GraphQL and Apollo are a They're almost like a different protocol for communication. Whereas this is a way of storing data and querying data. There are graph algorithms that allow you to do really interesting things with like point hops and figuring out like, hey, what's the most important entity based on all the relationships tied to it and stuff like that.

And so you get into some really cool Really cool algorithms that you can't do on other databases because the data is set up as entity relationship. It's kind of like, you know, there's like OLAP and OLTP databases. This is like a whole other category. We mainly deal in OLTP database, I believe. MySQL, Or like there's document databases, I guess too. There's different flavors, but so maybe I shouldn't like go to the gamut of things, but.

We've got good wrappers around these. So Neo4j is like kind of the old tried and true for graph databases. It runs on Java. It's been around for like 15 years. It's kind of outdated. I couldn't get great performance out of it. That's where I started. I use the Neo4j, you'll see in the API code in Memgraph, Memgraph Recommend this, I use the Neo4j Bolt Adapter. So you'll see some do 4j code anybody well, what's this because that's because mem graph uses that bolt adapter but mem graph is like A ninth of the latency?

of Neo4j. It's really, really fast. When you talk about a web application, that becomes important. Um... So the API was mainly in AWS land and I moved it over to Vercel because it's so fast in Vercel. Like it was a performance change I couldn't get AWS with API Gateway. I went from Lambda to Fargate to try to get better performance. I still couldn't compete with what I was getting in Vercel. Which is Kind of wild.

We're not using GitHub actions really. We have Husky for pre-commit hooks, so it won't commit unless things pass those. We use Playwright. It's all TypeScript. And I use Cloud Code for most things. You can use Cursor if you'd like. I can give you a free week of Cloud Code if you wanna try it out.

It's called-Is Cloud Code its own application? Yeah.

It works in the terminal.

Like cursor is? It works in the terminal.

I run it in multiple instances, like this one right here. I have it Handling, so I have MCP set up pretty heavily. I've got a lot of MCP set up, one of those is GitHub. Which is really powerful because it gives the tool accuracy and it gives it like authentication capabilities and stuff like that. So the tools inside MCP are super powerful. And we actually do our own MCP too and I'll show you that in a minute as well.

So where I usually start is I write issues. And I don't need you to do this yet or anything like that. I don't expect you to do this stuff yet. But more solving issues. But I have it even write issues using... using cloud code so I'll say let's see here Um... Yeah, I'll say Where did I... Some labels, this guy go up a little bit, okay. So basically I have this connected to GitHub via MCP in this terminal window here.

And I have cloud code adding issues based on requirements that I have, based on bugs that I see. And what it creates Um, Is, let's see, Atlas. Issues. Okay, so what it creates is these really, really nice issues. for itself to solve. Okay? So, and you can do the same thing with, what's it called? Cursor? And you can use a lot of the same models and stuff. So it depends on what experience you like. I literally pay $200 a month for Cloud Code.

And I have no problem cutting that into my expense for you. Yeah. But I'm able to give it like really, really defined, requirements for one thing to do and then Because I'm able to use, with Terminal I'm able to use TMUX and the Get Work tree, I'm able to create these sessions of Cloud Code that don't step on each other's toes. And then I have this other one here called solve issues. And what this is doing is it's pulling in issues using MCP and then it's solving them.

I got a bunch of tool calls after that, that's why that looks funny. But it'll go through here and it'll solve the issues and then I'll ask it to update GitHub after that via MCP. So then I make a pull request in. Um... into dev, and then away we go. This is actually a big pull request going into prod. which has like a ton of different things in it. And so I'm having Claude code write most of these and I'm just approving pull request, looking at the code.

They're also very isolated. A pull request, a branch, an issue, it's a one thing. So I can dive into that one thing, solve that one thing, give the agent small context, very focused context. I can work in plan mode. If I hit shift tab, it goes to auto accept edits. Or sorry, one time goes to auto accept edits, two times goes to plan mode. I mainly work in plan mode, and that's called revving as a term in AI.

So I rev the system. I go back and forth with it to really dial in. And usually I flip to auto accept and I'll YOLO it. I'll just be like, all right, fix it. I know you can do it. And then I look at the pull request because the pull request is like this one thing. I find that to be really helpful. I put these in different directories. Like this one here is in the Atlas directory. It's hard to see some of this with the theming of it.

This is in the Atlas directory. which is the front-end code. Not just frontend, it's API as well, right? So it's like a little more than that. But this guy here, this shouldn't be an Atlas. Okay, so this changed to Atlas accidentally, but I shouldn't have asked it to fix something. I asked it to fix something accidentally thinking it was in the, I think it was in the wrong terminal. It's stupid me.

But I actually set this in one directory above that so it can write an issue in any of the repos it needs to. And so if we look at my code base here, Um... For Graphite Atlas, I have Atlas, which is the, this is the Next.js code base. And then I have Well, the CLI, that's Nigel's. Nigel manages that repo. You can get access to it, of course, but we use that. In part, it's Python, most of it, but we use that in part for like like context, because he'll solve something on his desktop and it might not be fast, it might not be something that he can deploy anywhere, but it'd be like, "Hey, I really like this algorithm," or, "I really like the way this works." And he's really good at technically conveying things.

And so that's how he works, is creating these repos. The ground calm is Memgraph, but it has backups and auth, and it has an API around it and a Lambda to handle the auth. So there's a lot to being able to roll your own Memgraph, but it also saves you 25 grand a year, at least because you can scale your own Memgraph as much as you need and not have to pay them. So that's really important. We have an MCP and I'll show you that in a minute how that works.

And then we have a status page. That status page is another--A lot of this--Okay. But one of the really powerful things here is I have an MCP.json in here and has all these different MCP servers like sequential thinking, which is super powerful for cloud code. And you can do this with cursor. It'll respect the .mcp.json. This context one, which is really, really powerful for--I don't need to use the cursor.

I just use for... For my other Rather work just because we have a subscription to it like Enterprise. stuff so That's online to do Yeah, so like right now I'm on a completely different machine, so I'll probably just use VS Code. or everything else. Makes more sense.

Well, I'll give you an invite to Clodcode so you can try it for free for a week. Check it out. If you want to use Cursor instead, I'll expense Cursor for you. I think it's like 20 bucks a month. It's super, super reasonable. But I'll also expense 200 bucks a month for you for Cloud Code because I see the value. I get much more value out of Cloud Code. Seems like a computer.

Yeah. Once I know what I'm doing more, I could probably utilize cloud code better, but there'll be some ramping up here for sure.

Yeah, totally. And that's...

A lot of this... A lot of this back end stuff is a little over my head at the moment.

Well, and that's, I'm here to take the brunt of that. Yeah. So you can adopt these tools and workflows for front end stuff or however, just, you know, and we can pair program a bit too. Yeah. But there's some extras with this stuff here. Um, So, okay, so let's see. I'm actually playing with Ghosty. I don't know if you've heard of Ghosty, but it's really fast. Yeah. It's a terminal. I like iTerm because it's nice, but Ghosty's really, really nice too.

Okay.

I think I'm using iTerm.

iTerm is great. It's just kind of slow at times. Like if I'll have this go and what some of the beauty of this is I'll have this in this plan mode and I'll have it thinking and then I'll be able to talk to it. Like I'll be able to kind of direct it like, Oh no, check this link, check this link. And I'll be like, hey, I like this website. I want to design it like this. Hey, use Shad Zia and get this.

I'll kind of like ad hoc talk with it. And it works that way. That's part of repping. That's something you can do with dialing in the context. But if it's really thinking, my keyboard just won't-it'll stop. My keyboard won't-and it's the terminal running. And I got 64-bit RAM. I got a pretty decent machine that I'm running on. But I think it's the terminal. So that's why I'm playing with two different terminals today.

Because there's something going on there.

I only got 36 gigs of RAM.

You'll be fine. That was weird. So also, I was running out of space. Like... So like seriously running out of space to where I was like at 40 gigs and they was yelling at me. I was like, dang, what is going on? And it said it was like all these unknown app files and system files. So I went into Finder and on my home directory I just did Command-Shift-Plus to show all the files. And there were so many things left in from stuff that I uninstalled or caches, old things.

So I deleted stuff. I freed up almost 200 gigabytes of stuff. Wow. Yeah, that's nuts.

I have like 400 gigs left on this thing. Oh yeah, you're good.

Um...

This laptop's not too old. It's about three years old.

But it was like, it was just cleanliness. It was so weird.

Yeah, that is interesting.

So let me get to the app here. One second. Okay, can you see this here?

Yeah, kind of. It's very small.

Okay, let me go. How about that? Stick this.

Yeah, that's better. I also dragged it to a different screen that's higher resolution. Okay, okay. That helps me.

All right, let's see here. OK, so-oh, actually, you know what? I don't want to make this big. Let me minimize this. We don't need this. I don't need this, but I need it to be open. OK, I need this. All right, cool. Okay. Um, couple things, let's see, is this... systems okay mvs code okay yeah it started to add okay all right Cool. So I've got Claude desktop over here and Claude desktop access to graphite Atlas via MCP.

And so I can interact with it. I can say, Add Points. Next JS. Ruby on rails and other flavors. Rivers. to our, Programming. I don't think I have to say all this. Main view, use MCP. Okay, so I can say that. I'm going to kind of be working alongside you on this project. Um... it's not like I'm just like gonna you know leave you to the wolves there's Uh... There's like two directions that that this needs to be nurtured in.

Okay, so this is a compact conversation. Okay, this is annoying. All right, it's going to compact conversation. We'll get to this over here. So that's going to do some stuff via MCP. It's going to add more to our graph once it reads things and does all that stuff. What I'm doing now is I'm adding that capabilities. I think those capabilities as this navigator here, which If I go, hmm, Let me go here.

Let's see if I can... I don't really usually get into this. Okay, so there's a couple versions of Navigator. So what this is, is Um... Kind of an extension on like visualization tools. And you can think of like Mermaid as like in a lot of ways the predecessor. So Nigel comes from running his business in Airtable and Mermaid. And he has hundreds of employees. He's got lots going on for, for, for, um, Masterworks, and he needed a better tool to be able to handle that, but he also is very visual.

And mermaid diagrams are editable, which is really nice, 'cause you don't have to get pixel perfect with things and stuff like that. But they're not useful for AI. They're not useful for generating documents and stuff like that from them. And so he wanted to create something else. And there's a large community that they call the graph community, and they mainly focus on ontologies. And the abstraction has been super technical, mainly for pharmacy and a lot of scientific areas.

There's a subtraction of those so that people could use them. And you can think of the closest to that as Memgraph Lab. And it is this query-based, right? You have to write cipher queries, You have to be kind of like a data science type of guy to use it. instead of somebody who thinks visually and wants to think about something in like a map. But also, they really like Airtable, so they want Airtable and they want all the features and functionality of Airtable on that same data.

And so that's some of the advancements we want to go, which part of those features are super rich, but also Right now it's just me. And so being able to go in two different directions of chat and LLM and AI and then also feature rich with like what Airtable does and Notion does with their sidebar and you know being able to move you know doing all that stuff like There's like a lot going on there and you're kind of, it's like a whole canvas.

This is called XY flow, it used to be called React flow. It's pretty performance. Each of these things is an entity in Memgraph. This is stored in Memgraph. The sidebar is stored in neon or in Postgres and so are these views. These views are queries. These views are cypher queries. And some of the things that like recently that I'm working on right now, Is Luciao Guido van Rossum is over here. He was over here.

That's where the graph originally put him. But Nigel wants each view of well actually his initial customers want each view to persist. the points and paths. So they can drag things wherever they want. And then when they They go to a different one. Okay, let's move that one, I guess. They go back to this one. All that stuff's there if they zoom and pan. Let's zoom and pan. So stuff like that is some of the details that I'm really getting into.

Um... But I can't move fast enough to, you know, and now that he's onboarding customers, like design partners, like the person we met with yesterday was theHello. had a product for Airtable. And she broke off and has her own thing and she wants to embed our app into her tool. Um... So like some of these meet like he's very well connected and he's like putting this in front of the right people. He's got probably 25 customers that he's ready to sign.

So this is kind of ready to take off in a way, but there's no way I can manage this just by me, myself, and then handle the other lines of business and try to grow the business. So that's partly where I need some help. Okay.

So this is the first project that you want to help with?

Yeah. And this is dev right here. So, and I'll give you access via GitHub. That'll probably be one of the first things. So I gave you access to the knowledge base. You should have access to everything in there. I gave you a full user access. Yeah. Uh... I'll figure out GitHub when you let me know which GitHub you want to do. And then I think you need to sign those things. So let me know if there's anything that's funky.

But then that allows me to let you into the Graphonet as code base. I'll get you in the code base. I'll get you in his notion. And so you can just kind of build some context. And then don't worry about the graph repo. I'll give you access if you want, but don't even worry about it. Don't worry about status, it's running. Don't worry about MCP. You can if you want, but don't worry about those. The only one that you're going to need to pull down outside of the Atlas one is the CLI one because there's a web directory in there with some styling that's pretty awesome that we want to use for some of the stuff in there.

So it's like there's some learnings there, but outside of that there's one repo that I need you to focus on. And that's... Okay. Not you. That's this one. I've got 11 issues in there right now. I'm going to be adding issues to it. But every issue you see-and there may be some back end stuff. You'd be like, hey, there's some back end stuff I don't know how to do. I'll help you. No big deal.

I already see an issue. The Zoom button.

Yes, oh you're all playing with it or?

No, if you go back to the graphite Yeah, so if you look at the zoom, see the inside element is overlapping the order, the corners are not rounded. I don't know how to fix that right now.

Yeah, that might be a good first task. Let me get rid of this one. We don't need this one because I don't So if you run in, I have this one open. If you run into a problem with the graph thing, you can just document it here and I can knock it out. But you shouldn't really run into, you shouldn't run into things.

When you say graph thing, you're talking about the... Memgraph.

If you get an error, like you're creating a point and you get this weird error and it's like mem graph this error, blah, blah, blah, or query this query error, you The backend is making queries to Memgraph. Well, not exactly. The backend is making queries to an API gateway, Which has a land that authorizes it because Memgraph doesn't have any built in authentication for applications. And that's how they're getting on that 25 grand.

So I just built that. So I was like, well, screw that. I'm just going to house my own mem graph in an EC2 that I can make as big as I want, as fast as I want, and I'll just put it behind an API gateway in a Lambda, and that Lambda authorizes it and only lets our apps through, only lets dev through, and only lets production through. Okay. Um... And so, So that's kind of how I'm doing that piece of things.

And then the other thing is there's a two gigabyte add-on that is absolutely required to really do any graph algorithms. It's called Mage. And so you pretty much have to install that to do anything cool. And it doesn't come pretty much...

Install Mage locally?

Mage you can install locally. It's two gigabytes, but it's an add-on. So if you install Memgraph, you have to ask for Mage and you have to log in and install it. It's annoying. But it's the way it works. So, and their cloud offering, which is kind of like a pay-as-you-go thing, which I thought about using that, that doesn't have Mage. So it's like, oh, that's no-go right there, so I had to roll my own.

So that's why this exists altogether. Um... So you'll see one repo Um... There may be some documentation that's a little outdated. Like, we don't use this doc site right now. We mainly just sit in Notion and there's almost nothing outside of that API gateway in Lambda and that surround mem graph, there's really nothing in AWS. It all sits in Vercel. So it all gets deployed. really, really quickly, via the Vercel integration and I'll give you access to all this stuff because we have like observability.

Oh, and I need to give you access to PostHog, we use PostHog as well for analytics, which will be helpful as users come on because I track everything a user does. So we'll be able to get insights on new features and all that stuff. Um, post-hoc is pretty sweet unless you want to roll it, roll it yourself. I, I, uh, I recommended it to, um, another engineer or a CTO and he's like, I'm in a company, I'm doing a company in India, I have to house this myself.

And I was like, okay, he's like, It's... I don't know. He said it's 500 gigabytes or something like that to house post hog himself. He's like, I don't think I can do this.

I think I have to go to another solution.

Yeah. Yeah. That's crazy.

So, but it's really, really nice.

It's, it feels kind of state of the art. There's other competitors too, but it's pretty good. Um, So we have a domain set up and they go to two different environments. So you see deployment. A preview environment, all branches that are not the main branch get deployed to preview. If you start working in a branch, you can just go to deb.graphiteatlas.com and you can see your stuff. Um... If we're both working, And you can always see these, like if we're both working, there's an underlying domain as well.

that's like your branch domain. or you know, kind of thing like the specific one that Resolve to dev, if you go to dev, but there's kind of like a little bit of a race condition if two people are working in it. We could set up two different devs, I guess, or like a CJ.one or a Tim.one type thing.

We could do that. And that's totally fine. We want to do that.

You can take over dev. And I'll use the underlying one if you want for now. Off and all that stuff is kind of baked into it. So you'll see like, yeah, they can kind of clobber each other on that domain. But Under preview there's also These domains right here, that you can go to that are unique to that specific build. which is actually, it's a really nice system once you get used to it. Um... Storage is in Maitland Neon.

Do you have a few extra minutes?

Oh, yeah, I have all day. I'll hurry up and I'm over here. It's just a lot right now.

But that's recorded, so that's why I'm continuing. Okay.

Yeah, that makes sense, yes.

There's a Postgres instance, there's tables, These tables will start to make sense as you get involved.

We use Prisma on ORM, which makes it really nice to work with databases. It's a really nice,A stepping stone, especially from like coming from front end stuff to working in the API, to working in like with database stuff, Prisma is a great abstraction. So you don't have to worry about a lot of the database-y type things. Um... So that's Neon. I'll give you access to that. I'll give you access to Vercel.

Vercel, this is the new UI of Vercel. They changed it yesterday, so it's a little different. Um... Logs are important in Vercel. These become very helpful for finding issues You can filter by environment. I'm playing in some of the observability stuff as customers are starting to come on. So there's two projects in here, but there's an observability. Where's the-There it is. It used to all be just a top bar, now they got a side bar nav.

It's got me all messed up now. So there's some observability. It's not the most comprehensive, but I think it's in beta still. Oh yeah, alerts. We've got alerts set up going to Slack. Um... So deployments and stuff like that are noted to Slack so we can kind of keep an eye on anything, I guess.

Let's see. Should I? Do you guys have a Slack? Or are you just using the Grizzly Dev one?

Yeah, this one right here.

I'll invite you to this one right off the bat. And then I can invite you, so I'm a user in the other one as well, and I'll invite you to the other one, but it gets a little confusing because I've mainly been working out of this one because I... It's been this interesting partnership and Equity only comes in after customer signs. So until a customer signs a paying customer, there's no equity. That's part of the agreement and thatKind of makes sense in a lot of ways because if there aren't customers, there is no equity, so it doesn't even matter.

So that's like how he wrote it up. So I've been kind of on the, like using my own slack to kind of keep things all separate, but I just add myself to the things. The reason why I do that is because I work multiple projects and I wanted them all in one Slack.

I didn't want to have to keep jumping between them. Yeah, that makes sense. I can put you in the actual Graphi Atlas Slack.

It doesn't matter. whatever you prefer.

More I would, I prefer so I can like start interfacing with youI'll invite you to this one. Yeah, I think that makes sense for now.

That you and I can talk in? Okay.

And then we'll have like the stuff with Nigel that I'll create one with the three of us with Nigel. He's very hands on with product and he's very, very good. which makes it really easy now that trust has been built. Like, you know... At first it's like, oh man, do I trust your direction? We're partners in this. There's a bit of feeling out for things. He's impressive. So now it's just like he asked for something, I'm like, Okay, let's do it.

I don't like balk too much on future stuff. He doesn't... He is big into rework and he's big into the DHH stuff and keeping things simple. So the base camp guy, he's really big into his philosophy. So he's not going to ask for like, a bunch of stuff. Like he wants, like he wants this bottom table stuff to be like Airtable light. He wants it to be as good as Airtable. He wants this to look different.

He wants the sidebar to be better. But right now he's asking me for this. Like that's the main thing like he's having to I'm having to tell him no basically and I don't really like that as much because If he wants to go fast and super capable, But this is just kind of the arrangement. We're trying to make sure product market fit is there. And so we want design partners, we want a good five companies to say yes.

before like, you know, the real before we say let's quit our day jobs right right but a couple of these could turn into a bigger commitment opportunity and it's not to say hey you have to do it not at all but it's an opportunity to be a ground level engineer working with like somebody like Nigel you know who's done this a number of times, And that's very appealing to me.

So there's kind of that as well, yeah. Yeah.

Okay, cool. So... That's the layout of things. We won't talk about any other projects. Let me go back to that. Oh, oops. I was going to go to, ah, this is what it did. It added, it took itself a second. It got some views, added points to views, added some stuff, you know, just because it's doing stuff, you know, because it can through MCP. And now we want that. He wants that embedded. And his little graph, his like prototype, he's been, he works in cloud code as well.

His prototype that he's built forFour. The... He calls it Atlas Navigator for the chat interface. Looks nice, it's really cool. I just want to get capable. And if I can get it capable while you spool up, Um... then we can work on making it beautiful. which is like that's your bread and butter and we're in Tailwind. We're in Next and which a little bit more my wheelhouse now, like back in the backend and stuff like that.

So I'm totally there to help. And you can do as much as you want. But like, I feel like we're the perfect recipe to bring this to a level that's gonna make him really think, wow. Um...

Okay. Yeah.

I believe this.

So let me get back to this really quick.

This is the document for you to kind of go through after you, you know, This is the lay of the land, like how you do things. If you wanna deal with routes, if you wanna deal with API stuff, routes are probably stuff you have to deal with. And then next is taking a look at the Atlas stuff, taking a look at the issues. And then I'm not asking you to do any work, just let's schedule some time and let's do a couple issues together.

Once you look at the code, once you feel good about things, let's do a couple things together to kind of get you warmed up. And then once those are committed in the dev, we can split and divide and conquer a bit. Um... And then I think we can rock and roll and knock this one out. Maybe we can just meet weekly, every few days, whenever you need.

Okay. Whatever you have my full trust.

You know, we've worked together for years You know, not not through not all the years but you know, I think right like But you yeah trust with me like character trust Capability trust all those things right on You know right right from the beginning So, you know don't expect me to like be checking in on you every day or any of these things Just do your thing ask questions If I step on your toes, text me mean things, whatever you need to do.

Like if I'm giving you away.

I probably won't do that.

So if you need to meet in person, we totally can do that. In a few weeks, I was going to get together, you know, trying to do it a little earlier, but I've just been... It's been busy with things, but I'm trying to get us a place to work. I've got like three or four places that are like right in between us. Kind of where we met my coffee.

that would be like locationally advantageous, but also could be like a nice spot for us just to jam and pair program for a couple hours or something on some of the more complex things. Yeah. But we can just kind of see how things go.

I'm perfectly comfortable in my den here, the studio here that I took over from my wife.

and stuff.

Patty's comfortable here. And all that. So but this is kind of like in progress is kind of like a little bit of sight down the road as like what I'm doing, like what's happening. I'm working on issues. I'm opening things up to residents and the practice. I'm like, I'm getting ready for new work coming in as well. So you'll see me like prepping work for us. Um... And then, so just focus on this page here.

Like I'm not gonna, don't go to home yet. Just worry, you can, just worry about Moonlight KB. For right now, you have access to other things. and then it's gonna get you onboarded to Graphite Atlas.

There's so much other stuff in the wings that's working. I'm hustling.

I'm hustling If I'm not sleeping, I'm hustling. So that's just kind of how I am. I love this stuff. And, um, You know, I...

Try to make sure I take care of him, but this is like, yeah.

Like all I care about is like building something for him because I don't know what this world is going to be like. So I need him to be a trust fund kid, you know?

And that's not coming from, that's only coming from elbow grease, you know? So, um...

So that's you know, that's that that's like the the motivation for it So I don't expect you to like do what I'm doing work at all You know just put what you can in when you can you have a day job. This is moonlighting You know You are really good at what you do. I know you're going to add a lot of value. So from my side, there's not really any worry about it. I don't want you to fret about things. At all.

So just always have conversations with me and let's just be like upfront.

If you're like, Hey, you're asking for too much. Let's talk about it. If you're, if, you know, if, money's gonna ramp up more. Like as things can come in, as I can pull stuff in, and as these things go from incubate to revenue positive, I can, we can, we can, we can do more and we can hopefully get away from doing like day to day stuff. Um. Yeah, like the-The scribes of America and Adler and Howells and...

House RIs. There's a few I'm doing. I'm juggling two. because they're lucrative And They have to have somebody. I have to augment.

I do have work to do for both of them. Most of them are so slow they just can't keep up with me. But because they're contracts with Epic, they have to actually like, one has to have been hired as an employee. And I have an agreement with The VP that I can just run on my stuff and they know that I will drop them in an instance.

if I have to, they're a fraction of my income.

That is crazy.

But I get benefits, so it's like cool. And then I just picked up house. And Houselr X is like, we need somebody.

I was like, okay, yo, hire One Putt Health. You'll get me full time. You know I'm really good. I created RetroHook. I create these things. I met them through Alda Pontes, who's a RetroHook user. And she was one of the early adopters of RetroHook. And so she's like, oh, HouseRx needs like other types of integrations with next gen and all this other stuff. It's not HL7. Does your platform do that? I was like, yeah, it does.

But it's like a lot of like, it's a lot of like consulting and engineering work. And she's like, what if you just became a consultant to us? I was like, okay. So I was like, here's my rate. So they're like, "Okay." So I was like, Shit, I was like, all right, that's a lot more work than I had thought so like I'm eaten outside of this so I'm able to give you what comes in and incubate these things but I know that equities on the tape, there's other things.

The reason why I haven't talked to you about equity yet is I don't know what that all looks like because angel investors are starting to come in.

You know, like the numbers, like I could say, hey, Tim, gentleman's agreement, I'll give you equity.

I don't know what that, I don't know how much that is, what the points are. I don't know any of that.

So I can't put that in writing until that's set up with the hospital and with some of those.

Yeah. Matt controls the agreements for that. So I have Matt bulletproof the agreements, especially after what happened with Braved.

Um, Braided didn't go so well. And...

I don't reallyBraid? Braided didn't?

Is that the one with-what's his face?

With Jason and Guy? Yeah. That went really sour. Sorry to hear that.

Yeah, it's okay. There's a lot of greed and...

Yeah. There could be lawsuits there, you know, and andMatt's really upset.

Okay. So I'm trying to-I was really upset at first.

And Matt was like, let's see how it plays out. Um... And then Matt's more upset now. So I don't know. I just tried to put it to bed. What hurts more to me is it ruined friendships.

And that was the whole thing. We were supposed to talk and never let it ruin friendships.

And two people, well, there was one person that instigated it, but two people ran with all the money.

What is wrong with people? That is really wild. Especially if it's a situation where everyone's eating like it's just like...

Yeah, and I wasn't asking for money.

I wasn't even asking for a paycheck. I was like, use mine. I know you guys need to eat. Use mine. I'm going to hustle like I'm doing. I'm going to hustle so that I can eat. You know, but they like cut me out of my equity. They tried to like, you know, and Matt has been handling it so I don't get too upset.

Matt's not really a lawyer you wanna mess with. Yeah.

So, and it's just all going to work out. Fine and in the long run and I'm able to focus on what I really really care about is med scrub like I Like I'm so driven about med scrub I Uh... The feedback I've gotten from people that work at the government, the feedback I've gotten from physicians, from startups, I'm just waiting to get revenue. Part of it's like, Getting it fully ready. Like the offering, like the mobile app is like the last piece to that so that I can like enable doctors.

without without friction and that's if I can do that I can sell to hospitals so I worked with this guy Patrick Carter for a while and I I helped him with the clarity health project and that's actually how Med scrub was born was I needed to de-identify data before went to consumer LLMs we built an app for like rule health AI to help people understand their care better when they're in rural health situations.

And there was a lot of grants and funding at it a while ago, and it's kind of like... all in Jumbo right now, but I needed to de-identify the data on behalf of the user before it went to an LLM. And so I built a proxy. And then he's like, hey, could you do this for Jupiter Health? I need to connect it to MCP and I want to show it at the JupiterCon. And I was like, yeah, cool. So I built an MCP. He showed it off at JupiterCon.

The guy who runs HHS, Dr. John Pollock, he He's like, "This is really cool.

So I have a question. Yeah.

All right. Can you essentially just like... hook this up and go into an EHR and basically you're looking at PHI, but it's not PHI anymore? Like if you're trying to show something off.

Like I don't have like a fire app that like clouds the PHI's UI or the EHR's UI. It sits on the same network. And it offers tools to use ad hoc with their EHR. So if you grab EHR data, and you want to use it externally, it acts as that barrier for you or that filter for you. You can use your phone and there's like bamboo and stuff and a lot of doctors are just copying and pasting right into ChatGDP.

So it's like, no, no, no, don't do that. Copy and paste into this. Instead this will safeguard it before you do any that stuff So there's like that piece, the proxy, the like the engine sits in the hospital and each phone connects to the engine. And same with that startup, that proxy would sit in startups infrastructure And whenever they have to connect to an LLM, connect to something external with PHI, PII, it doesn't have to be healthcare.

Let me look something up really quick. Let me see here.

Let's use this domain. Shouldn't matter. Let's see, approach, I think it's under approach. No, not comparison. Oh, um...

Let's see, where have I got any?

A bit on here of like the recent lawsuits, and they're not all healthcare. Like there were a bunch of them recently that were... Um, Just...

Yeah.

that were just like tech companies.

PII. PII, personal identifiable information.

Yeah, breaking safe harbor.

And it's millions of dollars. And so like as As this becomes more and more of an issue because Apps are more and more adopting this. this becomes a way to safeguard.

So you could basically just copy this and change the name and sell it to other companies that are not Using it for PHI.

I don't even have to.

You don't even, you don't have to, but like, uh, I don't know. There's...

That's all that, excuse me. Well, actually, you know what? You make a really good point because I could probably improve the latency if it wasn'tDoing medical stuff, you probably wanna remove that too.

Anyway, you'd probably wanna-So you'd have a different pricing model. Yeah, maybe a different pricing model.

Right now I'm on consumption and So it's consumption based, they can buy credits. They get 500 credits to start. and then they can buy credits or I'm negotiating perpetual licenses for $25,000. So design partners, I'm trying to bring in $25,000. one time. They get the code in escrow just in case Medscript goes down. But either way, either way, like if we log in here, Oh, I got to add that. Oh, that is something I do need to do.

Oh, it changed. I changed the I had another domain and I gotta fix that, huh? So everybody downloads a proxy. or the desktop app now. in the new version. And then that is either credit based or if they have a license, perpetual license which I so I use the stripe license system which is awesome and I can just flag something as perpetual, and if they pay for it, and then they get a special license key, that allows anybody to connect to it and it doesn't worry about consumption.

So this is actually an older, because now I have the desktop app, so that's an older UI. I'll have to update that. It's kind of a little bit in progress here. Um, So, but again, I'm trying to get design partners for this one.

Um...

This is a very AI UI.

Oh, it totally is, yeah.

And it does a good job.

It does, yeah.

Well, especially if you're like, hey, use Shad CN. Use these specific things. It's like, yeah, it does pretty good. But then, you know, like I need a couple, you know, once I get this dialed in a little bit better, I'll take a couple passes at like not making it AI. Bye. That's kind of a little bit more of like what this turned out to be. Like this is where I was like, I wanted like DAI-ify it and it came out a bit better.

Yeah.

It did. Yeah.

But, uh, But yeah, when you log in, I didn't do that to those pages.

It's like, you know. It's the gradient. The gradient buttons, the purple gradient buttons give it away.

Yeah, yeah, yeah. Which is something, because anything magic UI, I feel like, Which I was like really I really like magic UI for a while. I've never seen them It's like a tail with a hat on.

It's like you could change the... The AI UI that they create just by using like removing gradients and changing some colors can make it look not UI or AI-ified pretty easily, I feel like. Colors do amazing things.

Well, and that's more your area. So my mind goes to excitement as to like, well, he's just on Graphite Atlas right now. But all my apps could use Tim kind of thing.

That's good. That's what I enjoy doing. Cool. It's med scrub, so you could just, you could read. Like, you don't even have to tweak it yet. You can just--Rebrand it or add another one called InfoScrub, right?

Yeah, exactly. I was like trying to think of a thing to call it.

Exactly, yeah, yeah, exactly. And literally the only reason why this chameleon is here is because I had chameleons as a kid growing up. Growing up I had veiled chameleons and they were like my favorite, yeah I have a penny, but they were like my favorite pet. They'd like shoot their tongue out and eat flies and change colors and everything. And so I was like, you know, I just want this to be mine. Like I wasn't even building it.

Like somebody else at the start.

Yeah. Yeah.

And that might be kind of like an...

Like it's not health carey, I guess. So that might be something that has to change, but I'm fighting it.

Like Matt's mentioned it already.

I like it. I think it's cool. It's unique. It's unique.

Yeah. Well, and like, like things out there, like some of it, like med plum, like plum is how is a plum healthy health care? It's a plum. I guess you're healthy as a plum. I don't know. The BIM canvas. These are also tools that I want to bring to your radar at some point because we'll probably work with these.

The BIM canvas is this really cool front end tool for working with a lot of EHRs.

You can basically put a little browser app on and you write a TypeScript app. It's really cool. And so you can do stuff with some of the most painful EHRs by building like a little app on there. And so I'm marketing some of this. So we might get some traction there because there's not a lot of people doing it.

And Hand Plum is what I built. How fair it is.

consented record exchange on, on top of. It's a FHIR server. Um... Yeah, it's probably you could say it's a competitor to one of health But it's like way better. Because a lot of really good people left. Yeah. So this is also interesting. There's a FHIR developer agent for Claude. It's kind of wild. So, yeah, I'll stop. I'm digressing. Lots to do on lots of things. Let's focus on Graphite Atlas. I put like start date of the first.

Sorry.

Um...

Let's see... I'll get you access. If I don't get you access, ping me. I'm going to stop this for...