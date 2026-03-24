# @November 7, 2025

Summary

### Project Overview

- The team discussed improvements to the greeting card creation platform workflow
- Focus on making the process more intuitive and customer-friendly
- Primary application is for holiday greeting cards that support charitable organizations

### Key Flow Changes

- Changed primary flow to start with card design selection rather than photo upload
- Simplified from "select design → upload photos → personalize" workflow
- Removed envelope option from the process
- Streamlined the editing interface by allowing direct interaction with the card

### Card Design System

- Admin will pre-define all card parameters including photo placement and text areas
- Design mats will include predefined areas for photos and text
- Card designs will include crop marks and bleed areas for professional printing
- Planning to offer 20-40 high-quality design options rather than overwhelming customers with choices
- Designs will include a mix of 1-4 photo layouts, Christmas vs. holiday themes, portrait vs. landscape

### Photo Implementation

- Users will tap on predefined areas to add photos
- Photos will be positioned in specific coordinates set by the admin
- AI-generated sample photos are being used to showcase the designs

### Text Implementation

- Fixed greetings (like "Merry Christmas") will be part of the design image
- Editable text will use Google Fonts with parameters specified in design
- Text boxes will be pre-positioned with defined parameters

### Back Card Design

- Each front design will have a matching default back design
- Users will have options to add photos to the back in different layouts
- Brand elements like the chevron design will appear on all cards
- Charity support message will appear in consistent location on all designs

### Business Considerations

- Initial focus is on holiday cards with potential to expand to other occasions in years 2-4
- Using third-party printer (DynaMark) rather than owning production facilities
- Advantages of using external printer include utilizing their excess capacity during holiday season
- Sales tax considerations: first $100,000 from orders outside Tennessee is tax-free

### Action Items

- [ ]  Rework the user flow to start with card design selection
- [ ]  Create the card admin designer tool
- [ ]  Remove the envelope option from the process
- [ ]  Pull existing designs from Notion into the system
- [ ]  Create and provide design templates with parameters for photo and text placement
- [ ]  Create back card design options with photo placement parameters
- [ ]  Provide pricing table information in CSV format for import into the system
- [ ]  Implement Stripe integration for both payments and tax handling

Notes

Transcript

We're making better.

One potential concern I have. Okay. When you go back in one of those early steps, it needs to be starting with the card design rather than the photo.

Understood. Yep. Totally agree.

To the customer, they're not thinking overlay. They're not thinking about the structure of how the card gets built, the layers. You need to know that because that's how you build the car, but the customer starts with the design and then finds photos to put on it.

Totally. I totally agree with you. Yep, totally agree with you. That's easy to flip around. I can flip that around. I'll pull those designs also that you have out of Notion and I'll get them in here. Okay.

I know we're supposed to... It can be useful for helping with... designed here because when you're trying to design an abstract, I can see that.

Yeah, yeah. I'll remove the envelope piece. Let me just kind of like reiterate back because I think we can maybe like meet Sunday or so and I can show you another iteration at this that would have all of the changes in there and more. because I've got some stuff in flight too. So, we want to change, we want to remove the envelope, we want to change the flow of things so you're selecting the design, kind of like how Shutterfly or Mpix does it.

Um... the back layout I need to to make some different options there I think you may I'll just look at and fix yep but I think we may want a more limited oh actually I think you have a version for me already that has our logo and I do okay there's a notion card for that one too okay fantastic I'll make sure I dial that in so I've got I've got that in notion already remove envelope okay cool so Okay, so then...

In the editor... So in step two, instead of step three, In step two you'll select the design right off the bat. That'll be your first thing.

Are you saying step one is you select which design you like?

Sorry, yeah, your step one will be you select which design you like. Let's just call it snowflakes border. Yeah. Okay, put that down. And then that may or may not dictate how many photos are for that layout, right? Like some layouts, like they may have like two, they may just like have like the two photos or is it all just Super flexible.

So the card design. So when I said as an admin, I will help define all of those parameters.

Okay, no problem. I can finish that in the admin side. So, for example... Yeah, I saw this.

Upload design mat. So this is a blank card design moment. There's nothing in it. And front pair of resolution. And we'll say it like this. Let's not finish on your computer. I'll just sit down at the bottom. There's this. In Notion, I've gone through an article already. I have this signal in here. Which are you? The computer isn't like literally dying, it's just too many things open. I put this in as a sample here.

So the photo parameters?

Mm-hmm.

So this is how I set up this entire card.

