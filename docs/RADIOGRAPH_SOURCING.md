# CHAIRSIDE: where your radiographs come from

## 1. The answer

**Download DenPAR — 1,000 real, consented, de-identified intraoral periapical radiographs, CC BY 4.0, 141 MB, free — and label 60 of them yourself with tooth number and finding. That labelled set is your v1 image bank and it is yours.**

Link: https://zenodo.org/records/16645076 (DOI 10.5281/zenodo.16645076). Paper: Nature *Scientific Data* 12:1615 (2025), Rasnayaka et al., University of Peradeniya, Sri Lanka.

---

## 2. Why that one

**It is the only source that survived every test.** Four separate things have to be true, and almost nothing satisfies all four:

1. **The licence permits selling.** The authors state it in their own peer-reviewed paper: *"The compressed dataset is available on Zenodo (10.5281/zenodo.16645076) under Creative Commons Attribution 4.0 license."* CC BY 4.0 explicitly allows commercial use. Note the trap: the *article* is CC BY-NC-ND. That covers the paper text, not the images. The data record is CC BY 4.0 on the Zenodo API itself (`"license": "cc-by-4.0"`, `"access_right": "open"`).
2. **The patients consented to educational reuse.** Ethics approval ERC/FDS/UOP/2023/45. The paper states patients give general informed consent at hospital registration allowing use of their clinical records including images "for research and educational purposes, provided that personal identifiers are removed."
3. **It is actually de-identified — checked, not claimed.** Images were renamed with random numbers and an algorithm stripped embedded personal details. This was independently verified by visual inspection, EXIF dump, and metadata audit.
4. **It is the right kind of film.** These are intraoral periapicals — the single-tooth view a student actually reads. Not panoramics.

**What I rejected, and why — this is the part that matters.**

*Looked free, is research-only (hard no, permanently):*
- **DENTEX** — the only open dataset that natively binds FDI tooth number to a named pathology. Exactly what you want. CC BY-NC-SA 4.0. Non-commercial. A freemium tier and a university sale are both commercial; there is no reading of NC where you survive. You also cannot launder it by training a model on it — the model becomes a restricted derivative.
- **Tufts Dental Database** — non-commercial. The Kaggle mirror grants you nothing; a re-uploader cannot give away rights they never had.
- **Radiopaedia** — CC BY-NC-SA 3.0. Best-labelled dental radiology collection in the world, completely unusable. Do not let anyone tell you "Radiopaedia is free."
- **ToothFairy2** — the website says CC BY-SA. Its own governing challenge document says the opposite: *"they can be shared for research purposes only."* The ethics approval backs the restriction, not the badge.
- **PhysioNet** — a signed contract, not a licence. Once you click through, whether the images are copyrightable stops mattering. You promised.
- **Roboflow Universe** — several sets carry DENTEX's exact class list under a "CC BY 4.0" badge. Those are almost certainly re-uploads of non-commercial data. Using them leaves a paper trail proving where you took it from.

*Licence was fine, failed anyway (the scarier category):*
- **The Paraguay panoramic set (Zenodo 4457648)** — genuinely CC BY 4.0, and 34 out of 34 files checked contain the **patient's full name** inside the JPEG file, e.g. `C:\Users\RADIOLOGIA\Desktop\BARRIOS DAMASIO-P001Pr-2019.10.15-09.29.27.jpg`. Several carry the exam date and time. The numeric filenames are sorted alphabetically by patient name, so even stripping the metadata leaves a re-identification path. **Do not touch this, and do not touch anything built on top of it** — which includes the popular Humans in the Loop tooth-segmentation set on Kaggle.
- **Do et al. (Hanoi, 3,926 panoramics)** — CC BY 4.0, but zero tooth numbers, no de-identification statement anywhere, and the only consent language is "for this type of study, formal consent is not required" — a research waiver, which does not stretch to a paid product.
- **BRAR (figshare)** — best consent language in the field, and the tooth-level data described in the codebook was never actually shipped. The delivered file has one row per patient, no tooth IDs at all.
- **Wikimedia Commons** — I expected 20-40 usable images. It is about **four**. 25 of the 28 apical-periodontitis files are German radiographs uploaded as "own work" by hobbyist accounts, not clinicians. Under German law the right belongs to the dentist who took the film, so a patient cannot grant that licence.

The pattern: **a Creative Commons licence answers "may I copy this file?" It never answers "may I publish this patient's medical image commercially?"** CC BY 4.0 says so itself: privacy and personality rights are not licensed. DenPAR is the one candidate that answers both questions with a document.

---

## 3. What it costs you

**One real limitation, and you should build the product around it rather than fight it.**

DenPAR labels where the apex and bone crest are. It does **not** label disease. So the pathology labels are yours to write — 60 films, maybe 10 seconds each to read, plus a careful pass to be sure. That is an afternoon, and it is the one job you are better at than any dataset.

