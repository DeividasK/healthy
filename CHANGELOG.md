# Changelog

What changed in each release of Healthy, newest first, compiled from the
fragments in `.changes/unreleased/` by changie; see
[Releasing Healthy](docs/releasing.md).

## [2026.10.3] - 2026-10-27

### Added

- Explore a demo profile from the website, with three years of sample records that show what Healthy can do. The demo opens in its own space, starts afresh on every visit and never touches your records.
- A condition now lists the biomarkers from its lab results, and a biomarker page lists the conditions it was tested for and related biomarkers, such as the inputs of a calculated value and others in the same group.
- On a computer, Healthy now uses the whole window: a sidebar for moving between sections, Home, biomarker and condition pages in two columns, the biomarker list beside each biomarker's details, and keyboard shortcuts (press ? to see them).
- A Treatments page lists all your treatments and filters them by whether you're taking them, have them on hold, stopped them or haven't started yet. Open it from the Treatments heading on Home, or from the sidebar on desktop, where the chosen treatment shows beside the list.
- Bundles can hold activities as well as treatments, so a routine like an evening wind-down with magnesium and stretching is answered with one tap in the journal. An activity's page lists its bundles.
- Choose your region in Settings so biomarkers use the standard ranges labs there use when a report doesn't print its own. Australia and New Zealand now use the AACB/RCPA harmonised ranges, and a biomarker page's new Range source section names the range set and its source, with a link to change your region.
- Lab results can now record over 31,000 more lab tests by their LOINC code. Search finds them after the app's own tests, Import with AI brings their results in too, and the web app keeps the list for searching offline.
- Tap the unit on a biomarker's page to switch to the next one, such as from mmol/L to mg/dL. The latest value, its range, the chart and every result are converted, and the page remembers the unit you chose.

### Changed

- Healthy on the web now opens at /a, and the main address shows a new home page about Healthy.
- The website has a new look: a personal health notebook, with real screenshots of the app taped onto graph paper.
- Screens now sit on warm paper, and biomarker charts show a light graph grid so values are easier to read.
- The Healthy heart logo and app icon now use the same sage green as the rest of the app.
- The biomarker history chart spaces results by date, so long gaps between tests show, and the edges of the reference range now line up with the chart's grid.
- Treatments set for a specific time now appear under that time in the journal, in clock order between the parts of the day, instead of joining the nearest part of the day.
- The header on phones and the sidebar on computers now use a deeper paper colour, like a notebook cover around the pages.
- On the Biomarkers page, the Out of range, In range and No range groups start collapsed. On desktop, a lab report shows the biomarker you pick beside it, and the Healthy logo in the sidebar takes you Home.
- The demo profile now has daily meditation and hyperbaric oxygen therapy (HBOT) sessions in its journal.
- Journal rows show an icon before the name, so bundles, treatments and activities are easy to tell apart.
- In the journal, a dose under a time heading such as "Morning" no longer repeats the time of day.
- The demo profile now also takes collagen, creatine and inulin on their own, outside a bundle.
- A bundle's page shows only how each treatment is taken and each activity is done, without the status details.
- Activities describe their schedule the way treatments describe their doses, e.g. "10 min in the evening" or "45 min, every 2 days", and leave out the time of day under a time heading or a bundle with a time.
- Settings are folded into Times of Day and Biomarker Ranges sections, and each time of day sits on one line beside its name.
- Biomarker pages drop the Learn heading and keep its expandable sections.
- Today's journal no longer shows a cross before you log anything, so a day that has just started doesn't look missed.
- The demo profile now has three months of journal history, a rising Omega-3 trend and notes on every lab report.
- Condition pages show severity, category and verification beside the date and status, and list diagnosis codes in plain words instead of raw terminology links.
- Treatment pages show the dosage once when you take it as prescribed.
- Diagnoses on a consultation show their date and status like other condition lists.
- The demo profile includes an Lp-PLA2 heart test, to show a lab test from beyond the app's own list.

### Fixed

- Condition severity is now shown with an empty, half-filled or full marker instead of green, amber and red, so it reads clearly for colour-blind people.
- Restoring a profile from Google Drive now shows that it is in progress, so the button can't be pressed twice.
- Journal bundles now start closed on every day, even when only some of their treatments are logged.
- Google Drive sync on the web stays connected in the background instead of stopping after an hour until you press Sync. Sign in to Google again once to turn it on. The privacy policy now describes the small sign-in helper this relies on.
- On desktop, moving between biomarkers with the arrow keys no longer flickers, and the list scrolls along with each step.
- The journal follows a treatment's current regimen even when an older period of taking it was left open, for example after syncing between devices.
- Reference ranges converted from another unit show rounded limits, such as 0.7–0.91 mmol/L for Magnesium instead of 0.69938–0.90508.
- Lab results are saved under the LOINC code for their unit, so a glucose result in mmol/L is recorded as a moles test and one in mg/dL as a mass test, while both still show as one Glucose test. RDW-SD uses LOINC's current code.
- Biomarker charts no longer show negative values on the axis for results that can't be below zero.

## [2026.10.2] - 2026-10-24

### Added

- Lab results can now record Free Androgen Index, Platelet Large Cell Ratio (P-LCR) and prothrombin activity in % (Quick), and AI import picks them up from your reports.
- Your biomarkers now include the Atherogenic Index of Plasma, calculated from the triglycerides and HDL in each lab report, with a page explaining how it's worked out.
- Calculated values are marked with a calculator wherever they're listed, appear in the lab report they come from, and their page links the results they're worked out from.
- Import with AI now also fills in new consultations, service requests and treatments: copy the instructions to your AI assistant with a visit summary, referral or prescription, then paste its reply to review the filled-in form before saving. Treatments get their dosing as a regimen, and service requests their repeat schedule.

