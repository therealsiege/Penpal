Created: February 15, 2026 4:02 PM
### Action Items

- [x]  Remove footer bar and move links to Help & About section
- [x]  Fix collapsible profile dropdown in sidebar
- [x]  Remove search button (non-functional)
- [x]  Remove home button from navigation
- [x]  Hide auto-layout sorting feature behind feature flag
- [x]  Fix debouncing issue with name field saving
- [x]  Fix arrange left-right/top-bottom functionality
- [x]  Add border radius to graph node elements
- [x]  Fix dropdown component width and scrolling issues
- [x]  Address dark mode rendering issues
- [x]  Create to-do list in Moonlight Knowledge Base

### Key Accomplishments

**Multi-select and Graph Manipulation Features** 

- Implemented multi-select for graph nodes (Command/Shift select)
- Added lasso selection tool for selecting multiple nodes
- Created arrange functionality (top-to-bottom, left-to-right) for selected nodes
- Added right-click context menu with duplicate and arrange options

**UI Improvements** 

- Fixed modal background opacity issue (was solid black/white)
- Added borders to graph node pills for better visibility
- Improved point properties panel behavior with multi-select

### Technical Issues Identified

**Critical Bugs** 

- TurboPack error caused by CSS files (graph-handles.css, graph-edges.css) from abandoned feature branch
- Invalid Tailwind utility classes causing compilation errors
- Auto-layout sorting overriding user-positioned nodes on page refresh
- Debouncing failure causing name field to revert changes

**UI/UX Issues**

- Footer bar blocking view of minimap and table
- Dropdown menus scrolling unexpectedly
- Theme system requiring extra render for dark mode
- Duplicative navigation elements (profile, settings)

### MedScrub Update

Discussed automated lead generation system using OpenClaw and Google Alerts 

- CRM automatically populated with leads from HTN community, Google Alerts, and NPI registry
- System ranks prospects and tees up outreach
- Working with Maurice at Optum for customer discovery

### Development Workflow Discussions

**Branch Strategy** 

- Considered simplifying from dev branch to main-only workflow
- Decided to table discussion for later

**Package Updates** 

- Addressed baseline browser mapping deprecation warning
- Updated next.config.ts to use remote patterns instead of deprecated domains

### Graph Visualization Research

**Layout Libraries Evaluated** 

- ElkJS: 1.5MB (supports edge routing)
- Dagre: 40KB (currently in use)
- D3 Hierarchy: 15-16KB
- Discussed AI-driven layout as future enhancement

**React Flow Features Explored** 

- D3 force layout, dynamic layout options
- Node collision detection
- Auto-layout capabilities

### Production Readiness Focus

Nigel's directive: focus on making existing features work, not adding new capabilities 

- Priority on fixing sidebar, footer, and debouncing issues
- Feature flag approach for experimental features

Notes

Transcript

Bye. It's broken locally.

Yes, an unexpected TurboPack error occurred. Please see the output of next dev.

More details. Is yours working locally? I was doing a merge. Let me switch to dev. Let me see if I can force switch to dev. Awesome.

I don't have any active branches, so I just readOh, dev.

Oh, this is localhost. Let me run it again real quick. Let me kill it and run it. I wonder if-OK, reload. OK, now I see the error. Okay, so let me go to this. Issues, let's see. Okay, so there's a turp. cannot apply unknown utility class Dial an exclamation with dash three. Okay, so it's a CSS thing that looks like I introduced.

Yeah, I guess in the console I'm seeing some stuff of CSS. Yeah. I don't apply unknown utility class. Exhalation W.3. Yeah.

Which is really CSS not, but that's not Tailwind. That's like what Tailwind renders to, I think, right?

No, that's explanation part, explanation point W-3 is with the,0.75 REM important.

Important though. I thought, oh, I thoughtBut...

I think they just switched. When you write the class, I think you're supposed to put the exclamation point in the back and not the front because on sound lines, I just had to fix a bunch of stuff where it was, but it was just a CSS warning saying it should be written the opposite way. where the exclamation point is in the back at the end into the class instead of in front of it. Gotcha. I don't know why that would break it, though.

Yeah.

It's the important prefix. So you can't, and it's on an @apply, and I think that's where the syntax gets changed. Okay, so--When you do it with an @apply. And you're mixing those two syntaxes. Oh.

Yeah, I'm seeing a lot ofExplanation points in the front of classes and graph handles dot CSS.

Is that one you did recently or is that?

I'm worried that a little bit of the UI stuff that I have in that other branch somehow snuck into dev. Um...

Yeah, I saw a bunch of CSS files when I pulled.

I don't know if they were like generated files. I thought they were just generated and...

Do you know what graph handles? Do you remember messing with graph handles at all?

I don't know where that came from, but... Okay, well, yeah, but not in this branch. Like in another video, I was working on the XY flow stuff.

And I had another branch and I didn't have it published and I'm worried that some of it snuck in.

Yeah. Let me just ask it.

On to you. Yeah. It's probably an issue as the codebase expands. That you have More it can touch and mess up. Yeah. Yeah, for sure.

