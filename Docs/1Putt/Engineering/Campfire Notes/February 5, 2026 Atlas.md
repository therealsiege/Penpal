Created: February 5, 2026 4:56 PM
### Project Overview & Business Context

- Graphite Atlas is a graph database product that abstracts complex graph technology for non-technical users
- Nigel Glenday is currently in the Middle East (Qatar/Doha) meeting with potential customers including a Saudi family and the CTO of Neo4j
- The product has 25+ potential design partners in the pipeline, with some interested in embedded use
- Main competitor is Glean, but Atlas offers better accuracy through structured business knowledge graphs

### Technical Stack

- **Frontend**: Next.js 15 full-stack, XY Flow (formerly React Flow) for graph visualization, Shadcn UI components, Radix UI, Tailwind CSS
- **Backend**: Memgraph (graph database, 9x faster than Neo4j), Neon Postgres (for user data/metadata), Vercel hosting
- **Tools**: Prisma ORM, NextAuth, Vercel AI SDK, Fathom/PostHog analytics

### Product Capabilities Demonstrated

- Users can visualize and interact with knowledge graphs through multiple views (graph, table, combo)
- MCP server integration allows Claude AI to interact with Atlas data as a tool
- Entity resolution handles duplicate detection when importing unstructured data
- Views act as composable filters on global data (org charts, engineering dependencies, etc.)

### Development Workflow & Infrastructure

