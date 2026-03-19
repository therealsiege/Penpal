# @November 21, 2025

Summary

### Project Status and Development Tasks

- Discussed necessary updates to the landing page, including fixing the logo, navigation bar, and ensuring mobile responsiveness.
- Identified issues with redirects and URL handling in the preview environment that need to be addressed.
- Discussed using AI tools to assist with development tasks and design work.
- Examined session refresh logic that needs implementation.
- Admin area functionality needs work as it's not fully tied in.

### Card Editor Design and UX

- Reviewed competitor sites (Minted, Postable) for inspiration on card editor interfaces.
- Decided to implement a modal for card details rather than a separate page to improve user experience.
- Discussed hover functionality for card previews ("quick view") similar to competitor sites.
- Discussed whether to allow users to modify designs or keep them as fixed templates.
- Considered implementation of image uploading for cards.

### Charity Selection Feature

- Developed a plan to implement customer selection of charities.
- Created 10 categories with 6 charities in each category in CSV format.
- Discussed backend implementation for charity management.

### Timeline and Deployment

- Identified urgent timeline constraints: holiday card orders peak during the week of Thanksgiving and the week after.
- Need to go live within the next 5 days to capture the holiday card ordering window.
- Discussed versioning approach, with version 1.0 being the initial release and version 1.5 targeted for the following Wednesday.

### Pricing and Competition

- Analyzed competitor pricing (especially Postable) to position their product competitively.
- Determined they can charge less than Postable while maintaining good margins.
- Identified Postable customers as their primary target audience rather than Minted or Shutterfly customers.

### Technology and Tools

- Discussed Playwright and Cypress for frontend testing.
- Examined how AI tools are changing the development workflow and design process.
- Reviewed account access needs for various services (ShipStation, Cloudflare, Neon, etc.).

### Action Items

- [ ]  Fix logo, nav bar, and make landing page responsive for mobile.
- [ ]  Fix redirect issues with the preview environment.
- [ ]  Implement modal for card details instead of a separate page.
- [ ]  Implement charity selection feature using the prepared CSV data.
- [ ]  Add session refresh logic.
- [ ]  Provide collaborator access to services (Cloudflare, ShipStation, etc.).
- [ ]  Deploy the site within 5 days to capture the holiday card ordering window.

Notes

Transcript

Okay, so I'll fix the logo and the nav bar. I actually need to do that whole landing page area, so I'll just I'll take a note of that. That's exactly what I'm gonna have AI do it and see how close it gets, and then I'll just double check things. Give AI that old layout and say, hey, make sure that this fits on mobile, this works on mobile, make sure it's responsive.

Yep, exactly, no problem. And I guess it will fix a couple things and then the rest of it will be fine. I still have some work to do on this. This isn't gonna work because we did the it's not tied fully into the admin

I thought I asked AI to do it, but I don't think I did it. It's kind of one of those things where it doesn't always behave. It hears you talking. Yeah, this one, yeah, we're talking crap about Claude Code, not you. You're doing a great job, Notion AI.

Notion is pretty awesome. Dang, it's still using the wrong link. So what really trips up Cloud Code, and it keeps reverting back to this, is the preview domain stuff. Oh, actually, that should have been fixed with this deployment. Did that deployment not go through?

Production preview 34 minutes ago. Yeah, so that should have

Let's see.

We're going to talk about it for a minute. We put it in plan mode because sometimes just zero shot it, it doesn't do a great job. Plan mode allows me to go back and forth on with it and I can have it ask me questions, etc.

I did redeploy the preview branch, right?

Okay, so maybe I need to refresh. So, dev, go back, refresh.

So it's not graphing, which is like an old one altogether.

Okay, just gonna give it a little bit more direction. Okay, so that's going. So I got to fix that so that the redirect works properly. I already know that this isn't going to work right. This is what you would give a junior engineer to go do. It totally is. And they would be working on this for the next two or three hours. Exactly. Exactly. I'd be like, look at the URL. These are the problems with it.

Why? Like, what did you, you know, check Vercel, check, you know, because it should be pulling from Vercel.

Let's see what it says. So then he's going to go and he's going to do some looking. He's going to say, oh wait, what next dot generates the magic using the URL environment which is set to the wrong value in Brazil preview environment. Are you sure? So if I go into First Cell, and then I go into the app, and I go to Settings, and I go to Environment Variables...

Oh, it's right. Oh, it's right. Development. Is it there for development?

I guess you were right, Claude Code. I guess you were right. Good job, Claude Code. Good job. We're just going to go ahead and do that.

I didn't expect to see that.

Okay, let's redeploy preview.

I feel like I was talking to somebody while I was doing this. I don't know what I was talking to when I was doing this, like splitting these up. I was doing this today. I closed that laptop at 1.30. I was like, I'm so done. The product guy asked me, I'm not even going to let them record, the product guy asked me is like, is there a retrospective on the past, like, you know, on this whole thing? Like, you know, is there going to be accountability?

Because he didn't get invited to the, I told you a little bit about the drama there. And so I've gotten out of all the meetings. So I've used that drama, because it got rose up. To like higher levels and I and I use that drama to To get myself out of meetings that really don't apply to me But but I also had to be strategic about that because I told my new boss I was like well

These meetings, I feel like I'm distracting the team from the business priorities. Like my priority is priority three and y'all have priority one, two, and three that you're dealing with, but you guys are having to deal with one and two all the time. So if I chime up at all about priority three, I'm distracting you guys.

And I don't know what to do about that. He's like, I don't know what to do. What should we do about that? And I was like, I think I should just be optional in these meetings. Like, there's like 20 hours of meetings now, because he just loves to get on in his radio voice and do it in full scrum.