Well, I wonder if we modularize it into folders and then we run our agents from a specific folder. If that puts them like, I know that they can work and they can traverse folders, but they always have to ask. So I'm wondering if that helps us like contain what agents can touch and not touch as well just by like CDing into a specific folder and then running the agent, the cloud code, whatever, you know.

Yeah. Okay, so it doesn't have to do with that exclamation point because I'm seeing another error console that it was just saying can't apply unknown utility class W-2.5, which is a... It's a completely valid Talon class, so I don't know.

The other one before was valid too, right?

They're both technically valid. It's something... So. There is, there's... It's just... I don't know how new this folder is, but there's a folder called "Styles" That only has three CSS files: graph edges, graph handles, and z-index bars. That should be gone.

It should be deleted. Because it should be part of that other branch, which is so weird.

Is this thing located?

Yeah, it's on the... That's funny. That's what the agent just said to do. Oh, really? Yeah. Yeah. Yeah, it's on the same level as like components and books, services store, like the styles folder.

Let me make sure I've done it. Atlas.

Maybe those need to be moved somewhere.

I'm just going to delete them for now because they're generated, but the files that generate them aren't there anymore.

And I think--Graph edges Yeah.

Like it's, it's, it's honestly, it's because, and I can show you the, the bit of work that I was working through. It's like, I gave it a bunch of links of like things that I wanted to, that I thought would be good features in XY flow or, uh, react flow. I was like, hey-and it was like a handful of things. I was like, I want to do these in another branch. These are the things I want to do. And so I created another branch.

But I think that it... Some of those things like it had to install a few things you know like it had to do a bunch of stuff and I think it generated those CSS files and And it didn't have a way to pull them out because the thing, when I switched branches back to dev, the thing that generated them was gone.

Okay, so I think just deleting them is okay.

Yeah, I think that's part of it.

Now let's see if it's rendered. Okay, I'm rendering. Oh, that's dead. Whoops, wait a minute. How about... Book a host.

Okay, let me--Well, so, Graph view is is importing that file. Graph handles.

Oh, it's this thing Book stuff too. Dang it.

And that import was written six months ago. So I don't know, like it's, Are you seeing a can't resolve Elk JS?

Uh...

Where is... I am not seeing that. IMPN installed after I pulled in Because I thought that's what my original problem was, but... Elcadrius.

I just pushed a little bit ago. Are we on the same? Just to run apples to apples, I'm not saying I fixed anything, but I did push.

Yeah, I mean... Then All Oh, I have stuff.

Oh, I see. Okay. I think I've got it. Okay.

Okay, so you just pushed a global CSS file.

Actually, so yeah, that, but I've got a couple other things going on. There's a lasso selection, a grouping thing.

The lasso selection kind of already exists.

Oh, does it? Did you already get to that?

Yeah, I wanted to go through some features. Oh, good.

Okay.

I just... I gotta get those running again. Yeah, for sure. So, when I just control seed out of out of the environment to stop it. It posted something saying that data in this module is over two months old, baseline browser mapping. To ensure accurate baseline data, please update to MPMI baseline browser. Wrapping list. Should I do that? I'll just, I'll paste what it sent me.

No, I don't know. I don't know what that.

I don't either. I'm just gonna. Not do that in IBM or in dev.

Are you putting it in Slack or in this chat?

Oh, I sent you on Slack.

Oh, okay. Oh yeah, there it is, okay.

Yeah, I still can't, I saw the same error, the TurboPack error.

Is that baseline browser mapping what we use for post hog for like the... We might have to ask Claude or Kursar about that one. I'm trying to think if that's for post hog for the source maps or...

Basically browser maps, I don't even know what that is. So yeah, like right after you run NPM run dev, like one, two, three, four, five lines after that, it has that message.

This right here?

Yeah, it has a message. And then it also says images.domains is deprecated in favor of images.remotePatterns. Please update next.config.ts to protect your application from malicious users. Okay, okay.

Let's see. Okay. Yeah. Let me clean out these ones here that are in dev that shouldn't be. And then let's... I don't know.

I'm just going to put those into Claude and see what Claude says about them. Yeah. And figure out what might fix us for those.

Okay, now we're back to rendering. Okay, okay, now that's back to rendering. Now, okay, let me, so that's pushed. Let's figure out...

I'm just gonna share my screen, is that okay?

Yeah, I just pulled Dev.

Okay. But then maybe make sure I don't do anything silly too. So scream the horn. You what? Just want to make sure you don't...

make sure you can keep eyes on me so I don't do anything silly. All right.

Got to reel me back in, Tim. Okay, so you were saying that this is happening.

I saw Nigel's little thing, like no pushing.

He got mad at me, I did it. Cheers. I like how he explicitly said no rich text editing.

Yesterday I did a whole vector thing. And at first he's like, wow, that's really cool. And then, yeah, he's pretty, he's like, no, make the thing work.

Yeah.

Oh, dang it. Let me kill this.

Let me kill this, then I'll start it again. Um... Oh, there it is. Okay. That's the one. Let me put it in here.

Okay, now after pulling it's loading my workspace. Okay. But that's withEditing something. I can think.

The next and BTS or...

Yeah, I edited the next up and pick that TS. It removed the domains and the images. Oh really?

Oh yeah, I see those are commented out, aren't they?

It says... We should be using next image.

