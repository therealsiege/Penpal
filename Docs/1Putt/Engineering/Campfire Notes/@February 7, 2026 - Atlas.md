Created: February 7, 2026 10:16 AM
### Personal Updates

- @Tim Grey shared that his dog had dental surgery for cracked teeth from hard chew toys and is now on a wet food diet
- Home improvement work (trim installation for kitchen island) caused slight delay to meeting

### Career and Business Updates

- Resigned from Agilon Health, now on contract at $32K/month with flexible hourly rate
- HouseRx contract continuing at $16K/month - solved NextGen API challenge by reverse engineering with Claude to find x-person ID header that enables FHIR endpoints instead of expensive enterprise ones
- Considering reaching out to Paul (currently working BCBS contract) to help with integration work and free up capacity
- 25 Madison courting for CTO role at Sift venture in pharmacy tech/clinical trials space - meeting scheduled for following Tuesday

### MedScrub Strategic Pivot

- Met with Maurice Hill, Chief Product Officer at Optum, for hour-long discussion about MedScrub
- **Key feedback:** Don't position as "extortion" (safety requirement) - instead focus on enabling providers to use AI for low-hanging fruit tasks while using de-identification as a feature
- Maurice suggested advancing mobile app beyond just safety clipboard to include AI functionality providers want
- Described as potential "billion dollar idea" if executed correctly - providers are getting squeezed and need AI solutions
- @Matt Wimberley immediately engaged to research problems to solve with provider/PA input

### Graphite Atlas Status

- Nigel Glenday (in Middle East) reports users are "super excited and happy" - building complex company structures in Atlas
- Several key bugs blocking paid launch need fixing before Nigel starts charging customers
- Performance improvements and bug fixes in progress on dev branch

### Technical Development Discussion

- **Environment Setup Issues:** @Tim Grey encountering "user not found" error when creating Atlas workspace on dev environment
- **Vercel Infrastructure:** Discussed Vercel development environment for secure environment variable management - uses CLI to pull sensitive variables without sharing .env files through Slack
- **Performance:** Switched MedScrub to Bun runtime - seeing 50%+ performance improvement over Node
- **Vercel Toolbar:** Enabled preview toolbar feature for dev environment testing

### Development Workflow and Priorities

- GitHub issues organized by priority - quick knockouts assigned to @Tim Grey, blocking issues for immediate attention
- Feature branches off main, PR to dev for testing, then Nigel UAT approval before main merge
- Husky pre-commit hooks run linting and TypeScript checks before code reaches GitHub
- Contributing guide and onboarding documentation in dev branch, will merge to main once stable

### Product and UX Discussion

- **User Onboarding Challenge:** Need to implement first-time user hints/tutorials similar to Airtable - showing users how to create first workspace
- Nigel has onboarding guides in Notion that need to be integrated into product
- Discussed notification sequence, user dismissal behavior, and progress indicators (e.g., "7 of 9")
- **UI Improvement:** @Tim Grey noted difficulty finding light/dark mode toggle - suggested adding arrow indicator to user profile dropdown
- Decided against Storybook and heavy UI tooling given small team size

### Team Dynamics

- Nigel described as exceptionally fast, technical enough to create prototypes and communicate requirements clearly, going "past 50% line" on communication
- Team composition praised as ideal - Nigel's technical product skills combined with development execution
- Nigel currently speaking at AI conferences promoting Graphite Atlas, plans to sleep 12 hours after intensive schedule

### Next Steps and Timeline

- @Tim Grey to work on assigned GitHub issues (quick knockouts from Feb 3 priority list)
- Address environment variable setup issue for @Tim Grey's dev access
- Plan next meeting for following week once @Tim Grey feels comfortable
- Weekend plans: fix remaining Atlas bugs, work on MedScrub repositioning based on Maurice feedback

### Action Items

- [ ]  @Tim Grey to provide W-9 before first paycheck
- [ ]  @Tim Grey to create GitHub issue for light/dark mode toggle UX improvement
- [ ]  @Tim Grey to work through assigned GitHub issues (priority Feb 3 list)
- [ ]  Debug and fix "user not found" error for @Tim Grey's dev environment Atlas creation
- [ ]  Work on MedScrub repositioning strategy based on Maurice Hill feedback
- [ ]  Consider reaching out to Paul about taking on additional integration contract work