All the ceremonies and retrospectives are useless because he only wants to hear the good stuff. And so this other guy in retrospect is all about the bad stuff, right? Right, but he wants to keep things really clean and there's it's all about shoving crap under the rug and blaming other teams That's the culture there

And so when he tried to pit me, I was like, you're trying to pit me because you told me not to talk to product or answer the phone. You told me not to. And then you're trying to pit me because they complained to your boss that I was not responsive. That's not fair to me. That's like, that's, you, that call and all that stuff that happened behind the scenes where it blew up on you and you went to lunch, that was on, that's on you. That's not on me. And the product guy, he also even did the thing you're supposed to do because he got in trouble for calling me before.

He's not supposed to talk to single contributors or whatever. So part of this is, like, the architect didn't do documentation, so the auth has been all jacked up between us and Epic, and, like, they didn't listen. You know, they're thinking Athena, and this is Epic.

Very different. And then this other guy, Chris, K-R-Y-Z, he's from Poland. He's got a... Yeah, but we call him Chris, just because he's here. But he has made like so many mistakes when he did the auth. I was like, okay, they used JWKS sets. There's these key sets, and then you go get the JWK from there, and it can be updated and stuff on their side.

So just in case there's a security breach, they have this place where they can put it. And they're like, well, it's not a PEM file. And it's like, no, it's not a PEM file. This is how it works. So they're like, well, that's not how Athena works. Well, it's like, no shit. You're not going to get them to do what Athena does as Epic. They will not care.

They just won't do business with us. They don't care. And so having to go through there. But he built the thing. So we got on another call with Epic Vendor Services, which is $380 an hour that they build to us plus our engineers on there. So I'm on there Yeah, I'm on there I'm $13,000 a month For them and I'm not full-time Their chief architect or the principal architects on there Michael who likes to hide things on the road the engineering manager on there Brian who likes to hide things under the rug and two of the engineers on the team on there that are full-time engineers

They're probably 150 grand a year engineers. They're not like superstars or anything like that, but they're in healthcare. They're getting paid. And so we go through this hour-long meeting, and pretty much at the end of the meeting, the conclusion was Chris chose a library, a Node library.

That wasn't compatible with jwks's and so he has to go back to the drawing board pick a new library Which he did in a couple of days that were pretty quick But it was like after months of getting them to focus and getting all this stuff in December. I

So, the reason why I'm technically, I'm not exactly an employee with, I'm in a risk-bearing entity. So, I'm kind of an employee, but just so that they can say I'm their dedicated Epic developer. So that they can check that box because it has to be onshore and most of their development resources are in India. Yeah, so there's like some kind of things there, but I work in like kind of a different manner Yeah, but they've been kind of trying to push me into this like you're an employee box.

I'm like Not gonna happen. Like, I'm gonna walk so fast. Like, you're not even half my income. I'm gonna walk so fast. It's been, so December, the chief architect, Sean, which is a really nice guy, I was reporting to basically his counterpart, and that person left.

But I was brought in and I got all my stuff done within a couple of months. And two months or so. Yeah, two months. I got there in August. A couple months. Got it all stood up. Tested everything. And then I used Cloud Code. Conditions or suspect conditions and they want to present them in front of the physician Because they're like hey the AI model or whatever it's seen This is like this geriatric patient probably has this you can probably bill for it check them for this Right, and so they get better care The doctor gets paid better the only people who probably lose I've been thinking about especially after our discussion when you when you're walking on the stairs about everyone else Yeah

How are we stealing from the future and stuff right is like who else who's actually paying for that right Yeah, yeah, it's it's taxes, but but also it's like there's health care condition codes and Medicare Medicaid for this It's kind of like it's preventative medicine But also there's like palliative care and other models to try to make make it financially more responsible is one way to say it Right, you know, you could look at it from different lenses maybe But anyways, there's this part

So I use CDS hooks, and in Epic, I basically use it to present cards. It's a way of fire, it's a new thing that came out on the PAMA Act of 2014, but it didn't really catch on because a lot of the EHRs don't fully support it. It's not mandated by CMS until parts of it 2026, and later on 2028.

So it's like now getting traction, right? But it's really cool because you don't have to build a front end. You just respond in JSON. And then the EHR displays all of this stuff right inside its own UI, just as doctors are used to seeing it. And they get to interact with it. They can do service orders. They can order palliative care, home health. They can order medications.

If something comes up and they order a medication and there's a, Generic for it, that is cheaper. It will it will say hey, there's a generic for it. Do you want to use that? Or do you think there's possibly a risk for this patient? Like so there's a lot of really cool things you can do with it This is event driven But then there's this other side, sorry to be verbose, but there's this other side where once the physician does their things It can make another call to my system and that can be the feedback of what the provider did

So the doctor's like, oh, I did this. We ordered these things. I updated the problem list. I updated today's conditions. This is getting sent out in the explanation of benefits. And so we want to update Agilon. And so, I have been trying to work with two endpoints that already exist in Python, but the team doesn't know Python. And they inherited them from a production workforce. They inherited this API. So, they tried to take that as an advantage in December to rewrite it into their JavaScript node stuff.

It's November of the very next year, and I haven't been able to talk to two API endpoints securely. That's like, that's like a huge retrospective, isn't that?

I need this rewritten in Node. That's true, too. That's one thing, but the problem with the way that it was written, it was written, so Athena has an ID issue where each Athena Each client or each Athena installation has duplicative IDs to another one. They don't have a master unique ID system in Athena yet.

So, what the team does is the team does a combo key, a composite key. They put the location, like the facility you could think of. This is facility Thomas House, right? And then they... Yeah, and then they... Exactly. So, they get a unique key out of it for that patient.