The library.

It told me baseline browser mapping is outdated, a dev dependency that needs updating. Okay. And then it said images.domains is deprecated. use remote patterns instead. Okay, which we are.

We might have to bump next in package JSON, I'm wondering. My thing's compacting. But I'm guessing that's what it's going to say. Before I get too far, I don't know if... You have access to this, but this isn't a document that you go into. Um... But I figured I'd show you what I've been up to lately. so I've almost gotten Med Scrub to where it's like at a spot where I could release a version. Okay.

So what I did was I started a marketing effort using Claude Code and this thing called OpenClaw. Have you heard of that?

Open clawed?

Open claw. OpenClaw. Oh, no, I didn't hear that. I like hooked into Gmail and...

It hooks into everything. I've got it tied to my lights. And some of the cool things you can do is you can write bash job, bash like script Cron jobs, and you can see this cron job right here turned the studio lights brightness, oops, it should be two, but to 95%. I've got an O issue on my keyboard right now. It's getting sticky.

I'm going to have to fix it.

So like it can do all these things, but what I also have it doing is I have all these Google alerts of potential leads for Medscrub and for One Putt Health. Coming into an email, like people who raise money, people who are looking for integrations, people who are having job posts for like fire engineers and stuff like that. So I've got all these things coming here and what I do with it is I have the agent get all this stuff together and it's making the CRM.

And the CRM, like it tags things like, oh, smart on fire, or this is like a good opportunity for a Vim app. I had it go through all of the HTN community, all of Builders Ask, all of those channels. And so I just fed it tons of awesome data from the discussions that are happening. And it surfaced. hundreds of leads and then I use this thing called Firecrawl. to go and get me as much of the data. Like this person needs a bulk fire app.

But let me see if I can open it really quick. But I was like, okay, give me as much data as possible. This is actually not a lot on this one. And then I like tee up some outreach. So an email looks like we have an email for or we have a LinkedIn so we had a LinkedIn We that they were found in the med plum discord. So it looks like they need a med plum app You know like just so so I've got I still have to do some like tweaking and stuff But I've got this like really dialed in to like how help get us more work and help get us more stuff.

Interesting. And that's just the, is that the one, that's the one put health ones. And then on the other side, the med scrub ones, Which are, there are so many Medsgrub ones, I don't know why I'm showing the cold ones first. Oh my goodness. Let me see if I can sort differently.

You're all cold. Yeah. Med scrub.

Sort by tags or something like that?

Yeah.

Sort-it was like-I forgot what that was. Priority, maybe?

Yeah, there we go. There we go. Look at that.

Okay, Snellgrove. So, okay, I think I read this one already. So this person's like very tech forward and fair hopeYeah, internal medicine concierge via signature MD. This is a great person to talk with about MedScrub. And so I had it rank things. This one's ranked 24 out of 192.

It's just amazing what I could do to like gather all, yeah, and there's also this like national NPI registry.

So I had to correlate against that, which is an API of every position in America. And so that's all their information there. It's like dirty. That's what Maurice told me. Over at Optum. He's like here check this link and so he told me about that and he's like that's where you'll find your customers And so Brentwood MD, that's nearby, I think. Some of these cool springs, I had to look for geographically areas where Matt could go, where I could go, where somebody could write, so somebody could try to figure it out.

Um, So yeah, so that's kind of like some of the silliness that I've been that I've been doing today and and yesterday, I guess, and then I So maybe I can show you with Atlas what I did. Ah, dang it. Ah, where's the thing? Oh wow, I got two of these open? Let me get this. Here we go. Okay, let's go back to Atlas. Okay, so now with Atlas, clean up this menu bar just a little bit.

It could use your pass edit though still.

Yeah, that's why I wanted to get on call so we can go over things. Okay.

So the thing that I was doing was, and we need to get these fixes out there, so I need to focus on those. So for the programming unit, oh, dang it, I got to move you. Sorry, I got to move you over here. I can't read my text.

Please tell me. Tell me.

Which Ones are object oriented. Dang it, you O.

I couldn't log in. I couldn't log into dev. I think was the issue I was having. Uh-oh. Okay, so I added a semantic search.

So it's object-oriented paradigm. And the semantic search is using PG vector on top of our neon. Alongside Memgraph. And so it's able to clear Atlas and figure out like Deep, deep pieces of information.

I had an idea that Uh, I'm not sure it would work, but we were discussing changing how graphs are sorted in sort. And why couldn't we not use AI for that? to do a smart Bye.

You mean it might not work every time? Are you talking about layout?

I thought about like, yeah, layout, like how's the, Uh, like... Like hierarchies and how things are... Position like this stuff, right? Why could we not tell AI to read the context and create some sort of layout?

Oh, I think we can. I think we want to. And I think that's like maybe... something interesting for us to work on together. I don't know. It sounds super fun. So I kind of want to do that part two.

And maybe that wouldn't even be... I don't know.

It seems like a--Well, there's parts to it, right? There's like the AI part and then there's the controls part. So if I go to React Flow, And then we go to the examples. So there's this interaction and layout stuff here. dynamic layout, force layout, like some of these things we would want to tap into and then And then use like the configuration and that thing to...

This is D3 force layout.