Notes

Transcript

No worries.

Gotta get all the natives It's fair, they're not. Oh Yeah, she's feeling good though. She'sUh... I guess if you give dogs like hard chew things They can crack teeth, and she's had those for like a while, so they've been bothering her.

large shoe things like bones and stuff.

Yeah, it doesn't always happen and it's like really common to give your dog that stuff, Yeah. And on both of her, she had... cracks all the way to the root. So just like... It was gonna get infected and all that stuff, so it was best if they pulled him. Yeah. She's on the good food. She's a happy girl with the food that she's eating right now.

A wet food diet.

Yeah, exactly. That's fun.

Actually, it actually did get here late because I was dealing with... We're getting some trim put in on our Island in our kitchen. because we had our floors replaced and we just, we were waiting for this trim to come in that matched our Island.

Are you doing it or are you having somebody do it?

Someone else do it. They were they were here though at the same time so.

Well, let's see. It's been kind of a busy week. I can give you a little bit of an update as to some of the stuff that's been going on. Okay. And then maybe we can just jump into Atlas. Yeah. Kind of see if you have any questions and how you feel about things and stuff. Okay. So yesterday Two days ago I flipped Agilon to Contract. I resigned. Um... I remember that, yeah. And I gave them-so I have two on contract right now that-I can't let you work on it, unfortunately, because it's like their machine.

It's like really locked down. But they're paying really well. Like, they'll pay whatever I say my hourly is. Dang. Yeah, so that's like-and I was just thinking about, like, I wanted to-I don't know. I was just thinking, like, it's really easy to do it, especially with these agents and stuff. Like, the trick is dealing with meetings and some of that, like, telemedicine. time consuming stuff. Wow. but like stacking consumers insulting things is like I feel like I've been kind of wasting my time a little bit too much not doing that.

Mm. Yeah, just because the level of effort to provide good value Especially if we target 20% of the work to get 80% of the value type of approach, Um, It goes a long way. Like I solved a thing for HouseRx this week and I reversed engineered the NextGen API to do it, so it was a little bit of work. But I found that if they use this specific header variable, it would allow them to use the fire endpoints for document retrieval instead of the enterprise NextGen ones, which cost a lot of money.

So it saved them a ton of money. And all I had to do was get Cloud Code to reverse engineer the API and find that there's this x-person ID header that they needed to add. And the reason what got me thinking about doing that was because like I was like whoa this like isn't documented but obviously they use the functionality. I bet they use the functionality for a front end app. It's like, what if I behave like a front end app and authenticate it like I would as a front end app.

And that's how I started conversing with Claude. I was like, OK, connect to it like you're a front end app. And let's just see-let's play with MIME types. Let's just see with all the different things what we can do to figure this out. And it just made a rubric. I had to make a markdown rubric or not a rubric. A markdown like table, of all the tries it did. That I wouldn't keep doing the same shit over and over again.

Yeah. So, and then yeah, it's all that andYeah. You know, that contract is 16,000 a month. So if I keep that going, that's like pretty decent. And then the Agilent one is 32. So like, you know, these integration ones and stuff, like finding these companies that like, They need it solved. But they're like, "Oh, we're gonna hire somebody." Like, no, you don't really need to hire somebody. Or maybe they are doing contract, you know, I don't know.

I was thinking about contacting Paul. And seeing if I could get Paul to help us out a little bit with that stuff. Free me up a little bit more because there's like a bunch of revenue coming in from that.

Um, Get him to retire as a comedian.

I think he's writing code. And not for the Saudis. He he's a wild man. Yeah, he's I think he's still doing BCBS Okay. And he's making a killing doing that because he writes his own hourly rate. But I was thinking, I was like, what if I should reach out to him and see if he wants to add more to his plate? Because this like next-gen back like this This is like his alley. This is what Paul does. He loves this crap.

It's like the most unsexy software possible.

I wonder if he still buys those same shoes and keeps them in reserve. Remember that? He's like, "They're discontinuing my shoes, so now I have to go on eBay and buy up all the pairs." So when I wear these out, I still have more.

Yeah, yeah, exactly.

I remember coming into the office all the time and there'd be one shoe just sitting on the ground because he would sit on his foot and he'd kick that shoe out.

But he always sits that way, so there would always be one shoe there.

The creature of habit.