Yeah, yep, yep.

For the parameters of first text box is 15.

Yep, I saw this, yep.

And I should get the, 100. Let's see. The photo box is now created. You see it also has the blade. Call for the blade. And then the text boxes are also pre-positioned. I say exactly where the text boxes are going to go.

Okay, cool.

And that's part of the administrative setup and it's nothing that the customer can do.

And what am I saving this as, I guess? I'm saving this as an image. If you're going to define this, And then I'm going to save this as an image. into neon like the other overlays But it's going to, when it goes to an image, you can't edit it. Correct. Okay, so you have to recreate it, and that's okay? Yeah. Okay, cool, 'cause the undo button, there's like a grand canyon-Yeah, once you output it, once you output it, If I had to redo it, I could probably save all the parameters.

Yeah, I could save all the metadata.

You know, which... Design map. I know all the text the customer selected. And of course I have the card design where I know all the parameters for what needs to go into the card.

Okay, cool. And then we're using, and then this is all Google Fonts, right?

Or no, this is images. Any editable text, they've been Google fonts. Okay, so this we're going to have versions of that one. And I will tell you what Google font. It'll be part of the parameter setup.

Okay, cool. Was that an editable one or was that one of the ones where you'd have like, Merry Christmas, Happy Holidays, you know, like different...

Yeah, so that's the... That is this, this greeting.

Yeah, the greeting, yeah.

If I can add that functionality here... I don't know how to do that in the UI. I didn't think that one through. Oh. Basically, the design mat needs to have multiple options. Yeah, that's really that text this image Have a Merry Christmas or if I wanted to say happy holidays and happy new year, but it's an unseparate image, right?

Correct. Yeah, so you'd upload Three images or something maybe yeah, okay. Yeah. Yeah And that could be, like, what if that was, you know, like the amount, and we'll say the amount of... Different greeting options for a specific card. It doesn't matter how many we have. I'm just going to save them into NEON, into Postgres. And then if it has three, if it has ten, whatever, that'll just be options that we display under the greeting.

I would make this low priority if this is version 2. Oh, oh, oh. Because think about it, I could just put this. I will have 20 designs for this year. Yeah.

Oh yeah, you can just make different designs. So they start with the greeting and they can't change it during the build. Yeah, I got you.

And I don't need to have a thousand designs like Shutterfly.

No, no, that's probably not what people want.

If I have 20 to 40 really great designs. A nice slice of Christmas versus holiday. portrait versus landscape. in a mix of one photo to four photos, I just do a nice cross section of all of those different parameters. That'll be good enough, I think.

Is Easter and Mother's Day good opportunities for this too?

People buy cards more for... Um... Did you buy cards for other holidays? The challenge is giving on their mind. I think that that is a year three or four, maybe even year two. Lisa asked the same question.

Yeah, like how do you like extend the year-round? Yeah, yeah, exactly.

That is a great long-term goal, but it's not critical to the start.

Right, yeah.

People think about giving right now. I need to build up the brand. I need to get the nonprofits getting everyone in. And then maybe in two or three years, I fit a critical mass where I can market to customers directly. I'm not relying on a nonprofit to...

Yeah, right, right, right. Totally.

There were some other things that she thought about. Otherwise to extend the All great. I have the benefit of using a third-party printer. I don't have to worry about idle capacity.

That's the prayer's problem. Are they also the printer? Shutterfly and... They are. Oh, gotcha. They own their own equipment. Gotcha.

They own their own production facilities. So they need to keep their equipment moving all year round.

But if they do, their margins are good. Their margins are really, really good because they're verticalizing.

Their margins would be fine if they did only holiday cards. But then you have equipment that's idle for half the year.

Yeah, yeah, yeah.

Which? isn't good for them.

No, no.

The DynaMark, who I'm using for this, they're printing a bunch of other things right right right Right, that makes sense. Like, I'm eating up their excess capacity. Our capacity starts to... Their order volume goes down in the hot place. point of reason is naturally there's a lull Does Q4 budget start to drop, maybe?

Everyone is. Budgets are allotted, businesses slowed down.

Exactly. People are going on vacation, just the requests asked. So a lot of their business slips out, especially on this prayer. Okay. This particular equipment. And so this is a really nice balance because they're doing commercial printing for everything else. And now they're filling up their surplus demand in the holidays.

Yeah. Interesting. Hmm. Okay. Um... So the Carb designer, I still need to do that. I've taken one cut at it, but I need to dial it in, especially since we talked. I've got the notes for dialing this and I think we're pretty I know these logos and stuff down here, these buttons down here will change, but it's the functionality for right now.

