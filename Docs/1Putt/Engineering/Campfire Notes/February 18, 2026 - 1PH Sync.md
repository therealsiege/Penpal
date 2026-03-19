Created: February 18, 2026 6:59 PM
### Personal Updates

- Team member's sister having a baby this weekend; plans to visit with son who is excited to hold the baby
- Will be watching four dogs including three golden retrievers over 75 pounds during the visit

### Recent Engineering Progress

- Implemented ElkJS graph layout algorithm for better performance with large graphs (50+ nodes)
- Layout direction button now functional with improved snappiness
- Fixed debounce issues that were causing graph lag during node dragging
- Resolved React exhaustive dependencies lint rule conflicts
- Added semantic search layer using Postgres vectors on top of Memgraph
- Can now perform deep contextual searches (e.g., "which are functional languages invented by English-speaking programmers")
- Added alignment guide lines when moving nodes

### UI/UX Improvements

- Updated light mode styling: less bright white, subtle gray background on graph view
- Improved dark mode: slightly lighter graph background for better contrast
- Fixed table column width issues with type dropdowns
- Enhanced sidebar hover states for better visibility
- Graph visualization now has collision detection, though some overlapping still occurs

### Issues Identified

- Delete button (keyboard) not working - only backspace functions
- Need to add background to nodes to prevent text overlap
- Layout algorithm doesn't auto-apply on view load anymore (fixed)

### Point/Path Manager Discussion

- Current show/hide interface is not intuitive for non-power users
- Critical feature for creating different views (HR org structure vs technology map vs customer base)
- Used by existing customers (Masterworks and others) to build composable views
- Paths can only display when both connected points are visible
- Decision to involve Nigel in redesign discussions due to complexity

### Action Items

- [ ]  Remove grab handle from graph toolbar (legacy multi-view feature)
- [ ]  Remove expand/collapse button from graph toolbar
- [ ]  Consider removing workspace close "X" button (no home page/dashboard to return to)
- [ ]  Move settings and sign-out to admin section in sidebar
- [ ]  Replace theme dropdown with icon toggle for light/dark/system modes
- [ ]  Update color scheme: consider changing light blue action buttons to match logo colors
- [ ]  Schedule jam session with Nigel to discuss point/path manager UX improvements
- [ ]  Create GitHub issues for identified UI cleanup tasks

### Current Status

- Working through Nigel's UAT priority list - many items already closed
- Sprint goal: complete items through #24 on priority list
- Estimated timeline: less than a week for remaining high-priority items
- Team velocity is strong - collaboration between Clint and contractor working well
- Nigel is "super happy" with progress and eager to get customers onboarded

Notes

Transcript

Hey, hey.

Yo, how's it going?

Not too bad.

Right on, right on. The Deem is not working too hard.

Um, I mean, I literally was working two minutes ago. Watch out on this call. I, We're trying to see. Push out this like speak notes recording for us. tribes that are like, um... Oh, what a day. Certain scribes, I guess, needed to... This record directly onto certain visits to speak notes. I don't know. So yeah, getting that working. The understanding is then Instead of pain...

Um. Do you want to just go over things really quickly and then we can break? And that'll give you some stuff to work on when you want to? And then we can kind of end up... We get... My sister's having a baby. Saturday? Okay. I should be available. It's my sister. It's not my wife. You know, so... Yeah. But we're going to go... My son wants to hold the baby. He's been wanting to hold the baby for months.

He's so excited. Okay. Yeah, so we're going to do that this weekend. We're going to see them a little bit, but... Um, And then we're watching all four golden retreat. Wait. No, we're going to have their two golden retrievers with us as well. And so it's just going to be four dogs, three of them. Three of them over 75 pounds. A lot of golden retrievers.

Yeah, exactly.

They're all really good. They behave. But they all scared in the bed So that's it. There's always so much space in the bed.

And fun with that.

Yeah. Okay, so Gosh. Lots going on here. Let me just jump into showing my screen really quick, and I'll try to orient.