He's a funny dude. Okay, so... So, yeah, that was, like, interesting. They came back, like, with, like, an hour, like, within, actually, I resigned Thursday night. And I knew talking to other people that they would probably want to contract me. Yeah But, uh...

Um...

They came back to me like the next morning. I'm like, well... What about contracting? Okay, you know what your rate with how much time is it gonna be all that kind of stuff and Yeah.

And so yeah, just like progressed.

And then yesterday, let's see, there's some other interesting things yesterday. 25 Madison has been courting me to do a... A venture for them? called Sift. They are courting me to be the CTO of this venture. which would be building a team, all the normal things. It's in pharmacy tech. They're starting to buy... Um, clearly. clinical trial locations. And they want to be able to scale and do, it's a lot of like health verity like strategy of providing clinical trials with patients data in them.

Um... But obviously there's a front end, there's software to be built, there's all sorts of wildness to do. They are like heavily courting me right now. Like they're, when they came, Yeah, Dhruv. Um, I've had a number of meetings with them over the past couple of days. And I have one more meeting next Tuesday with them. Um... And so I don't know if I would like, that's kind of why I'm thinking, Paul, it's like, how do I do this stuff and do that?

Like, how do I keep this, you know, 50 something thousand dollars of revenue coming in? and be able to fulfill it and work on this other thing. So, um... I'm trying to think a little bit about how to do that. So they're talking a bit to me, and that might be interesting. It won't change anything.

I'll still do this stuff. Yeah.

And then the last one, I talked with Nigel, the users are super excited and happy and they are building some wild stuff of their company in Atlas. It looks like soup because what the hell is this?

Because this looks so much. But that's really cool.

I talked with The chief product officer at Optum yesterday? Optum. They're like a really, really big verticalized... Gosh, what are they now? There are good claims. Insurance carrier provider like their opt-in is massive Okay. And I've got the transcript from the meeting. And there were like a lot of things that he could only tell me so much about. But it was focused on Medsgrub. And I sent him the Medsgrub AI link and I was like, "Hey, I'd love to get your feedback.

And he's like, I got some ideas. So I sent him my schedule link and We talked yesterday. We talked for about an hour. And his name is Maurice Hill. Ah. And he's basically like said You're halfway there, but don't sell like extortion. Don't sell safety. to use Medscrow. What you want to do is go the next mile and figure out what providers want to do with AI. that's like low hanging fruit with a consumer LLM and cheap.

And use your de-identification tool to make it safe for them to do it, but make that a feature on your app. So that they'll pay for that future. Dang. So he was like, "Okay, cool." So he's like, "Advance your mobile app a bit." to do things, not just be a workspace or a clipboard, like a safety clipboard kind of thing.

Yeah. I was like, whoa, awesome.

And then he gave me a bunch of ideas and like avenues to go down. He's like, Optum's not doing these things, you should do these things. Kind of thing. Um... So, and then he's like, he's like, I'm gonna watch you and see what you do. I don't want to get sued, but I'd love to work with you. So Matt's obviously worked in doing product stuff mainly. I called Matt right away. I was like, "Dude, I met with Maurice Hill.

This is what happened." He's like, "Let me talk to my wife. Let me talk to my dad. Let me talk to my father-in-law." All these different people who are doctors and PAs. He's like, "Let me figure out what problems we need to solve with this thing." He's running on that. Um, So that was like really interesting because He's like, "You have a billion dollar idea if you can He's like, "There are multiple billion dollar ideas in this space, and it's like the AI space is going crazy in healthcare." But like if you can get this a little further the providers are getting squeezed and if you come in and like kind of be the The hero on their side, the Robin Hood, then you'll win over Epic and the others.

Walmart wins, not Macy's in this case. And so that's like, you know, the whole thing, like, I haven't had somebody tell me I had that great of a thing going in a while. especially somebody who's in the space and Like a top Thinking, top brain in the space probably on the product side. Um, So yeah, so that was like Interesting, still fugazi, still like, duh duh duh duh, whatever they say. But it's like motivation for me to like put a little bit of cycles into it.

So that's what I'm planning on doing this weekend while I get you schooled up on Atlas. I fixed a couple keybugs in Atlas. I've got a few more to fix before he's like, "I'm gonna start charging you money." And that's the goal.

I still have some work to do.

Start trying to do what?

He wants to start charging people. He's got bait.

