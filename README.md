# TraceReady — CSCT Exam Prep

Study app for the **Canadian Society of Cardiology Technologists (CSCT)** national certification exam.

It turns the official exam blueprint, ECG Analysis Study Guide, Exam Guidelines, and candidate dates into a focused study path: weighted modules, practice quizzes, flashcards, rhythm checklists, and refreshable exam intel from [csct.ca](https://www.csct.ca/EXAM-CANDIDATE).

## Quick start

```bash
pnpm --dir apps/web install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## What’s inside

| Area | What you get |
|------|----------------|
| **Study Path** | Blueprint-weighted topics (ECG 30%, ETT 18%, foundational 25%, …) |
| **Practice** | Single-answer + multi-select quizzes with explanations |
| **Flashcards** | CSCT Exam Guideline numbers and high-yield facts |
| **Rhythms** | Checklist mapped to the CSCT ECG Analysis Study Guide |
| **Exam Intel** | Sitting dates, fees, eligibility — refresh from CSCT |
| **Resources** | Official PDFs and pages (blueprint, candidate guide, NOCP, …) |

Progress (modules reviewed, quiz scores, rhythm checks, flashcard flips) is stored in your browser via `localStorage`.

## Notes

- TraceReady is a study aid, not an official CSCT product. Always confirm dates, fees, and policies on [csct.ca](https://www.csct.ca/).
- Exam guideline values in the app follow CSCT’s published “Exam Guidelines for exam purposes.”