The last work I did, I think was on Sunday, Monday, somewhere in there.

Yeah, we're looking really really goodSo yeah, you know, kind of like, Like, uh... the They call it Gulf Ham and Egg in it. But like the teamwork between the two of us like works really really well for being effective on this. Um... So like we're getting we're getting through like he's super happy Oh, that's good. Yeah, he just wants to get some customers and start pouring some money into this thing.

Um... Let's see here, so what I've been doing Can you see my screen?

Yeah, hold on. I need to adjust my...

Oh, are you on the small monitor? Huh? Are you on a small monitor?

I mean, I've got the big MacBook, so it's not super small. I've got a couple of external monitors, but... This one's the clearest.

Oh, I see. Okay. It looks fine.

You're good. You're good. Okay.

So... This is the priority list that Nigel's been going through when he UATs. I added this column here to show, like, because a lot of these are closed. So I was like, I know a lot of these are done, but he just, like, didn't update it. So I was like, well, I'll just add a column instead of removing stuff off of his ticket. To be nice. Um... But I fixed a few more things. Also, While fixing things, I enabled that I did the first layer of the button for the layout.

So, and when I say the first layer, The button with the direction works and it makes sense So you won't have it let me just show you really quick on my screen yeah Yeah, yeah, that's fine. You have to go give yourself a feature flag. Oh, yeah, yeah. You have to enable it for yourself. But it's using that ElkJS. So the reason why it's using ElkJS is because it's more performant with large graphs.

And chances are we're going to have...

More than 50 or 100 points. It definitely can get larger. So this is a bigger library, but like I think it's worth it.

Yeah, it works so it works so snappy and fast.

Yeah. Oh, yeah.

So it's much better. It works good.

But it doesn't have things you can see here. When I zoom in here, there's like overlaying stuff. So it doesn't have like collision detection and some other features that are in the React flow that we could enable to solve it further to make it even better.

Yeah, yeah. I think we could do that.

Okay, cool.

I mean, step one, you stick a background on those tiles or the nodes so they don't like...

Yeah, definitely.

This is transparent right now, so she's showing everything through it.

I also added these lines when you move nodes.

I did see that. Yeah, I noticed. I did notice that.

That's good. That's pretty cool.

Let's see.

It's so crazy how easy it is to reverse engineer a pro feature. You know what I mean? They can't guard their stuff anymore because of... agents. You know, it's like the agent season is like, all right, I can write that.

It does.

Yeah, it's like a little... offshore fabric shop or something, you know, textile shop.

Yeah. To say it as politically correct as I can.

I think I was working on a little Sunday night, Monday morning, and I was noticing the graph was super laggy. because of the debounce or something was like It was like you started like dragging a node and it was like trying to update and like, and then like... hydrate the front end, like multiple really fast and it was like causing a bunch of lag. but it looks like you fixed that issue. That's good, because it was really bad.

Yeah, I stayed up a few hours. I was like, oh, shit. Like, I broke a bunch of stuff. I better, like... Just like do the like clean up stuff. And so I got in there and Honestly, the biggest thing I was fighting was that React exhaustive dependencies lint rule. Where it wants to have all those dependencies in the hook array and it's like, okay, that's great, but then it's like firing on all those, see, like...

It's just this crait feels like a crazy balancing act and maybe I'm just like not really wrapping my head well enough around hooks and that dependency array to make it clean enough, but I fight that ES lint, um... Well, and it's the agent too, because the agent will write code that's kind of wonky, right? So it's like, I have to go back to that. It was so crippling. Once I fixed that, it was like, boop, boop, boop.

Everything started behaving really nicely and I was just like on the new, you know, good things. Yeah. And so that worked. And then the other thing that Nigel did was... So when you chat with this, a couple things happen. So let me just do list my atlases. A couple things happened here. So I don't know if I showed you, I added a semantic search on Saturday with a layer of Postgres. I'm using vectors.