You have this out for the photos, so how will that work if there's multiple photos?

You'll just click on each area or tap on each area. If it's got three on there, you'll have three different places to tap. So each area, and it can do drop, But you can't do that on a phone. So it's only on the web that you can drag a photo into that area. How much do you think people really need it? Need what?

Being able to stylize their photos. Because I can do a lot of that using iOS.

I don't think they have to. Now they do. You know, it's, it's, it's, you know.

I can stylize it before.

You totally could, yeah, yeah, totally. Um...

We get the benefit of doing this late. Yeah. They had to build that originally, but we don't.

Yeah, no, we don't have to. Yeah. Uh...

And they don't need to go to add text. They should, because the text box is already going to be on there.

Oh, right. Okay. Gotcha. So we don't need this. They just need to be able to... to put what they want in there. Right, so they don't need to... Yeah, I got you.

I'm wondering whether you even need that. Like, do you really need that panel? this whole thing. Uh-huh.

Could you just do it with you don't need the photos thing yeah, you Because you already have design you've already selected it This is if you want to change the design later on is the only functionality for that you don't people don't plan to want to do that Style is... could be under the more it could be you know like actually I don't think we need it's part of the design yeah yeah yeah there's a lot that the design does that that covers in terms of gaps yeah yeah yeah especially because If the design is not a border, like it kind of goes over top of this, right?

Yeah, so... And then more, I think I have just show safe zone. Yeah, I allow you to see the safe zone, which It's not showing up in mobile very well. Wait, hide this. Yes.

I think the what would be Helpful is to go ahead and start with the Card admin designer.

Yeah, yeah, it could be that. Because it...

helps drive the rest of it.

No problem.

And, So to that degree, on the card back branding details, So that's in here, I just tagged you on it. Okay, cool. This has the exact details of where that All the card designs that I'm creating, that I'll finish creating this weekend.

Mm-hmm.

I am making sure that the text, "Profits from this card supported" what charity name, will always be in the exact same spot.

Okay, yeah, that's great. Yeah, that's the way I'm thinking about this too, because this is a canvas to me. Right, it's a canvas that we export to a PDF, so all that makes total sense.

And Chanchu Piki's amazing at creating big photos.

Yeah, yeah, yeah. It got the fingers right. Yeah. Was it like a year ago or maybe it was two years ago? Like there'd be like six fingers or four fingers, you know?

I'm checking everything.

I'm like counting the number of teeth and everything.

Yeah, exactly.

It's amazing. So, for example, these girls.

That's very Nashville, too. I feel like I know those people at night. I know those people.

So this girl is this girl. The one on the left is this girl on the left here. And then that's her sister. If you compare them, Like. I think they're this, like, casual person is going to be like... I think of the same person. Yeah, yeah. And that's intentional, 'cause I'm gonna create a card design that has These two? And this one. And then... I think this is the one that failed to get the parents to look right.

Okay. And then this separate different family.

Oh my goodness. The quality is ridiculous.

Yeah, I've been very impressed. The one thing that I haven't loved is that too many of the men look too similar.

Oh, I got you.

Look at that. There is something in there where if I don't give Derek a promise.

But this is going to be a 5x7, right? These are mainly going to be 5x7s, and that's pretty good resolution for 5x7.

You don't have to print any of these. It'd be plenty fine for web resolution.

Yeah, yep, yep.

That's my problem. These are just samples.

Oh yeah, okay, gotcha.

Yeah, because if you look on their website all the cards always have sample pictures like go to Shutterfly and the designs always have pictures so you can help imagine how you can make this card look cool. This one has three on the bottom and one on the top.

Yeah, okay.

And so when I create the car designs that have multiple photos, I need to have multiple photos of the same people.

Yes, exactly, exactly, yes, yes, exactly. I don't know if we need all this. Does anybody actually read this? No.

No, no, no. It's not in those set up requirements. Product details. They're not getting multiple paper options.

Right, right. 6 by 8 or 5 by 7, that's interesting. They give two options. They give multiple options, but only two.

Many cards don't have two options. Many cards are just one option.

Yeah, but I just wonder why... Why they, yeah, that's just interesting.

So I think I've already belabored the point, but just in case. So the image template I'm giving you. It includes all the crop marks. You don't worry about generating crop marks.

Okay, oh this is gonna be one like this. Okay, yeah, yeah.

