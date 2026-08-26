# CHAIRSIDE: pricing and payments, answered

---

## 1. Can you actually get paid?

**Yes, this week, without forming anything.** Stripe is the wrong question.

**Stripe is closed to you.** Jordan is not a Stripe merchant country. The UAE is the only Middle East country on stripe.com/global — Saudi, Egypt, Qatar, Kuwait, Lebanon are all absent too. There is no waitlist. Stop designing the billing layer around Stripe.

**But here is the thing almost everyone misses: Jordan IS a supported Stripe *payout* destination.** Stripe won't onboard you as a merchant, but it will send money to a Jordanian bank account. That gap is what makes merchant-of-record platforms work for you.

**Do this: open a Polar account.** Polar's docs name Jordan explicitly and say *any individual or company operating in our supported countries can receive payouts from Polar even if Stripe standalone is invite-only there*. Polar is the merchant of record — it sells to your customer, handles tax, and pays you. You need a Jordanian ID and a Jordanian bank account. No company. No US entity. Live in days.

Cost: 5% + $0.50, plus 1.5% for non-US cards, plus ~$2/month payout fee and 0.25% + $0.25 per payout.

**Paddle is the alternative** and is better if universities become buyers, because it invoices and handles VAT in 200+ jurisdictions. Its policy is "anywhere except this list," and Jordan is not on the list. 5% + $0.50, pays via Payoneer (which works in Jordan). Catch: **$100 minimum payout** — at $5 a head that's 20 customers before you see a dinar.

**Skip:** Creem (Jordan not supported — Israel and UAE only), Wise (won't open accounts for Jordan residents, doesn't even send JOD there), Lemon Squeezy (Stripe owns it and is migrating users to Stripe Managed Payments, which excludes Jordan), Tap Payments (verbatim: "We currently do not accept any new merchants from Egypt, Jordan, or Lebanon"), FastSpring (~$0.95 flat fee = 19% of a $5 sale).

**Your US citizenship: real, powerful, and not yet.** Because you have an SSN you skip the two things that break this route for everyone else — the 8-12 week ITIN wait and the EIN delay. Stripe Atlas is $500 one-time (Delaware C-corp, EIN, 83(b) filing, next-day processing) then $100/year, plus Delaware's own ~$450/year for a C-corp ($400 franchise tax + $50 annual report). **Realistic year one: ~$950.**

Don't spend it yet, for three reasons:
- It creates permanent US filing obligations. **15.3% self-employment tax** applies and the Foreign Earned Income Exclusion does *not* remove it, because the US has no totalization agreement with Jordan.
- The whole chain hinges on one unverified link: **will Mercury open an account for a founder resident in Jordan?** Jordan is not on their prohibited list, but they offboarded Ukraine, Nigeria, Pakistan, Croatia and the Philippines in July 2024 with days of notice.
- Polar gets the money in now for $0.

**Form it when one of three things happens:** YC accepts you (they require the Delaware C-corp anyway), a US/EU university wants to pay an invoice, or MoR fees exceed ~$550/year.

> **This week, free, 10 minutes:** email Mercury support — *"I am a US citizen with an SSN, residing in Jordan, forming a Delaware C-corp. Can I open an account?"* Get it in writing. That one email de-risks $950.

---

## 2. What students can actually pay with

**This is your real blocker, and it is not the processor.**

World Bank Findex, Jordan: **2.82% of adults have a credit card.** 32.43% have a debit card. Credit cards have been flat near 3% for a decade (3.48% in 2011, 2.53% in 2017). Your customers are young and disproportionately female — a 12-point gender gap in financial inclusion means they sit *below* those averages.

**A monthly card-on-file subscription is the single worst collection mechanism for this audience.** A payment method the customer doesn't have is identical to no payment method at all.

What they actually use:
- **eFAWATEERcom — 5.09 million users, 30M+ transactions/year.** Jordanian universities (German Jordanian University, PSUT) already collect tuition through it. Your exact segment already has the habit, and it's cardless — payable at ATMs, bank apps, tellers, exchange houses.
- **Google Play gift cards, buyable in Jordan through Zain Cash.** This is the sleeper. Jordan is supported for both developer *and* merchant registration on Google Play (many countries only get the first). Payouts in USD by wire, $100 minimum. Fee is 15%. **It is the only route on this list where a student with no card and no bank account can still pay you.**
- **CliQ** (2.16M users) and mobile wallets, for local-gateway routing.