### Changed

- Values with a standard formula, such as cholesterol ratios, non-HDL cholesterol, globulin, transferrin saturation, HOMA-IR and the Free Androgen Index, are now worked out from the results in the same report so they always agree with them. A value your lab reported without those results still shows.
- Condition timelines initially show Active and Planned steps. Clear the filters to see all steps.
- Biomarker status grids are visual only; tapping individual squares no longer opens biomarker details.
- The Google Drive backup status now shows on its own line under your email, so long email addresses no longer hide it.
- The journal now flags doses recorded on a day the treatment was on hold as not matching the regimen.

### Fixed

- Restoring a profile from a backup file now shows a spinner and keeps the app locked until the restore finishes, then opens your record.
- Google Drive backup on the web works again after the page was opened offline, without reloading.
- The offline icon now also shows on the web when your device is connected to a network that can't reach the internet, and disappears once the connection is back.
- Doses or sessions logged on one device for a treatment or schedule deleted on another no longer get stuck in sync and fill the console with warnings.
- After deleting your last profile, choosing to restore from a backup no longer sometimes jumps back to the welcome screen.
- On the web, pressing Escape right after a form opens now cancels it.
- On the web, you can now reach and scroll record pages with the keyboard, even when a page has no buttons or links in its content.

## [2026.10.1] - 2026-10-22

### Added

- Service requests can repeat, such as 3 PRP sessions every 4–6 weeks or 30 minutes of reading every day. The journal asks about each one when it is due and lets you record how long it took, and the service request lists the sessions done.
- Add a profile photo from your photo library. It shows on your profile and in the header, syncs to Google Drive and is included in exports.
- A routine whose items are all logged, some taken and some not, now shows both of its buttons tinted, so you can see it is done.
- A new welcome screen introduces Healthy and how your records stay private on your device.
- If you already use Healthy, restore your record from the welcome screen.
- You can fill in new lab results with your own AI assistant: tap the Import with AI button when adding lab results, copy the instructions to your AI together with your lab report, then paste its reply to fill in the date, time, laboratory and results for you to check before saving.
- Lab results now cover 200 common tests, including blood sugar, cholesterol, kidney and liver function, thyroid, iron, vitamins, hormones, clotting, heart and urine tests, each with its usual units and reference range.
- Lab results cover every biomarker in WHOOP Advanced Labs, adding HOMA-IR, omega-3 index and fatty acids, leptin, adiponectin, 1,5-anhydroglucitol, iodine, corrected calcium and cholesterol ratios.

### Changed

- Going back to Home shows your records straight away instead of reloading them behind a spinner.
- Healthy shows its header the moment it opens, with placeholder rows while your records load, instead of a blank page and spinners.
- Healthy starts faster: the app is now about 40% smaller to download and load.
- The profile page is simpler: your photo, name, age, birth date and ID sit at the top, Google Drive backup is a single switch showing your account, and the recovery phrase opens in place. Switch between profiles with the button next to your name.
- Adding a profile only asks for a name; add a family name, date of birth, gender or photo if you want, and start their record straight away.
- Setting up Healthy now asks only for your name; add other details later in your profile.
- An empty Home now suggests what to add first: a condition, a lab result, a medication or supplement, or a doctor visit.
- Labs Summary is now called Biomarkers. On Home it is a compact grid with one square per biomarker, out-of-range results first, so you can see at a glance how many are out of range; its key counts only the statuses you have, including No range. Tap a square to open that biomarker, or the heading to see every result.
- Lab results show each biomarker as in range or out of range, with a bar marking where its value falls against the reference range. The Biomarkers page and each lab result group biomarkers by status, and biomarker search has moved to the Biomarkers page.
- Your lab results are now listed on the Biomarkers page, below your biomarkers, like your other records with their date, status and lab; open one to edit or delete it. Home shows only the Biomarkers grid.
- A biomarker's history chart now labels every result next to its point and shades the reference range, and its page lists the three most recent results with Show all for the rest. Tap a result to open its lab result.
- On a biomarker's page, the Learn topics are now rows divided like the rest of the app, opened with the chevron on the right, and the note about reference ranges at the bottom has been removed.
- Reference ranges now follow your gender and age, for example ferritin, liver enzymes, hormones, kidney function and PSA. Each biomarker page explains which range applies to you, and lab results ask you to add your gender and date of birth to your profile when they're missing.
- Every lab result is now called "Lab report", instead of a long technical panel name such as "Complete blood count (hemogram) panel".

### Fixed

- A treatment dose's Time field now only appears when you choose "At a specific time", not for parts of the day like Morning or Evening.
- Treatments on hold no longer appear in the journal on the days they are on hold.
- Doses taken every few days or weeks, like every other evening, now appear in the journal only on the days they are due.
- Neutrophil, eosinophil and basophil results are saved under their correct standard test codes, and existing results are corrected.

## [2026.10.0] - 2026-10-20

### Added

- Adding a treatment now also records that you start taking it today. You can pick another day, including one still to come, or remove it.
- The journal groups treatments by time of day: morning, noon, afternoon, evening, bedtime, then those taken at any time.
- Reorder the journal: tap the reorder button, then move treatments and bundles up or down within each time of day. The order is kept on every day and syncs with your other devices.

### Changed

- Taking a treatment can no longer start before the treatment's date, and a treatment's date can't be moved past the day you started taking it.
- New doses in a regimen start as 1 tablet once a day, so you only change what differs.

### Fixed

- Cmd/Ctrl+Enter right after typing saves what you typed.