Yes, yeah, in React Flow.

But what we can do, I think, is we can let... surface these to AI. And we can allow the model to produce the configuration for these, based on business context, I guess. Right. It'd be the most powerful, you know, right? If we can marry those two. But there's like a number of these, and that elk one was the one that I was This just this first one, but I was starting to play that in that other branch I'm starting to play with a few of these just to like yeah get the controls in there and then we can figure out the AI and the other stuff and another big watch what collisions piece That's huge.

Right.

Node collisions. I was... I swear I was looking at this. Only some of them did collisions, though. Like, the Dodd-Grey one did not do collisions.

Yeah, I think the dagger one might be one we're not going to a lot.

Is it a dagger that does it?

Or a horse dagger?

There's a... Where was it?

That's cool.

I like this stuff where you can just--Add a point, you know, like, you know, that kind of stuff.

I like the auto layout. That's really cool.

And I think we get a lot of this stuff like, for cheap because it's built into React flow.

But, you know, and there's also another thing. I don't know how much we're doing with Tailwind.

But this might really unlock us if we don't have Tailwind in there or if we're not really like...

What do you mean we don't Tailwind?

In React flow.

We're not leveraging Tailwind heavily in our React flow components. Um... We could, you know, we can style things much, much better, I guess. It should be like a base, brief suitcase type of thing that I haven't from it's a chippy tail in andUm.

I'm pretty sure everything I've edited so far, I've been just editing Tailwind classes. I haven't written any CSS.

Oh, okay. Okay. Okay. Yeah, it should be good.

We're using Tailwind. Okay, so stop sharing because--So I cannot create a video I cannot create workspaces or atlases in dev. Because it says, uh... I was invited to a different... This usually means the user was invited to a different...

That's still happening?

I thought we fixed that. I mean, I'm on dev and I tried to...

Did it ever work?

I don't remember, I've been working off local. Oh. I was gonna send you what it sent me.

And local's been working?

That is, I'm not found in preview database. This usually means the user was invited in a different environment. Please ensure the user is invited. Because I'm using the same email to try to, I am logging into dev to see me. Okay, got it. Is there something else you-let me hit that again.

OK, let me fix this thing really quick.

It's found the-browser baseline dependency issueWow. And then I'll fix that for you.

Oh man, that's an annoying bug.

Yeah. It's...

But I thought I could get somebody to one, and then they'd be in both.

I thought that was-because I thought I would just create the-the user on the fly, but that mechanism might not be happening. Okay.

Okay, I'm sharing my screen now. Okay, so we have points here. This is local, but I'm on dev. I'm not on any special branch or anything.

To me, this is basically you working on dev.

Local is pretty much a duplicate of dev.

Right. The one thing I wanted to...

bring up really quick was do you want to just branch off a main and not and we'll only use like we don't really need that dev branch because previews get deployed to dev So do you want to just likeNot merge off main and make a PR back into main?

And so, Dad? Uh, I'm just, you know, I don't know.

Because if we have changes on dev, And then I Great. Yeah, wouldn't I want the current changes we have on dev on my new branches? So I don't want to like cause conflicts when I try to merge things or...

It would just be a magically moving dev as a gate to main.

And so you would always pull main back in if there were a new, like a pull request approved into main, you'd pull that into your branch. Just like as if somebody made a PR in a dev, And it got approved.

Right, you update your branch.

I do. I don't understand.

I feel like we've discussed it later, I guess, because it's distracting right now. So, Are you changing the colors of these?

Are these different colors? The... I did not change the colors of... I did change the colors of these hills up here to have an actual border because... Oh my gosh.

Just go to sign up. Yeah.

So home We need to, okay, I need to fix that mouse over. How did I not notice that? Home needs to be, like, removed, I think.

Yeah, and you know when you go, will you click there real quick?

Yeah, it goes here.

We're signed in right now, so that should show like Workspace.

So it's really easy to know, oh, I just go right back to Workspace too. And also, why did it go to white? Instead of staying in your theme. Like what's going on with the theme stuff right now?

What just happened there?

I did actually notice that at some point there's some weird things around.

That's really boggling.

I don't know how that...

Maybe we're resetting-I think-Yeah, well, Darkmode...

I'm not sure why the background is-It's almost like the theme system is different from when you're-no, it's not logged in to logged out, because you're logged in the whole time.

I don't know why this is gray like that. That's weird.

Yeah, I've noticed that.

It's almost like React Flow needs another render to pick up the theme. Like it's like it's not like now it not looks great.

It looks beautiful now. Well, before, it was only a light theme.

And I think that's just like it's like behind a render or something. I don't know if it's like a React Hook issue or...

Yeah. I haven't tried to fix it yet.

I do want to like mess with this bar here. I want to get rid of this home button.

Yeah, we can do that. It doesn't make sense.

Yeah. If they want, do we have a logout button? Is that a thing? Is that under here? Sign out. There it is. Okay. So if they want to go back to that page, I think sign out is the way to go there or they can click the logo and that does the same thing. So instead of having this button here, which goes like that. And also you'll notice it's already up here. Why not move this up above here? Um, But I'll like, kind of like...