So I give you everything. Yep. When you display to the end user for, Editing the card.

Mm-hmm.

They should only see what's within. the crop marks.

And that math-Right, right. Yep, I've got that that way.

That math is also-I saw that. Like, you're only going to show them a window. Yep.

And I can show them not the window too, and if they go-That's like safe mode. Yeah. Yep.

You're voting on that. I'm going to do that. But have a Merry Christmas or Happy Holidays is all part of the image, the overlay, the design map. And any editable text will always be Google Fonts. And I would specify that in the design.

Okay, cool. Okay.

It should be just part of the text box. What font do you want?

No problem.

Google Fogs has 200 watts. Yeah, yeah. the common ones, and then what's made up happening is like handy. I need to wait just to go grab more fonts.

Yep, React, Google, Because I don't want to load all of them.

That would just crash the browser. Except for any given point, I may need to go grab an extra font. Or you might be able just to reference them.

Yeah, I'm trying to figure out how to do a library of them.

So. They give full rights to be able just to download them to self-host. And that just may be an option. Like each time I use a new font, maybe I just have two.

add them to a self hosted library come open to whatever but it could yeah that could just be a yeah we could have our own npm package or something that would be we could barrel it so it's not It's not always lotion all the time.

Not my highest concern, but in the back of my mind, like if Google's font server goes down, I don't want my You don't want the site to go down.

Or the tool, I guess. Because the site wouldn't go down, but the ability to do fonts and the ability to buy cards would.

When Google Sponsors go down, there's going to be a lot more on the internet than it also goes down. But I don't want to be... That can avoid being part of that collateral damage.

Yeah, yeah. Sounds good.

Would it be helpful? Yeah. For the card back designs. Especially for the photo placement.

To specify the The location the parameters so the options of these I guess that would be helpful because I can go through I'm gonna get creative and I can create a matrix of all those if you could do that that would be very helpful.

We're just using the same XY coordinates. Here's the size. Yep.

So height and width and But that's not part of the designer, the card designer. The back.

To the customer, they should just be selecting the parameters, or selecting the card design. So you go in here, there's a one card design, or one photo design, there's a three photo design. They're going to pick from like 15.

But I'm going to have it in the admin area to where you can design it. Only I can design it. Yeah, okay. Yep, I can do that. Okay. No problem. When we last talked, I was like, oh, demo, demo. He's thinking of this process. But... We have to do the card editor or the card designer really to even get to this process in a way. Okay. I can do that. Okay, what else?

We just go through Notion. Yeah. And we just go through Notion to see what on here. What's the best way to, would you like, for just saying, like, here's an MVP?

Will you just click on any one of those that you'd like to make part of the MVP? and just yeah just we'll add a field yeah let's just add a property and like we call version or something Oh yeah, you can use priority, that's fine. High priority can be the ones for... Okay. We can even show, we can go up to the filtering and show them on the cards if we wanted to.

you So you have the card dimensions and all the math. Yep.

I've even got all that in my knowledge base. So I'm... I'm cooking with oil. When I'm on this, when I'm working on this, it's super, super potent.

put this in there too yep I've got that that was the positioning and size of oh maybe I haven't seen that yet this is for the card back Okay, cool.

Okay. Okay, yep.

I did not create a sample of that one. Let me see, a little bit of the...

I almost feel like there's... Almost each of these pages are like a task in Notion in a way. So if I can hop over here without killing that. OK. I was thinking I was kind of putting it all in one, but it's really not that. It's not as simple as that. So we have the landing page that's in progress. I need to touch that up based on the one that you gave me here. I've still got some stuff to do to simplify ours.

Um... So that's one card that needs to be done. And then... The Front layout. so no no no then then we need to I need to update Flow to space. Start with design. The design of the card. Okay. then that will Get us there, and then we've got the-you're doing the back-the back-oh, yeah, yeah, you're doing the back cards. Um...

Just part of, for example, like for every car design, I will design a default back. pattern or colors or whatever. It might just be a solid color for some cards. But there'll be a default one that matches the front design. And then I'll get the option to add photos. You're getting the chevrons no matter what.

That's part of the car design. On top of it.

But then I'll create the windows. Here's the... parameters for a two photo design. So I'll give you the code, the parameters for x, y coordinates and height and width. Where to place the photos yeah perfect and that is it that's their option they can't just drag i don't want them dragging photos around right right no i want this thing to look organized i want a little professional this thing needs to look beautiful when it gets delivered i'm saving people from themselves well that allows me to force them to do the tap to upload a photo exactly it's really fast yes yeah that makes total sense i really like that and so i'll create So I'll go and create all of those I'll create a card in notion like here's the Here's all the possible design options for the back.

