// Knitwit’s privacy statement, terms, and accessibility statement.
//
// Adapted from the corresponding documents for Grip (Digitaal Toegankelijk B.V.), which are written
// for a business-to-business SaaS platform sold on subscription. Knitwit is neither: it is a
// consumer app, free, with no billing, no customer organisations and no processor relationship with
// its users. So the structure and the plain-spoken tone are carried across and most of the
// substance is not — a privacy statement describing data Knitwit does not hold, or terms about
// invoices it does not send, would be worse than none. It would be a false statement to the people
// relying on it.
//
// Kept as data rather than markup so the three documents cannot drift apart in how they look, and
// so the wording is diffable when it changes.
//
// ## No postal address, deliberately
//
// Pientr Holding is registered at a home address and it is not published here. The company is still
// identifiable: the Chamber of Commerce number is given, and the register resolves it to an address
// for anyone with standing to need one. If Knitwit ever needs to print a street — a PO box or a
// registered office would be the way to do it — it goes in OPERATOR below and appears in all three
// documents at once.

export type LegalSection = {
  heading: string;
  body?: string[];
  list?: string[];
};

export type LegalDocument = {
  title: string;
  updated: string;
  intro: string[];
  sections: LegalSection[];
};

// Fill these in and the placeholder disappears from all three documents at once.
export const OPERATOR = {
  name: 'Knitwit',
  legalEntity: 'Pientr Holding B.V.',
  // Knitwit is the name on the app; Pientr Holding B.V. is the company behind it. Both are named
  // wherever the operator is identified, because a knitter who wants to exercise a right, or a
  // regulator who wants to find somebody, needs the registered entity and not the product.
  tradingAs: 'Knitwit',
  chamberOfCommerce: '93543212',
  vat: 'NL866443769B01',
  email: 'hello@knitwit.eu',
};

const WHO_WE_ARE: LegalSection = {
  heading: 'Who we are',
  body: [
    `Knitwit is a trading name of ${OPERATOR.legalEntity}, a company registered in the Netherlands. Chamber of Commerce ${OPERATOR.chamberOfCommerce}, VAT ${OPERATOR.vat}.`,
    `Write to us at ${OPERATOR.email}. That address reaches a person, and it is the right one for anything in this document — questions, corrections, or a request about your own data.`,
  ],
};

export const PRIVACY: LegalDocument = {
  title: 'Privacy statement',
  updated: '23 September 2026',
  intro: [
    'This explains what Knitwit knows about you, why, and what you can do about it. It is meant to be readable — if anything here is unclear, write to us and we will fix the wording.',
  ],
  sections: [
    WHO_WE_ARE,
    {
      heading: 'Who this applies to',
      body: [
        'Anyone who uses Knitwit. There is no organisation behind your account and no administrator above it: your knitting is yours, and we are the controller for the data described here.',
      ],
    },
    {
      heading: 'What we hold',
      list: [
        'Your account — the email address you signed up with, and a password we never see in readable form. If you sign in with Apple or Google instead, we receive whatever identifier they give us, and the address they pass on.',
        'A display name, if you choose to set one. It is what the app calls you and nothing else.',
        'Your knitting — projects, patterns, your yarn and needle stash, row counts, time spent, notes, and any photographs you add. This is the substance of the app and most of what we store.',
        'Technical data that any website receives — IP address, device and browser type, and error logs when something breaks. We use this to keep Knitwit working, not to build a picture of you.',
        'What you send to the pattern reader — see below, because it leaves our systems.',
      ],
    },
    {
      heading: 'What leaves Knitwit, and where it goes',
      body: [
        'Three of Knitwit’s features work by sending your text or pictures to a language model. This is worth stating plainly, because it is the only case where your knitting is read by anything other than Knitwit:',
      ],
      list: [
        'Reading a pattern — the text or document you import is sent for parsing.',
        'Reading a ball band — the photograph you take of a yarn label is sent so its details can be filled in for you.',
        'Translating a pattern for sharing — the words of the pattern are sent, without the numbers.',
      ],
    },
    {
      heading: 'Who processes data for us',
      list: [
        'Supabase — the database, file storage and sign-in behind Knitwit. Your data lives in their EU region (Ireland).',
        'GreenPT — the EU-based AI service that reads patterns and ball bands, as described above.',
        'Vercel — hosts knitwit.eu.',
        'Expo — builds the mobile app and delivers its updates.',
        'Apple and Google — only if you choose to sign in with them, and only for that.',
      ],
      body: [
        'We do not sell your data, we do not rent it, and nothing here is used for advertising. There is no advertising in Knitwit.',
      ],
    },
    {
      heading: 'Transfers outside the EEA',
      body: [
        'Your account and your knitting are stored in the EU, and the pattern reader is an EU service — both deliberately. Some infrastructure suppliers are established outside the EEA; where that is so, transfers rest on the European Commission’s standard contractual clauses.',
      ],
    },
    {
      heading: 'Why we are allowed to hold it',
      list: [
        'To provide Knitwit at all — without an account there is nothing to sync and nothing to come back to. This is the performance of our agreement with you.',
        'Our legitimate interest in keeping the service secure, catching abuse, and finding out why something broke.',
        'A legal obligation, where one applies.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'Your knitting stays as long as your account does. Delete your account and we delete it, within 30 days, apart from anything we are legally required to keep. Technical logs are kept briefly and then discarded.',
        'You can take a copy of everything at any time — Account, then Download a backup. It is a plain file and it is yours.',
      ],
    },
    {
      heading: 'Keeping it safe',
      body: [
        'Every row in the database is readable only by the account that owns it, enforced by the database itself rather than by the app asking nicely. Photographs are in private storage, not on a public URL. Everything travels encrypted. If something goes wrong in a way that puts you at risk, we will tell you.',
      ],
    },
    {
      heading: 'Your rights',
      list: [
        'See what we hold about you.',
        'Correct anything wrong.',
        'Have it deleted.',
        'Object to, or restrict, how we use it.',
        'Take it elsewhere in a portable form.',
      ],
      body: [
        `Write to ${OPERATOR.email} and we will answer within four weeks. If you are unhappy with how we have handled it, you can complain to the Dutch Data Protection Authority (Autoriteit Persoonsgegevens).`,
      ],
    },
    {
      heading: 'Cookies',
      body: [
        'Knitwit stores what it needs to keep you signed in and to hold your knitting on your own device. That is all. There is no analytics, no tracking, and nothing shared with anybody for advertising — which is why Knitwit does not ask you to accept cookies. There is nothing to accept.',
      ],
    },
    {
      heading: 'Children',
      body: [
        'Knitting is for everybody, but an account is not: you need to be 16 or older to create one. If you believe a child has made an account, tell us and we will remove it.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'We may update this. If a change matters to you, we will say so in the app or by email at least 30 days beforehand.',
      ],
    },
  ],
};