like a line here. So it will almost be like a It'll have that same arrow, but it'll just be like a taller button and you click it and it will collapse everything. And then that arrow will expand.

Like you'll go up and down with the stuff that's in... The profile thing?

with that arrow or?

Oh, this arrow would turn into like a like a not it wouldn't have that but it would have like a little like like this, like a V, like a dropdown. Yeah. So it would be intuitive that it's a dropdown. Yeah, that makes sense.

Like this is not intuitive.

I will probably make it so you click anywhere inside here, it's going to pop this menu down.

Yeah, yeah. That's... That's pretty important stuff too. Search does nothing. I don't know if we want to remove that for now or what would search do?

But it shouldn't be there if it doesn't do anything yet.

Yeah, we should probably remove it for now. I don't even think it's needed because you can just search in the navigator.

Right. And I don't know if the Navigator button is needed there because you have it in the toolbar.

Um...

On the right?

We could leave it there because it actually does something. I don't care about that. I'm more worried about cleaning stuff up that doesn't do anything. Because this does something, so it doesn't seem like it's broken.

Yeah, that's frustrating.

Right.

It's...

We don't want frustrated users.

No, we don't. No, we do not. And we don't want to frustrate Nigel.

I don't know what all of is. I'd probably look at the code and find out, but I don't know all this stuff.

Oh. Well...

I don't know what is part of adamant and what's not.

What is part of what?

Admin. Oh, yeah, I see. His profile here...

Um...

That should be the same profile that's underneath that seems duplicative.

I didn't know-where did that-I didn't know you could get to that stuff.

What the heck? Back to workspace. I think that's part of, is that part of like, That is all wonky.

You want admin and we want, I think we want help and about. Does that, yeah, we want help and about.

Um...

I would almost put the sign out on here, too.

Yeah, well, it makes me think, like, could we... What?

So you'll notice when I go to admin, the bar is completely different, which is fine. I don't care about that. I just wanted to point out how it's laid out. It's kind of cool. So down here, I like this theme thing. I don't know if it's necessary to be up front.

It doesn't have to say theme, but I do like having it there.

I would like to have one of the multi-select things. Instead of going like toggling like that, you would have-You would have to use those same icons. You have something like this.

Oh, yeah, yeah, yeah.

Or it's just quick, like...

The sun, the moon, and then like a little computer icon. Yeah. Do something with that.

I don't know if that's like... That might not be needed because we have that menu here.

And so maybe we should just-We got to do another one, I think, because-so those are two different menu bars, the one in admin and the one in there. This one's small. It has some expandability we want to make sure we retain.

So when you grab that bar on the right of it, well that too, but when you just, yeah, that's something that was asked for, so I think we want to retain that.

But cleaning up on there, like...

Yeah, like, I think it would be really awesome if we could... knock out some of those soon. You know, like that sidebar in terms of making sure it's always like scrollable once nothing gets hidden. To always expand and there's no black area.

Three, not duplicative, right?

Because we've got some duplicative stuff there. We've got some hidden stuff. It's almost hard to talk about because there are so many different issues that There's a lot.

It's loaded with issues that need to be almost like picked out one by one.

Where did my workspace go? I just created one. So that's, that's, there's an issue. It didn't add my workspace after I added it. I had to refresh the page.

Oh, that's weird. Okay.

But this was an issue I wanted to talk about is You can't see my dev tools.

But...

This entire thing is just overplaying the rest of the page.

Let's get rid of it.

We've got privacy policy and terms of service on the homepage.

Well, it shouldthat shouldoh, that shouldThat should be in the help and about.

Oh, can it be... It's already right here. Oh, okay. Yeah, okay.

And then we can have the links for all that.

Yeah, let's do that. And then we can get rid of that whole bar that's persistent on every page.

Right? Yeah, it's literally blocking things like... For instance, if I have the table Well, so I don't know if I selectSelect these two points here. It says two points selected down here, right? Yeah. If I hide the table, where'd it go? It's actually down here underneath this. See how the mini map is like hidden? This is just literally on top so yeah I'll kill that. Gotcha.

Yeah. Yeah. And it's also looks weird with the sidebar on the left. Like, you can see the overlap, and you're like, well, that's kind of wonky.

Yeah. I mean, it's just taking up...

I think...

We already talked about it.

I think removing it is our best option.

I thought this was adjustable.

Sound adjustable?

Is it only this? That one's not adjustable anymore.

Just because you can show and hide them with the toggles up top.

Okay. We were thinking about doing it in the future as adjustable, but Nigel was like, I kinda just want them like, quick offer on like I don't want to have to like drag and get yeah you know like okay that's fine Is this sort thing up here, is this available to them?

Yeah, it is. Yeah.

Yeah, we could put it on a fancy flag if you'd like, though.

Well, the issue is, I've noticed you can come in, I can do a bunch of sorting, see how I just moved that right there, and then if I hit refresh and come back... See if this actually happens or not. Okay, you'll notice how it's it resorted them by what is up here. So you're going to, if you have a customer that has laid out everything, they're going to be really annoyed.

Yeah, that's bad.

So this should almost be like a confirmation thing or when they click it, like, I don't know.

But yeah, we got to fix that.

Before we go to this, I don't know if it's. Is it saving the layout? Or is it... Are we loading the layout? Because I'm assuming these... These get saved, their positions.

