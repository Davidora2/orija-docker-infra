export type Question = {
  id: string;
  topicId: string;
  type: "single" | "multi";
  stem: string;
  choices: string[];
  correct: number[]; // indexes
  explanation: string;
  source?: string;
};

export const questions: Question[] = [
  {
    id: "q1",
    topicId: "ecg",
    type: "single",
    stem: "Per CSCT Exam Guidelines, what is the upper limit of normal for QTc using Bazett’s formula?",
    choices: ["400 msec", "420 msec", "450 msec", "500 msec"],
    correct: [2],
    explanation: "CSCT Exam Guidelines: QTc = QT/√RR with 450 msec as the upper limit of normal.",
    source: "CSCT Exam Guidelines",
  },
  {
    id: "q2",
    topicId: "ecg",
    type: "single",
    stem: "What normal QRS axis range should you use for CSCT exam purposes?",
    choices: ["0° to +90°", "−30° to +90°", "−90° to +90°", "−30° to +110°"],
    correct: [1],
    explanation: "CSCT Exam Guidelines list normal axis as −30 to +90 degrees.",
    source: "CSCT Exam Guidelines",
  },
  {
    id: "q3",
    topicId: "ecg",
    type: "single",
    stem: "Which LVH criteria does CSCT specify for exam purposes?",
    choices: ["Sokolow–Lyon only", "Cornell voltage only", "Romhilt–Estes criteria", "Any voltage criterion is acceptable"],
    correct: [2],
    explanation: "CSCT Exam Guidelines: ECG criteria for LVH — Romhilt–Estes Criteria.",
    source: "CSCT Exam Guidelines",
  },
  {
    id: "q4",
    topicId: "ecg",
    type: "single",
    stem: "Normal QRS duration on the CSCT Exam Guidelines is:",
    choices: ["0.04–0.08 s", "0.08–0.12 s", "0.12–0.16 s", "< 0.20 s"],
    correct: [1],
    explanation: "CSCT lists QRS 0.08–0.12 seconds.",
    source: "CSCT Exam Guidelines",
  },
  {
    id: "q5",
    topicId: "ecg",
    type: "multi",
    stem: "Which findings support a Wolff–Parkinson–White pattern? (choose all that apply)",
    choices: [
      "Short PR interval",
      "Delta wave",
      "Widened QRS",
      "Prolonged PR with dropped beats",
    ],
    correct: [0, 1, 2],
    explanation:
      "WPW pattern: short PR, delta wave, wide QRS. CSCT also notes WPW is one form of pre-excitation among others.",
    source: "CSCT Exam Guidelines / ECG Study Guide",
  },
  {
    id: "q6",
    topicId: "ecg",
    type: "single",
    stem: "Ashman phenomenon is best described as:",
    choices: [
      "Polymorphic VT with long QT",
      "Aberrant conduction after a long–short cycle, often in AF",
      "Failure of a pacemaker to sense",
      "Complete AV dissociation",
    ],
    correct: [1],
    explanation:
      "Ashman aberrancy follows a long–short RR sequence and commonly shows RBBB morphology in atrial fibrillation.",
  },
  {
    id: "q7",
    topicId: "ecg",
    type: "single",
    stem: "A pause that is an exact multiple of the basic PP interval is most consistent with:",
    choices: ["Sinus arrest", "Sinus block (exit block)", "SA reentry", "Junctional escape"],
    correct: [1],
    explanation:
      "Sinus (SA) block pauses equal exact multiples of the PP cycle; sinus arrest pauses usually do not.",
  },
  {
    id: "q8",
    topicId: "ett",
    type: "single",
    stem: "For CSCT exam purposes, ST segment changes during exercise testing are measured:",
    choices: ["At the J point", "40 msec after the J point", "80 msec from the J point", "At the T-wave peak"],
    correct: [2],
    explanation: "CSCT Exam Guidelines: ST segment measurement 80 msec from the J point.",
    source: "CSCT Exam Guidelines",
  },
  {
    id: "q9",
    topicId: "ett",
    type: "single",
    stem: "Per CSCT Exam Guidelines, which BP change is an absolute indication to terminate an exercise test?",
    choices: [
      "Rise in SBP of 10 mmHg",
      "Drop of 10 mmHg from pretest value during the test",
      "Any DBP above 90 mmHg",
      "Failure of HR to rise by 10 bpm",
    ],
    correct: [1],
    explanation:
      "A 10 mmHg BP drop from pretest during exercise is an absolute termination indication for CSCT exam purposes.",
    source: "CSCT Exam Guidelines",
  },
  {
    id: "q10",
    topicId: "ett",
    type: "multi",
    stem: "Which are reasons to stop an exercise tolerance test? (choose all that apply)",
    choices: [
      "Sustained ventricular tachycardia",
      "Patient request to stop",
      "Technical inability to monitor ECG/BP",
      "Mild isolated PVCs with stable vitals only",
    ],
    correct: [0, 1, 2],
    explanation:
      "Sustained VT, patient request, and inability to monitor are standard stop reasons. Isolated mild PVCs alone are not automatically an absolute stop.",
  },
  {
    id: "q11",
    topicId: "ett",
    type: "single",
    stem: "Why continue monitoring in recovery after ETT?",
    choices: [
      "Only to document cool-down HR",
      "Ischemic ECG changes and arrhythmias may appear or worsen in recovery",
      "Recovery monitoring is optional if peak exercise was normal",
      "Only blood pressure matters in recovery",
    ],
    correct: [1],
    explanation:
      "ST changes and arrhythmias can emerge in recovery; ECG, BP, and symptoms are followed until stable.",
  },
  {
    id: "q12",
    topicId: "devices",
    type: "single",
    stem: "In the pacing mode code DDD, the first letter indicates:",
    choices: [
      "Chamber sensed",
      "Chamber paced",
      "Response to sensing",
      "Rate modulation",
    ],
    correct: [1],
    explanation: "NBG code position I = chamber paced; II = sensed; III = response to sensing.",
  },
  {
    id: "q13",
    topicId: "devices",
    type: "single",
    stem: "A pacing spike falls on an intrinsic QRS and does not alter its morphology. This is called:",
    choices: ["Fusion", "Pseudofusion", "Failure to capture", "Pacemaker-mediated tachycardia"],
    correct: [1],
    explanation:
      "Pseudofusion: spike coincides with an intrinsic QRS without contributing to depolarization.",
  },
  {
    id: "q14",
    topicId: "devices",
    type: "single",
    stem: "Pacemaker-mediated tachycardia typically involves:",
    choices: [
      "Single-chamber VVI devices only",
      "An endless loop with retrograde atrial sensing triggering ventricular pacing",
      "Battery depletion causing runaway pacing at 300 bpm",
      "Failure to output due to lead fracture",
    ],
    correct: [1],
    explanation:
      "PMT is an endless-loop tachycardia in dual-chamber systems driven by retrograde P sensing.",
  },
  {
    id: "q15",
    topicId: "devices",
    type: "multi",
    stem: "Implantable devices a cardiology technologist should be able to discuss indications for include: (choose all that apply)",
    choices: ["Pacemaker", "ICD", "CRT", "Implantable loop recorder"],
    correct: [0, 1, 2, 3],
    explanation: "NOCP 1.4a lists pacemaker, ICD, CRT, and implantable loop recorder.",
  },
  {
    id: "q16",
    topicId: "ambulatory",
    type: "single",
    stem: "A key patient instruction for Holter monitoring is to:",
    choices: [
      "Avoid all diary entries unless syncope occurs",
      "Record symptoms and activities in the diary with times",
      "Remove electrodes nightly to shower freely",
      "Exercise maximally each hour for calibration",
    ],
    correct: [1],
    explanation:
      "NOCP 1.2c: instruct patients on diary entries relative to symptoms and activities for correlation.",
  },
  {
    id: "q17",
    topicId: "ambulatory",
    type: "single",
    stem: "When analyzing ambulatory ECG, technologists should:",
    choices: [
      "Ignore medications because Holter is rhythm-only",
      "Relate findings to patient symptoms and medications",
      "Print every single beat for the report",
      "Always prioritize artifact over true ectopy",
    ],
    correct: [1],
    explanation: "NOCP 1.2f: analyze recording and relate to patient symptoms and medications.",
  },
  {
    id: "q18",
    topicId: "ep",
    type: "multi",
    stem: "Mechanisms of arrhythmogenesis emphasized in EP knowledge include: (choose all that apply)",
    choices: ["Abnormal automaticity", "Reentry", "Triggered activity", "Frank–Starling overflow"],
    correct: [0, 1, 2],
    explanation:
      "NOCP 1.7c: abnormal automaticity, reentry, and triggered activity. Blueprint emphasizes 1.7a and 1.7c.",
  },
  {
    id: "q19",
    topicId: "ep",
    type: "single",
    stem: "Which EP interval reflects conduction through the His–Purkinje system below the AV node?",
    choices: ["AH interval", "HV interval", "SNRT", "VA conduction time only"],
    correct: [1],
    explanation: "HV interval approximates His–Purkinje conduction time.",
  },
  {
    id: "q20",
    topicId: "anatomy-patho",
    type: "single",
    stem: "Normal ejection fraction for CSCT exam purposes is:",
    choices: ["40%–50%", "50%–55%", "55%–70%", "70%–90%"],
    correct: [2],
    explanation: "CSCT Exam Guidelines: normal EF 55%–70%.",
    source: "CSCT Exam Guidelines",
  },
  {
    id: "q21",
    topicId: "anatomy-patho",
    type: "single",
    stem: "ST elevation in leads II, III, and aVF most suggests injury in which territory?",
    choices: ["Anterior (LAD)", "Inferior (usually RCA)", "High lateral (LCx)", "Posterior only"],
    correct: [1],
    explanation: "Inferior leads II/III/aVF typically reflect RCA (sometimes LCx) territory.",
  },
  {
    id: "q22",
    topicId: "anatomy-patho",
    type: "single",
    stem: "Hyperkalemia on ECG is classically associated with:",
    choices: ["U waves and flat T waves", "Peaked T waves and QRS widening", "Delta waves", "Short PR with delta wave"],
    correct: [1],
    explanation: "HyperK: peaked T waves progressing to wide QRS / sine wave.",
  },
  {
    id: "q23",
    topicId: "anatomy-patho",
    type: "multi",
    stem: "Intrinsic pacemaker rates you should know: (choose all that apply)",
    choices: [
      "SA node 60–100 bpm",
      "AV junction 40–60 bpm",
      "Ventricular foci 20–40 bpm",
      "Purkinje network 100–150 bpm as primary pacemaker",
    ],
    correct: [0, 1, 2],
    explanation: "Hierarchy: SA 60–100, junction 40–60, ventricular 20–40.",
  },
  {
    id: "q24",
    topicId: "pharm",
    type: "single",
    stem: "Adenosine is primarily used to:",
    choices: [
      "Convert atrial fibrillation long-term",
      "Briefly block the AV node to terminate/diagnose reentrant SVT",
      "Treat Torsades as first-line instead of magnesium",
      "Increase ventricular pacing thresholds",
    ],
    correct: [1],
    explanation: "Adenosine transiently blocks AV nodal conduction — useful for AVNRT/AVRT.",
  },
  {
    id: "q25",
    topicId: "pharm",
    type: "single",
    stem: "Which drug effect is classically linked to scooped ST depression and shortened QT?",
    choices: ["Amiodarone", "Digoxin", "Adenosine", "Atropine"],
    correct: [1],
    explanation: "Digoxin effect: Salvador Dali–like ST scooping, flattened T, short QT.",
  },
  {
    id: "q26",
    topicId: "pharm",
    type: "single",
    stem: "Why monitor QTc when starting many Class III antiarrhythmics?",
    choices: [
      "They shorten QTc and cause AF",
      "QT prolongation increases Torsades risk",
      "QTc is unrelated to drug safety",
      "They only affect the PR interval",
    ],
    correct: [1],
    explanation: "Class III agents prolong repolarization; excessive QTc raises TdP risk.",
  },
  {
    id: "q27",
    topicId: "ecg",
    type: "single",
    stem: "According to CSCT Exam Guidelines, normal PR interval for exam purposes is listed as:",
    choices: ["0.10 s", "0.12 s", "0.20 s", "0.12–0.20 s"],
    correct: [1],
    explanation:
      "CSCT Exam Guidelines text states: Normal ECG Measurements — PR 0.12 seconds. Use the official exam guideline value when answering CSCT items.",
    source: "CSCT Exam Guidelines",
  },
  {
    id: "q28",
    topicId: "ecg",
    type: "single",
    stem: "Torsades de Pointes is best associated with:",
    choices: [
      "Short QT and peaked T waves",
      "Polymorphic VT with shifting axis and prolonged QT",
      "Regular narrow-complex SVT at 150",
      "Sinus arrhythmia in athletes",
    ],
    correct: [1],
    explanation: "TdP: polymorphic VT twisting around the baseline, linked to long QT.",
  },
  {
    id: "q29",
    topicId: "anatomy-patho",
    type: "single",
    stem: "Right-sided precordial leads are most helpful when evaluating:",
    choices: [
      "High lateral OMI only",
      "Right ventricular involvement in inferior MI",
      "Left posterior fascicular block exclusively",
      "Pacemaker battery voltage",
    ],
    correct: [1],
    explanation:
      "Right-sided leads (especially V4R) help identify RV infarction accompanying inferior MI.",
  },
  {
    id: "q30",
    topicId: "devices",
    type: "single",
    stem: "Failure to capture is present when:",
    choices: [
      "A spike is followed by no myocardial depolarization",
      "No spikes appear because intrinsic rhythm inhibits pacing",
      "A spike lands on an intrinsic QRS (pseudofusion)",
      "The device senses myopotentials and inhibits appropriately in VVI",
    ],
    correct: [0],
    explanation:
      "Output without capture means the spike does not depolarize myocardium (lead/threshold/metabolic issues, etc.).",
  },
];

export function questionsForTopic(topicId: string): Question[] {
  return questions.filter((q) => q.topicId === topicId);
}

export function allTopicIdsWithQuestions(): string[] {
  return [...new Set(questions.map((q) => q.topicId))];
}