Oh, I got you.

But there's like a few bugs that are kind of standing in the way. of that happening. Yeah. Um, Yeah.

Once they're charging for something, that's when people will start complaining because they're...

Yeah, the expectations change. Right, right, right.

Yeah.

So, okay, and then I also went into Vercel yesterday. I wrote a, in Atlas, there's a, if you go to the depth branch, I don't think it's on main yet. I'll just pull into main. Um...

There's a like I'm unable to make-Contributing guide.

I'm unable to make atlases, like create a workspace in dev.

It gives you an error? Yeah. What's the error? Are you running local host or are you running on dev? Are you on dev proper or local host? Hello, Dev. Oh, okay.

It says, user not found, failed to create Atlas, user not found. Oh. Weird, okay.

So, huh, okay. So it's like you're not in the database. It's there. We did the M-Light. Um, okay.

Let's see here. Let me create one on, on broad This is just that Yeah, but this is dev.

Let me just do like a little preliminary look with this agent here. and see if it's easy. I'm guessing it's... I was playing with environment variables. I'm guessing I screwed something up there. Which actually works out well in the conversation because, so yesterday I was trying to do like extra custom environments and you can only do one. It's like, damn it, I can't do a custom environment for Jim and for me, right?

It's like, okay, well, whatever. So, um... So then I read about what devs form. There's a development environment in there. And basically, with the CLI and with the Yeah, with Vercel CLI and NPM-I, it will pull in those sensitive variables and create your dot ENV for you. So there's like no weird sharing of .env files through Slack or you know what I'm saying?

Like, it's like, oh, do you have .env to get going, right?

Like, so they have like, so that environment called development, right? In Vercel, never deploys anywhere. It's just to hold those environment variables.

So I'm like, "Oh wow, that's kind of cool."How does that work with NPM?

Are they like, Are they packaging the variables? That's a good question. And then I'm downloading them?

I'm really not sure how they're doing it, to be honest.

I feel like that's the only-because they can hide what's inside the package, right?

NPM-Like, I've I feel like they have to be running a script.

Inside of the NPM I to be able to do it. But I didn't know you could do that.

When you're installing it, it probably uses some sort of encryption key that de-encrypts the environment variables and creates the file or something.

And I bet you have to be logged into Vercel.

Because how would it know your machine, right? So you're, you practice a lot and you yourself see a lot. That's where the magic's happening. is Vercel CLI sets you up to do that.

Because anybody on NPM would be like, you know, could get your stuff, you know? So that, I think that's the key to it.

Do I need to download this?

The CLI? Yeah, you probably want to.

Is there an awesome Vercel one? Vercel has like... Gone on steroids. I am pretty smitten with Rassel right now.

I almost used it to the ploy cocktail menu, but I found that I already had it deployed. Like for... Huh?

For tomorrow?

Yeah, for when I have like larger get togethers, I just create a cocktail menu and post it with a QR code. So that way I don't have to explain ten times what I can make.

That's awesome. That's awesome.

Okay. I have it hosted on Netlify or something like that.

Oh nice, yeah, gotcha.

I don't know if they fixed it, but a few years ago they had a problem with... People getting overcharged because people would get DDoS.

Oh really?

And then there was no DDoS protection, so I was just letting it go. Yeah. But mine's like so lightweight. Like it's just literally... HTML and CSS. And so it would literally take probably years to actually accrue some decent charges denouncing it. Because there's Like half a kilobyte loading. Yeah, it's so small.

Okay, yeah, it's an environment variable. It looks like I... Must have screwed up that. Get that going for you. I'll give that back going for you. You can play in prod while Um... Well, this figures itself out.

Is Dev in a-You know, there's like different modes where certain features will be locked out if you're in a production mode. Um, So for instance, like DevTools, Like our current app on Soundlines, I use Vue Dev tools so I can actually like It helps a lot. I can go and drill down into the opponents, watch events, and stuff like that. But I can't use that on Prod. It only lets me use it on... a dev environment.

Yeah, there totally is.

Do I have, I'm on dev right now. Okay, I don't have it enabled on mine. So settings Next. There's a...

Assuming there's some sort of--That's a button that shows up here on the right side. I don't know if I'm sharing my screen. No, you're not. Oh, dang it. I thought I was. I thought it was like this whole time. That's okay.