Epic ain't doing none of that bullshit. But you can still rewrite all of that. Totally, but that was all they had to do. They just had to give me endpoints, because I can't like force that in forever. So all they had to do was give me endpoints that didn't have to break apart these things and do all this extra stuff and lookups and all these things that they were doing.

And so they're like, we're just gonna rewrite this stuff. We don't know what's going on over here. There's not much documentation either. And so then, you know, come around full circle or a year later, the CEO has been removed. We've gone through another rift or reduction in workforce. And they still don't really know what they're doing. So I just kind of closed the laptop. And I was like, you know, what happens happens.

Like, if there's a paycheck on Friday from them, awesome. I'm not gonna like base my money situation off of them. Yeah, but the there's it's a publicly traded company and there's no accountability. They're actually going to reverse split a stock. So that's going to pull some of the stocks that are open. It's going to help some they're doing some things. They've cut a bunch of customers that.

We're losing like losing money because they're just too risky, you know, they're doing this preventative medicine medicine approach and they're they're unique about it because they're creating a risk-bearing entity business a Partnership with each of those customers with each health care system

And that's nice because it's a healthcare system, not an individual hospital, but they're taking, and year zero, this is the big kicker, year zero, Agilent fronts all the bills. So like 20 million dollars up front Agilent puts forward to get them on board, get the data flowing, get all this stuff going so that year one they can start collecting money and start doing this together.

With the high utilization, with COVID, with all these things, they've been like backwards for like five years. It's healthcare. It's healthcare. IT. You know, I jumped in and then I jumped out pretty quickly. Thankfully they have like 20 year contracts. So like a lot of these, a lot of them can't back out. But if they could, we get on calls.

And these hospitals and physicians are so pissed. They're so pissed that they have to do anything with this. And so my whole goal, and that's why I did the CDS approach. When I got brought in to solve the problem, I was like, oh, this needs to be CDS-ed.

So I was like, and actually, Marcus was the person I was dealing with originally. And then Marcus got fired like two months ago. And then my boss left because he was like, I'm not dealing with this shit. And so Marcus applied for that job. Marcus didn't get fired. Marcus got let go. Marcus was like a 10 year employee. He got a massive severance.

This is how stupid they are. And then he applied for Patrick's job, got Patrick's job in product, and so Marcus and I are back working together. It's so crazy. So they paid him, so they stressed him the fuck out, because they have firemen. I get not lucky.

Why do I get stuck with the asshole boss that isn't going to fire me? He fired one of my counterparts. I wonder if he would if he didn't get bit in the last thing. If that last one, that HR issue, that, um, that he knows it's the second time around, maybe he got a pretty serious warning, a good heart to heart, you know,

And potentially more an opportunity cost, like that person would have stayed, you know, the impact, you know, right? Like there's probably like opportunity costs and other stuff even, right? That was just a lawsuit, right?

When you get that pull forward investing, that's gold. Four years of equity that someone gets pulled forward. Wild. Wild. I'm like, I still talk to her, I'm like, you got lucky. Like, why can't I get your luck? She got lucky, but she potentially could have gotten more if she'd asked for more.

oh yeah well they try to give her like 11 weeks it's just like no yeah

I had this weird thought like so when I first moved down here I was driving a 2014 Grand Cherokee

And I got rear-ended at that yield sign. There was a car in front of me and I got rear-ended so bad. I hit the car in front of me and I got rear-ended by a Vanderbilt surgeon. In a BMW 635 or a 6 series, you want a pretty heavy car. Convertible down, his granola bar went all over the dashboard. It was wild. And my back was kind of feeling like a little shitty, but I had been going through PT for...

Golf like golf damage to it for like playing when I was injured and stuff in college like just kind of like repetitive So I was like, oh, I don't know what this is But like to this day, I'm always thinking like I could have gotten money out of that like

I lost a ton of money because my car, I got my car fixed and then it wouldn't start. And so I went and sold, I wanted to sell my car, so I was like, well, I don't feel right selling this car. So I took it to the BMW dealership and I was like, because more of my friends were like, you need to get the 3 Series.

They're like the best cars ever. And I rode in his 3 Series like, oh, this is awesome. So I was like, I got to get one of these. So I found a 320i with a manual, which is 186 horsepower. And I was like, I got to go drive this thing. Cause I can go so fast and not get in trouble. You know, we just go through all the gears, you know. And it was my favorite. It's been my favorite car ever. But- I had a 328 convertible.

Hard top convertible. It was that year that they had that hard top convertible. Did it have the paddle shifters yet? Or, oh, that's cool. That's been my, I still talk to people about like, that was still my favorite car. The balance of those cars and everything, like, I think that's on like the E36 chassis maybe.

I don't remember, but that was my favorite. Yeah, I love those. So, but anyways, I go there and I was like, hey, I just told him, I was like, I got hit, it's on the thing. It's not reliable for me anymore, but I don't want to sell it to somebody and it'd be a family and Them to get stranded somewhere like that I just want you to know that this is the way it is and you guys have the Technicians and all that stuff. So like I end up losing like 7 grand on it.

You know, so but going back and forth that I know he was like snickering at me like it was no big deal Like, you know insurance no big deal. You know, I'm just like I was like man. I'm losing money like I knew I was going to lose money, I was like, man, it's like, you know, thinking about it. And if I would have like, just been like, Oh, my back, my back or something, you know, or anything, like I probably could have gotten like serious cash.

I don't know how I feel about that now, too. It's like, which... I sleep great. I probably would sleep good with it, too.

And so there I think people, while it shouldn't be this way, you get in this place where it's easier. for us to make ethical decisions.

