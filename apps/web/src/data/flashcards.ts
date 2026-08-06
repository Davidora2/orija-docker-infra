export type Flashcard = {
  id: string;
  deck: string;
  front: string;
  back: string;
  tag?: string;
};

export const flashcardDecks = [
  { id: "exam-guidelines", title: "CSCT Exam Guidelines", countHint: "Must-memorize numbers" },
  { id: "conduction", title: "Conduction & Intervals", countHint: "Rates and intervals" },
  { id: "ett", title: "Exercise Testing", countHint: "Stop criteria & ST rules" },
  { id: "rhythms", title: "Rhythm Recognition", countHint: "Quick differentials" },
  { id: "devices", title: "Devices & Pacing", countHint: "Modes and troubleshooting" },
  { id: "pharm", title: "Cardiac Pharm", countHint: "Class and ECG effects" },
] as const;

export const flashcards: Flashcard[] = [
  // Exam guidelines (official CSCT)
  {
    id: "g1",
    deck: "exam-guidelines",
    front: "Normal PR interval (CSCT exam guideline)",
    back: "0.12 seconds (as stated in CSCT Exam Guidelines for exam purposes).",
    tag: "official",
  },
  {
    id: "g2",
    deck: "exam-guidelines",
    front: "Normal QRS duration (CSCT exam guideline)",
    back: "0.08–0.12 seconds.",
    tag: "official",
  },
  {
    id: "g3",
    deck: "exam-guidelines",
    front: "QTc formula and upper limit of normal (CSCT)",
    back: "Bazett’s formula: QTc = QT / √RR. Upper limit of normal = 450 msec.",
    tag: "official",
  },
  {
    id: "g4",
    deck: "exam-guidelines",
    front: "ECG criteria used for LVH on the CSCT exam",
    back: "Romhilt–Estes criteria.",
    tag: "official",
  },
  {
    id: "g5",
    deck: "exam-guidelines",
    front: "Normal QRS axis (CSCT exam guideline)",
    back: "−30° to +90°.",
    tag: "official",
  },
  {
    id: "g6",
    deck: "exam-guidelines",
    front: "Normal ejection fraction (CSCT exam guideline)",
    back: "55%–70%.",
    tag: "official",
  },
  {
    id: "g7",
    deck: "exam-guidelines",
    front: "Where is ST segment measured during ETT for CSCT exam?",
    back: "80 msec from the J point.",
    tag: "official",
  },
  {
    id: "g8",
    deck: "exam-guidelines",
    front: "ETT blood pressure drop that is an absolute indication to terminate (CSCT)",
    back: "A drop of 10 mmHg during the test from the pre-test value.",
    tag: "official",
  },
  {
    id: "g9",
    deck: "exam-guidelines",
    front: "Is WPW the only pre-excitation syndrome?",
    back: "No. Wolff–Parkinson–White is one type of pre-excitation; others exist (exam guideline).",
    tag: "official",
  },

  // Conduction
  {
    id: "c1",
    deck: "conduction",
    front: "Intrinsic rate of the SA node",
    back: "60–100 bpm — primary pacemaker.",
  },
  {
    id: "c2",
    deck: "conduction",
    front: "Intrinsic rate of the AV junction",
    back: "40–60 bpm — escape pacemaker if SA node fails.",
  },
  {
    id: "c3",
    deck: "conduction",
    front: "Intrinsic rate of ventricular (Purkinje) foci",
    back: "20–40 bpm — final backup pacemaker.",
  },
  {
    id: "c4",
    deck: "conduction",
    front: "What does the PR interval represent?",
    back: "Time from atrial depolarization onset to ventricular depolarization onset (SA → AV conduction).",
  },
  {
    id: "c5",
    deck: "conduction",
    front: "1st degree AV block hallmark",
    back: "Prolonged PR interval with every P conducted to a QRS.",
  },
  {
    id: "c6",
    deck: "conduction",
    front: "Mobitz I (Wenckebach) hallmark",
    back: "Progressive PR lengthening until a P wave is not conducted.",
  },
  {
    id: "c7",
    deck: "conduction",
    front: "Mobitz II hallmark",
    back: "Sudden dropped QRS without progressive PR lengthening; often infra-Hisian and higher risk.",
  },
  {
    id: "c8",
    deck: "conduction",
    front: "Complete (3rd degree) heart block hallmark",
    back: "AV dissociation: P waves and QRS complexes march independently; ventricular escape often wide/slow.",
  },

  // ETT
  {
    id: "e1",
    deck: "ett",
    front: "Absolute indication to stop ETT: BP change (CSCT)",
    back: "Systolic BP drop of 10 mmHg from pretest value during exercise.",
  },
  {
    id: "e2",
    deck: "ett",
    front: "Name common absolute ETT termination criteria",
    back: "Sustained VT, ST elevation in leads without Q waves, signs of poor perfusion, moderate-severe angina, technical inability to monitor, patient request, drop in SBP ≥10 mmHg (per CSCT guideline).",
  },
  {
    id: "e3",
    deck: "ett",
    front: "Why monitor recovery after ETT?",
    back: "Ischemic ST changes and arrhythmias may appear or worsen in recovery; BP and symptoms are tracked until stable.",
  },
  {
    id: "e4",
    deck: "ett",
    front: "What is RPE and why use it?",
    back: "Rate of Perceived Exertion — subjective effort scale used to gauge patient workload when HR response is limited (e.g., beta blockers).",
  },

  // Rhythms
  {
    id: "r1",
    deck: "rhythms",
    front: "Sinus arrest vs sinus block",
    back: "Arrest: pause without expected P; interval not a multiple of the PP. Block: pause equals exact multiple(s) of the basic PP cycle (impulse formed but blocked exit).",
  },
  {
    id: "r2",
    deck: "rhythms",
    front: "Atrial flutter classic ECG",
    back: "Sawtooth flutter waves (often ~300/min) with variable or fixed AV conduction (e.g., 2:1 → ventricular rate ~150).",
  },
  {
    id: "r3",
    deck: "rhythms",
    front: "Atrial fibrillation hallmarks",
    back: "Absent discrete P waves, irregularly irregular RR intervals, fibrillatory baseline.",
  },
  {
    id: "r4",
    deck: "rhythms",
    front: "Ashman phenomenon",
    back: "Aberrant conduction (often RBBB morphology) after a long–short RR cycle, commonly in AF — not VT.",
  },
  {
    id: "r5",
    deck: "rhythms",
    front: "WPW pattern triad",
    back: "Short PR, delta wave (slurred QRS upstroke), and widened QRS.",
  },
  {
    id: "r6",
    deck: "rhythms",
    front: "Torsades de Pointes key association",
    back: "Polymorphic VT with shifting QRS axis, associated with prolonged QT.",
  },
  {
    id: "r7",
    deck: "rhythms",
    front: "Junctional escape rhythm clues",
    back: "Rate ~40–60, narrow QRS (usually), P waves inverted/absent/after QRS.",
  },
  {
    id: "r8",
    deck: "rhythms",
    front: "Idioventricular rhythm rate",
    back: "Ventricular escape typically 20–40 bpm with wide QRS; accelerated idioventricular is faster but usually <100.",
  },

  // Devices
  {
    id: "d1",
    deck: "devices",
    front: "What do the letters in a pacing mode (e.g., DDD) mean?",
    back: "NBG code: I = chamber paced, II = chamber sensed, III = response to sensing (Inhibit/Trigger/Dual), optional IV = rate modulation, V = multisite.",
  },
  {
    id: "d2",
    deck: "devices",
    front: "Capture vs sensing",
    back: "Capture: pacing spike produces depolarization. Sensing: device detects intrinsic activity and responds per mode.",
  },
  {
    id: "d3",
    deck: "devices",
    front: "Fusion beat (pacing)",
    back: "Simultaneous pacing and intrinsic depolarization → hybrid QRS morphology.",
  },
  {
    id: "d4",
    deck: "devices",
    front: "Pseudofusion",
    back: "Pacing spike falls on an intrinsic QRS that was already being conducted — spike does not meaningfully contribute to depolarization.",
  },
  {
    id: "d5",
    deck: "devices",
    front: "Pacemaker-mediated tachycardia (PMT)",
    back: "Endless-loop tachycardia in dual-chamber devices: ventricular paced beat → retrograde atrial sense → triggers ventricular pace.",
  },

  // Pharm
  {
    id: "p1",
    deck: "pharm",
    front: "Adenosine primary use in arrhythmia",
    back: "Terminates / diagnoses reentrant SVT involving the AV node (brief AV nodal block).",
  },
  {
    id: "p2",
    deck: "pharm",
    front: "Amiodarone class and ECG effect",
    back: "Class III (multi-channel); prolongs QT / refractoriness; used for VT/VF and some atrial arrhythmias.",
  },
  {
    id: "p3",
    deck: "pharm",
    front: "Digoxin classic ECG effects",
    back: "Sagging ST depression (“Salvador Dali”), flattened/inverted T, shortened QT; toxicity → arrhythmias including bidirectional VT.",
  },
  {
    id: "p4",
    deck: "pharm",
    front: "Why care about QT-prolonging drugs?",
    back: "Increase risk of Torsades de Pointes — monitor QTc (CSCT upper normal 450 msec).",
  },
];

export function cardsForDeck(deck: string): Flashcard[] {
  return flashcards.filter((c) => c.deck === deck);
}