- **GitHub Issues**: Primary task management, issues linked to PRs
- **Branching**: Feature branches off dev, PR review by Nigel, then merge
- **Deployment**:
    - Any branch push deploys to preview URLs via Vercel
    - Dev branch → [dev.graphiteatlas.com](http://dev.graphiteatlas.com)
    - Main branch → [graphiteatlas.com](http://graphiteatlas.com) (production)
    - Plan to create separate staging environment for Nigel's UAT
- **Testing**: Playwright for E2E, unit tests, pre-commit hooks with Husky

### AI-Assisted Development Setup

- Heavy use of Claude Code with MCP servers for development acceleration
- Context 7 MCP server provides documentation access (Next.js, etc.)
- Submin AI Kit creates code-specific agents and skills
- Playwright MCP enables test generation from browser behavior

### Current Priorities

- **Critical path**: Five major issues blocking paid gate, mostly resolved
- **UI polish needed**: Contrast issues across themes, inconsistent styling
- **Onboarding**: User invitation flow and email sequence need design
- **Tim's initial tasks**: Contrast fixes and other front-end polish work assigned in GitHub

### Access & Environment Setup

- Tim granted admin access and feature flags in dev environment
- Local development connects to dev AWS/Postgres automatically via Vercel
- Neon database accessible for manual data editing/testing
- Repository: Atlas folder only needed initially

### Collaboration Model & Opportunity

- Clint handles development velocity, Nigel manages product/sales/UAT
- Tim onboarded as part-time contractor through "Moonlight" program
- Equity offered regardless of full-time commitment
- Long-term vision: Scale from solo dev to two-person team, potential for full-time as revenue grows
- Other 1PuttHealth projects queued: eSpiral (healthcare residency tool) and MedScrub (PHI redaction)

### Strategic Context

- Product timing is ideal as Nigel networks globally on AI for CFOs/business leaders
- LLM integration makes graph databases increasingly valuable for accurate AI responses
- Goal: Unlock Nigel to focus on sales by stabilizing engineering delivery
- Met with Airtable CPO who found the approach "fascinating"

### Next Steps

- Saturday 9-10 AM pairing session to review progress, answer questions, and demo AI workflow tools
- Clint to set up separate staging/preview environments
- Tim to explore codebase, get comfortable with local development, and review assigned GitHub issues
- Async work cadence with regular check-ins to be determined Saturday

Notes

Transcript

Are you going to a meeting? Yes, Remi. It's time to be quiet. Okay.

Amen. Not too bad. So I only took 30 minutes and we can... Do another session we can go longer Whatever it's more I kind of wanted to leave some time for you to ask questions as you're getting acclimated. Yeah. I'm kind of deep in the code right now. Um, Just to kind of give you a little bit of the current status of things. Nigel is in Doha or he was in Doha now he's in He's in the Middle East right now.

Yeah, I see.

I saw he posted something. Looks like he's in Qatar.

Yeah, okay. Yeah, he's been bouncing around over there. The Saudi family wants to use the tool. is one of them. And then he met with... So... We haven't talked too much about graph databases, a little bit, but then this kind of wraps and surrounds. In a way, this business wraps graph databases and provides an abstraction that's really useful. Because they're super powerful, but they're also really academic.

and kind of like in the technical leads. So our whole goal is to surface that to other personas. The main graph database technology that's been around for 15, 20 years plus is called Neo4j. And that's where he, so he met with their CTO and some of them. We don't use Neo4j As a database under the hood, we use Memgraph. Which is a faster, it's like nine times faster than Neo4j. It does a lot more in memory, kind of hence the name, than Neo4j.

So it writes less to disk and, you know, kind of is a little bit more optimal that way. Same kind of thing, though. It's the same technologies. But with Memgraph and the Bolt protocol, the communication protocol, we actually use the Neo4j and that's recommended by Memgraph even. So Neo4j is still like super big in the space. but they're Their database engine is a little older. It's written in Java.

It doesn't perform like some of the other ones. I think Puppy is a new one that performs really well. It's in Rust, I think. But it's still kind of an emerging area because the value... Bless you. The value of these database, of this type of database technology has really increased due to the use of LLMs. This is the way LLMs think and talk. Okay. So you're able to provide, in Graphite Atlas' case, you're able to provide a semantic layer of business knowledge that allows the AI, the LLM, to be very accurate.

And I can demo the product more to you if that would be helpful as well and get you a spot in there.

Yeah, probably.

I'm going to be lost, I feel like, for a bit.

Yeah, that's fine. So let me just show my screen. So I'll just kind of show you what you're going to get. And then I'll add you.

Should I go do some research on graph databases just to get a feel for it? Get some basic knowledge on it. Not that I need to touch anything to do with it. Just...

I don't know if it will help or not. It wouldn't be a bad idea, especially when you think about, so we have an API that wraps a lot of the nuances of the graph database. But if you were to directly connect to it, you would notice there's latency things and batching and there's ways and patterns to handle communication. And they're not the norm. So there is some to be aware of. For the most part, I've abstracted that out to an API that you can just straight write queries to.

and then it'll execute those. So you being the front end application will kind of say, is the only citizen, the only first class citizen, the only consumer of that API In that regard, The other consumer of the API is our MCP server. And you can think of that as a way for us to bundle logic and API calls into these things called tools. Which allows us to like put rules in there like you can only edit your stuff basically.

And that becomes kind of complicated when you talk about LLM calls. Because let me just share my screen here a little bit. That'll probably help. Help a bit. Let me know when you can seeYeah, I can see. Okay, let me just, I'm just gonna make this the whole screen. This is Graphic Atlas. And this is my programming universe here. And I actually created this not by hitting this plus button, which you can create points.

Oh, we want Babel, whatever. You can create points and paths this way. and connect things together. or You can use flawed because we have an MCP server So let's see where would that be? Think I've got it somewhere Ah, here we go, Graphite Atlas workspace. Okay, cool. So you'll see here that I use this. Can you see Claude right now? Yes. Okay, cool. So in this chat here for Claude, what I did was I had it grab the data from my Atlas and interact with it.

So there's an MCP server built in and if we go to what that looks like, I'll open up right here. You'll see that users can Set a graphite Atlas MCP server, and it runs off Node, right? And what it is, it's like a set of tools that interact with our API. And that's really, really important, MCP is, because you can think of it as like HTTP. It allows us to put rules and capabilities there. So as we surface like, hey, you can do these things to the graph database, we also want to make sure that they don't shoot themselves in the foot, shoot another user in the foot, destroy the whole database, all those things.

So MCP is like, it's like HTTP in a way, it's a standard that allows us to open up our chat and our API to allow for cool things like this. Now actually I'll just show you. Let me... So the same thing. So kind of what I'm doing is you've got this MCP here, this chat. What I'm doing for the most part, I've got some bugs I'm working on, but for the most part what I'm doing is I'm bringing that into Atlas.

So let's see here. List my Atlases. Okay, and now I'm chatting with the data that's this like visualized declarative structured form of data that's in these entities and relationships you can think of, points and paths. Okay, let's... Let's work on number one. Who invented No. Ryan Doll created Noah. Rhyme Doll is also, so you can even see like that it's able to traverse paths. Ryan Doll is also the creator of Denno, which is like the new node he is known for building.

Node blah blah blah, which runs on the V8, blah blah blah, cool stuff, right? So you can also say, okay,Give me a... Job. I'm just gonna put it in there now. You can kind of do wild stuff. You can ask it to visualize. It'll use this to visualize more.

All right, so those nodes up there, did you create those or did the alum create those?

Add the LLM to it. I asked the LLM, I said, "Hey, Give me a universe of programmers and what they created.

What I'm saying as you're searching now, does this create more nodes that you can explore?

or Can we? Create some nodes around the rust landscape. We already have maybe some. So this is where, actually this is kind of funny. This is where things get really difficult in data science. What's happening right there is it's doing entity resolution. And entity resolution is where it's taking Unstructured text is taking knowledge And it's saying, OK, I recognize this. Now I got a bunch of new stuff in here.

This is where it gets difficult. I got a bunch of new stuff here. Is this the same? Is Ryan Dahl the same? Is... You know, right? So it... Let's see, here's the current landscape. So it's able to-here's what's already mapped. Um.

So if Ryan Dahl was the same... and link to this one, it would create that connection on the UI?

Exactly. Let's just say I I'm speaking to this. You can speak to this, right? You can talk about your company. What if there's duplicates, basically? What happens if another entity comes in that's close enough That's Ryan Dahl, but not spelled exactly the same. How does it resolve that? Some of that stuff is where things get really, really complicated. But it's also like... Nobody has a great answer.

It's more where it's like, well, let's figure out a great way to put the human in the middle of it. Like, how does a human verify? So right now, that's kind of how it's happening here. is it was like, hey, let me look at what you have. And it's going to propose some changes. Okay, we got some new stuff cargo duh rostov duh Tokyo duh like those are like all ones. I'd rocket those are all ones I know that are huge Dropbox was written in Rust?

Oh, I didn't know that. Wow, that's interesting. And then it's gonna say, here's some new paths. So these are the relationships, points and paths. Say, OK, cool. Let's go ahead and add that. And now what it's doing behind the scenes is it's using batch create, tool that I've written in MCP to go ahead and add those to to the Atlas. So now it includes includes all that stuff We can probably kind of, you know, it gets a little wild here because it's got, it's gotten some, I've gotten a bit in there.

And what's really interesting is look at all the lines to JavaScript.

Yeah, that doesn't surprise me.

This craziness. So, So you're able to interact with it. You're able to create documents, like this Node Engineer document right here. So there's like a lot of really cool interaction you're able to do based on A visualizable map of your business Or whatever you're doing. It could be your soccer. You're a soccer mom and you've got a soccer league you manage. I don't know. It could be anything, really.

Um... So cool, that did that. I'm just going to close out of this. So this area is really what I'm working in right now, a lot of this stuff and cleaning up some of the UI. This was smushed. It's better now. This is better So and then You'll notice here maybe is one of the things you'll notice potentially is all of this is like very flexible. And that's a little bit of its own trick. This one used to work really well and this is what I'm having trouble with right now is getting this one back.

I somehow broke that one. And then this one here. And you'll kind of like see that there's a couple different themes going on here. So there's the visualization tool, which is like, it's cool. It's kind of how we think and stuff. We're trying to base it off of Moreau, if you've seen Moreau. I have, yeah.

Okay, so it's kind of similar in that way.

And Moreau under the hood is like a big JSON object. For us, instead of it being a JSON object, it's a graph database. And why the graph database is cool is because there's graph math and all these other algorithms and stuff that you can do with graphs. Um... So that's really cool. So there's kind of the Moreau, and we use XY. XY flow which used to be called react flow We use that library. Let me see if I can...

It's my flow. Yeah. No base UI.

Yeah, it's pretty good. It behaves really well. Double abuse is good. Looks pretty good. DoubleLoop is a cool one. This one is kind of a competitor. They do metric trees, but you can see it's very similar. They're using the same library as us, right? And so they've tied them so each node has an API call to it. And so you can give them live data, which we plan on doing that eventually. But there's a lot of really cool stuff that's kind of like getting to play in this area.

Um... Okay, so there's the graph area, which in itself, it's kind of nice, it's kind of useful. And then that becomes really, really powerful when you tie it with our view system. And so right now you're seeing all the systems and languages and all that stuff. But I could just have it as the creators in languages right here. So there's these composable views and these are basically just filters on the data So if I go up to, where's my filtering?

Where did my filtering go?

Is that my filter now?

I don't know where my filtering went. I must have dropped it somehow. Okay, so you can filter on on piece of data and that allows you to Um... You know, create views of different things. Oh, this is my org chart. This is my engineering chart. These are my engineering dependencies, you know, and all these things. And then you can have like one major view that's, here's my whole business. And then--Yeah.

And all of those are valuable at different levels, but they're really valuable because the chat interface can interact with all of those. So I gotta figure out why my filtering is not showing up. I'll do that.

So what is-What are some use cases for graphite atlas in the real world? Would this ever be used as like a presentation tool?

Yeah, it could be.

So,Just what I'm looking at now doesn't look like something you would use to present with.

Right, right. That could be, and you can generate artifacts from that. It's more as a thought partner, and the main use case is... Your workforce people Is mailable. People leave. People come and go. And that knowledge, that tribal knowledge, all of that needs to be well preserved. And Graphite Atlas is the tool that helps you do that because you can dump all of that knowledge in via unstructured data, via all sorts of different ways, get it into a structured format that can be shared.

that can be used across the team and then that can be used to generate HR documentation. all sorts of reports. And so what in a lot of companies is An org chart, a whole different slew of diagrams could be in lucid chart, could be in all sorts of different things that represent how they do business, that represent how communication happens, all sorts of things. That can be boiled down into one area that isn't just a diagram, it's something that's living, breathing, and you can interact with.

So it's kind of like And with that, with the whole AI part of it, It's very coupled to LLMs. And so that's the kind of the other piece to it is this also enables you to have a little bit more accurate of insights than something like a gleam. I don't know if you've heard of Glean. This is probably our biggest competitor. But Glean basically will take all of your data in your company, like your whole Google Drive, scrape it, and create some insights.

What's... Unfortunate about it? is It doesn't really have a map of your business or doesn't have anything to be able to go off of. So a lot of the insights are Not as well. You kind of like... don't get what you pay for.

And so that's kind of the initial perspective I'm getting.

And there's like a little bit of an adoption to it where it's like, well, the tools in its infancy and it's going to get better, right? So there's like a little bit of give and take there that they're trying to introduce to the market. but they're also having trouble. So I shouldn't say they're having trouble. They're selling a lot. I would say they're having trouble keeping customers. Um... So There's Glean.

With our visualization area, this is our workspace, it's kind of the mixture of the Moreau visualization tool, which we're doing sharing and stuff like that coming up. I haven't finished sharing stuff. I've got some bugs in it. There's this notion like sidebar You know, you can adjust, rearrange things, do all sorts of stuff like that, which it needs more work for sure. But that's kind of the direction with it.

And then there's the air table envision the air table like tabular area of the data, which these are the same bits of data, it's just how do you want to see it? Yeah. And there's some really cool things that Airtable does that we want to do. Like Airtable does roll-ups and... Ah, King Tide.

Roll ups.

Yeah, there's some really interesting things where you can basically run functions on a whole column or on other data. So you can do some cool stuff there. We need to eventually get to that level of doing stuff like that. In a lot of really great ways we can take what's already done because Anything we can introduce and do and hear our way is like gold because it's able to be done on top of the graph data.

We met with the chief product officer of Airtable. Like a couple weeks ago. Yeah, it was pretty interesting. Yeah, they're not really doing much like this. So they found this fascinating to be fascinating. Um... So there's some, I might drag you into some interesting meetings with some interesting folks. I didn't know that, I didn't know Nigel was going to take... I didn't know Nigel was going to do what he does like this.

I didn't know it was going to take off like this. Um... Okay, so that's kind of the lay of the land. If I hop over to here...

So this dev.graphyatlas, should I sign up for this?

Yeah, I think I might need to...

Is that even useful for me? Yeah, it would be useful.

That would be useful for you to sign up for this. Yeah.

I would... development work on this. Is there like a local environment I can run locally OrTo like see changes?

Yeah, totally. There totally is. So let me kind of give you the lay of that too. So really quick. Okay. So you may get an email here. If not, I'll send you one after. I don't know if I got that right. Did it? That should get you in, and then... Let me see, once you're in, I can go, there is a feature flag mode. So let me go to settings. So API keys is how you do MCP servers. Um... Oh crap, I need to go to, where's my admin area?

Okay, all right, I'll make you an admin. And then you get access to this area as well. And this is just the dev one, so the data's not really that useful, 'cause it's what was in dev. But like what's really important is this feature flag thing. Because a lot of things I don't open up to everybody yet. And it's in progress. And even then, we've got these design partners Certain companies that are really, really good at getting us feedback And so we have been Slack channels.

And so we're interacting with them and giving them access to things earlier than like the normal mainstream.

Makes sense. Cool. So let's see, did it show you yet?

No, it doesn't show you yet. Once it shows you, I'll get you squared away there.

Uh... Did you send me an email? Is that what you did?

I invited you... Was it?

Was it, uh... Was it the right email?

earth Timothy.a.gray@gmail.com. I might not have to do it this way. Let me just do it this way.

okay these are invited okay did you get anything Okay, it says pending.

Yeah, I think once you...

Except it be good. It might go to spam or something.

The first time, it doesn't always go to the right. Oh, that-That might be I am not getting anything at the moment.

Yes.

Yeah, I watched you type it. That's right.

Okay, let me see if... Out in spam.

Okay, isn't that updates or anything?

No, I went to all mail even, just nothing. I should search, see if that, okay.

Yeah, I don't see any.

See ya.

I might have to do it through prod.

Maybe that's what it is.

Oh, maybe you have to do it through the actual?

Anything? Nope.

That's so weird.

Oh, maybe I have to... Maybe, uh, okay, let me try to lock you in.

Maybe that's what it is. I bet that's what it is. Okay, let's go. Okay, see if you get that link.

Okay, I got a sign into graphite. Alice. Okay.

Alright, we need to talk about that at some point. I don't have any tickets for that yet. We need to figure out the onboarding experience. So we just need to think about when a user gets invited, do they get-like a series of emails, like maybe it's like three emails. They get one email and then, Like they log in and all that stuff. Then when they're logged into their workspace, maybe they get a second email and that's Nigel's like, here's how to get started with Graphite Atlas or something.

Like, I think we got to figure out, we don't have anything there right now. So that's, yeah.

Yeah, right now, literally I got an email and all it says is sign into Graphite Atlas and there's a sign in button.

Dev, tech, referral, you should be on there.

I think I was... Was I already in graph...

This is dead. So let's see. So now this email should put you at the death callback. Um... And you should be in that one.

Okay, I just got the dev one.

Okay, cool. And now, so what's great about this too, if I go to feature flags, I think, Um, And then I go to... Like... Okay, one user override. If I go here, I gotta go to users. Can I make you an admin? Make admin. Okay, here we go. So I'm gonna make you an admin. Okay, and then now I can also give you feature flags. So I'll give you the Atlas Navigator, API keys, And then eventually, once we start working on this trash and restore stuff, we'll add that too.

Right now, it doesn't work yet. So no need. Okay. So now you're fully set up in the app. Okay, so let me jump over to here. Can you see my screen still? Yep. Okay, cool. So let me, I'm going to make a new terminal. I'm in the source code Atlas. here, Graphite Atlas. And if I go to the source code of Graphite Atlas, There's a couple things going on. There's Atlas, which is the one that we're going to work in.

That's the next JS app. There's graph, which is like, Basically Memgraph and a bunch of other stuff that helps make it an API and like authenticate, you know, like all those things There's MCP server There's a status page. And then there's like some stuff that the CLI and stuff like that, that's where Nigel plays. Like he kind of does some stuff in there.

So we're gonna--Do I need to pull all that stuff down from graphite Atlas? 'Cause all I have right now is Atlas. Just Atlas for now. That's all I have. I haven't pulled up already.

OK, just Atlas. And then when you get into Atlas, just npm i. And then when you're done with that, you can do npm run dev. Whoops, not good to ease. Um, And then, well, it looks like 3000 is in use. So, okay, whatever. So then you have Graphite Atlas available and it's pretty quick. It uses Turbo Repo. You'll get all of your logs that are happening in this NPM run dev over here. So like it'll tell you what's going on, where you're clicking, all the things.

which that becomes very helpful. And now This has its own API, so it's like... The only thing that this is connected to... Whoops. Oh, that's not 3000. Whoops. That's what's running over there. Okay. I was wondering. So anyways, it's pointed to the dev AWS. And if I go to Vercel here real quick, so... Um... Vercel has two environments There's two projects. There's Status and there's Atlas. We care about Atlas.

It gives people the status update of our mem graph, of our postgres, and of our API. So it just kind of pings that stuff to show people if it's working or not? This is the project you care about. This is using Vercel to deploy it. And it hasAs like a normal production thing, that's graphiteatlas.com. But then it also has this preview deployment system, which is kind of cool. It's like a little weird at first.

But then it kind of starts to make sense. And so any branch that you use and you push to, it will pick that up and it will deploy that to dev.graphitatlas.com. And then it also says preview here. It also, so if we go to this one, It deploys to Dad and here, these two other places. Go ahead.

Okay. So, If I'm working at a branch and you're working in a branch, and I push something, Well, It will unstage whatever you have and thenI'm sorry.

On dev.graphiteatlas.com, yes, it will. But these things underneath it will be different. between our branches so we can use the ugly domains. What I'm gonna do is I'm gonna set up another one so that I have one and you have one. And then we always have one. This one here, dev.graphanalyst.com is... Kind of like staging, in a way. So what I want to do is I want to change. I want to create a staging one.

And that's kind of where we say, hey, Tim and I are good on these things. Nigel, can you take a look? Yep.

Just send him the links.

Yeah, exactly. Yeah. And he's pretty good at it. He's pretty good in GitHub issues and stuff. So which is mainly where we work out of? Um...

Oh, okay.

And so like right now, this is what I'm working on here. This is basically like the gate to get people to pay for it. There's five major issues that I've got to figure out. I think I've got I think I've got all of them figured out. So there's just the one likeresizing thing on the X and Y pain. So I gotta get that. And then there's a number of things to get after. Some of those kind of, you know, more in your wheelhouse.

Um... But this is like the priority list. So Nigel and I work together on a priority list based on the conversations he's having and based on the work to be done.

I saw something about contrast.

Yeah, on the front end. I almost said something when you were going through stuff. I was like the contrast on some of the text and background on some of the tags is not good.

Well, and it might not be good for both themes, like because it's this is themed.

Right. So like, yeah, yeah, I know I have the dark theme because it's set to my system, which is dark.

And like sometimes dark looks better than light and sometimes light looks better than dark depending. So there's like a lack of consistency in a lot of that. if that needs to be dealt with. So that would be one of those things that would be really good to get to earlier. Yeah. So, but yeah, we kind of work out of here. We're really efficient doing it out of here. Nigel's really cool. He's pretty technical.

So So, but then, you know, basically what I do is I, you know, I get down on these issues and, you I might pull an issue like this one right here. I might pull this into my clod. I might pull it in because I've got MCP set up and I might like tee up like tee it up in Claude and try to work and figure it out in Claude. But what's great about each of these being an issue is I can just create a branch make a pull request, I can create like one thing that's all tied to this issue.

That becomes very easy to track and it also becomes a container to work in. So, So it's like-You mean create one thing? Yeah, so I'll create-I won't close this issue yet, but I'll create a branch off of this. I'm off of dev and I'll work on this. I'll pull it into my code. I'll work on it. And then once I get it fixed, I'll make a PR from this into dev. And then it'll hit that dev branch, you know, to deploy to dev.

I'll get Nigel to look at it because he kind of does, I get him to do UAT for me. It's kind of what I get in a lot of ways out of it, you know. So because that allows me to go really fast. That's our agreement. It's like, Nigel, you got to UAT things and I'll go super fast. And he's like, "Okay." So I've been going really, real fast, but I've also been really leveraging Cloud Code to do that. And one of those things with Cloud Code is I'm using MCP to pull these in.

Rev, Cloud Code, a bunch talking to it. get a good solve on it, and then I push a branch up, make a PR, let him test it, and if it doesn't go well, I can really quickly revert.

-Okay, so you said you're making a PR And that's when it deploys to dev is when you make the PR? Or is it when you just push a commit? Any commit to any branch that you have?

Yeah, if you make a new branch, it will deploy that branch. Right? Okay. And so it could be the same thing. as what's already in preview if they're the same branch, right? If there's no difference between them. But if there's a change, it will deploy your latest change in the preview. Okay. So there totally could be collisions, but we can also like... I can put some things in place to make two paths for us.

Do we have... like a label. So like how we have it on Soundlines is we have like... If you throw the stage label on GitHub on a branch, it will deploy that to dev.

Oh, okay.

And so we know who's... We can look and see if anyone has the stage label on their branch, and then I'll know, okay, I need to go ask them if I can stage something. Or if it's not in use, then I just add it on there, and then it runs all the...

So you'll see this is, you know, which branch or which commit. was deployed to preview. Okay. But like, Don't worry about stepping on my toes. I'll cut staging out for Nigel tonight. So that we can get that really good communication feedback with him. And then I'll figure out cutting Elaine out for myself. like a CJ or whatever, like a Dev2, doesn't even really matter. And then we can have two different ones that deploy.

You can literally call it staging.

Yeah, I think I need a total of three of them because I need one for me to look at. You need one. And then we need one for Nigel to be able to say, thumbs up, man.

I like having a dev environment that's justWhat's currently pushed to That's not deployed? Yeah. It doesn't have to be deployed, but if it's emerged PR? That it's always showing like the current source of truth that might not be merged yet.

Yeah, so maybe we introduce preview as a name as well. And so dev.graph.atlas, and that's our area.

That's our dev environment.

Yeah, exactly.

And we work together using that one. And then we have preview, which... Or, you know, Yeah, preview is kind of like-literally, it deploys those automatic ones to preview.

Because I can set-if I go to Settings-How often do you guys deploy to-to production.

We try to do it more and more. It's getting to be like daily almost now. Okay. It's getting a lot faster. You know, it's smaller, you know, small chunks, right? Trying to do small chunks, you know, and that sort of thing. But the CIC is getting pretty good. Um... environments Production is on main, everything else goes to preview. And then we've got a development which you can, doesn't have it. So this could turn to preview.graphiteatlas.

Development could go We could do two different ones. We could do Tim and we could do CJ. as development ones and we can push to those via CLI. And then This all unassigned get ranches, I don't know if I want to continue to do that though. Because then we would clobber-potentially clobber preview accidentally. Um...

Shouldn't preview be...

whatever's actually merged. Yeah.

Yeah, maybe preview should go off of an exact branch.

off of main or whatever.

Because this one's off of main, so that if this one goes off of dev, we can have a small difference between dev and main, and that difference can be Nigel's thumbs up. It can be like, I gave you thumbs up, and those are in main. I haven't given you thumbs up yet. Those are in dev. But there's a live environment for either of those. that can authenticate and do all the things just like the other.

So when we merge PRs to main, it's automatically deployed? Yeah. Production? Yeah. Okay. Yeah.

No buttons. Yeah, it's full CICD. Um... Yeah, and we got feature flags. So there's a little-Yeah, we got feature flags. A pull request can't hit main without Nigel approving it. So, you know, Nigel will talk through things with us and, you know, we'll be we're pretty like. communicative about it so like we haven't had any issues but it does sound a little cowboyish as you and I talk about it it's like whoa yeah you're right that is that is true Yeah, yeah.

As you grow and expand, you just have to... Implement more process, unfortunately.

We've got some playwright tests going. We've got unit tests going. We've got some rules in GitHub that require That requires some checks and balances. It could totally be better and we can Add to that as we go. What's beautiful about this is Nigel's really good at cutting scope. and getting to like brass tacks of what's valuable.

Like he wants good.

Yeah, like you see like you're like, oh wow There's a lot of tickets in there I created most those tickets because I want to do stuff like there's stuff I want to do and it's like well we thought about it We talked about I need to put any document that somewhere but that's not in like the priority list yet even there's only like 12 things that we're really working on right now and Yeah, I think I've got pretty much done and those are the big showstoppers Um...

But there's, yeah, there is like hundreds of things that we, you know, that we could do with this that would really add value. What that roadmap is and that priority and all that stuff, that's kind of still like a mailable discussion and there's design partners and that's more Nigel's area. Um... But yeah, he's really excited that you're helping out. So this is, uh... This is such a good timing for this in so many ways because he's kind of taken off and it also helps him like...

I feel like he's de-risking things a little bit. It helps me bring you on and you know so we can moonlight and make a little extra cash. Yeah. And it also kind of gets us... It gets our foot in the... in the door as like his core engineering team. Like we're gonna be the ones that know most about this like, you know We're so like in terms of getting like as this grows and turns into something which I'm extremely confident that it's like partly I'm confident the idea but I'm really confident in NigelLike he's really impressive.

He's good. So I think it might turn more into like a full-time type thing. But where it's our area, our, our decisions, you know, You know, like a ground floor, you know, it's like a really good... like a good opportunity, it's a lucky opportunity that this all This all is coming together like this.

Yeah. I think, I think, uh, Having equity in things really helps make it personal. Why are you like You know what I mean?

Oh, 100%.

You're working on something and you want to make it better because it's also yours in a way, you know? Yeah, yeah.

The more and more we get into our careers, the more and more we see the opportunity cost of working at one place or another, one project or another. Yeah. Yeah, like, you know, five years down the road, it would be nice to have some type of a... Pay off? That's, you know... Maybe life changing, maybe not life changing, but like the reason that you strategically did that. You know, um... So yeah Um...

The first, this one's the first committee.

Um...

I've got so much going on right now.

I just resigned from Agilent today.

From where? Agilent Health. I just resigned.

I can't. Okay. I can't be a principal engineer there anymore? I just, I don't have time. And it's not worth the headache. Um... Like more and more keeps coming in. Yeah. So Yeah, so let's try to get this one to a point where... The snowball is really moving and Nigel, like our whole goal, in terms of you and me, our goal is to unlock Nigel. And if we can, he's getting really good at sales. He's got a great Rolodex of people, like companies, like he's speaking all over the world about AI in businesses for CFOs.

Like he's like the time is so perfect for him to be doing this and trying to get customers. So if we can like focus on this one first. Um. There's almost like lose sight of anything else that we talk about really. Like, because we want to knock this one out and then get the snowball going. He'll come back to us. You know, we'll get equity either way, either if we take full time or not. Right. It's a choice of how involved we want to be.

We want to get equity either way. Do we want to move on to something, another thing, and focus our time on another thing? We can figure that out. And that can be, Like... If you want to do, like if Nigel has something and you want to go, you know, let's just talk about things.

Like we just always got to talk about, right.

Yeah, 100%.

Uh... I'm not trying to give them engineers away either, you know, but like what's best for Tim is also You know what is you know like the highest priority in this? So I get that Um... So we got this one. Matt's already working on the Bridgestone guy. So that's coming down the ropes. I'm currently working on eSpiral, on the thing for Nigel's father-in-law, which is where this whole connection came from, that's at...

The residency that he runs, the hospital system in Fairhope, Alabama, Mobile, Alabama. So that's like... Like, they're beta testing it, but he's getting all of his residents to use it. And there's like becoming more requests and now he's trying to sell it to another residency program in Pittsburgh. And so there's a lot of stuff happening there that I need to focus a little bit on Help him but but I can tee that up for next because like Right after we get done with Graphite Atlas, we can work on eSpiral.

You know what I'm saying? I'm already getting paid from him. So there's money coming in from that. So I got stuff lined up, lined up, lined up. And eSpyro has equity. They're all that combination thing. So I feel like super confident that this isn't like just a three month thing. It's just let's just start here And focus on graphite atlas. Knowing that I got a number of these that are similar to it.

In a way, they're TypeScript, JavaScript, Next.js, so there's the similar technologies either in healthcare or something Something like this.

I need to familiarize myself a little bit with Next.js. But I mean, most is... Modern JavaScript frameworks are They all kind of use the same stuff.

Totally. Bi-directional...

binding, you know, there's like major things that they're solving. Are you using Context 7 yet?

Nope, no idea what that is.

So this you can use, so also,I use Cloud Code because of preference, I use, in another place, I use Cursor. And Cursor has a really nice terminal agent and stuff and everything, butYeah. MCP.json needs to like kind of be become like a major tool shed for you? Context 7 is like the biggest one I would say of MCP servers, but it's basically an MCP server of everything. Like Next.js. all sorts of things.

And so...

Oh, so it's using this to help you solve problems and...

TurboCharge is your cloud code.

by giving it access to awesome documentation that it can read. So there's, you know, so like for instance, next is one of the things in there. Um...

The other thing that I'm using, so there's...

So if you want to use cloud code, it's like a little bit more of a translation to me, but I'm also using Summon. Um... And SubminaiKit's pretty cool because it will like look at your codebase and create, it'll basically download agents that are specific to the tools in your codebase that will run as subagents while you're running your cloud code or whatnot. I think it's only for cloud code. Um... So, but what you, what, it'll create skills and agents for you and then you can say, "Hey, spool up these sub-agents to look at the code." And you get like a really, really great quality of interaction with your agent.

And I think--That's nuts. So I'm guessing you could use it with Claude or with cursor and just rename Claude to agent.md And then, I'm not sure, but, you know, so it generates these things and you can use them as you interact and they're really, like, really powerful. Like it really cuts down on time, Yeah.

I can see how. You're on a completely different level with your... Your agency. I am. I...

I might not, it's my laziness.

I might need a session just to have you help me set up Whatever workflow you got going on over here.

Yeah, let's do it. Yeah, no problem.

Yeah, I'll teach you the ways of my laziness. Yeah. So I can get you going on this one and I can get you going on Cloud Code. I at least have a free week if you want to use that and see if Club Code's the way you want to go. And then you can just jump on my plan.

Yeah. And I'll just cover it.

I currently have a, like a, uh,Her, sir. Subscription myself. Um,What?

This is growing on me that they have the agent.

Like now that you can just bust it open in the terminal, I'm like, okay, I like Kersen.

Yeah, I think they just updated because I didn't see this other like...

It has this thing where I can search for agents.

It just popped up.

I don't know. Interesting. That might be an interesting thing to play with.

So the whole concept is really cool and it's mainly using MCP under the hood. So like, You know, GitHub and I got all sorts of things. GitHub is really nice because I can have it pull in the issue and start riffing on it. And a lot of these small ones, it'll just like, it'll eat those up. Like it has no trouble with those. And then I can also be like, oh my gosh, this is what's happening. Oh, here's one.

Here's one that's really cool. I'll be working on an issue and And It'll come about working with the agent that it's actually bigger than I had expected originally and so I'll have it create other issues in GitHub and be like, okay, let's not solve that yet. Let's create an issue in GitHub and we'll solve it later. I'll have a sub-agent solve it. And it's become like a really accurate workflow for working with AI Because the whole goal of it for me is like keeping that context window narrow and very pinpointed at the thing it's trying to solve and Because then I have the best results with GPTs.

So that's kind of allowing me to do that, is working with these MCP servers. And then there's, so that's context seven. There's Playwright. Playwright. Oh my gosh, Playwright's so good.

Because it can see everything it's doing.

Yeah, it's awesome. So awesome. And then... I have some more.

That's Graphite Atlas Workspace.

What's the other competitor to Playwright? Yeah.

Hi Cyprus. Cypress.

We were using Cypress before and Playwright's so much faster.

Yeah, yeah.

And you can generate tests from like behavior in a browser with Playwright. You can record your behavior, which is really nice for like product folk. Yeah, well, and engineers, because like, hey, go generate the test for me, please. You know, I don't want you to talk about it.

Generate the test, you know, and they can kind of like give you snippets of what it is.

Yeah, I Like writing like the vitess or whatever, like V test.

Oh yeah, yeah, V test, yeah. V, I think. Yeah, yeah.

I don't understand. I think it's Veet. Yeah, it is Veet. It's Veet.

Yeah, I thought it was Veit. Veet.

But That has a... That has the same thing where it uses Chromium or whatever and shows you it clicking through stuff.

Um. Oh, nice. Oh, they have a behavior. Oh, really? It's very fast.

It's just unit testing.

That's more behavioral, huh?

Well, I'm still mounting components and stuff. And the way we have it, I'm like even... You're like mocking queries and mocking query results and stuff. So you can actually test different conditions based on the results. And then I was telling you how we're using GraphQL and we have CodeGen, which generates types based off the schema, which is really nice too for testing because it gives a lot of context to AI when it's writing your tests because it can see all the types that are generated.

And so it just knows exactly how to structure everything. And Which is super nice. It makes TypeScript so nice having all those types just available. Yeah. Right?

Like, you know, just like without the pain and burden of dealing with them. Yeah. Yeah, it's really... We're coming into the golden age of, like, being a software engineer. You know, like... And like a lot of software engineers, they're getting these tools and they're like making little websites and they're doing stuff, but they're like missing like the underlying pain that we went through to understand like how the hell a browser works.

What's HTTP? You know, like the actual like things of this that I think our knowledge is going to become like even more, um, Rare. and sought after. So let me just get back to this stuff here. So I can send you these links. This is what I'm after right now. What I'm working on right now is this. Prodgate priorities. For you, I just want you to get schooled up and feel comfortable in things. There's some Tim stuff here.

These are things that, Nigel and I thought you'd feel comfortable doing right off the bat.

to get involved in the code.

And then we can figure out, yeah, we can figure out, those are like the first ones. Then we can figure out what makes sense next.

Um.

I'd start like a Figma workspace. I don't know if you guys have one for anything, but...

No, we haven't been using Figma. Which there's an MCP and there's all sorts of really cool stuff for Figma so I'm definitely my ears perk about it.

Sometimes it's easy to, if I already have like some designs, Moffed up to go in there and be like, and change some colors or mock up a new feature to see how it looks. Sometimes something looks awful once you start. Winning it.

Yeah.

Well, we need to like take passes at that coming up too because right now we're just like in like the base Shad CN New York style like it's It's... It's somewhat uniform and it looks okay. But it's not what we're after. This whole black area sucks.

It's so annoying. It drives me crazy.

Yeah. Should avoid using pure black and pure white.

Yeah, yeah.

But just like in general, we're trying to... So it was looking a little bit more razzle-dazzle for a bit, but it wasn't consistent at all. So I was like, well, you know what? This is so not consistent. Let me just peel that stuff back. And then we'll figure out globally. Like I've been thinking about bringing you out of this project pretty much since day one. So I've been like, you know, like, you know, like, okay, you know, this, these like things I need to focus on and there's things I want to focus on, but not yet.

And so like, there's some of the stuff that I kind of wrote, like even some little animations and everything is like, wait, why am I doing this? Like, that's not a good idea for me. I need to stop doing this and just wait on that stuff.

Right, because you could do something and then it... Yeah, definitely. I think it's good to wait until the product is starting to get more flushed out, you know, then start thinking about that type of stuff.

Yeah, and I want to give you, like, a global, like, this... It's kind of consistent and for the most part, yeah, this is pretty global. But I want you to be able to not have this hodgepodge of things. Yeah, there's Shad, Sienna, and Radix in here, but those are like, there's like two base frameworks. Everything else, they're not customized at all. Everything else, it's like, do whichever you want to do.

And if you want to replace one of those, let's talk about it, no problem. Yeah. Whatever's cool, let's use, you know? So, you know, that's kind of the opinion on it is just like, I got something here. It's... At least with state of the art, when I grabbed this stuff, But I also knew that I was going to be bringing on the specialist, you know, somebody who has an eye for this type of thing to help me with that area because I don't.

Um... You know, you can pick this thing apart, you know, left and right and I'll be like, oh, let's go to production with this thing.

Yeah. You know, like, yeah, that's not good.

You know, so it's like a really good combination between. Between the two of us, I think, For sure. I'm more like a jack of all trades in some ways. And how my brain works? So. Yeah. So I don't know. Do you want to try to meet up this weekend and maybe knock out a few things, pair program a little in the new agent, like some agent style workflows after you get active in the code?

I could...

Yeah, I could probably on Saturday, I probably could sometime. Any time. I'm hosting a Super Bowl party on Sunday, and so... Saturday will be a lot of cleaning and shopping and preparing for that. But, like, it's not going to be all day. I could take an hour out of my day to... We could sit down and jam. That's not a problem.

Can you do like Saturday at like 9 or 10?

A.M.

or P.M.? A.M. And then we'll just knock it out.

We'll knock it out of the way. See where you feel on things. Make sure you don't have any blockers.

That's kind of the big thing.

I don't want you to have any blockers.

I want you to be feeling like you're going forward with things.

Yeah, as long as you're, seem like you're understanding, like, Getting Getting spooled up on things sometimes takes credit. Oh, yeah, yeah. I would say my personality is, Sometimes I am slow to spool up on things because my brain tries to absorb too much at once. You know what I mean? Yeah. But once I get going, then I can really get going.

Yeah. I have zero worry.

So, yeah, no need for any disclaimers or anything. Just do your thing at your pace. You know, when we were doing like bridge connectors, always like... It's going to be a couple months. That's what I tell people. It's a couple months. You got to get going on a whole new code base. And that was before we had AI and stuff. You know, with AI, like, I can generate more stuff now for you to have to go through, you know?

Like, it's really not like AI has given you, like, that much of a leg up on, like... Contact switching, learning a new thing, etc. So, yeah, and think about this, like, this... This relationship For Graphite Atlas, for us, this is an investment. I want to work with you for years and years and years. And I think Graffitellis could be a vehicle that we work together for years and years and years on it.

But if it's not, we're going to have stuff lined up. I'm excited. Yeah, there'll be some good stuff. There'll be some good adventures coming up.

I've been wanting to... do something else. I just feel like I'm stagnating at down the line split. Yeah.

It's stable.

Like, let's keep some stable things going on right now, you know?

That is stable. And then...

We'll know when the time's right to... To send a resignation letter or whatnot, you know?

Yeah, yeah. When it... Just, yeah, the time sink for that job doesn't become worth it anymore. Yeah. A hundred percent. It stays pretty, pretty busy. so This week got really busy. Like... I've been working my butt off the last few days.

Well, let's try to let's get this going and let's see if we can.

get more revenue coming in so we can like triple what you know, I think we can like within months triple what we're doing. And that kind of feels like... Full time.

Yeah. That kind of feels like worth it to focus on this.

And Nigel's like really open to expanding that so Yeah, let's see where it goes.

Yeah, 100%.

Okay with that.

If I don't have access to something, just let me know.

I'll set up those environments Just a little bit. I'm going to run and get the family dinner here.

Um... But so, you know, play with things. If you deploy to dev, no big deal. I'm probably gonna deploy to dev when I get back. Trying to figure out the last little bits of these things here.

I'm about to dinner as well.

I can smell it.

You should have access to most things.

If you don't though, like the main things to have access to are Bracel, GitHub, you should have, I think you're already in the code base.

I've got Brazil.

I've got GitHub.

Like, actually you don't, no, 'cause neon is part of her sound. What'd you say? I was thinking you would have something from neon, but actually, Neon is not... So if you go to Graphite Atlas and then you go to our project and then you go to storage, neon is now there. Okay, Nia, there's our Postgres. So we have two Postgres databases. We have a preview one for the preview stuff, like the dev stuff.

And then we have a production one. Just normal Postgres databases, they're super simple. Um, and And then we have a status one. So this is how you connect to it. You can go to Neon and use it right from Neon, open in Neon. So like it's super simple data stuff. Like it's so tables. Here's the atlases, right? Here's some atlases. All of the data that it refers to that's in the atlas isn't here. That data is all in Memgraph.

But feature flags, you'll see, oh, feature flags. You'll see that there's data in here that will make sense to the UI, weightless entries. Tim Gray, ah, there he is. So the neon stuff's not complicated. You know, it's super simple. We can talk about whatever we need to.

Do I need any of that for like posts locally? Or anything like that.

No, that's the beauty of all this stuff is like, it just works.

Your local host will connect to to, the Vercel API will be able to connect locally to Postgres. No worries. Okay. Yeah, it's so beautiful the way all this works. Like when you do NPM run dev, you get like a whole, you get everything and it works. It's so nice. The only thing, The only thing that can happen is if you're using port 3000, And you do like the magic link login. It may... puts you at the wrong port.

So it may send you to 3000 when it's running at 3000X. because there may be a break in that callback, But outside of that, it's pretty stable. The development environment With Turbo Repo and the stuff that Vercel and Next.js does is really developer friendly. Sweet.

Yeah. Yeah. Never used Next.js, so. Should be fun.

Yeah, I have nothing, but I'm drinking the Kool-Aid. I really like it. I liked Guillermo Raj's tools when he did Moo Tools.

Yeah. He's like an object oriented brain.

Like he loves simplicity. He's Um... He's been doing this since, you know, early 2000s. He's Really, really smart dude. Um... So like, and there's the, you know, honestly the API was, in The whole API actually was, when I started this, was in AWS. And it was a Node Express API. And I I probably could have written it more into Vercel at that time, but a lot of the Vercel stuff, like backend quote unquote, API stuff, JSON responses was still in its infancy.

So I was managing this like high latency API in AWS that was supporting the front end in Vercel. And I was like, whoa, whoa, whoa, I got to refactor this. So I brought all of the API logic to Vercel. And so Vercel does the front end and Vercel does the server side operations outside of Memgraph. So anytime Vercel talks to Neon Postgres, anytime Vercel makes a call to another API, it's right down in the Vercel API layer.

Um... Which also To me, brings like the whole API backend type development more and more into our wheelhouse where you and I can work together on them.

Um, Can I... Or like the dev environment. Can I edit directly in the cells? Of the database? Is that possible? Yeah, yep. Through Vercel's UI?

Through Neon, technically. You would get there from Vercel. Neon, okay. You'd get there from Vercel, but then Neon.

And right now, we might go away from Neon in the future because Neon's a little expensive. But it does a really good job at managing Postgres databases and AWS, like there haven't been a lot of great options. So if we launch this really quick, You're gonna... Open in Neon. Then we go to tables Let's just go to, I don't know, sessions. We can edit these, bam, right like that. Um.

Yeah. Sometimes I just want to test how a long string behaves when it overflows.

Yeah. Oh, yeah.

You could just go in and-Yeah, that one wouldn't be visual, that column I did there.

Yeah, future flag one.

You get what I'm saying. Like users, they have a name. So what does it look like when the name overflows?

Yeah, there's little things like that.

Because sometimes you'll test with a quick little test one and it doesn't quite push the UI... And then you put production and people start entering really long strings and then it looks like ass.

Yeah, yeah. Oh, totally. Yeah, totally.

Okay. So. That's probably enough to saturate. For a little while? Yeah. Okay. Um... And I'll send you a meeting invite for Saturday.

Saturday morning. We'll do an hour Saturday morning.

Yeah. And then we'll do Super Bowl stuff.

Hopefully there's UFC this weekend. I don't know. But we'll do fun stuff this weekend. And then we'll figure out another time. So Saturday we'll talk about, like, what's next and where you feel comfortable. Like, do you want to work async for a few days and then catch up Wednesday? And we'll just figure that out on Saturday.

Yeah, that sounds good to me.

Alrighty, my dude. Alrighty, my dude. Well, I'll let you get to dinner and I will talk to you later on. Have a good one.