Yeah, they do. Yeah. And I don't know which one's happening first, right?

Before, it may have run that auto layout first and then done the user runs, which is probably the best thing, right? Because it's like, give us the base from the auto. And then whatever user tweaks or decorations have happened, apply those. But it might be going in reverse. And that also may be why it's taking a little bit longer to load. Yeah. But I think it might be a race condition or, you know, like that might be something I introduced.

I'm not sure.

It might be applying the, when it loads it, it might be applying it after it loads. That's what I think is happening.

Maybe should okay. I'm gonna put that behind a feature flag for now and And we'll just allow you to move things around and we'll go back to the drawing board on that one. Just because it can take a little time. We've got other things to do.

Yeah, exactly. Plus, in the meantime, I've introduced where I can take like... Let's say I have these three that I can select. For Macs, you just hold down Command key and you can select multiples like that. Then you can right-click on them and arrange top to bottom, and it'll arrange that group. And then since I have these selected, I can then move these wherever I want.

That's cool.

Um. So like I have like this. Yeah.

That's cool. That's really cool.

So multi-select was already in. I just had to figure it out.

Awesome, awesome.

So for shift, I think for PC, you hold down shift and you can shift select.

Oh, shift, okay. Okay. Yes.

Okay, I guess shift select. Works for me.

Ship might work for both.

No, it doesn't work for... Huh?

Two points selected.

Yeah, it's working. I'm holding shift and I'm doing command.

Oh, nice. Okay.

Okay, they're both working. I actually might have...

In a table, they can work a little differently.

In a table, if you do top and you do shift, it'll do the whole selection, where if you do command, it'll only pluck.

Yeah, so if you hold If you hold shift, do you notice my mouse changing?

Yeah, it's like a grabber. For a...

Well grabber's the stock one. And then when I hold the shift, it does this and then you can, And then you can do this.

Oh, that's awesome. OK, cool. And they're highlighted. Oh, that's cool. Love it.

Yeah. And you can move those around. You can right click on them. And duplicate.

I wish Nigel was here to see this. Do you put oh my goodness, where is Nigel? He's gonna go nuts when he sees this. He's not in line.

So left to right. Oh, that didn't work 'cause I have... So I also did something before if I had a point selected and then I selected another point, it was leaving a point It was leaving this point properties open. I got rid of that. So now if you click one, it'll show you point properties. But if you multi-select, it gets rid of point properties because now you have multiple points. So it... Yeah.

Does that make sense? Yeah, that's fantastic, yeah.

Um,This is awesome.

That's right.

This is a lot of added value to the users. Um... I think it'll... I think... Hiding that one thing behind the feature flag kind of makes this like... To where it's pretty close to bulletproof to what it is.

You don't think there's anything-It's up here.

Yeah. That's the only thing that can make things go wrong, I think. I'm confused here. This is like doing the opposite. The heck? I'm not following. Okay, so, I have these right here, right? This group of four. Range Y group. Arrange left or right. That should be a, it sounds like it's a horizontal, or if I go here, if I go top to bottom, which is a vertical, Wait a minute. Wait a minute. That's weird.

That definitely was not... Um, Okay, I'll have to go look at that. That wasn't... broken before, so that's weird. Look into that, that's weird.

Let me put the, I'll do the one behind the feature flag.

I'll make a branch and I'll hide the layout.

Hide that. Yeah, I'll do that. Make sure, Sure, it's auto, like, it's doing the auto one and it's not re-sorting.

Yeah, yeah, yeah. Did you see this?

Did you know what... Did you look at the... Like the dog gray and the D3, the different... What do they call them? Node layout sorters?

Yeah. Look at the sizes of some of those. In terms of like package and...

One of the package sizes on those was like one and a half megabytes. Wow. The one we're using is super lightweight. Okay, cool. Okay. It's like, I don't know, it was like 20 KB or something. Okay, cool. This one, I saw... You were saying something about ElkJS being installed or something?

That's a small one? Yeah. It's a nice layout. But we'll see.

I was thinking about throwing a kitchen sink at a little bit of it and us playing with it, but... Maybe it needs to be a little bit more surgically introduced.

Reference. Where is it? Is it samples?

Up a little bit. ElkJS.

Yeah, you had it right there.

Yeah. Underdraft. Dagger looks nice.

That's what we're using.

But you have to have points in hierarchy for it to-when we get it way out this way, it's kind of-And we also use curving and, you know, but... They?

Did they like update this paid website? Um, hmm. Preference on And I wanted to show you-Is it the multi-alc or the single alc?

Because they've got an-Layouting.

Here we go. Overview. And this is this is in learn but. Yeah, dog race, 40 KB, D3 hierarchy is 15 KB, 16 KB, elk is 1.5. Is that the one that was installed? Yeah.

Yeah, I remember that. I had all of them in there.

And that other branch-Oh, yeah, because Elk does edge routing, which is what I think...

Yeah.

That's gotta be. That's the only thing that's different, right? From the...

Help probably supports a lot of stuff. Well, I'm okay with that. It's the most configurable option. Oh, okay. It's a Java library. It's a Java library that's imported to JavaScript.

