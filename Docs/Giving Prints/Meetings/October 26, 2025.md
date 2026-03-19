# @October 26, 2025

Summary

### Product Design and User Experience

- Discussion focused on card design interface with emphasis on bleed areas (extra margins that get cut during printing)
- Cards will be 4.5 x 6 inches with bleed areas to account for 1/8 inch printing variability
- Agreement to remove visible bleed indicators from the UI as they cause user confusion
- Mobile-first approach is critical for success, unlike competitors (Shutterfly, Minted) that struggle with mobile interfaces
- Goal is to create a simple editing experience that allows users to complete orders quickly on mobile devices
- Current text editing tools on mobile are challenging and may frustrate users

### Order Fulfillment Process

- Printer will access an admin interface to view and manage order batches
- Printer will download card designs and shipping information
- Combined shipping label and packing slip design discussed
- Packing slip will include low-resolution images of cards for quality control
- Printer will ship cards directly to customers but will not stuff envelopes
- Customers receive box of cards and envelopes to assemble themselves

### Business Model and Charity Integration

- Decision to use single for-profit entity rather than separate non-profit foundation
- Commitment to transparency about profit allocation to charities
- Profit calculations will be handled quarterly rather than dynamically per order
- Charity approval system implemented in admin interface
- For initial launch, will manually recruit and onboard charities before transitioning to self-service

### Technical Infrastructure

- Domain "[givingprints.com](http://givingprints.com)" to be pointed to Vercel
- API endpoint will use a less consumer-facing domain name
- R2 buckets used for storage
- System stores order information and images in folders organized by order number

### Feature Prioritization