Sorry, the single image to...

And multiple And then you gave me design options for the front already. Those are in Notion.

I put a couple in there. Okay. I'll add some more. All right, I'll just put it as a takeover here. There's at least one in there and I have a couple that are in progress.

Okay. Um. And then I'm also going to save. So I'm going to save card designer. Save to... Uh... It's probably PNG. Card, whoops. I'm going to do it that way, whatever. OK. Save metadata? Okay, so then we can pull it back. We've got one for the card designer. I think it's this one right here. Yeah. Yeah, that's no problem. I can do that in a matter of maybe two or three hours. That's probably the biggest piece that I have to really put my mind on.

But that, and it's also like a, it's like a templating system for our, our whole site though. Like it's, that's a pretty, that's pretty, pretty fundamentally important. Um... Okay, so Maybe I can... I'm not worried about this. That's all done. These are done.

SEO, don't worry about SEO. Great, whatever works.

Again, I'm relying on...

Oh, Claude Cote will write the SEO and it's awesome. I feel like we've kind of got this going. We still have some work to do, but it's... You've already gone over this I need to finish the stuff from there I haven't done the printer admin area. I'll do that. But these weren't ones that I thought we had to have for demoing to charities. We don't. But I might still get them by Sunday because once I get some of that Yeah, once I get through this editor, it just starts layering on.

It gets easier because it's stuff that it's seen before.

Yeah, exactly.

On there, what's missing is it's not just the stripe. Payments.

Yeah. It is also strike tax.

So you're going to need this. That's on here, the sales tax collection. Okay. Um... Stripe has a really good text module.

Based on location. Yeah, okay. Yeah, cool. I can put that in.

So what's amazing about this, I'm doing my research, For orders outside of Tennessee, the first $100,000 from those states is so tax free. You can get to $5 million scale. if I don't work at the Tennessee without collecting any sales tax. Um, if I can get the orders to go to each stage. But that's tremendous scale without having to, which is awesome.

Yeah, it gets you started off, right? You know, get you going, yeah. Order fulfillment flow. Okay, that's after. Yeah, okay, cool. We don't need to go over that now. Okay. Um... There's still some stuff here that I will probably break into other cards I think just so we have it with this I'll just yeah, I'll leave that there for now Okay, so design options, the card designer. Reordering, removing the, yeah.

Move envelopes. Okay. Um. Greetings. Selectable greetings.

Now that's not MVP.

Yeah, it's easy though. Okay. Yeah, anything I can get into that designer becomes really easy. for the next part. So if I can give you the ability to add in images and stuff like that, like if you can upload it, and I know that maybe Photoshop, there's still some stuff to do with the images.

Everything requires a manual piece, but that's fine. Yeah, and I can do some of that too.

I've got some graphic design capabilities. But anything that we can put, if I can make that designer super powerful, then it's kind of like you can go to town that. becomes It's like generative, but also Fixed right because you're generating an image that can't get messed with can't get broken right and then we just print on top of it Yeah Yeah.

Between last time we talked and now, something has clicked. Yeah, yeah.

Yeah, oh, yeah, yeah. I don't know when, but it has.

Because you were wanting the open-ended design. Open-ended, they're gonna screw it up.

Right, right. I think it's a number of things. Starting off when we talked about this mobile first stuff. When I started going back through the designer and thinking mobile first and how we'd like select an image, that got me thinking, that was like the first layer of it. So I think it's been like layers.

And then you start to see the pieces coming together.

Yeah, yeah. One notion you told me about like the layers, then you give me that like JSON object of like coordinates. and like the text and stuff. And I was like, okay, that clicked. And then this one with the card designer, I didn't think about doing that first. I should have thought about doing that first because I was like, oh, he wants to demo this to-to non-profits, so I want to get that first, but then as I was doing this, I was like, "Whoa, shit, I need overlays or underlays, whatever you call them.

Those are mats and borders and things, designs." So yeah, kind of like a little bit cut the cart, like doing 180 a little, but yeah, I'm super, super in line now, I think. I don't know. I don't know why I was thinking this was like the first page, but really, like if you go, if you're not in the editor, Like because if you're not in the editor and you select one like this is what this would be like a design like that Right, so you select when you go okay customized card then it goes in to this but that's like a step zero in a way.

