# Surgify MVP

Surgify is a mock-data-first surgical practice-change detection demo.

Open `index.html` directly, or serve the workspace and navigate to `/surgify-mvp/`.

## What The Demo Shows

- Surgeon profile mapping across procedure mix, current practice, patient scope, device access, and local outcomes.
- Evidence monitoring with escalation, watch, match, and suppression lanes.
- Practice Change Score calculation using evidence strength, patient overlap, procedure volume, practice gap, outcome severity, and implementation fit.
- Alert detail pages showing why a signal surfaced, what current practice conflicts with it, and what safeguards are needed.
- Journal club packet generation with PICO, appraisal questions, agenda, and decision memo.
- CPD logging and audit trail entries linked back to the evidence signal.

## Architecture

- `index.html` provides the shell, navigation, workflow rail, and local Lucide icon bundle.
- `styles.css` contains the responsive dashboard system and component styling.
- `app.js` contains mock surgeon profile data, mock evidence records, the Practice Change Score model, state, renderers, and workflow actions.

The future PubMed integration would replace the mock `evidence` array with an adapter that normalizes PubMed records into the same fields used by the scoring model.