- Address book integration and envelope printing deprioritized for initial release
- Custom envelope printing with branding ("profits from this card supported the charity that mattered to this sender") planned for future
- Return address printing is simpler and could be implemented earlier
- Envelope supplier recommendation: [envelopes.com](http://envelopes.com) for bulk ordering

### Action Items

- [ ]  Point givingprints domain to Vercel for deployment
- [ ]  Create printer admin interface for order management
- [ ]  Design combined shipping label/packing slip template
- [ ]  Skip envelope/address printing features for MVP (move to version 2/3)
- [ ]  Add developer access to all platform accounts for continuity
- [ ]  Meet again on Friday

Notes

Transcript

I don't know how much of my old code you're able to unpack or that you're able to have a clot unpack.

I can look at...

The engineers solved for that already. We were using different dimensions. We were going after a four and a half by six card.

Okay, yep.

Slightly smaller card. But the logic of how to deal with that layer.

I'll take a look. Some of that code's really old, so running it and being able to play with it is one thing versus taking a look and having Cloud Code look at it, it's very easy. Getting it running, there's major dependency stuff to try to get going, so I don't have it fully working. I got it pretty close to working. So I might be able to see that.

That section might be able to work standalone because it wasn't relying on a lot of the framework. Okay. It was, I forget which framework, but it was, it was custom, but it was something where, you know, so we need this.

Yeah, that's yeah, this is really cool. I like the way they do this too.

And this piece works well on mobile.

On mobile, it's just one and a selector? Or what is the use of mobile? It gives all these options. How do you want it to look on mobile? Is it?

I think that this is the, what they've done here is the ideal option.

Like a swipe, like each one of these is a swipe and you see the full page on mobile?

Let's go see. I forget exactly how to do that.

So if I go right now, I'm on this layout. So if I go to this layout, oh yeah, okay.

And they do this for all cards on the back, but you can also see how it places everything to have that bleed.

Yeah, yeah. But why is, okay, so even in the middle there's bleed. No, there's not.

Look, so you see that edge goes right to the edge, and then this is the edge of this one.

But no, why is there this white in the middle here?

That's just part of the design.

Oh, so I can, all I can do is move it? If you wanted to, you could get rid of it.

That template doesn't allow for it, but if you wanted to you could have it.

Okay so if I change, oh I see yeah okay so if I do that one yeah okay gotcha. That's just part of the design but you can see that it bleeds.

It still does the bleed on the outside. Okay, I was worried that it was like part of each image, just the way they print it. Okay, cool.

It is only for the cut. It's all for the cutting. Okay. It's all for the cutting of the card. Because when the paper prints, I wish I brought the paper with me. I should have. It's inkweed, right? Well, it's not so much the inkweed. The ink is really crisp and sharp. Like, you can create this sharp edge, it's just fine. It's when the paper's going through the printer. So it's a sheet of paper about this big.

When it goes to the printer, as it's flying to the printer, it jumps around. Oh, I see.

Okay, gotcha, gotcha.

And so they can't, the printer can't be precise within about an eighth of a minute. It can only guarantee about within an eighth of an inch.

Oh, wow.

Of wear on the paper turnip frame. Everything on the paper will be perfectly plated. Oh, but it's the printing of the...

It's the printing of it. Yeah. So each one that comes out might just be a little bit different until they cut them.

And then when they cut them, and then if you look, if you're going to look really, really closely at the prints, man, I wish I brought the cards over. The sample, you'll see that they're off by hair.

Okay.

Because they printed me a stack. Yeah. And if you look at them carefully, each one is off by a sixteenth of an inch from each other.

Right.

And it's because the paper is jumping out. And then when you cut it at the exact same spot through the cutter, the cutter cuts into the exact same spot every time. It's a razor blade with the feeder that is perfect rails. When it feeds through, it's pushing through and cutting it. There's no wiggles. There's no wiggles. Yeah, yeah. But that image in relative position on the paper is off by up to an eighth of an inch.

It's really close to two. They're guaranteed an eighth of an inch. It's closer to about a sixteenth of an inch.

Okay.

But the bleed on here is also falling an eighth of an inch.

Okay.

And so that's the reason why It's because when this prints all of these might be just slightly to the right, just slightly, the whole thing might be slightly to the left on the paper. So why does the user need to know though? Why do I need to know when I'm, you know, like, in, like, You don't. You don't. But when you place this image, so that's why it happens. So, like, you should be able to, this image you should be able to drag it left and right just a little bit.

If you zoom in, then it's already placed it to the max size. But if you were to zoom in just a little bit.

Yeah, there you go.

Now if you were to... This is moving around within that hidden box.

Okay, I see.

Okay. So I guess what's the, what's the benefit to the end user that's buying this, of showing the blue here. Okay, that's okay. They don't need to. Okay, gotcha, gotcha.

They really don't need to.

Okay, cool.

In fact, I would say get rid of it.

Okay, okay. Because that's where the confusion was lying to me. It was like, why does the end user care? The end user does not care.

They left it on there.

If I had to speculate, they left it on there just so that the user wouldn't be confused about for example if there was some small tiny detail in the bottom corner of a photo. Like, well, why can't I see that little tiny piece of that picture? Let's say you put your signature in the photo. Yeah. But some small little detail, some little bit of text in the very bottom corner well you could never make that fit for the image because the image if you have a pencil or a pointer, something I can point with.

Yeah, I got all sorts of stuff here.

Man, I wish I had brought my, those samples. If down here, so the image still extends all the way down here. And if you add a little detail that maybe said the date of the photo, I guess why does the user need to know that?

Why doesn't the user just see what this, the image, okay. And then they would drag it in, right?

Exactly.

Okay. But they wouldn't be able to drag it.

There's a little bit of text down here and it's in the bottom left of the corner for this picture, for this particular photo, you would never be able to drag it into view.

I see, yeah. Because you still need to print to this green edge.

Right, right, right.

So that is what the, maybe what they were trying to solve for. I'm not worried about that. Okay. That just creates confusion.

Yeah, that sounds good.

It's extra.

You have to know more about how things work and when you're just trying to like order cards.

I would just simply have it let the customer, they might get frustrated for a second. Like, why can't I get that little tiny detail in the corner to show There you go.

Oh, there's a big thing.

There you go. Oh, that's kind of cool.

Now you're going to see the magic of how this is working. So if you had little tips down here, or there was a purple flower down here that you really wanted to go to show, you can never get that to be in the picture because I have to print this area that's going to get cut.

You'd have to like zoom in and scrunch it up in there, right?

You'd have to like edit this to be in the cut area. Yeah. Okay. That's interesting that they do it like this. I was thinking of hiding that from the user and never showing them that edge.

I think that's totally fine.

Okay. This is cool though.

I like the way they do this.

This gives you a lot of visibility to see how it works.

That's a line for text of some kind. Okay.

If you had text on this.

Oh yeah, oh I can do text here, okay. Oh yeah, okay. Oops, did that give me a text?

This is very hard to do on a mobile first.

Oh yeah.

So that's the reason why I'm kind of nervous of how much. Well that's probably why they do it like this.

Full control versus their basic editor type thing.

Doing the blank cards option, it certainly helps because this is the first step. I think no matter what, when you code it, or if I, you know, my engineering hat, almost everything on this you've reused. So it makes sense for that to be a version one. So I totally get why you're like, can I, can I start here?

Yeah. Yeah. Yeah.

I don't know if it's simple enough for the user.

Cause when you do it on a phone, trying to get that text box to be just centered, be just right, becomes really hard for the end user.

Yeah.

And for the text to be the right size, does it look right with the right colors and the right backgrounds, does this even look pretty, does this font match with this font?

Yeah, yeah.

Some people are great and amazing. They can do that. Nine out of ten people can't.

No, no.

They're not artistically inclined. Heck, I'm not even artistically inclined. This is going to be a challenge.

Well, then you're paying money, too. You know what I'm saying?

It's like when you have to ask somebody for money, if like they're just like saving it to their computer, like, you know, it's like, okay, yeah, I'll play with it. Yeah. But if they're paying money and shipping it to their friends and family, they don't want to ship out something wrong to me.

Yeah, so the goal of this for me, I think, is the value of giving prints is make it so it's so easy to do on your phone fast. Yeah. Like, I've tried with Shutterfly and minted especially.

They're definitely web only.

And I get ready to do it on my phone and I wanted to order them because I wanted to give you samples and show you samples.

I was like, I can't even get this thing.

I just need to go log into my account and do it on my computer. And then I never come back to it. And I still haven't come back to it. But if you could do it in like one sitting, really quickly on your phone, that's an easy way to give up $200.

Yeah.

And like, take my money. It was easy.

Right, right, exactly. I feel like this stuff should be optional. Like the, you know, like the envelopes and like, this should be like an upsell almost.

It is, yeah.

Because this slows things down. This should be the last.

This is not part of, this does not need to be part of MVP or version one.

Okay. So I just hit save, do a final preview. Okay, great. Add to cart.

And the thing is, on all of these things, the customer, I don't know that you do on any of this, like adding to a cart, I don't think customers buy multiple products.

Okay, that's good to know. I don't, I could be wrong, but I don't think that they do.

I wish I had the data.

So we could maybe streamline the checkout more. As soon as you're done, you just go straight to ordering. Yeah, exactly.

Don't add to cart.

Well, the other thing is, what about the uploading the address book thing?

So go back to the envelope page. My guess is that Andrew's printing.

Okay, they charge 35 cents each.

Let's see what this workflow is. I'm curious what that workflow is. This would be the version two. Okay. Or three.

I thought you'd put in a... So this is just... Oh, that's the return address. But what about the... I thought they'd upload an address book.

Yeah, let's see what happens.

Okay, so I do that, and then... Oh yeah, okay. And we support addresses from download our template, enter a copy and paste. Where's the, oh, okay.

So all of these are painful, all of those are . The ideal option is to be able to go and select from.

From your phone, right? If it's on the web, what address book would you... So I signed all of my phone addresses to Google, but I'm unique like that. Like my whole contact book gets replicated and saved just in case because I'm worried about you. So I don't know if on the web if there's a way I could get to somebody's address book.

I think the three options are, again, we want to be mobile first.

Yeah, mobile first.

I think being able to select from their phone, whether it's Android or Apple, I don't worry about any other permutations, just Android or Apple. If we can tap into the address book to go just go and select.

First filter on here's all your people with addresses with an address actually entered and then select everyone that you want yeah yeah that's oh that's that's that's like that'd be the perfect blow right yeah that's the perfect blow that's the happy path but then also some of those people might not have addresses in that for that user right?

You might, you know, that's why I like it has to be just the one you only put only display automatically filter so like my phone book has I don't know let's see if I can do this just kind of like is there a filter there where it's like everybody that has an email. I don't think so. Um... But if you're tapping into it, maybe there's a way programmatically.

Yeah.

I can do it in card.

There's no way just to filter, but you have all contacts and there's a way to filter on just the ones with well I'm going to pull from the API so I'll just filter I'll do the filtering then and I'll pull all the data and I'll trip it up, but well. Okay. So that's pretty painful in there, that's for sure.

And then the second option is import from an Excel template if they're on a computer.

That would be the CSV type stuff.

But again, address printing is version two or version three. Add single.

OK, so that's how they're doing it for single. OK, add another.

Can you select your address book? Where did that come from?

I thought that was, oh, that must be the thing in, in PIX, like your accounts, right? Because it looks like it's your app. Yeah, it looks like it's your address book in here can you okay I don't see where you can like it's totally different yeah that's actually like maybe like pretty good to be honest. Like, you know, cause if you can get a, if you can do the... Everybody's doing things differently.

Because how does somebody populate the template? Where are they getting their address book from? Like, you know, you want to be able to get it out of their device or out of their account but if they're not on their phone where are their addresses Where are they storing their addresses if they're not on their phone? Oh, yeah. Also, we're thinking too, when we think about it, we're thinking about the charity.

They're going to have these in a database somewhere, right? Potentially. So an export to a CSV, that's very natural for them.

I would say leave. Again, I think this is a complex problem that should be low in the secondary third on the okay okay not this week maybe maybe next week or something Okay. It is not a must have feature to be able to sell cards I don't think.

Okay, right, right.

It's a nice to have. I would plan on just skipping it.

OK, it wouldn't let me go past it.

I plan on skipping it for now and something that we can start later.

Okay. I mean, what did I return?

Address printing. I'd be okay with putting your return address. Yeah. Yeah. That's easy.

Yeah. That's easy. Right. Yeah. Um, and the, the, the, the, the, the same vendors, suppliers, vendors for the printing capabilities do that, right?

They do.

Okay, cool. Cool.

For now though, just leave all that off. Let's build it as a feature on its own.

Okay. In a separate sprint.

Okay, okay. That sounds good.

Because then I also have to get the printer to then get their motion, make sure they don't screw up orders and put the wrong addresses with the wrong card orders yeah yeah my plan for them is that I am so I was working with them this was one of the last final details on paper samples and paper supply and ordering paper ahead of time, which I have inventory. And they were struggling on getting envelope stock.

Don't know why. Just their supplier doesn't do that. They make paper, but they don't make the envelopes.

Oh, okay.

Whatever it is, I don't know. Yeah, yeah. Anyway, they were struggling on that and what they said was, you know, we can't beat the prices on envelopes.com. Go to envelopes.com. Our supplier can't beat those prices. Go to envelopes.com, buy them in bulk, and we can do some custom printing on the back if you like.

So how would you get them to the supplier then?

Would you have to deliver those to the supplier? No, it's not a big deal. Okay, okay.

I can even have them shipped straight to them.

Yeah, that's true.

And what I'm going to do on those envelopes is that I'm just going to have on the back printed on the back just printed given prints calm or just giving prints yeah and then the bottom the profits from this card supported the charity that mattered to this sender.

Right.

Yeah. And just keep it generic. I won't even say what the charity is on the card. Just simply, it'll be the same envelope for everyone. And just keep it simple. Yeah.

And great brand awareness.

And yeah, I love it. Yeah. Okay. That's awesome.

Yeah.

Okay. Okay, so we're through this here. We still need to talk about that.

So just, yeah, so just completely put this off to the side. This is a version.

Okay. All right. Easy peasy. Do I have what I wanted to show you after this? I don't know if my auth is blocking it now. Did that deploy? It did, okay. So now, because when we go to profile, I should be able to, because we have different profiles that we can do admin things on.

Okay, send me the link.

I was playing with this this morning, somehow I broke this when I was last working on it. And this is what I wanted to show you was the area where you can approve the nonprofits. So I've got like a non charity, like a become a charity type thing. Okay. And so it's a form and then it goes to you and then with all their details and then you can say yes or no and then it creates a profile in there for them and then they can go in and upload their addresses, they can add pictures so that they have like a little profile that will show up on the website and stuff, right?

So I got all that stuff going and I wanted to maybe it's in my voice sent you before so it's it should should uh maybe i'd just no it would send me this it's broken um I think it's I changed the way E and B variables are handled in this latest push and I think it's not picking up on the env variables and so it's not able to get the resend. Oh, well, maybe not. Maybe I'm lying.

Oh, yeah, there it goes.

Okay. Fine then. Okay, there we go. Just kidding. It works. I should have put in the right email I guess Okay, um Charities, charities, charities Admin user, yeah, where's the Admin, okay, cool Nonprofits So this is how I manage them We don't have any applications obviously because I haven't really made this live. Oh, yeah, this is right. That's on my preview. I bought this domain for like 10 bucks giving prints just so I could have one and I could do the social off and stuff like that before I before I transferred years in but yeah if we could just get that on Cloudflare that'd be super helpful for me.

I still do need to like change some callback URLs and stuff like that after so there's still a little bit of work to do but um i was able to go a lot further forward with the development by having a domain, a custom domain.

What, where do you want me to point? If you give me some of the details of where you want me to point the domain or domain name server? Because it's sitting on, I think it's on AWS or GoDaddy. I have half my domains there.

Oh, so do you want to do the DNS on the existing one and just point from... I don't care. Okay.

Whatever's easiest for you.

So when things change, when we deploy and we want to deploy to the domain. So I'll attach that to Vercel. Yeah, we should be good. So all I'll do is I'll attach that to Vercel because the API, we're not planning on opening up the API to others, are we? There's not really like a play for that. So the API can be an ugly domain that's ours. It doesn't need to be something fancy. Right, okay, cool. So then I can just attach it to Vercel and I think I can pretty much use whatever you have.

It doesn't have to be in Cloudflare, basically. And we can... Our two buckets. Our two buckets. Oh, well, you know what? I'm just going to use this giving print with a Z, one as well for the R2 buckets maybe. Oh, and also in this notion, I've got links to all of our stuff here, I'll add you, I think most of it, I've added you like an account on or something like that, but I'll add you so that you just have access to any of this.

So if anything ever happens to me or whatnot, you still have access to all this stuff. But that's pretty much all the things that we're using.

Here pending applications. I wanted to show you the application thing. So this is how we check the applications. Let's go to the preview. Become a charity. I thought I added this somewhere. I just can't remember where. Become a partner? Is that?

I had built a form, I don't know where it is anymore now. I don't know how to get to it. I'll have to send you a link at some point.

The way that I view this for this year is probably also low on the priority. I have a hunch that I'm going to have to do things manually with them. Yeah. The first dozen, until I get to a critical mass, where charities then just sign up on their own, I have a feeling I'm going to have to sell to them. Oh, yeah.

Yeah. I want you using our app. Oh, got it. So everything is, even if you're doing it, I want you to like go to the link and you add them type thing and go and then we'll track all the approvals we'll track it all like it'll always be apples to apples. Totally good. Okay, cool.

Dang it. Okay, I don't know. I must have to I don't know what I did with that. I think I did it before I did the new checkout stuff because I did that new because we changed the way the pricing stuff worked because before it was like now we're doing a platform fee and we're doing all the profit goes to them.

Before it was like a variable of the profit went to them. Correct. Yeah.

And by the way, I ironed out and went through the, in case you're curious, the entity structure. So I went and did, and GPT is a piece of it.

Oh, a non-profit and a full profit? I looked into that.

Yeah, yeah. Looked into that, and it's not worth it. It's not worth it, okay. Newman's Own. Have you heard of Newman's Own products? Like they sell salsa and salsa? They make really good salsa. They make food products.

Newman's. Okay, okay, okay, okay.

They boldly advertise 100% of profits to charity. 1% of, and it's a little misleading because it's two entities. There's a for-profit business and then the foundation. The org disperses 100% of the funds they receive to charity. But the for-profit entity first has to pay taxes and then they disperse their funds to the nonprofit.

Oh, okay. So the for-profit does it as well.

So it ends up still having to pay taxes no matter what.

And so that was the last game going through chat GPT. I'm like, yeah. So what's the real advantage? Why don't I just have this one company, um, and skip the hassle of having two independent boards which is a company requirement and the the only answer on it is like it provides a little bit of assurance to customers that you have a separate nonprofit entity that has separate governance.

Who even knows who's going to look at that?

Exactly.

Okay, yeah.

And you end up paying about an extra 1% to 2% more taxes because of that. So I'm like, because of all that, and then all the administrative overhead. I'm like, no, I will, the benefit isn't worth it. It's gonna be one company and it's a for profit company. We're gonna do the right thing. We're gonna take a point, we'll publish our tax returns, just make the tax returns public or redact what we need to, but here's the transparency you need.

Yeah, yeah, yeah.

If we get to that point there's ever a question of integrity, then we're like, there's your tax returns.

Right. And I think that simplifies all the payment stuff in the back end too. It does. Because I feel like it was going to be more complicated.

Yeah. You just go through.

Yeah. And that's the thing about calculating how much you're donating and stuff.

Like, don't worry about doing that dynamically.

We can update that statically once a quarter.

OK, sounds cool. Yeah.

We'll calculate it.

Because you know what?

I'm going to send it to the accountant. I'll have the accountant do the thing, like, all right, we're pulling this out. Here's the different layers. Whatever's left over, we set.

Yeah, yeah.

And we'll figure out how to re-corrater it between different orders, because some orders are more profitable than others. I'm like, do I need to figure out which one's more comfortable? The answer's no. I can prorate people just based on the number of cards.

Okay, cool.

So how much profit goes from each order to each chariot. We'll figure that out on the back side. At some point we may be able to make it because we'll get it so static. Like look, it doesn't matter how much you order, it's always going to be this amount. And then we can publish it and give the person real time insight but I don't think they really care. In fact, I think there'll be a detraction because they'll say, all right, well, it's $10 for this order.

Yeah, right, right.

It's not as much as I thought it would be.

Yeah. The thing is, is that how you do it in time?

There's not that much profit in here, you know, as I thought, right? Exactly.

I thought I was getting rid of their greed.

They're not that greedy, dammit.

Um, on the, on order fulfillment, can we like talk about that just a little bit?

Yes.

Okay.

Um...

Okay, yeah, there's like a little bit of... I need like a little

... . . . .

Okay. And so when you, so the payment processes, the, the, the, the, the order and the image gets saved to the bucket. Um, and then you want a packaging slip with the image right?

Saved into that same folder so that'll be a folder with the order in it. It'll have like it'll be the order number. Yeah. And then inside of it it'll have the actual product the image that they have or the images that they have of the card. It'll have a PDF image of the packing, the packaging slip with an image inside of it so that you can verify that that goes with that order. And then and who prints the packing slips?

They will.

Okay, cool. Okay. And then the shipping label and the packing slip, can those all be on the same file or those separate? Are shipping labels separate? Is that where it's dynamic? Like the the from the address book thing?

The picture is worth it.

I see your keyboard.

It's because I have a...

Yeah, the the protector, yeah.

So this is meant to be the printer's view.

And so they'll get a batch. Let me even go back.

Oh, so the printer will log into the system?

Correct.

Oh, okay. Okay, great. Okay. So I need to have a printer admin area. Yes.

They can download. You can download orders that are ready.

Correct.

And they can probably view their financial stuff.

Yeah. So this would be my screen. This would be my screen. These are all the orders that have come in. Some have requested an expedite and some have requested standard. I would legitimately take, why did I not select these? Oh, because they're already in a batch. So it would go and select all that aren't in a batch already, create a batch for production. This is for me in case I end up using multiple printers down the road.

Oh, okay, yeah.

But for now, this is meant to be, there's only one option.

Okay.

This is meant to be instead of the actual printer.

Right, it goes to the... Yeah, it goes to the peoples. It's like, it just marks it as ready to be printed and then when the supplier logs in they see that or that batch.

Exactly.

Yeah, and then they can download and fulfill it. Exactly.

When they log in, what they see is... Here are the batches they have. And they'll basically correspond one per day One per day is what I'll probably do every other day. They'll come in here.

They will see who wants to need to go and print in this batch.

They'll see the card.

They'll download the design for the card front. Download the design for the card back.

And the shipping label. Okay, yeah, I got it. Okay, yeah, this is cool. Do you have a piece of paper?

I did not mark the cell phone. Oh, paper.

We're a digital house.

I didn't mark it, but it's supposed to be a case where I can draw faster than a wireframe.

Sure, that's great. Thank you, sir.

No worries at all. I used to have a whiteboard.

I used to whiteboard everything, and I had whiteboards. Oh, whiteboard work too. It's not in this office anymore. I guess we use this. It's Sharpie. The appendix got a new couch. You're a happy girl. Yes, you're very elegant now.

We got my sister's couch, so we got rid of the others the other stuff and much better.

I didn't think it'd be this dark in here. You should just try to do natural life and just now noticing how dark it is in here. Oh yeah, you heard Penny got attention and you said you need to come get some attention. Yeah. You are the most jealous dog I have ever known. Yes you are. Finish your ancestors. Look at you and say, what the heck? Put that thing on a couch over there? What are you doing?

I feel like I need to go and go home and grab the search and see it and I probably also need help create a template for you. Okay. So this could be able to do four mock-ups in case we need it. Yeah. This would be an eight and a half sheet of paper. They make pre-printed sticker sheets. Two stickers per page. It designed these shipping labels so you could print shipping labels on both halves. Yeah, I think I've seen this before.

They're cheap enough where I would print a shipping label on bottom half, the top half would just have a very low resolution visual. Here is the order. Here's the order. Yeah. And what I'm trying to do is for this shipping label when I when they print they'll they won't they'll take the front image they'll place it on their printer on the side of your, like, drag and drop. The back image, they'll drag and drop it, put it on the printer, send it to print.

They'll also take the shipping label and print one copy of the shipping label And that shipping label is a one page, I'll give them the double belt sticker paper. Get the shipping label already ready to go. And then the top will be, here's the details about the order, the order number, customer, picture of the front and back of the car, just low resolution, so that way they can't screw up what goes in the box.

So they're shipping out a whole box of them to you?

No, to the customer. So they're going to every place.

Oh, okay. So they're shipping out individual cards. Yeah. Okay, cool. Okay, cool.

So the customer orders 100 cards.

So this just tracks all the way through their process and then they throw it away. This never gets to you.

No. No. They're going to ship directly.

And it never goes to anybody because they're getting a card with an envelope. They're getting the product. All right. So for you, let's say you're ordering, you are a customer.

You place this order, you end up getting a box full of 100 cards because they're not mailing the cards for them.

Oh, they're not mailing the cards. That's what that's OK, gotcha.

You want to see the cards or do you want to hold it? You want to see. OK, yeah. OK, you probably want to add your own little notes. If it's an envelope you may end up putting some extra photos in the envelope like you oh okay okay oh okay I thought they were doing distribution they not doing the distribution they're only going to they're doing order fulfillment yes yes so they'll send 100 cards to you the customer yes exactly but then you Clint will then send us all your cards and then I put them in the envelope still like they're not putting the cards in the envelopes either.

They're not going to stop it. Right. Okay. Okay.

I need to make sure they send the right order to you. Yeah, exactly. And so this helps with the quality control.

Totally. Because if I want you to pay for, here's the shipping label, slap this sticker on the box, put this.

This is what it's supposed to look like. This is now a packing slip. Yeah. Put the packing slip in the box and as you're also putting the cards in the box, make sure those cards match the picture on the package. Yeah, exactly.

Yeah, yeah, exactly.

Easy, easy, easy. Trying to make it idiot for if they hire any kind of temp labor. Yes. They're going to say, all right, well, all right, this makes sense. Here's the box. Slap the sticker on it. Wait a second. These cards don't match this picture. Something wrong here. Right.

Exactly. Exactly.

Okay.

All right. I'm 100% on the same page. Okay. Is it shipping out?

If this blows up and it does it in a good way, is it shipping out 100 orders or 1,000 orders a day? Oh, yeah. It could be. I need to make sure they get the right order in the right box.

Well, just this whole, and that's why I was like asking about the process because envelopes stopping all those things in my mind were like questions that I like was kicking down the road for later. I won't go down that business. Okay, cool, cool, cool.

Some of them do that, but I won't go down that business. I see, okay, gotcha. That is too labor intensive.

And they make mugs and all sorts of wild stuff. I'm not going to.

Okay, cool.

We're going to be a one trick pony, but do that trick really really well.

Yes, yes, yes, exactly. Bruce Lee style.

Was he the one that had that famous quote?

10,000 kicks or one kick practice one kick. 10,000 times, yeah.

I fear a man like that. I can't remember exactly.

I fear the man who practices one kick 10,000 times.

Exactly, yeah.

And the man who does 10,000 kicks one time.

Yeah. OK. Do I have other questions about this?

I don't think so.

So that's the shipping label. It's shipping label, packing slip combined.

Yep, yep, yep. And I've seen this dotted line thing before too. Yeah. Okay. I know what you're doing.

I think I sent you a photo.

Yeah, I think so too. Yeah. The thing that made me where I saw it. Yeah. Okay. Oh, I did. Yeah, that's what I remember. I love it. Yeah, exactly.

Because I was like searching for lost golf balls. And so it's a sticker on the bottom. You can peel this sticker off too.

Yeah.

And that's a sticker on top?

Yeah.

That was the shipping line, but that's what was on the outside of the box that got shipped to me.

Yep.

And they had this on the inside, so that way...

Aren't they supposed to rip that off? So it's just like a... They could.

This one does not have perforation.

Okay.

And it doesn't look like they still do preparation anymore, like the ones I found.

Really? So it's not a big deal?

It saves them a penny of cost per box.

Yeah, when people throw it away anyway, so they don't really care.

It's not a big deal. I don't mind that. I didn't think anything less of them. That's what my pack and stuff looks like. I don't.

Yeah. Okay. Yeah. Right. Right. Okay.

Um, reminds me, I need to make sure I order.

Do you want to try to get together again Friday? Yeah. Okay. Okay. cool
		

![Screenshot 2025-10-26 at 10.58.24 AM.png](@October%2026,%202025/Screenshot_2025-10-26_at_10.58.24_AM.png)

![Screenshot 2025-10-26 at 10.52.28 AM.png](@October%2026,%202025/Screenshot_2025-10-26_at_10.52.28_AM.png)

![Screenshot 2025-10-26 at 10.51.08 AM.png](@October%2026,%202025/Screenshot_2025-10-26_at_10.51.08_AM.png)

Packing slips are per batch 

Mobile first Builder