**To reach eFAWATEERcom you need a registered merchant.** Everyone assumes that means a JOD 30,000 LLC. It doesn't. **A sole proprietorship (مؤسسة فردية) costs JD 5-40 and takes 10-15 minutes at the counter.** That converts PayTabs (~2.25%), HyperPay and Amazon Payment Services from CLOSED to OPEN, at 3-4.5% all-in — a quarter of what any MoR charges.

**So: a split stack.** Polar for international. Google Play (and/or a JD 5-40 establishment + local gateway) for Jordan.

---

## 3. Is $5 right?

**The price level is roughly right for Jordan. The cadence is wrong, and $5 is far too low everywhere else.**

**Jordan/MENA undergrads — $5 is defensible but sits above the anchor.** Spotify Student in Jordan is **$2.99/month**. That's the number in a Jordanian student's head for "what a student app costs." $5/month reads as 67% more expensive than the most familiar subscription in the country.

But affordability is a red herring. $5 = **JOD 3.55**, under 2% of a JOD 200-400 monthly student budget. Dental students are among the wealthiest student cohorts in Jordan — the University of Jordan parallel track charges **JOD 250 per credit hour** (JOD 500 for non-Jordanian certificate holders). A family paying that does not blink at JOD 3.55. The barrier is *collectability and willingness*, not capacity.

**US/EU — $5 is leaving 3-5x on the table.** Neural Consult, your closest named competitor with a dedicated dentistry page, charges **$24.99/month** ($18.75 billed annually) with no student discount. Price a US tier at $12-15.

**And here is the reframe that matters most.**

**There is no INBDE-equivalent gating Jordanian dental graduates.** The Jordan Medical Council practice test applies to graduates of *foreign* universities. The Jordanian Board is a post-residency specialty exam. Baseline licensure is 5 years plus a 12-month internship — no high-stakes MCQ. **So don't market CHAIRSIDE to Jordanian undergrads as "exam prep." There is no exam.**

**The urgency exam is the Gulf licensure exam, sat after graduation.** Jordan's dental market is oversupplied and graduates emigrate. Every Gulf authority gates entry behind a Prometric exam plus DataFlow verification, and one attempt costs four figures:

| Authority | All-in cost, general dentist |
|---|---|
| Saudi SDLE | SR 3,385 |
| Dubai DHA | AED 2,020 |
| UAE MOH | AED 2,688 |
| Qatar QCHP | QAR 1,968 |

Incumbents serving that cohort charge **$69.99** (ExamCure, 6 months) to **$115-250** (eDentalPortal) — 14-50x your $5. INBDE Booster charges **$279 for 90 days**. That cohort has a deadline, a price anchor, and a measurable outcome. **That is the tier worth building the pitch around.**

**Verdict: three prices, not one.** Free game → $12 list semester pass, PPP-discounted to ~$5 for Jordan/MENA → **$59 Gulf-exam pass, 6 months, mapped to the SCFHS/DHA syllabi.** Never quote $5 as your global price in the YC application; quote the list price and the regional discount, so nobody reads a $5 ceiling on the US market.

---

## 4. One-time vs monthly vs credits

**Pick: a term pass with a quota named in lectures.** Not monthly. Not credits. Not unlimited.

**Why not credits.** Students don't buy credits; developers do — and even developers revolted. Cursor's June 2025 switch to credit billing took users from ~$100/month to **$20-30/day**, produced a public apology and refunds for charges between June 16 and July 4. Lovable's users named the feeling: *"credit anxiety."* A visible credit meter makes a student ration the feature and then resent it. Internally you meter tokens. Externally you say **"30 lectures this semester."**

**Why not $5-one-time-for-unlimited.** At $0.015/lecture, break-even is **333 lectures**. Sounds unreachable — until you remember that one Recipe Ninja user ran the same generation **12,000 times for a $700 bill**. Unlimited-per-use funded by a bounded one-off payment is unbounded liability, and it grows fastest for the users who love you most.

**Why not $5/month.** Fees. Every MoR charges a flat ~50¢ that is 10% of a $5 ticket *before* any percentage:

| Structure | Fees | Effective rate |
|---|---|---|
| $5/mo × 12 through Paddle | 12 × $0.75 = **$9.00** on $60 | **15.0%** |
| $12 semester pass through Polar | $0.60 + $0.50 + $0.18 = **$1.28** | **10.7%** |
| $50/year one charge through Paddle | $0.50 + $2.50 = **$3.00** | **6.0%** |