**The consequence for the pitch: reverse your pipeline.** Right now you generate a case, then hunt for an image. Do the opposite. Pick a radiograph from the library first, then generate the case around the finding you know is in that image. Every case is then bindable by construction and you can never generate a lesion no picture shows.

**So yes — the honest pitch is "your lecture drives the case, from our verified clinical image library," not "everything in your lecture becomes a case."** Say it that way in the deck. It is stronger, not weaker: a university buyer hearing "our AI draws the X-rays" ends the meeting. "Every radiograph is a real, consented, de-identified clinical film, cited to its source" is a selling point.

**What a 60-image bank actually covers** — realistically 12-20 distinct findings: proximal caries, occlusal caries, recurrent caries under a restoration, periapical radiolucency, condensing osteitis, retained root, impacted tooth, periodontal bone loss, previous root canal with short or voided obturation, root fracture, internal/external resorption, radiopaque lesions. That is most of an undergraduate radiology syllabus.

**When a lecture has no matching finding:** the co-op session still runs — the hidden-information player gets a different secret channel that week (a periodontal chart, a vitality test result, a medical history detail only they can see). Design the reader role so the radiograph is *one* possible hidden channel, not the only one. That one decision stops your image bank from capping your content.

**Size is not a problem.** A periapical as WebP at 800×1000 is 40-80 KB. Sixty images is 3-5 MB. Serve them from a CDN with lazy loading; do not put them in the service-worker precache.

**Attribution is one screen.** CC BY lets you satisfy credit "in any reasonable manner based on the medium," including a link to a page holding the information. Build one "Image credits" screen: dataset title, authors, DOI, "CC BY 4.0" hyperlinked, and a line saying images were cropped, downscaled and re-encoded. Add a small (i) button on the radiograph viewer itself — it is an hour of work and it removes the argument entirely.

**Topping up:** where DenPAR lacks a finding, pull single figures from open-access dental journals. Europe PMC lets you filter to commercially reusable articles only — `LICENSE:"cc by" AND OPEN_ACCESS:y` returns 1,011 articles for "periapical radiolucency" alone, and the captions are written by the clinician who took the film ("Intraoral periapical radiograph shows obturation of the root canal of tooth #25"). Free, no registration. Use the sanctioned bulk endpoints (`fullTextXML` and `oa.fcgi`), never scrape the web pages.

---

## 4. Phantom, typodont, and rendering from your 3D models

**Rendering a radiograph from your existing low-poly tooth models: no. Do not build this.**

A surface mesh is a hollow shell. It has no bone inside it. Project through it and you get a smooth thickness gradient with no trabecular bone, no lamina dura, no periodontal ligament space. Those are not decoration — they *are* the finding. The radiology literature is explicit that both the lamina dura and the trabecular bone must be lost before most dentists can even detect a periapical change. So the one thing your worked example needs to show ("radiolucency at the apex of 46") is the exact thing a mesh render physically cannot contain.

Would it fool a dental student? A first-year, briefly. A fifth-year or any lecturer, not for a second. And worse than being spotted, it teaches the wrong rule — students would learn "dark blob = lesion" instead of learning to tell a lesion from the normal bone texture beside it, which is the actual skill.

**Phantom with real extracted teeth: yes, genuinely good — but only for crowns.**

This is a published method with a very useful property. The source study states plainly: *"As phantom study, no ethical approval was required."* No patient, no data subject, no privacy law attaches at all. Real teeth arranged in a jaw model set in dental stone, shot on your school's own sensor at 60 kV. Ground truth in that study came from sectioning the teeth and reading them under a microscope — better ground truth than any clinical dataset, where "truth" is just two dentists agreeing.

The limit is stated by the authors themselves: the teeth sat in plaster "and not real bone," which "altered the radiographic appearance at least in the root region." So phantom gives you excellent caries, restorations, overhangs, canal anatomy — and cannot give you periapical pathology. A dry mandible with bur-created defects covers that gap, and hands you matched before/after images of the identical site, which no clinical archive can produce.

**Is a hybrid right? Yes, but not the hybrid you were imagining.** DenPAR is the spine because it is real in-vivo pathology with a consent document, available today. Phantom is the expansion pack for caries once you have clinic time, and it is worth doing because it has literally zero legal exposure. Rendering from meshes is out.

**Illustration:** keep it, but only as the answer key shown *after* the player commits. Never as the thing they read. Two reasons. Perceptual-learning research found little transfer when learners saw only the lesion cut out, and good transfer when the surrounding normal tissue was included — what people learn is the contrast with normal, which a drawing cannot supply. And cervical burnout and the Mach band effect are the two classic false-positive traps in caries reading; a drawn radiograph contains no trap to rule out, so it trains overdiagnosis. Textbooks put line diagrams *beside* radiographs, never instead of them. Do the same.