All right, let me see. I don't see this. Here we go. It's general. It's probably in general. Vercel toolbar. There it is. Pre-production. Okay, so I gotta read a little bit. result So this one's on Node. Medscrub's on Bun. And Bun is bad. And it's so easy to switch to bun. like Okay, here. So if I go to, so this is Medscribe right here. Um, Settings, Build. Is this build? Yeah. Why isn't it showing it?

It should be showing it. Let's see, deploy. Settings. Configuration and current production deploy. Huh. But all I had to do was add "bun" instead of "next"? And it did it all. Like, it was so easy. It's basically... Where's the... It's like three lines change the whole engine. Let's not go on Unscrew AI. Yeah. This, bun-bun next step. All I had to do was add these three spots and I was running on bun and the performance gain is like It's more than 50% faster.

Then Node. Yeah, it's really fast. Claude just bought Fun, or Anthropic did. To run like that's how this runs and stuff it all runs in bond So yeah, it's quite interesting. Okay, so let's see, is this ready? Should be close. I'll show it over here. OK, that should be good. We're in. We should be seeing it. It's a little next button over there. Hmm. Preview. On. I don't think I need to do anything. Oh, maybe this is what I need to do.

Sister. So...

There's a toolbar. I don't know why it's not...

Is it in? Console? Is it in the dev? Tools.

Maybe there's a way to turn it on there. It's usually right here on the right side of the of theOf the browser. I'm not sure why I'm not seeing it.

It's weird. Do I have it in there?

Does it have? Awesome.

Reverse.

Staging now, I'm not using I just didn't really need it that much, so I disabled it. It was kind of getting in my way. Um, But I just turned it back on on that list, so hopefully... I bet I have to deploy. Maybe it deployed the... I bet it deployed the wrong build. is what probably happened. So let me see here. Is this going to dev? That's the Shinjirou, the Valle. Husky takes a minute sometimes. Okay, all right, that's going.

Okay, that should do it. Okay, cool.

Let's get to this really quick here. So I'm doing... Oh, I was going to ask, where is this list?

Oh, yeah.

It can use... I'm in the issue of saying I don't see...

This is like a specific issue here.

Nicholas Matsakis: In that was in.

Yeah.

Is it safe for weird? Okay, so this one February 3rd, I Priority for third. Okay, cool. These are ones right here that should be quick knockout.

Yeah, yeah.

Work on those.

Okay, and then while you rock on on those. I'm gonna work on That prod gate, which is up a little higher, Um, I've got 629 done I'm working on 598 right now, which is, there's a weird thing going on in 598. And then I've got 698 done. I've got to double check. 628 And then I got test 700 and I think those are good. And then we can just like figure out together the other ones. These are just the ones that's like I need to get done because they're important and I've been in the code the whole time.

So probably makes sense for me just to knock these out. Mm-hmm. And then these are non-block. So these are the ones we'll get to after that. And we can work together on them. We can, you know, however you feel comfortable. Some of those are probably back-end and front-end. Okay, here we go. So this is what he wants to work on. after we get through this stuff. So he wants to do file, upload, text, okay.

Sounds good. Fun stuff it looks like. This stuff always like Pretty interesting stuff right here. Um, This stuff here is like a lot of... X Y Graph stuff, like a lot of that React Graph library stuff, that library is really good. That library is really good. There's like not, I feel like it's second to none. Okay. Let's see. Okay, cool. Yeah, that's pretty much it. Where did I put, so if I, oh actually I'll keep that here.

If I go here, Here's where the issues are. If you go to dev, and I'll merge this in when I can, I just need to get a couple more things fixed. If you go to Dev, you'll see a contributing Here. And this is like kind of where I came to with the environment variables and the environments themselves in Vercel. -Most of the stuff you should be good to go. And if you can't get that, you know, so if you go to Vercel, You can just even manually download the EMV for development.

Like if it doesn't work, you know, if you have trouble doing it, the Vercel way through MPMI and all that stuff you can just grab it from there Or I can sign up to your email. So this just has all the stuff that'll basically be set up for you. Once it's in there, this is what my flow has been so far is I'm making features off of main. And then I pull it So I make a PR back into dev usually. instead of main, just to be able to test and adapt first.

Okay.