Same processor, same customer, **9 points of margin.** And you clear Paddle's $100 payout minimum in two customers instead of twenty. It also matches how Jordanian students already pay for everything at university — per semester, via eFAWATEERcom — and removes card-on-file entirely, which 97% of Jordanian adults cannot use.

**The recommended SKU:** *"$12 unlocks Case Builder for this semester. Includes 30 lectures."* Cost exposure: 30 × $0.015 = **$0.45**. Bounded, and it creates a renewal event every semester — a retention data point, not a one-off transaction.

**Cost control, in order:**

1. **Verify the real per-lecture cost before launch.** Your $0.01-0.02 is probably per *call*, not per *pipeline*. One upload is extract → structure → generate case → generate distractors → validate. Instrument cost-per-completed-upload end to end. VINspectorAI's "10 lookups" cap looked safe until each lookup fired 3-4 chained calls and one feature hit $18.25 in a week. Assume your real number could be 3-4x.
2. **A hard per-account dollar ceiling in middleware, plus a provider-level account cap.** Rate limits cap requests, not dollars. Only a spend ceiling controls cost.
3. **Async batch processing — 50% off, and "your case will be ready in a few minutes" is a perfectly good UX.** This one is nearly free to adopt and halves your bill.
4. **Prompt-cache the fixed scaffolding** (system prompt, case schema, dental rubric, few-shot examples) — identical on every upload, and cached reads bill at **10% of base input price**. One published team reported $8,000/month vs $45,000 for identical work.
5. **SHA-256 dedup scoped to the uploader's own account only** — never a cross-user lookup, for copyright reasons.
6. **Gate uploads behind an account + phone OTP, not a .edu email.** Over 40% of college students never receive a .edu address, graduates keep theirs, and free fake-.edu generators are a live commercial category. Most of your market has no institutional address in the form the check expects. Instead, make university-email verification *optional* and reward it with a **larger** free allowance — that flips a barrier into an incentive and quietly builds the institution-by-institution map you'll need for the university sale.

---

## 5. The free/paid line

**Confirm "free game." Revise "paid uploads" — the wording, not the code.**

**The problem with selling uploads: Knowt already gives that away free, and charges $5/month for everything else — exactly your price.** Knowt's *free* tier does upload-a-PDF-and-get-study-material with AI, unlimited flashcards, quizzes, summaries. "Turn my lecture into content" has been commoditised to zero by a better-funded competitor. Sell it head-to-head at $5 and you lose the comparison in one screenshot.

**What is not commoditised: a 2-3 player hidden-information co-op case that a study group plays together.** Nobody sells that.

Same code. Different sentence:

> ~~"Upload your lecture and get study material."~~
> **"Turn your lecture into a case your study group can play."**

**Yes — the buyer unlocks their friends, and yes, that is the growth engine.**

Copy Jackbox exactly: **only one person needs to own it.** Joiners connect with a room code from any phone browser, no account, no download. That model produced **826 million+ game joins since December 2022** and ~$47M in 2024 online revenue. EA runs the same thing as Friend's Pass on *It Takes Two* — and has kept it across multiple titles, which is the real signal (retiring a cannibalising feature is easy; keeping it means it works).

**Marketing line: "One of you pays, all three of you play."** That converts the price objection *"I can't afford it"* into a group decision *"one of us gets it."*

**The invite prompt goes at the locked-role moment, not at signup.** Dropbox's referral is famous for the 3900%-in-15-months number, but the transferable part is the *placement* — the prompt fired at 80% storage, when the invite solved a problem the user was feeling right then. You have a cleaner version: a hidden-information case *literally cannot be played alone*. **"This case needs a second dentist. Send a link."** Make it double-sided in your own currency — both players get an extra free upload when the invited friend finishes a session. That spends ~$0.03 of AI budget to buy an activated user. No paid channel comes close.

**Free allowance: give every account 3-5 free lecture uploads per month.** At $0.015 that's $0.045-0.075/user/month; **1,000 free users costs $45-75/month.** Budget $100/month and treat crossing it as a conversion signal, not a fire. Students who have never seen their own lecture become a case have no reason to pay for it.

**Draw the library line deliberately.** Curate the built-in cases around fundamentals and classics — *deliberately not* any one university's syllabus. The purchase trigger you want is: *"this is great, but my perio final is Thursday and it's on Dr X's slides."* Evernote's free tier was so complete that conversion sat under 2% for years until they cut it from 100,000 notes to 50. Zoom drew the line at 40 minutes. Your line is better than either, because the free game and the upload are genuinely different jobs — but only if the library stays general.