---

## 5. Your own dental school

**Realistic, slow, and worth starting this week for a reason that is not the images.**

The images are the smaller prize. The named oral-radiology sponsor, the signed data agreement, and a faculty willing to say "we use this" are what make a university sale credible later, and no competitor can copy that quickly.

**What the process actually looks like — and the trap in it.** Expect the ethics committee to tell you this is *not* human-subjects research, because you are building a product, not contributing to generalisable knowledge. That sounds like permission. It is the opposite: it means you have no institutional cover, and your real counterparty is the faculty's legal or dean's office, negotiating a **data agreement**, not an ethics approval. Getting into the wrong queue costs a semester. Ask for that determination in writing anyway — it is your proof that you asked.

**The one clause that decides everything:** the consent form must name **commercial distribution, worldwide, in perpetuity**, in Arabic and English. "Consent to treatment" is worthless here. "Consent for teaching within the faculty" is also worthless. You cannot retrofit this onto films already in the archive, so it only works going forward.

**How many images:** a published caries-training study ran on **10 bitewings across 82 students**. You need far less than instinct says. 40-60 images and 12-20 distinct findings is a complete v1.

**One non-negotiable if you start collecting:** capture FDI number, surface, finding, and the reporting dentist's confidence at the moment the film is taken. Labelling an unlabelled pile later is the failure mode that kills these projects.

---

## 6. Do this week

1. **Download DenPAR** (141 MB, https://zenodo.org/records/16645076). Confirm the record still reads CC BY 4.0 and open access before anything else.
2. **Open 100 films at random and count the pathology.** How many show a finding worth a case? That number decides whether DenPAR alone carries v1 or you need the journal top-up. This is the single most valuable hour of the week.
3. **Label 60.** One spreadsheet: filename, FDI tooth number, finding, your confidence, and a note if the film is ambiguous. Reject anything you would not stake a viva answer on.
4. **Build the credits screen and the provenance record at the same time as the images.** Per image: source, DOI, licence, licence URL, date retrieved, what you changed. Retrofitting this is impossible and it is exactly what a university procurement office will ask for.
5. **Flip the case pipeline** so the generator picks a radiograph from the labelled bank first, then writes the case around it.
6. **Email one oral-radiology lecturer** at your faculty asking for 15 minutes. That is the whole ask this week.
7. **Send two free emails**: İbrahim Ethem Hamamcı (ETH Zürich) asking for a commercial licence to DENTEX — dual-licensing academic datasets is routine and one yes solves the entire problem; and Xiaocheng Fang (fangxiaocheng162@gmail.com) about PerioXrays, which has 5,662 annotated apical periodontitis lesions and currently no licence at all, meaning the author has simply never been asked to add one.

---

## 7. Do NOT

- **Do not use anything CC BY-NC or CC BY-NC-SA** — not in the free tier, not "just for the prototype." You will ship the prototype. This means DENTEX, Radiopaedia, Tufts, CTooth, ToothFairy3 are permanently closed.
- **Do not touch Zenodo 4457648 (Paraguay panoramics) or anything derived from it.** Patient names are inside the image files. If you already downloaded it, delete it. As a clinician-in-training, the decent move is to email the corresponding author and Zenodo so it gets fixed.
- **Do not trust a bare tooth number in a caption.** A verified Cureus paper writes "#25" — the # prefix means US numbering, where 25 is a lower right central incisor, but the case describes an upper left premolar. Two different teeth, opposite arches, opposite sides. Read every film yourself and confirm the number from the anatomy, not the text.
- **Do not use any image whose caption says "reproduced from," "adapted from," "with permission," or "courtesy of."** Those figures are carved out of the article's licence.
- **Do not ship a mirrored or flipped radiograph.** Left and right reverse, and you teach a student to call a lesion on the wrong side of the mouth.
- **Do not render radiographs from your GLB tooth models** — see section 4.
- **Do not let students upload their own patient radiographs.** The moment they do, you are handling patient health data. Block it, or reject images server-side with an explicit "no patient data" gate.
- **Do not ship without a takedown path.** Consent can be withdrawn. Version your image list and have the app honour a removal list, so you can pull one image out of an installed PWA. Build it now, at 60 images, not at 5,000 users.
- **Do not assume any dataset is clean because the badge says CC BY.** Every claim in this brief that survived came from the licence record plus the actual bytes; every claim that died, died in the bytes.

**What you must verify with your own eyes:** that the Zenodo record still shows CC BY 4.0 and open access; how much real pathology the 1,000 films actually contain; whether their tooth IDs use FDI or something else; and the four corners of every single image you ship, at full resolution, for burned-in text. One patient name in one corner of a product sold to a university is not recoverable.