Okay. And so, but we can do some interesting things, like we can say, okay, search, Number one, we'll just say number one. And tell me... Which ones are Functional Languages and which ones are invented? I am English Speaking Um... program. Okay, so that's like really like in-depth. context type Type searching So it's gonna It's going to add a step in. Oh, it didn't even... Okay, one hundred and half.

I'm going to use functional programming paradigm. Connected via use resource path. So Rust is Python supports it. Yeah, JavaScript supports it. Those aren't. Pure functional. Okay, here we go. Haskell, Clojure, Erlang, Fsharp, Elixir. Good. Languages created by English-speaking programmers. JavaScript, Brennanike, Python. Dutch but English speaking, okay? You know, like, it can do, like, really, really powerful stuff because it's building a semantic layer on top.

of the graph layer, of the mem graph layer of data. So it's got like the super good structure, super good map of the data, and then on top of that, it's like, hey, here's also some vectors for mapping, searching, and doing vector type operations. And I'll put that for you in your chat. So, um, so I'm in your, in our chat.

So they would like link the two between the graph.

the navigator or chat and the use of PG vector to create a semantic search layer And at one point I had it to where it was saying semantic search, and I don't know if I removed that. I can't remember if it was late. If I removed that, where it says that, and it just groups it, or if the way I... Because list my atlases which it did listing your atlases I've examined What did I say? Search number one.

Yeah, that's interesting. Okay.

Oh, that reminds me, Paps. There was, um... What's on a path? Now hit the delete button. No. I don't want to do it. Okay.

No, no, no, he cancelled, he cancelled.

Now hit delete button on your keyboard.

Oh. The backspace or delete, which one?

Are you on PC or something? Mac, but I have...

Maybe a delete button. There's a delete button on Mac.

Yeah, hit delete. Nothing.

Nothing. What? Nothing. Nothing happens?

Okay.

Backspace did it.

Oh, Backspace did it.

Okay, but refresh your screen now, though. All right.

Does it not actually delete? Oh, it didn't do anything.

That was something I noticed and I totally forgot about. Yeah, it's... I think that's as easy as just hooking up to the current delete functionality. Yeah.

Um, I figured that That would be a good... Things you have.

Or it just makes sense.

or you can just click on something and hit delete and it actually disappears.

Oh, okay, that's actually something to... Because... It should delete from the view, right? It should delete the...

It should delete the... Path.

Just the path. We don't actually delete. What? We don't actually delete points and paths unless... So there is a delete delete, but there's also...

What I'm saying is it should match... Like if you click on a path right now, you go to point properties, there's a delete button or path properties.

Yeah, yeah. There's a little bit of a nuance to it that I have to write into here. And that's this. If it's in the base view or the default view, it will delete it from Memgraph. If it's in a view that's created, that's like a composite view from the sidebar... That's not the base all data view. It will delete it only from that view, but if you create a new view, you could show it again from the path manager.

So there's a little bit of logic there that happens based on if it's a view... Or if it's like and and and I was thinking like when you know the reason I bring that up It's because like well even in the views you should have a delete button like there should be removed from view and Delete and those are different things Yeah, they're just not on the UI right now. No, it's not. No. But that like underlaying way that...

It is actually in the UI.

Is it? But is it working right?

I wanted to say I discovered something Where you can hide,Nodes or something? We cannot delete them?

But it was very like... Uh...

It wasn't obvious of how to get them back. Yeah. If that makes sense.

It's not. So that's an area that we have to... Probably discuss and think about a little bit and it's been mentioned but it's really not on the issues yet and that's yeah, that's not the the That's like the user experience of the path manager, What we have is capable, and it'd be great for a power user, but it's really, really difficult to know what to do. Um...

I mean, all these things are cool. Like, I'm pretty just focused on, like...

What our current app is for getting a good working production Example out.

for Nigel. That Nigel was on for, yeah.