Like I'm more like, I care more about like how many points of pass a user can create and without it like, Bonking out on them Then the build size, but... Um.

Yeah. Is that the English Honorable? Like the European one?

What did you say? When they say honorable mentions, that looks funny. Is it the European spelling?

If you want to use dog dog or D three hierarchy, but need to support nodes with different dimensions of D three flux reading Something else tree looked promising. Oh, cola? Interesting. Honestly, Mostly want to get like I was trying to think in my head how we could hand roll... Collision detection.

Honestly, I think we go as far as we can with this library rate, and then There's a library that Memgraph put out.

that's like really lightweight and I think we switch to that and then start rolling around on top of that. And then we have a lot of control, but I don't think we want to use this one. I don't think we want to use Reactable as the base. We get a lot of free lunch here, with all these features and stuff. It's super feature rich.

But I think we're gonna like Kind of like that.

Well, think of this. So like running this on drop. So like someone brings this over here, drops it, and then it runs it andMaybe that'd be annoying though.

Yeah, yeah. If it was faster, too, like if it was really quick, like kind of snappy, it would be like, boop.

Like, you know, that would be perfect, you know? I wonder if you could adjust the speed of that animation.

Let's go back to this. There was another thing. Okay. Oh, yeah. For names, something's wrong with our dbounce right now. So if I like... Select all of it and hit backspace. It just added it back and saved it.

Oh dang. Okay. Gotcha. Yeah, see, I just typed...

Yeah, there's something... I don't know what's happening, but... Like... I mean, Yeah. Especially does not like if I delete everything. See, it just put like, I don't even know what that is. Where'd that name come from? Is that like the original one? But over here it says unnamed still. But there's, this is in there, so let me refresh. Which one is it? I'm wondering. Now it's going to rearrange everything.

Is there a... unnamed in here. I don't know if that was the original one. So the node name changed over here when I did that. There's still text in here. And then it saved it once I added something. So I think we got a debouncing problem.

Yeah, I think so. Even like, I swear I saw something. And Chat.

Uh... Yeah, I'm seeing debounce, reload triggered for... Blah, blah, blah, blah, blah, blah. You guys refresh triggered.

I got umAgent working on it.

that'll square away and then I'll Take care of that.

force layout style There's a few areas, this is a UI issue, I've seen where the elements inside the box are square. Do you have that? Yeah. And then like, so see how the corners are dark?

Right, right, right. Because they're overlaying the corners.

That's easy enough to go in there and I just throw I just need to draw a border radius on there. Yeah, I That's that's something This right here, I tried to fix this on like, What's this? On Friday, this.

Oh, the drop down.

The drop down is Um... So yeah. This looks like crap. One of the problems is this component is shared Huh?

That hover takes away the text right away.

That's annoying.

A physical sight one?

Well, just the thing that's hovered on. You can't actually read it. Right.

There's some dark mode things that... Gosh dang it. That's not what I wanted to click. Light mode. Light mode's probably fine. Process, like, I actually couldn't even-I guess get the check marks on there. Yeah. So light mode's probably mostly good, but there's definitely a lot of issues with dark mode in certain areas. Kind of like I was saying, mousing over here, this should not go dark like that.

I can't read that. Wait, is it fixed now? Oh, no, it's when I mouse over is what you're saying. Yeah. Okay. Regardless. OK, so for point properties we have the type here too, right? That's like missing a border or something. So when I search for types, if I scroll down, it scrolls back up. Like I'm not touching anything.

I just did that.

Which is super annoying if I'm just scrolling.

I wonder if that's related to Z-bouts. No...

Actually, don't. Let me just try it. I'm not getting anything on the console related to that, but I can probably fix that. That's probably easy enough to fix. I just don't know why it's doing that. Is it okay that the descriptions are cut off like this? Hmm.

It's not ideal.

I can add a title to the element.

Is it high priority? No. Is it a problem?

Sort of, yeah. It would be nice to have it fixed. But it's not like a cut to prod problem. It's not a blocker.

Yeah, okay. I mean, it's the same thing with this here. So I try to make this wider by default and actually successfully did. But the issue was... To make the, when I made this wider, this, this cell in here became the same width?

No! Oh, okay. That makes sense.

Which is like... So it's like this drop down or just like thing is not like... It's yeah, it's not outside of the instance of that element. Vue has something really cool called like... Portal or something where it like. puts it outside of everything else. that I really liked. Bye. Or yeah, I forgot what it was called, but we've been doing it with our modals a lot. This this component here is the same as.

This component Yeah.

Um, And I kind of like that we're using the same components that we drive.

Oh, yeah.

Right?

That's great. Yeah. Yeah, they need to work in both places. I don't, these aren't, but like this dropdown here, even though it'd be nice to reuse it, is not a super... Actually, the component is the search and all the stuff down here is all one component. Yeah.

Well, and I think if you can fix one in one area, a lot of things should be fixed there, too.

So when I did fix it down there, like by putting, I was like throwing like a fixed width on it. like if it existed here, Like, had it at least come out a little bit.

I see, yeah.

When I did that, it affected this one here. It made this one have the same width because right now it has what's called a fit width. So it's fitting the container and that's why this is this wide because it's fitting this container. Oh, I see.