yeah because of the genetic lottery right like you know you know in a way yeah and so because it's easier for us to make ethical decisions and so like we should I believe I have

And also time too because like a lot of times we don't have to make a decision about something right now with pressure Right like and so and then you keep you know, keep planning things and keep like, you know Investments in time money all those things like and it turns into

My approach will always be, as long as I'm in a position, my approach will be.

Do the right thing like what is the right thing? What is the fair thing? Yeah Yeah, it was just so weird him like smirking and really expected me That's why I think going back, he's probably thinking about me like, man, that guy maybe doesn't know or what not, but man, that guy could have got me or got my insurance.

Okay, this stuff. I need to fix this redirect. I thought I got that squared away. Let's see if that got squared away. Well, it should have.

Oh, yeah, that was my fault. Yeah, we figured that out. That was my fault. That's deployed. Let's go ahead and we'll just do it like that.

This has been a curse and a blessing because I love it, but now I can't use it. It's like all sorts of wildness.

We can design these however you'd like to. AI did that. On the backend stuff, I could care less what it looks like. Okay, cool. I'm just going to let AI do it quickly and make it look good by best practices. And then we'll just dial in whatever we want to dial in.

I got those things. I'll take care of those.

I talked to it about, what did I?

Okay, let's just let's go through the flow. Let's see what it let's see how it does real quick

For the most part, it understands me, but I've definitely gotten more caveman as I use AI. This is a magic question. Ask questions when needed. That's a magical one. It is, yeah. Yeah, well that's why I said that because you said when and I was like I should put when in there but I'm so lazy I'm not even going to change it and I know it's going to work still. It's a magical phrase. It is, yeah. I was like, help me write a better prompt for this, here's what I'm trying to do.

Yes, yes, yes, use it, use it, yes. It's like Inception. In a way, you know that? Yeah, I've never seen the movie, but I've just seen the memes. It makes me think, like, that's kind of what I want to do with ChatGDP, and partly what I'm going to eventually do with Graphite Atlas is, I want to really control the context window.

And there's these sub-context windows that I want to be able to generate. So I want to be able to have links. It's almost like having ChatGTP or Claude chat. And then you chat with it, and then you're like, Oh, double-click on... I know, I hate when people say that.

Double-click on this, and then it'll be like, Okay, here's the new context window. Here's the summary from the old one that I'm going to give it. And then you can edit it. And here's the new stuff that... How do you want me to... Dive in on this part of it and so you could but then you could like traverse back to the other ones And but it's all about like the context window, which it's like human, right? And so, you know, it's a conversation and they're just

I want a tool that can do that and there's nobody doing that yet.

Oops, not to yet. Let's go.

We're just gonna see how it does with pretty much a zero shot here.

Coding is changing so much. You know, like, this is, this is it now, right here. Yeah, maybe I need to shift careers here. It's just kind of fun.

So maybe just ask it, what is the session timeout? Okay, yeah.

It's mainly an admin area because the session doesn't really exist when you're building when you're there isn't a session but there kind of is but it's not like a session It's not a session that can expire in that way. It's just some state.

This one's a real bug. These are so easy to do, these things.

Yeah, so I think I messaged you about that. I don't know if I checked for a reply. I'm sorry. Is it okay if I just generate it for you from the card? So it'll basically look like a little bit of a like a little piece of the card.

Right, because the template, the design map, doesn't include a photo.

Oh, so I was gonna Oh, I see. So I could do Jerry, but I was gonna do without a photo. And you see the placeholder. But

Oh, these are more on the front end. Okay, gotcha. Okay, I was just thinking it's for the admin area, but I see this for the front end. Okay, totally makes sense. So you want full control. Okay, okay. No problem. That's just a feature. Is that number five period?

Actually, maybe do it on the, as an admin.

Okay, so we need a, we need to add an image, a thumbnail image, add an image, and a sample image.

And a sample that the admin will upload.

Okay, um... Ask...

I probably have to do it. I don't think I can do it.

I don't know that you actually need it. There's additional functionality to add later on, but I was going to say it'd be a 2026 feature to add, so it might be...

Isn't this a crazy workflow, like product engineering workflow? There's a Notion AI thing going in the background that's going to give us to-dos, give us summaries. It's like we're working with an engineering team right now. It's just so weird how this has gotten... We're about to tackle six different things. Some features, some bug things. I don't know how it's totally going to work out. We're going to see.

We've given it images because it can read images, and then we've got to say, okay, make sure to, make sure...

Playwright. Oh boy. Playwright is amazing. So playwright is like A.I.s. Oh, well, okay, so... Maybe hit this real quick. Okay, so let it start working. Yes. Okay. Have you heard of Cypress?

Oh, sorry. So Cypress is a behavioral testing tool, like an acceptance testing tool, that's built on Selenium and CodeCeption. Selenium and CodeCeption were 15-20 years ago, when I first started my career. And so you were able to write these tests that would open up a browser, and they would test your front-end UI.

So the best front-end developers were doing that stuff. And so I was like seeing the coolest dudes. It has been edited to include proper punctuation. Firefox, which is super popular, right? So that was super nice, but and so and then and they did okay and then Cypress came along maybe in like 2010 area

And Cypress was really nice because it brought a lot of stability to the fragility. And so Cypress, you could pretty much get almost, you could at least write smoke tests. You can pretty much do end-to-end testing. And then also have it run in your CICD workflow. So you could make a pull request in, or somebody could make a pull request in the main and approve it, or before it's even approved.