Right. And then add off of that. It's really just like...

scope creep on this oh my goodness yeah oh my goodness So on Sunday, Monday, I did a lot of stuff, but I don't think it was very noticeable.

It was like a very subtle thing because I didn't want to completely change how the UI looks completely. Without people's approvals and stuff?

Nigel was like, holy crap.

That helps a lot, yeah. Okay, so...

Did you fix those direction things where when we-Did this like, what was it with, uh, crap. Why isn't... I thought a right click did this. What happened?

I'm right clickingIs it right? Right, hit the--Shift click.

No, it's command click. No. Oh.

I wonder if it doesn't work when you're selecting with an area like that. Try just selecting those points with holding. Oh, interesting.

Now hit shift click or not shift click. Yeah.

Oh, wow. That's bring up the menu.

Oh, that's interesting. Okay, so we probably should create an issue for that.

I've got--Yeah, also if there is--We can do that after. This thing.

If you are, I would say we need to update this arrange group thing if you've changed the range. Algorithms are. options. It should be the same as that button.

because I don't want it to affect them. Because if you do it, whatever you do. So the way I did it is whatever you do manually creates like a little thumbprint. And it's like the user did this. And if the user did it, we don't overwrite it unless the user overwrites it with something. We don't allow these buttons to overwrite it. And that could be a decision we change later. We just want to draw a line in the sand.

That's fine.

So dark mode, I made the graph background like a little bitLighter.

Okay. It was super dark. You'll notice it's a little bit lighter than the rest of the app. So it's just like, it's not like super dark.

I feel like it reads... Dark mode I didn't work on as much because it looks pretty good already.

You'll see some like the table might look better a little bit.

And like mousing over like the sidebar menu stuff might look better. Yeah.

These are short for some reason. I don't know, oh, that looks nice. These are short.

Oh, the background.

So they're not supposed to have a background on them.

That's one thing I need to fix. If you go to switch to light mode and you'll see what I'm talking about.

Yeah, that's right.

Yes. See how it's in the background? I did change the styles on the table. More for light mode to make it-A little bit more.

I don't know. Not as white. Everything's still pretty bright, but I tried to tone some stuff down.

And if you click on the types, you'll notice like the, Go back to the-that might work too. But yeah, click on one of those. So you'll see how it's wide now. And it's not super tiny.

Yeah. Yeah, so we added like...

I added a prop on there that lets you set a width. if you don't want it to take the full screen or the full container.

Right, because it was colliding with another-Well, it was trying to take the full width of that column, that type column.

So...

where we were fighting with this one That one's good.

Yeah, it was, we were fighting with when you add a point. Okay. Yeah, add.

Yeah, so, you've done that. So that one wants to take up the full width, and so I couldn't set a physical width on it.

I fixed it, so obviously it's working now. Also, if you look at the graph view, you'll notice the background's not bright white anymore. I kind of like honed it down. I very slighted it. I made it like a... It's a very, very light gray instead of being like a super bright white. Yeah, that's right. Perfect. It's not a lot, but I think it makes it... Yeah, yeah.

It's really coming together type... Type thing. The one thing I'm thinking about is this color here that you have here, I think that needs to be in this top two of our two. I made those two light blue, And that looks a little out of place. Whereas what you have kind of matches the logo more. And I need to...

I see what you're saying.

Um, I kind of took those, that color is usually like an action button color. And so I kind of left it like that because it, It didn't look horrible, but... Yeah.

It's not high priority either way.

I also changed a bunch of like, so if you mouse over on the sidebar on theI changed the mouse over color on some of that. Go down to help about an admin down there.

Yeah, yeah.

I tweaked that. It just wasn't showing up almost at all. It was like a super, super faint... background and now it shows up a little enough where you can see it. Yeah. Yeah. Yeah, I A lot of little tweaks like that. I didn't want to go full, like, change the... Like, the light game could be a lot more maybe powerful or not. I don't know. It might be fine how it is, but... Instead of having a white sidebar, we could actually choose a darker color that would bring the brightness down of looking at the entire page.