So do we need one-oh, do we need a container? Is that broken?

It might almost be better, even though it's not as pretty.

I'm okay with two of them. If we want to split them, because the behavior is so different.

I need to do something where it's... Because if there's some sort of overflow hidden on here, it's going to make it a pain in the butt to create this menu. Actually, it shouldn't be. If I'm able to see all this, I should be able to... Use something else, like create something else using absolute positioning. that uses this relative to this cell here that should issue. Yeah, I just spent way too much time trying to make it work with one component, and then I...

got frustrated and went to something else. Okay. Um, because it was, it's not like it's broken, but it's, uh, it was just annoying. Yeah. This year though, So I think we have an issue. So this is in three spots. We just figured we saw three spots. Point properties, create points, and then the The data. Yeah. So on this one, if I scroll, I'm scrolling right now. It doesn't scroll. You actually have to grab the scroll bar on this one.

So the other one automatically scrolls you up if you scroll. This one doesn't scroll at all. But, I mean, search works. So there's that.

Oh, okay.

Yeah, I'll go through. It just went down there a little bit for some reason.

Well, the value of having it dry is they all work the same and they always work.

So when we're kind of missing out on that type of behavior, it's almost like, all right, let's just split them apart. Yeah. Instead of fighting with them.

Yeah, there's a lot of little things like point path. Like this should have a background on it.

Yeah, totally.

Yeah. Stuff is just... This button here.

What do we need to focus on to go to prod here really quick? And then we can circle back around on this stuff and figure out like...

For sure this thing needs to be removed. As we now have, we have this. So I was even thinking we could add. some of these options too. This but I just didn't want to like do that because this menu already existed Yeah, yeah. And I didn't want to like...

Yeah, that's fine.

Add things. There was like another button on here. I forgot what it was. I think it was like... Duplicate or it was add to view. There was an add to view button on here, but it wasn't doing anything. So I just removed it for now since. I thought, like, this is a good enough indicator... of like you have points selected. I would probably want the background to change also when you have something selected.

Like these are highlighted, these three points.

Yeah, it's a little subtle. I don't know what...

But it's a little too subtle. Oh, yeah, there it is. This one's... I don't think that's a blocker for broad.

I'm sorry? I think it's just doing a thicker border, it looks like.

Thicker border and even just lightening the background just a tiny, tiny bit. Christine? Give it a subtle. Yeah. Anyway. Blockers, though, I'm going to remove this bar down here because that's actually blocking view of things.

Do you want me to...

Huh? You're gonna take care of the footer bar? Yeah, I'll take care of the footer bar. I'll move all this stuff into helping about. Okay, cool. I'm going to remove search, remove home. I'll try to fix this bar with having the collapsing up here.

Okay, that'd be great. Yeah.

Profile, am I keeping this or removing it?

No, yeah, I think a lot of that's duplicative, right? What is settings?

Oh, wait, what?

What was that? What did you point out?

Settings.

Oh, those should be under your drop down there. And I'm fine if they get removed from the drop down or something. But it sounds like you've got an idea of what to do under that drop down.

So I would just remove them and take back the real estate.

Now this goes to settings profiled. Why is this like black?

I don't know. Claude screwed up.

I think it's probably just a default default. Yeah, it's Shadcy on New York.

But it should be themed to our stuff. It's not.

I don't know if you saw I fixed an issue when you click this. The whole background was solid black.

Oh was it?

on all of our modals. It was solid black. or a big solid white for light mode. Because it was trying to apply a background opacity to... to the background of the modal and it was not, doing anything, so I fixed it soon. Because that looks horrible because it's just it's like very jarring going through a modal and just having to be tired.

It looks great now. Yeah.

I don't remember what else I...

Get that sidebar squared away and...

Get this squared away. Get the bottom part squared away.

I'll do the feature flag on the layout stuff. I'll do that right after.

Do you want me to look into the debounce?

I just pushed a fix for that.

So if the fix works, we should be good to go. If it doesn't...

Then we're gonna have to address it I pulled it down right now. Cool.

Just refresh? Yeah. Doo doo doo doo doo. Package, do I need to empty and install? Package lock will click to change.

No!

That's me holding. I'm just holding delete. Did you... I know the pains of debouncing and saving because of the stupid scratch pad on the visit details page on Speak Notes. 'Cause it's a pain in the butt 'cause I had an issue once where I updated it and anytime anyone would load visit details page, It was loading as blank, and then it was saving the blank, and it was just wiping everybody's nose. That was the most I've ever sweat at that job.

I was fixing that one fast. So, yeah, I don't know what's causing the... I'll work on that.

I'll work on debounce.

And I'll work on the force layout thing.

I'll remove that and put that in feature flag. OK. I'm not going to give anybody access to the forest layout stuff right now.

You and I can take access when we want. Yeah.

I'll just hide it behind a feature flag and lock it away. And then if you can take care of the sidebar and those other items that you had mentioned, there is a notion...

page happening that's going to give us a to-do list.

And I'll put that in our Moonlight Knowledge Base under the-I probably need to go look at that stuff.

I have not logged on to that page at all. Okay, let me... No worries. I know I still need to give you my W9 had that. You already said that? No, no.