Your Jenkins and those days are your Bitbucket or your because they have workflows or your GitHub would run it's CICD and it would run those before and see if it would pass. And so basically spooling up a server pointing to your development API or whatever that API was, could be future branch, and it would run through these tests. You'd see a window. It'd be like clicking around and doing stuff and it would, you know, it'd be active.

You'd be doing, you know, the active assertions, right? So you can do tests, full test driven development from the front end using the browser and this like automated tool. And it was like, it's grown over the years. Playwright has gotten so advanced.

And AI is really cool, so maybe it's not as powerful as it was a couple years ago, but before Chats.dp, Playwright existed. And so there's this few years where Playwright had this thing in the market that nobody had where you could click around in the browser and it would generate the test for you.

And so in the console area you would have this test and you'd go and dump it into a file and then you'd say okay Okay, I want this to run on CICD as well And so you'd have your product guys, your QA guys, your UAT guys going in there just using the app like they normally would and they'd be giving you snippets of like, hey, this is my test, this should break, this is what I should see, this, you know, and you just dump it in there and it's now your acceptance criteria goes from being just in a Jira card to being in a live verifiable

And so that was like game-changer and now with the fact that This can read images and stuff I can give it playwright, and I can say, use playwright to iterate. Use playwright to validate yourself. If it doesn't work with playwright, don't talk to me. You know, like, right? Like, you know, and so it'll think longer, and it'll do, you know, right?

It definitely costs more in tokens, but it's pretty good. Okay, wow. Okay, cool. So I usually take these and I go like this Yeah, like such a awesome

Okay, cool. Should admins upload a separate... I think we should, right? Yes. Yes.

For the expected use cases, explain. One's going to go to a gallery. Oh, we're sorry. Oh, yeah.

When the user clicks on a card to see the card details, that's a really good question. So it's amazing that AI asked that question. So as a user what would you think? Would you want, you're looking at a gallery of 20 potential card designs, would you want to click on that card and it have a modal show up with a much more detailed picture? Do I like this card?

I think that's the answer, yes. And then when it's like, yes, I like this card, go in there and it goes straight to the editor, which now no longer has it in the photo. For a first time user, yeah. If you're a returning user, you may want another button in there that, like, what if we hover over, we can do both, right? So if you click on it, on the main part, right, that box becomes the box that shows the details. But then there's, yeah, a little one in there that says, start with this design.

And if somebody already knows that that's the design they want... Yeah, I'm speaking to the same thing They would just go right into the end of the editor to the basically this is step two, right? Because they've already selected their design. Yep. Now they're in step. We're only instilling an extra click in a worst-case scenario.

It's only an extra click If they want it. Yeah, if they want it. They don't have to do it. If they want it. If they already use the site and they see that button there, they might just do that. What's that about if they've used the site? It says they're clicking through...

Go to Minty. I haven't been meant to do it.

Do we have it on ours? I think we have it on ours.

So this is the page we're talking about, right? So if you click on this, you get details, right? And you can start from here. Customize this card. I don't think we need to add to cart here, but now what we could do here is go straight to the editor at that point. Yeah, what if you hit customize card and then you go right to the editor?

Resolutions that if you click on it, I think bring up a modal instead of a page instead of a page save a page load Let me I'll take a picture of that, just so I can make that easy. Okay, so this right here will go to a modal instead of a page. Same information though. That one in the page...

You know, I know we've got different things, but you know, like, that's pretty much, you know, blah, blah, you know, like, it's a little sales type thing. Because I think we can skip that altogether. We don't need that sales page. We don't, but if it... I'm just saying, you know, because if we do the... I'm sorry, I should rephrase this. I didn't say this part. My brain is thinking what can I use of this content for the mobile.

And so I think like some of this goes away, but like the features, maybe that's still useful, the prices may be still useful. That's not the price. Right. But like, you know, maybe there's some useful content here. Or should it just be this right here? I think just the more detailed picture of the photo. Okay, so just that? Okay, I got you. They want to be able to see a little closer, like, do I like this design or not? The problem you're solving for is, do I like this design or not?

Okay. Let me set AI up for that too.

Minted does it because they do it with They're trying just to put in a bunch of extra job. They have their artists. They're trying to give. Oh, yeah They're trying to give credit to their artists Which is like, I am so, I favor like the minimalist, especially with this stuff. I am so surprised that both Minted and all of the ones I've seen, they've gotten so cluttered.

Like that's on the loud thing That's so weird. Check out one more website. I want to show you one more Because I just There's one other company that has a really, really clean, simple interface.

So one, you can start with or go to go to the holiday cards. Let's go over there first.

Just click into any one. Start to edit. I like that. So, yeah, they're doing more holidays. Oh, actually, go back. Go back. There we go. That's what we need to do. Hold over quick view. That is what I'm solving for.

This is a higher resolution.

Yes, they can. They do software UI. Let me... Okay. Okay. Ooh, that's gold. That's gold. Alright, cool. So now actually click into one of them. I'm going to just walk you through this. Right here? Yep. I don't love this. This screen is not necessary. But then you go to customize card and then the rest of it is...

It's nice that I didn't have to log in. Exactly. And it is so clean. Oh yeah, images. Okay. Okay, cool. Yeah.

Oh, that's this. Okay, I got you. Why? That's messed up. Doesn't that feel like that should be landscape and you should be, and the photo should still like, right? Some of their designs aren't great. Do they not? I wonder if they don't do landscape. Do they? Oh, they do. Okay, so this just doesn't match it. Come on, Vivian.

So, and that's also an interesting thing. So, where, so, this is, they have a marketplace type of a thing.

I don't know how to see how many I have.