Yeah. I don't think that's super important at the moment though. If you get what I'm saying.

Yeah. Yeah. OK, so a couple things.

Can we remove this whole thing from dropdown, do you think, now? And put a little toddler, you know, because I...

Or like dark boats?

No, just-I was just looking at this dropdown here in general. And since it's already been cleaned-it's gotten cleaned up, it's like there's not much-This is like a toggle pretty much. Right.

Sign out and just be...

Still, that could be the only thing in the dropdown really.

Then settings can be done by the admin.

I was going to say settings and sign out can be down where admin is.

Oh, yeah, sign out too. Yeah, totally.

And then light mode, dark mode, system would all be in one line with a toggle.

Yes, yeah.

With the icon toggle. Because it's the little berry. Yeah, I think it'd be better to and then get rid of that whole drop down.

Just so you know, it wasn't me. It was Claude Codd that did that. So if we're pointing fingers, we're code dead.

It's not horrible. I'm trying to build off what was already built.

So, okay.

So a couple of things that I've noticed that might be that top bar that was at the toolbar for the graph.

This?

Yeah. On the left side of it?

There is a handle?

Yeah, yeah, yeah.

We used to have users...

I don't know what that's supposed to do, but it needs to go. Yeah, we need to... If it's not going to do anything.

At one point, we allowed users to open up multiple views at one point, at one time. Okay. Like side-by-side, top-to-bottom, and all that stuff. And then... We... abandon it to focus on other things. So, I don't know if it'll ever come back, but I think, yeah, getting rid of that handle there would be a really good idea and talking about it like so I'll create an issue in GitHub for that to track it And then...

I'll send it your way so that we can keep things going with that.

Okay. The other thing is the... Ah. On the other side of that bar, there's an expand or collapse button.

Yeah, that's also part of it.

And it doesn't really help because you're-opening multiple views anymore, so So it's in the same realm of it going– it probably just goes away.

We do have a button on the navigator. Well, that works on the Navigator if you look at it.

Yeah, that's nice on the Navigator because that makes sense.

That makes sense.

You get a full screen Navigator, yeah.

Okay, so I wasn't sure with that feature. I wasn't sure if you wanted to remove it or... or fix it or do something else with it. But I think right now it's probably best to remove those icons to not cause user confusion.

Yeah, yeah, yeah. And that'll probably be something, if we bring that back, we'll feature flag it in. We'll test it, we'll put all those buttons behind a feature flag and do things that way. I'm almost thinking this X needs to go away too. Because I don't really need... What is...

The use of the link workspace. Right. I don't know. Right.

There's nothing you're going to see by getting rid of that because there's no like... If you have like a home page here, yeah or a dashboard, yeah exactly. Yeah, right Yeah That would make more sense, but you don't.

So, yeah, I can see where we probably get rid of... Probably get rid of that.

Molly, this is an interesting...

You fixed the issue where it was applying on load, right? I'm pretty sure you did.

Where it was applying on load?

Yeah, it was applying the layout on load. Yeah, yeah, yeah, I got that.

Yeah, that wasn't– I haven't opened that one. That view sends the fix.

That was the first time I had opened that system's languages view. Nice.

Oh, yeah. That's why it was all in the square.

Yeah, yeah.

Weird grid layout, yeah. Um, Okay, so I think we're looking really good. The list is like... A lot of clothes still.

Oh, yeah.

This is what I'm going to show you.

I would say,What?

I'm going to show you the point and path manager. Because... Okay. You do like oh, it's just this is where you can hide the freaking hide in the points, but it's not super intuitive and It requires somebody who thinks with The expertise that you have to be able to... This is like difficult. Like I don't know...

I even touched this because I didn't know what we wanted to go with on this. Like I don't know what the direction was. I don't know the advantage of hiding. Show all, hide all are important.