Yeah Whereas like that's not what should be the front layout the front layout should be the designs. I This page here should actually be the list of people.

This should be step two, right? Because step one should have already happened when we grabbed this as step one, right? Step one. Oh, whoops. What did I do? Crap. I don't know what I did. I did click step one, boom. And then this is step two. No envelope, select front, select back.

Once you get here, so if you click, so this should be the, step one should be the list of 20 to 40 designs.

Yep, okay, yep, yep, exactly, yep, yep.

That's the landing page or page 1.

Yeah, exactly. The cards, it could be a slash cards.

Step 2 is I want to tap on this box and add my photo.

Step one, boom.

Step two would be, you'd already be on the photo. You'd already be editing the card.

Oh, right, because this is implied based on the design. Sorry, duh. Yeah, duh. Okay. I got you. And then the back, is options that are already supplied. This whole thing, this page here, doesn't exist anymore. Mpix does this, but we don't need to do this, right? Okay, cool. Okay, cool. Okay, so then One, select the design. Two, upload photos. Do the do that Put your text, like your name and like, you know, like the editable text, right?

Personalize the card. Personalize the card.

Step three, select a charity. Step four, review and check out. Oh shit, yes. Perfect. Perfect. And now Notion's going to make sure I don't mess it up. Okay. Okay, am I missing any tasks? Yes, I am. Streamline. Step one. This may not totally make sense, but it's somehow going to make sense to me when I look at it. Street line set, one select design. Um... Streamlined. Streamline choose... Oh yeah, delete.

Delete layout selection. Step implied from Step one, select design. Okay, I think that should do. That. May not be good enough, but it makes sense to me. I know it's going to be okay. Um... Okay, that's on front and back. No envelope. Let me just...

Step one, select your card design, which is really the design mat.

Design mat, yep.

Step two is add my photos to that mat now.

Yep, yep, yep. Multiple or, you know, this one is one photo right here. Upload photos.

The text box should already be on here. Right, right. So I can actually tap on the text box to change that.

Boom, yes, okay, that makes sense. Right, right.

I don't think you need a separate Shelf.

Oh this whole panel this whole thing can go away.

Yeah, because you can edit straight on the card Yeah, exactly.

Yeah. Yeah, definitely. Yeah Well, yeah. And right now I'm only doing that in... when it's big enough, you know, because this is more mobile type. But yeah, that... you could get rid of that expand and hide stuff, which was really cumbersome. As you saw, I was trying to do that. That was very cumbersome. And then we don't need this because you're not changing your design. So then you continue, you select your colors.

We'll be doing a back redesign now.

A back design.

So it would be like this.

I thought that was part of the... You'd select that when you select the overall design of the front.

Yes. The back is pretty popular, but if you want...

If they ended up wanting...

Two photos. The back, I'm going to create the... 15 different potential templates for the back.

Oh, will there be, so they will, will that be a solo app chooser then? Oh, okay cool. Okay. Yeah.

Okay that makes sense. They can't change the background But when they can't change it, how many photos?

No, but they can say how many photos, yeah. And which layout photos they want.

Yeah, diagonal, yeah, okay. They can get artsy, okay, gotcha. No, I'm on the same page.

And I will get those parameters to you. I will make sure that I have. pricing table As a I know she's right.

Yeah. We don't need that in code, I don't think. It's just for you and me, right?

We need to tell the customer when they're selecting a card.

Oh, I do need that in code.

Okay. That MPEG-like drop-down of how many cards are hoarding, how much it's going to cost.

Yeah, if you could get me that in CSV is fine or spreadsheet, do you, Google Docs, whatever.

It should be something we can change. It should be parameterized so that we can change it because the printing costs will go up over every year.

Right, right. So, but how, so... The way I do that with graph-so Graphite Atlas has an ontology. And we use Airtable because that's really, really easy for the team to work in. And then I pull that on build and I populate JSON structures. I'll give it to you in CSV.

Is that okay?

Yeah. Okay. And then, well, I didn't know if you, how often do you need to change this data? Probably once a year. Okay, okay, cool. Yeah, so I can upload a CSV to Neon, do a drop postgres, and then it'll be super fast and easy. I just didn't know if you needed that in the admin area because but maybe maybe that's in the future We could maybe put it in the admin area and make it kind of cool. Good with that.

So you'll upload a CSV to here for pricing. Mm-hmm.

I will. Okay, cool. No worries. I don't know what I did. I don't know how I broke that.