That's what I like. I like because that's the right way to do that part. There's definitely stuff I don't like about this. That, you know, and I'm just mean, but... I like that they're not overwhelming you with... Exactly. But their whole website is that way. They have a good product manager there. Okay. I don't know who it is, but they have a good product manager. If you go and click through the editing of cards, just click through.

Okay. You can upload one of my photos.

Pick one with just one picture. You see, they start off with a starter image. Oh, yeah, yeah.

It's a cool thing that they'll try to put on my list for 2026.

There, look though. It's three layers, yeah. Yeah, there's. They've done that with a couple cards. There's like a masking or something happening. They've done that with several other designs. It's really cool.

I don't know how. I don't know how either. Yeah, okay, that, okay. But it's not a, that's not MVP. No, I, yeah, I just, I, now I'm, yeah. But you said there's nothing else on the screen. It is so simple and done editing up more photos. We don't what is this? Oh, just a zoom in. Okay, great Flip, okay, great color

This is a voice memo that includes proper punctuation. It has been edited to include proper punctuation.

Can I change font here? No, I can't change the font. But that's the thing. That's the thing. You don't need to. People don't care. It's pre-designed. It's part of the design. Yeah, that's true.

And then we already do this type of thing. Which is very similar.

And then just send it to me in a box. So that's the cool thing, that would be another 26 feature. That is cool, yes. We can do this. So we're always going to do this for now. Yeah.

I think there's a guest option. Oh, good. Okay.

It doesn't tell you how much. That is interesting, yeah. It won't tell you how much.

Oh, I was waiting for it to load. I was like, wait, I thought I was supposed to do something.

So, do the math on 860-2, slide it by.

That's not that crazy. That's about the same as the competition was with MPEX and stuff, wasn't it? Right. For this type of numbers? Exactly. And what I've already done the pricing at, the cards online, I think, start... Is going after every single one of Postable's customers. At first I thought I was going after Minted customers and Tiny Prints and Shutterfly. I'm like, no, I'm going after Postable because they're used to paying twice as much.

They don't do nearly as much discounting either. They have that big pop-up on the front for like 15% off. But even that isn't going to happen. Yeah, you're still, you know...

Oh, they already gave, wait, wait, wait, dude, look, they already gave us 26% off, so are they gonna allow us to do that? Are they gonna allow us to double the, let's go see, this is where I stopped. Like I wonder, so if I go continue shopping, and then I go. No, no, no, you wanna go to checkout. I need to use this, right? Yeah. And then that thing maybe, and then continue.

How do I... I don't want to...

I'm scared to put the numbers down with But then we won't get that. I want to see it with the discount and see if you could, but there's no way to, you'd think you could put it right here. Even with 20% off, they are still more than I'll be charging. Yeah, yeah, because you're talking double.

Right? Exactly. Plus the non-profit aspect, we haven't even discussed that. I'm going straight after, forget Minted, forget Shutterfly, I'm going straight after their customer next year. I feel like they bought this package. They bought Fletch.

And Fletch built this for them. It's like $5,000. Fletch built it for you. It was the last time I talked to Fletch.

These guys are really good. These guys are super good. Interesting. Yeah, super, super good. Anyway. But it really, that feels like... Their UI was super clean, super simple, and it also made it very easy to use from a phone.

Oh, okay. I wanted to see that, actually.

Yeah, yeah, this is exactly what I'm going for. Yeah, yeah.

So what do you think about, I'm down to like do a little research on this, but what do you think about us not allowing the user to modify? Not the way we really want to go anyways if we're if like they're doing that It's all I want to do the design thing Like where we could make the design more integrated in with the photo

Like, I don't know exactly what they're doing yet, but that's font, that's all, that's freaking cool. I wanna do that. Yeah, that's cool, yeah, yeah. That's really great. Because we're running up against a deadline. All of these. People are starting to order them now. Okay, and they'll continue through about seven days after Thanksgiving. Yeah, and then it falls off a cliff Okay, gotcha. Okay

Next this upcoming week the week of Thanksgiving and the week after Thanksgiving is when all the orders get placed Okay, so like I'm already in that window. Okay, so seems to be a big weekend Okay, so we need to get the card editor done. I can tell it's a big weekend because the companies have already reduced their promotion.

Ah, I see. So we need to go live in the next five days or so? Okay, alright.

So what we're talking about this remove the back tab. Yes

Doing it in Sublime allows me to like not worry about hitting enter and not hitting shift with it or you know.

I would like a playwright test to be ordered.

Okay, now we should have session refresh logic.

Oh, yeah, that's why it's broken. There isn't one. Okay. We're going to reuse this. Yeah, that's good.

You see anything wrong with it? No, all of that looks good.

Isn't that cool? I don't know what type of work I just did there. I guess it's prompt engineering. It is prompt engineering. This work has changed so much since you've... Yeah, I'm taking pictures and I'm just, if I knew this was the end game, it would have been very hard to...

To like wait Because this is like the golden era. This is like this is Legos like this is easy. I can work It still gave a lot of Things that you needed to be able to understand what was happening. Yeah. You couldn't be oblivious to coding and engineering. Right, right. Yeah, most definitely there, but...

I don't have to get my hands dirty, and that's nice. And then the context switching is very easy because I can either have it teach me something or read something for me. Or I can have multiple things going. I can have multiple ones going. And then the other thing that gets really cool, if I'm not working on multiple projects...

And I'm really trying to go fast, is I will, so there's two pieces of technology that come into play really, really, and they work together. They're a must. So this terminal has tmux built in, so I can use tmux and I can use it to get work trees. And what I can do is I can use...

multiple agents, basically, multiple Cloud Code agents. And I can do like clots clod or some different ones, like tools to help me UI manage them, which is nice. But... What I can do is I can give them very specific tasks to do, and then with Playwright, I can have them test them and stuff like that, and then make a PR into Git. So by using the Git work tree in tmox...