Yeah, so that's how you make views. So you'd make different views and then you would show and hide points depending on what you want. Like the HR org structure with people and who they report to. And then there's like maybe your technology one is different. When you think of your company as a whole, Like, you know, the customer base is different, right? And there are companies using this. Masterworks uses it.

He's got a number of companies using it. So there's data that we're starting to see and kind of how they build it out. And they're building things out very much in like a composable way on the left side. So the workspace, the views in there are specific views. They're never an all day to view. There's always something very specific And they use the show and hide of the point path manager to be able to make them specific.

So it's like, oh, I just want the functional programming languages in this new view called functional programming. Okay. So that's kind of the gist of it as a whole. So all high dollar useful. showing and hiding paths is becoming something that's like next level And we should just talk about that later. So just like focus on points. When you think of like, you know, 395 points, like how do we... That's why there's a search here and like there's types and like it's like how do we...

How do we make this easy?

I would assume we're hiding paths that are connected to points like it. Yes, yes, most definitely.

And also... Just not to get too far into the nuance, but with a path, we can't show a path unless both those points are shown. We don't show a path that's connected to nowhere. Right, makes sense.

So there's like just some logic to that one that's kind of additional.

But this is like a whole area that we would get a lot of value out of putting some time into because it's critical to how this whole system tied together.

Yeah.

I'm trying to think of how to make it. Better. It's just kind of like a tedious thing. It's...

Yeah, and honestly, one thing that would be nice is, and maybe it's just, A UI thing of making it more visible from here. Like, can I chat with this? Because you can chat with views, you can do show hide, all that stuff's available to the SCP. So when it gets tedious, how do we make it easy for somebody to do it from... Typing.

Yeah. Right? And then...

Go ahead. People can, Select a bunch of stuff now, I think, and create a new view with it as well.

Yes, yes, they totally can. If it's there, right? If it's not in a view that they can grab it, so then that point path manager becomes pretty essential.

But yeah, if they're like starting from the all data view, the soup view, the kitchen sink view, they can, you know, splice out the plumbing and the porcelain and the toothbrushes. I don't know, you know, like just kind of like, you know, section things off from the sink. I can't. Um, Uh... So that's like an area that we... There may be like some hints of some of this stuff in the The force ranked list.

But, and there's like a stopping point here. This line right here. So we're just going to 24 right now. So that's kind of our sprint for the next couple weeks, really. I would say this is... Maybe a week. I don't know. I don't know. I don't know what your schedule's like. Actually, maybe it's less than that because a lot of these are closed. I'm trying to think if any of those are like the path managers that are big.

These look pretty small, to be honest. I think this one's... Maybe not. Um... Yeah, they should be pretty quick. So they should be like maybe a, I don't see like probably less than a week with the two of us on them. Um... But we can take our time a little bit with these because the things below it aren't important. And then if we take our time, maybe we start to piece apart like the Where'd it go? So, um, that's, uh, the point path manager, maybe, you know, like we start to like, Hey, what do we want to do?

What do we want to suggest to Nigel is more like, you know, what do we want to show him is capable? And if we're confident in it, let's just do it. If we're not confident in the decision, let's surface it to him, like as kind of like the product decision. and figure out what he wants to do and then You know, get him to prioritize it.

We could do something where if youOr we could just have a, I'll button that. shows connected Points. Like, I want to hide this one point, and then there's a button that shows show connected points. And then you can hide those connected points, maybe, if that matters.

I almost like to be honest, we almost need to jam with Nigel.

because Yeah, I'm okay.

Yeah, exactly. Yeah. So maybe we should do a little bit and then loop him in on this one because it's kind of a big one.

Yeah, yeah, I agree with that. So, um... Okay, so get rid of the grab thing. Get rid of the... expand button Oh yeah. The drop down menu items.

So let me go really quick. Hang on one second. Let me just take this. And this should take care of all of our to-do items. It'll summarize them and then I'll create GitHub issues with my