export const TERMS: LegalDocument = {
  title: 'Terms and conditions',
  updated: '23 September 2026',
  intro: [
    'What you can expect from Knitwit, and what we expect from you. No small print requiring a lawyer — plain agreements.',
  ],
  sections: [
    WHO_WE_ARE,
    {
      heading: 'Your account',
      body: [
        'You need an account to use Knitwit, and you need to be 16 or older to have one. Give a real email address — it is the only way back in if you forget your password.',
        'Look after your account. What happens inside it is your responsibility. If you think somebody else is in it, tell us quickly.',
      ],
    },
    {
      heading: 'What it costs',
      body: [
        'Nothing, today. Knitwit is free and there is no paid plan. If that changes, anything you would have to pay for will be made clear before you pay it, and nothing you already have will be taken away without notice.',
      ],
    },
    {
      heading: 'What you can expect',
      body: [
        'We do our best to keep Knitwit working, safe and available, but we cannot promise it never breaks. Maintenance, updates and faults happen. Features change, and occasionally one goes away.',
        'These terms contain no service level agreement. Knitwit is a free app and is offered as it is.',
      ],
    },
    {
      heading: 'Fair use',
      body: [
        'The pattern reader, ball-band reader and translator cost real money to run, so each account has a daily allowance. Ordinary use will never reach it. Automated or bulk use may, and we may limit or suspend an account that is affecting the service for everybody else — we will try to talk to you first.',
      ],
    },
    {
      heading: 'Your knitting stays yours',
      body: [
        'Everything you put into Knitwit — your projects, your patterns, your stash, your notes and your photographs — remains yours. We do not claim it, we do not publish it, and we do not show it to other knitters. We use it only to run the app for you, as set out in the privacy statement.',
      ],
    },
    {
      heading: 'Patterns that belong to somebody else',
      body: [
        'Knitwit lets you import a pattern and read it. Many patterns are somebody’s copyrighted work, often their livelihood. Importing one for your own use is between you and whoever wrote it, and it is your responsibility to have the right to do it.',
        'Knitwit does not share your patterns with anyone. The PDF export is for you — printing it, keeping it, or giving it to a friend is subject to the same rights as the pattern itself.',
      ],
    },
    {
      heading: 'What belongs to us',
      body: [
        `Knitwit itself — the app, its design and the software behind it — remains the property of ${OPERATOR.legalEntity}. You may use it; you may not copy it, reverse-engineer it, resell it, or scrape data out of it.`,
      ],
    },
    {
      heading: 'The parts that use AI',
      body: [
        'Reading a pattern, reading a ball band and translating a pattern are all done by a language model. Its output can be wrong, and sometimes confidently so: a misread stitch count, an invented yardage, a mistranslated instruction.',
        'Nothing it produces has been checked by a person. Check it against the original before you knit from it, and certainly before you cut anything. We are not liable for a garment that came out wrong because an AI reading went unchecked.',
      ],
    },
    {
      heading: 'Liability',
      body: [
        'Knitwit is free and offered as it is, and we are not liable for indirect loss. Nothing here limits our liability for intent, deliberate recklessness, death or personal injury, or anything else the law does not permit us to exclude — and if you are a consumer, your statutory rights are unaffected by any of this.',
      ],
    },
    {
      heading: 'Ending it',
      body: [
        'You can stop whenever you like, and you can delete your account from the Account screen. Take a backup first if you want to keep your knitting; after deletion we cannot get it back.',
        'We may suspend or close an account that breaks these terms or damages the service for others. Where we reasonably can, we will warn you first.',
      ],
    },
    {
      heading: 'Things outside our control',
      body: [
        'If Knitwit is unavailable because of something we cannot control — a supplier outage, an attack, a power failure — we are not liable for the consequences, and we will tell you what we know as soon as we can.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'We may change these terms. Important changes are announced at least 30 days beforehand, in the app or by email. If you do not agree, you can delete your account before they take effect.',
      ],
    },
    {
      heading: 'Which law applies',
      body: [
        'Dutch law. If we disagree, we would much rather talk it through first. Failing that, the dispute goes to the competent Dutch court.',
      ],
    },
  ],
};