They can open their own workspace of the codebase, checked out from Git basically, do their work, and I can have however many I can keep going, right? And so I can have 10, 12 of them I've done before. All doing different tasks, some UI, some back end, some full stack even. But as long as I keep the tasks, it's me thinking in solid principles. I got to keep the tasks very small and testable.

And if I can do that, and I know it won't just spin and take forever, I probably fucked up and I gave it something too much, but if I can do that and give it these little pieces, it's awesome hands. Like it can do stuff super high confidence, and then it comes down to like PR review trainings. And so I'm just like looking at PRs and figuring out, okay should I prove a shot, you know.

It's funny, AI works, so I'm using AI to help design the cards. Yeah, yeah, yeah. Those are plug and play for me. Like, I haven't had one that I've had to modify. And AI isn't quite as far along on that, but the same principles. If I get it really, really specific, get the prompt and the area of where I want it changed really specific,

It does a good job, but what are you using? I'm using Photoshop Photoshop has can you show me how I've never seen that tool before I'm not proficient. I'm not proficient, but I'm able to I use Majorne I was playing with Yeah, like some of these little things like these are Like I iterate so Remy loves. I don't know why but he loves kangaroos It's his favorite animal, like kangaroo

And I got a couple of variant photos of that same baby from Chattanooga, but like the ribbon and the ornament. You're in Photoshop proper right now. This is built into Photoshop. They're chat toys. Let's see if it will...it crashed on my laptop.

that went into it.

Is this table stakes for designers now? Are they all doing this or is there a variation? Otherwise they can't keep up. They can't, yeah, okay, gotcha.

Okay.

Did they acquire this software? Did they build this in-house, do you know? I don't know. It is not as good as Chapstick BT. Oh, really? I've heard they've got... I've heard they've got the bee's knees. When it comes to image generation and the prompts, it feels a year old. Interesting.

Interesting. Okay. Okay. It should do something that stays somewhat within this bound. Gotcha.

I played with Sora yesterday, the other day. Oh, my fortune. Oh, my goodness.

Okay. They'll usually give me three options.

But AI is, within Photoshop, is very much like, give it a very specific task, narrow the focus, and it'll do a good job. I tried originally to do the same thing. I gave it an entire... Yeah.

I gave it the entire canvas and it just was not working and so then I went and narrowed it. Alright, I just want up here and then did a great job. It still went out of its bounds though. Because it went and edited the ornament, which I liked. I thought it did a good job, but I was like, I did not give you the permission to go and edit that, but it went and did it anyway. Are there creative weights that you can adjust in this?

Maybe? I haven't played with it enough.

Oh, this is wild, though.

Can you modify it now? Oh, here. It blended. Oh, okay. So, okay. So it's flattened. It's not interesting, interesting.

Wow, that's a, what a day. What a day to live in. Oh my goodness. But imagine the work it would have taken just to create any one of these. Oh, oh for sure. Oh yeah. And so if you're a graphic designer and you haven't adopted that. You can't iterate as fast, you can't create stuff as fast.

That are like I'm like gonna work with my customer face to face and just boom show them some stuff Take some homework back. Give them the real one. Yeah, you're right. Like it's almost like a different. It's working more bespoke working relationship

That's so wild. Wow. Okay, so marching orders. Let me... I need to get back on track. I know time is starting to really become of the essence for this. So we've got these issues, it's squaring away on these prototype issues here. I think that if we can just dial in the task area, I can run with less ambiguity on what needs to be done. Yeah, I'm going to go and see if I can create. Now that I see how you're using these prompts, I can also help. Yeah, you can tee it up. Teeing them up.

OK, so let's see here. So I've got to do the landing page. That's important, so I'm going to put that up here. Card back, branding details, I don't know if that's important yet. It will become, let's see, it has all the information. Yeah, I think I've already even put that in there, I just don't know if it's done it yet.

I know there's some stuff I could probably remove, but I'm just scared to do it right now.

We talked about it, but I didn't add it to the... I know it'll be a task in our little chat. Yeah, I didn't add it to that, though.

Do you need anything from me on getting ship stations set up? Should I go and set up the account and set up all that and then give you a login? If you would like to, I can, I can, if you, so I did set one up. More than 30 days ago. So the the freeness, I think, expires after 30 days. So but I already have an API key in there. So if you send me the account, I think I can add you as a credit card to it. OK, I can add you.

It may have kicked me out, but I should be able to add you Ship Station and Stripe. I think those are maybe the last two that I need to add you to. Let me go, so the way I can see is if I go to, oops, that's the wrong one.

Okay, so you've got GitHub, you've got Resend. Do you have Cloudflare? I do not. Okay, so I gotta give you Cloudflare. Neon is through our first cell, but I'll make sure you have access to that so that you can use the console in Neon. Pretty sure you have post hog, but I'll double check if you don't have post hog.

and then ship station and that's all I think we use right now. Unless there's something that was added really recently that I can't think of but I think that's that's the list. I can just give you the credit card. No, no, no, no, I'll just, I'll just tell him. No, no, because you're going to be editing it. You just got to let me know if you're, something's going to be hitting it a huge amount. So that way I can make sure. Because it has a $3,000 limit.

Oh, I was just thinking for accounts I need to set up in case they're billing me Yeah, I've just got it on my on mine right on my card right now. So it's it's all of its like Cheap, free, you know, nothing's costing me a lot. Okay. The most expensive thing might be $4 a user on GitHub. But I don't know, is there something with ShipStation that I don't know of? Because I think the most that might be is like $30 a month or something.