**And be honest about Anki.** It's free, open-source, has the best-validated SRS algorithm available, and there's a large free dental deck ecosystem. You will not out-retain it. Don't try — students will make that comparison in the first thirty seconds. But note that **AnkiHub charges ~$6/month for live errata on top of free Anki**: the paid layer is *curation and currency*, not the algorithm. And the documented Anki failure modes are exactly your feature — **65.7% of students report being overwhelmed by card volume, 37% cite not enough time to make cards.** Market the two things Anki structurally cannot do: ingest *this professor's* PDF with zero authoring labour, and Gulf-syllabus-mapped case content no free deck covers.

---

## 6. The next 30 days

**Week 1 — validate and de-risk, write no billing code**

1. **Post one question in your dental-student WhatsApp/Telegram groups:** *"If you wanted to pay 3 JOD for something online right now, how would you do it?"* Options: card / eFAWATEERcom / Zain Cash or e-wallet / CliQ / ask someone with a card / I couldn't. **That answer picks your payment stack — not any fee table above.**
2. **Second question, 20 students:** *"Would you rather pay JOD 3.5 every month, or JOD 11 once for the whole semester?"* Settles the cadence in a week, costs nothing.
3. **Email Mercury.** (Section 1.) Free, 10 minutes, de-risks $950.
4. **Instrument cost-per-completed-upload end to end.** You cannot price what you haven't measured.

**Week 2 — the retention work. This is the YC item, and it comes before any payment code.**

5. **Make partnered play the default path in onboarding.** A solo player's first prompt should be *"invite someone,"* not a solo tutorial. Duolingo: users with one Friend Streak are **22% more likely to complete their daily lesson**, and learners who add friends are **5.6x more likely to finish the course.**
6. **Ship free room-code joining with no account required.** Ask for the account *after* the session, when they've just had a good time.
7. **Start logging four numbers from day one:** weekly active players (week-over-week %), D30 retention, % of sessions that are 2-3 player, % of signups that arrived via an in-game invite.

**Week 3 — cost armour, then billing**

8. Async batch + prompt caching + per-account dollar ceiling. (Section 4.)
9. Open the **Polar** account. Ship the international semester pass at $12 list.
10. **Only if the poll says cards don't work:** spend the JD 5-40 on the sole proprietorship and get quotes from PayTabs and HyperPay in parallel. Start the Google Play developer + merchant registration either way — it takes time and Jordan supports both.

**Week 4 — the tier that actually makes money**

11. **Build the Gulf-exam pass: $59, 6 months, mapped to the SCFHS/DHA syllabi.** "SDLE-mapped" is a claim no free Anki deck makes. This is 10-16x your student ARPU on largely the same content, aimed at people facing an SR 3,385 exam fee.
12. **Add a class-group rate.** INBDE Booster gives ~25% off for 30+ students — group buying is already the norm in this category, and a Jordanian dental class is a tight WhatsApp cohort. **"Whole batch, JOD 2 a head"** collects more, faster, than 60 individual card subscriptions ever will.

---

### Where making money and looking good to YC pull apart — explicitly

**They conflict, and YC has told you which side to pick.**

YC's published bar: **5-7% weekly growth is good, 10% is exceptional, 1% means you haven't figured it out yet.** And critically — **when you aren't charging, YC explicitly accepts active users as the growth metric.**

Every paywall you add before your application lowers the number YC reads. Gating the game would trade a differentiated retention story for a few hundred dollars a month. Run the arithmetic: **EdTech has the worst freemium conversion of any measured SaaS vertical at 2.6%.** ~5,000-6,000 Jordanian dental students × 2.6% ≈ 150 payers. At $24/year that's ~$3,600 ARR. That is not a YC story no matter how well you execute it. (Note the one lever that moves this: **time-limited free trials convert at ~22% vs freemium's 2.6%** — a trial of uploads, not open-ended free uploads.)

So: **keep the game 100% free forever, ship the paid pass small and late, and report revenue as proof-of-willingness-to-pay, not as the growth story.**

The chart to build the whole application around: **D30 retention of partnered players vs solo players.** The education category's D30 benchmark is **2-3%** — the worst of any app category. If your partnered players retain at 2x your solo players, that single chart is the strongest slide in the application, and it's worth more than every dollar you could collect between now and January 2027.

**Which is why item 5 comes before item 9.**