I'm kind of going back and forth on if you make the branch out of dev or main. I'm trying to make them out of main. The reason why I'm doing that is I'm trying to keep the gap between dev and main small, but I'm still trying to keep a gate there for Nigel to say thumbs up, thumbs down.

And if you have any ideas with that, More than my ears are open.

But that's kind of like the two things I'm trying to get out of it is, you know, really good development workflow for us to not step on each other's toes, but also a way for Nigel to be like that. UAT, QA type. spot before it's production.

Okay, so...

So anything going into Maine, like if you want to put something into Maine, it's going to require Nigel's approval. Same with me. I can't push to Maine without Nigel. Well, I can if I want to find it.

override as an admin account, but I don't do that.

Unless he tells me to. So my goal is he's technical enough to you know, he's He's jack of all trades. He's... Um. Okay. Yeah, he knows what's going on. So this will be like a pretty good flow to go forward unless there's like something more efficient that still keeps him in the know and in the loop. Let's see, the only thing you might have, okay, Husky might block your commits. And if it won't commit, you'll be like, "Oh wait, why is that?" Just look at what is going on in Lint and TypeScript.

There may be an issue with one of those. You need to resolve.

Okay.

But we, like instead of having GitHub actions run through and do linting and type checking and unit tests and all that stuff, and like the code actually go up there and wait for GitHub actions to run, I'm using Husky as a pre-commit runner, and Husky's doing all that stuff before the code even gets pushed up. And with Vercella, which we wouldn't, I see. For the most part, this should be like squared away for you.

Um... And then most of the information is in that Where's this? Zen. Our knowledge base? So I kind of keep pretty much everything here. And if you go to the Graphite Atlas one and open that, You'll see like this onboarding guide here. And this will, if you haven't seen this yet, this could be helpful just as like an overview of like, hey, this is what's there. You could also just have your L11 take a look.

And then all of our conversations I put right here.

I record them and I put them up here.

And so there are notes of like what's happening etc, etc. So if you're like, oh, what was he talking about? Comtax 7 or something? You can go back and look. Okay, let me minimize that. You don't need contributing anymore. You have access to the site and the code. Is there anything else you have access to? Is there anything else you need access to? Because I feel like that might be one I can... At least check off for now and if something comes up something comes up Um...

I think we're pretty much good with that one. And then these are what we're working on right now. You're doing, you're kind of doing onboarding right now. I need your W-9 before first paycheck.

So just whenever with that I can help you do that if you need. I've done that a number of times.

Is it just like a download of W9 on line somewhere?

Yeah, yep. Yep, totally. Okay. Totally. That way I don't have to like withdraw taxes or you know, like that whole thing.

Which, yeah, that's like...

Extra overhead thatRight. I'm not dealing with much new material. Um, okay. Yeah.

So, uh, I'm just going to leave it open for questions for you. Um... I've talked enough.

-Okay, got that. Hold up. Let's see here. Think you've answered most of my questions right now. It was mostly around... Where I can like... Read. to set up stuff. I'll look at some more of these issues so. Going into Graphite Atlas and I was trying to, it took me like a couple minutes to figure out how to change from light mode to dark mode on there. Which is not a good sign. Or that. So we might want to change You know, you click on the user picture and it's a dropdown, that's where you would sign out.

We might need to change that where there's like a little arrow or something underneath it or next to it or something like that.

Stuff like that. That, will you create a GitHub issue? Yeah.

And then what we'll do with Nigel, we'll have him prioritize a lot of that stuff.

I'm sure there's plenty of other stuff that needs to be tackled first, but as someone with new eyes on this project going in, I could just look at stuff or write things down that don't make sense to me. Just like as someone who's just looking at something that I've never seen before.

Um, And then we need to think about onboarding customers at some point? Like how do we onboard consumers?

Because this is a consumer-facing tool, so it needs to be like-Airtable like in terms of like hopscotching a user to be able to create their first thing, you know, like there has to be something that we, that we do there.

I'm not sure what it is.

Um, um,Kind of like the first time login where it's popping up. Like modals, right? Yeah, like little hints. Click here, and then you dismiss it, and then we store. Store that somewhere.

Um, Nigel has some really good guides in Notion. Like for getting people going.

That's what he does with the design partners is he uses that to get them going and That content is like super valuable, but it's not in the site. And there's probably a bunch of different ways to bake it in, you know, like kind of like, you know, those little, there's part, yeah. So, but it's on his mind.