So I think we're good. And that's if you're live. So I think we're I think I don't think credit cards an issue, but I need to get you an owner account on all of these so that we can collaborate together at the same level.

Okay, so I need... and then let me get back to the task board.

I need to... I'm gonna go into one of these here. Landing page updates.

Should I just do a due date, or should it be like release based? Like this needs to go in this next... yeah, I think that's probably better.

I just did one, just 1.0. Yeah, just, yeah. Let me...

Maybe like next Wednesday can be 1.5. But it'd be good like 1.0 become like the first thing that actually like is not coming soon. Yep. So that'll be that's like the not coming soon thing.

I think I added that, didn't I? I could be wrong. I thought that was...

What was that? Oh, it was in case I needed to reconstruct the card.

Oh, the system. The system smashes everything together. And in case there's an issue with the car. Like a PSD versus a PNG. In some cases I needed to be able to edit a car. I do have that, but make cards...

Yes, I got it right. Is it Ibl or Ubl? Okay, so yeah, I got that. I'll QA it, but yeah, that was the intention. And we can almost make that one a version.

Because if there's an issue... But then you have to recreate cards. Let's make sure we don't have to recreate cards. If there's an issue... I will deal with that with the customer side. Let's make it a 1-5. Let's at least get it so we can start getting orders. Okay. I'm not planning for worst case scenario. Okay.

Some of these things I've started, I'm just going to try to clean up in progress so I can focus a little bit on what I need to knock out. Then we can add check out. I do have a customer selection at charities. Yep, I haven't done that yet, but I can do that. Did you read it? Yeah, we did. And we talked about this, didn't we? Or maybe I had a dream that we talked about this.

And I just read this and that's where the information came from. I don't think we talked about it. We did, we did. Lisa told you it's got to be all of them. There was another one, maybe it was at dinner the other day, at your golf. And then I added, I thought I added an up...

I see this categorize charities here CSV down at the bottom right here. Oh Yes, okay. Great. Cool. What I did is just help to curate a list of...

It's a CSV format. Okay. It's creating the categories. I created 10 categories, six charities in each category. Okay, cool Yeah, oh great. Okay. I'm gonna dump that into neon kind of like I did with the pricing thing And I'll have it as like an editable thing in the admin area.

Do you want it to be where you upload and delete fully, or do you want it to be able to add and remove charities granularly?

It could be both. You could say both, but that's probably getting into more 1-5-2-0 type stuff.

Because that's gonna be a lookup table that we manage in the back end. Are you gonna manage it? Like how do you... do you download a list and then want to re-upload the whole list? So let me add that on here. There was another card that carried.

I have a charity sign up base too, so we've got something that I can work from, which is helpful.

Yeah, that's why I was already starting to think that way.

They said they're booked from 10.30 to 11.10 tomorrow. No way then. But outside of that, they said they're good and Sunday they're dead. We'll see if that lasts. So I can call up there before. Remi's with my dad, so I need to... Sunday looks a little better. It's a little cooler.

Okay. Okay. We're flexible at this point. We skip snaps some days. Yeah, we sometimes can't get our snap. By the way, the prompt on this one, how does it work?

Well, actually, it won't matter.

Once you qualify and get into it, it's good until 8th grade. So basically you can automatically get put in the advanced classes. It's a free 8th grade, unless you ask to be pulled out, but it automatically puts the kid on a different trajectory from day one in kindergarten. Oh, okay. For some reason I was thinking police.

I don't know why. I was thinking of the... Okay, okay. But it's like, they go and do a test. Okay. It's numbered.

We had some hunches, so we did some different things for him. And I think he squeaked through. So he had his first class yesterday, and so they go to a different school. So we pull him out of daycare and he came back yesterday just telling us...

What? Is it STEM related? Basically, yeah. It's advanced classes. Where do they go? Robertson Academy, which is down...

Drive 30 minutes there and 30 minutes back. 30 minutes there and 30 minutes back. At 9 o'clock and 2 o'clock. Once a week. It's only until he starts kindergarten in the fall. And then, if he's going to an MNPS school, which he will make him go to Sylvan Park Elementary.

They pull them out of class once a week in the school to go do advanced learning and advanced classes. If you're going to public school... That's wild. If you're going to go to public school, I'll get you the final details for when they sell. It's kind of a big deal. It sets them on a very different trajectory.

It's every week there's something until it's every week until they start kindergarten And then when they start kindergarten, it's every week still right? Yeah, but it no longer has a burden Yeah, yeah, yeah, we I feel like we have we deal with that type of burden just because of the timing My dad picked my dad picked up Remy. So now that they're here the things have changed dramatically But you know and then Rhea's around

Ria won't be out till 3.30 so it's like you get Remi at 2.30 and then she's 3.30 and it's like where'd your day go? Yeah, exactly. Yeah, the whole afternoon.

Yeah, that's, that was the whole goal was to, you know, I, we would have stayed in Nevada, but, and living in Nevada and living in that house. This place is like all broken, you know what I'm making do, but it's, you know, like, there's no hot water spout, like, for hot water just to come out that's already purified, you know, like, there's like some of those, like, we don't have that either.

There was some serious Benefits there but

I don't have to live in the city and I was thinking

What would happen if I lived in like Franklin? Like it's similar pricing, but would I get more income? You know, that'd be close to God, you know. You know, that type of a thing.

Yeah, we got to figure out zoning and, you know, for... If you're thinking Brentwater, though, where's it coming? Well, because Valor doesn't start in elementary, so we have to figure out some...

Because zoning doesn't matter for Valor, right? It's just where I can drop his punk ass off.

At least that's what I heard in this conversation.