export const ACCESSIBILITY: LegalDocument = {
  title: 'Accessibility statement',
  updated: '23 September 2026',
  intro: [
    'This describes how accessible Knitwit currently is, and what is being done about the parts that are not. It is written to be honest rather than reassuring: an accessibility statement that overstates where a product stands is of no use to the people who need it most.',
  ],
  sections: [
    {
      heading: 'About the European Accessibility Act',
      body: [
        'The European Accessibility Act (EAA) is European law intended to make products and services usable by everyone, including disabled people. Since 28 June 2025, organisations it covers must meet EN 301 549, which is built on the Web Content Accessibility Guidelines (WCAG) 2.1 at levels A and AA.',
      ],
    },
    {
      heading: 'What digital accessibility means',
      list: [
        'It works with a screen reader.',
        'It can be operated with a keyboard alone.',
        'There is enough colour contrast to read it.',
        'The content can be perceived and understood by everyone.',
      ],
    },
    {
      heading: 'What we are aiming for',
      body: [
        'WCAG 2.2 levels A and AA across the whole of Knitwit, on the web and on the phone.',
      ],
    },
    {
      heading: 'Where Knitwit actually stands',
      body: [
        'Knitwit has not been audited by an independent accessibility consultancy, and no WCAG-EM evaluation has been carried out. What follows is our own assessment, measured where it can be measured. On that basis Knitwit partially conforms to WCAG 2.2 A and AA: some of it meets the standard and some of it demonstrably does not.',
      ],
    },
    {
      heading: 'Known failures',
      body: ['These are measured, not estimated, and they are the reason this statement says “partially”.'],
      list: [
        'Colour contrast. WCAG AA asks for 4.5:1 for ordinary text. Knitwit’s main body text on its background measures 9.9:1 and is comfortable. Several other combinations are not: white text on the primary button is 2.5:1, link green on the background is 2.7:1, and the warning orange is 2.8:1. These fail, they appear throughout the app, and they are the most significant accessibility problem Knitwit has.',
        'Screen reader labelling is thin. Roughly a dozen controls carry an explicit label or role; many more rely on their visible text, and some icon-only controls carry nothing at all.',
        'No control announces its state — whether it is selected, expanded or busy — so a screen reader user cannot always tell what has happened after they act.',
        'Knitwit has not been tested with VoiceOver, TalkBack, or with disabled users. Until it has, this list is what we have found rather than what there is to find.',
      ],
    },
    {
      heading: 'What already works',
      list: [
        'Headings are marked as headings, so a screen reader can navigate by structure.',
        'Touch targets are enlarged beyond their visible size throughout, which helps anyone with limited dexterity.',
        'Body text sits well above the required contrast.',
        'The app respects the text size set on your device.',
      ],
    },
    {
      heading: 'What we are doing about it',
      list: [
        'Correcting the failing colour combinations. This is the first thing, because it affects everybody and it is measurable.',
        'Labelling every control that a screen reader would otherwise announce as nothing.',
        'Testing with VoiceOver and TalkBack, and then with people who use them daily.',
        'Commissioning an independent WCAG-EM evaluation once the known failures are fixed, rather than paying to be told about them.',
      ],
    },
    {
      heading: 'If something is in your way',
      body: [
        `Tell us at ${OPERATOR.email}. Describe what you were trying to do and what stopped you — that is far more useful than a guideline number, though a guideline number is welcome too.`,
        'We will acknowledge within 3 working days, keep you posted, and tell you plainly if something will take a long time to fix.',
        'If a part of Knitwit is unusable for you and the fix is not quick, write to us anyway: we would rather help you directly in the meantime than have you wait.',
      ],
    },
  ],
};