It's just, he's trying to, I don't know where that is in priority. It needs to be up there. It needs to be up there pretty high because... The whole premise of this is the abstraction around something very technical and And code's not the only thing that helps with that.

Yeah, so I think that's probably gonna have to be a priority before you guys switch to like a paid. Yeah.

Definitely before we go, we open it up to everybody.

The easiest thing to do is to... I guess have him just take screenshots and then... Edit, just put text boxes on the screenshots of... I'm like... where you want Hints or something create create a story like a yeahBecause it's gonna run like a PowerPoint presentation where you basically will have slides. Like this is, you'll have a little, They're basically annotations.

Yeah, there's a sequence to it all. Yeah. Yep.

And then we got to figure out how we want it to behave. Well, let's say they onboard, they dismiss the first notification, and then they exit the... Exit the-The tutorial thing or something?

They exit the site altogether.

They close the site. Now what's the behavior when they come back? Do we... Show only the ones they haven't dismissed? Do we just rerun the entire thing again where they're seeing every single pop-up?

Right, right. Well, I think notifying them like you're on this pop-up of this pop-ups right you're on seven of nine in the yeah that might be helpful too so that they're like, oh, this doesn't go on forever.

I've also seen like hints where you could like a gear or something and Or some sort of menu where you can just disable it altogether, just dismiss hints.

Yeah, yeah. Or something like that. Mm-hmm.

Um But we can also have, once we have those notification pop-up things, in place we can Create like a help area. where you can go and go look at all those All over again.

Yeah, yeah, yeah.

What are your thoughts on Storybook and some of those UI Tools. We don't have a product team. We don't have a real, real need to collaborate.

Yeah.

I don't know. I don't think we need that type of thing. Right. I could see if we had a very large team type of thing, then that would be probably useful.

Okay, cool. That's how I feel too. I didn't know if there's any other features that I was missing or anything that, you know, any aspects to it that would help us. Well, I can let you run if you're feeling good about getting up and going and you can just ping me through Slack if you have questions.

Yeah, if I start running into issues getting... the environment set up and stuff at all. I'll let you know. Cool.

I'll knock out some of these other ones. Mm-hmm. I'm gonna try to work a little bit on the med scrub thing. Today see if I can ping Matthew I'm guessing Nigel's going to want to talk at some point in 12 hours. He said he's going to want to sleep for 12 hours.

Sleep for 12 hours. Oh, because he's on the other side of the world? Did he just get back or something? No, but he just went hard.

Like, he's like, he's speaking at all these AI conferences over there, and he's just like laying down the payment for Graphite Atlas.

Oh, this guy is, he comes from South Africa.

This guy is a different-he went to UVA. Um... I feel like my mind does half a cycle compared to his three cycles. He's just like, he's so fast. He's so fast. But it's, yeah, he's... He's like dangerous in the technical area. He's enough, but he doesn't like... He's enough to like... Make product really efficient. He can totally do it, but he's so into it and so into the weeds that he can talk about it, he can tell you what he wants, he can create a prototype.

But he can't create from that's in production So it's like almost like the perfect situation for us because from a communication standpoint, he's going past 50% line.

He's going like, he's going above and beyond like on his side. Right. That's just kind of how he is.

That's not always the case. Depending on who you're working with, sometimes they don't even know what they want and they just want you to start working on something. And then they're like, no, that's not what I wanted.

Yeah, exactly. Exactly.

Well, I can only build what you tell me.

Yeah. Yeah.

So that like it is a really interesting Team composition. I don't know. It's just interesting to work with somebody like this that's that good at what they do.

Hopefully I can be of help.

Oh, I know you will be.

And I think we're gonna, Probably ride this wave a little bit with him because It looks like this is going to take off pretty hardcore. Okay, so, Grand Fun Atlas, good. All the things good. I don't think there's anything else we need to... Go over. As long as you're feeling good about rocking and rolling and we can maybe meet, I don't know, like...

Sometime next week when you feel when you feel Good about jamming again? Yeah. Um. Yeah.

Yeah, if there's anything you need, any tools you need, let me know. I'll throw them on my card and get you squared away. Um. Yeah, that's pretty much it.

Sounds good, man.

Cool.

All right, well, I'll let you go and I'll talk to you on.

on Slack or something. on Slack or something. Sounds good, dude. I feel you.