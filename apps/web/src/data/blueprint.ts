export type BlueprintTopic = {
  id: string;
  code: string;
  title: string;
  weightPercent: number;
  area: "cardiac-procedures" | "foundational" | "patient-care";
  summary: string;
  studyTips: string[];
  keyPoints: string[];
};

export const blueprintAreas = [
  {
    id: "cardiac-procedures",
    title: "Area 1: Cardiac Procedures",
    weightPercent: 70,
    color: "teal",
  },
  {
    id: "foundational",
    title: "Area 4: Foundational Knowledge",
    weightPercent: 30,
    color: "navy",
  },
  {
    id: "patient-care",
    title: "Area 2: Patient Care",
    weightPercent: 0,
    color: "slate",
    note: "Listed in NOCP; currently 0% of exam weighting per blueprint.",
  },
] as const;

/** CSCT National Certification Exam Blueprint (2014 NOCP revisions). Weights ±2%. */
export const blueprintTopics: BlueprintTopic[] = [
  {
    id: "ecg",
    code: "1.1",
    title: "Record and analyze electrocardiograms",
    weightPercent: 30,
    area: "cardiac-procedures",
    summary:
      "Largest exam slice. Master 12-lead acquisition, artifact control, and rhythm/morphology analysis tied to symptoms and meds.",
    studyTips: [
      "Drill CSCT exam guideline numbers until automatic (PR, QRS, QTc, axis, EF).",
      "Practice naming rhythms from the official ECG Analysis Study Guide list.",
      "Link ischemic patterns to coronary territories and symptoms.",
    ],
    keyPoints: [
      "Select standard, right-sided, posterior, pediatric, and Brugada lead sites",
      "Obtain artifact-free, technically correct tracings",
      "Analyze and relate findings to symptoms and medications",
      "Know when additional tracings or rhythm strips are needed",
      "Recognize pre-excitation (WPW and other pathways)",
    ],
  },
  {
    id: "ett",
    code: "1.3",
    title: "Perform exercise tolerance testing",
    weightPercent: 18,
    area: "cardiac-procedures",
    summary:
      "Second-heaviest procedure topic. Focus on indications/contraindications, monitoring, termination criteria, and ST measurement rules.",
    studyTips: [
      "Memorize absolute vs relative termination criteria.",
      "For CSCT exam: ST measured 80 msec from the J point.",
      "BP drop ≥10 mmHg from pretest is an absolute stop criterion on the exam.",
    ],
    keyPoints: [
      "Indications and contraindications",
      "Protocol and electrode selection for ETT",
      "Monitor HR, ECG, BP, symptoms, and RPE at rest/exercise/recovery",
      "Identify life-threatening conditions and act",
      "ST depression/elevation criteria and recovery interpretation",
    ],
  },
  {
    id: "devices",
    code: "1.4",
    title: "Assess pacemakers and implantable devices",
    weightPercent: 10,
    area: "cardiac-procedures",
    summary:
      "Pacemaker/ICD/CRT fundamentals: indications, sensing/capture, magnet use, troubleshooting, and environmental interference.",
    studyTips: [
      "Know pacing modes (NBG code) and what each letter means.",
      "Differentiate fusion vs pseudofusion; recognize PMT.",
      "Review indications for pacemaker, ICD, CRT, and ILR.",
    ],
    keyPoints: [
      "Indications for pacemaker, ICD, CRT, implantable loop recorder",
      "Capture, sensing, thresholds, crosstalk, VA conduction",
      "Magnet use indications/contraindications",
      "Alerts, recalls, remote monitoring",
      "Environmental interference with device function",
    ],
  },
  {
    id: "ambulatory",
    code: "1.2",
    title: "Ambulatory ECG monitoring",
    weightPercent: 7,
    area: "cardiac-procedures",
    summary:
      "Holter/event monitoring setup, patient diary instruction, strip selection, and symptom correlation.",
    studyTips: [
      "Practice matching diary symptoms to rhythm strips.",
      "Know when Holter vs event vs ILR is appropriate.",
      "Review artifact sources unique to ambulatory recordings.",
    ],
    keyPoints: [
      "Select monitor parameters and electrode sites",
      "Instruct diary entries for symptoms and activities",
      "Analyze recordings relative to symptoms and medications",
      "Select relevant strips for physician report",
      "Trans-telephonic / event monitor concepts",
    ],
  },
  {
    id: "ep",
    code: "1.7",
    title: "Electrophysiology testing",
    weightPercent: 5,
    area: "cardiac-procedures",
    summary:
      "Blueprint emphasizes 1.7a and 1.7c: indications and arrhythmogenesis mechanisms (automaticity, reentry, triggered activity).",
    studyTips: [
      "Prioritize indications and mechanisms over lab hardware detail.",
      "Know AH, HV, PR, QRS, QT, SNRT and Wenckebach cycle length conceptually.",
      "Connect reentry to SVT subtypes (AVNRT, AVRT, atrial flutter).",
    ],
    keyPoints: [
      "Diagnostic and therapeutic indications for EP study",
      "Mechanisms: abnormal automaticity, reentry, triggered activity",
      "Key intervals: AH, HV, PR, QRS, QT, SNRT",
      "AV node / Wenckebach / tachycardia cycle lengths",
    ],
  },
  {
    id: "anatomy-patho",
    code: "4.1",
    title: "Anatomy, physiology & pathophysiology",
    weightPercent: 25,
    area: "foundational",
    summary:
      "Includes a small share of conduction (4.3) and procedure knowledge (4.4). Know cardiac anatomy, hemodynamics, and core pathologies.",
    studyTips: [
      "Map coronary arteries to ECG leads and MI patterns.",
      "Review heart sounds, EF range (55–70% for exam), and shock/failure signs.",
      "Tie conduction system anatomy to rhythm origin sites.",
    ],
    keyPoints: [
      "Cardiac chambers, valves, coronary circulation",
      "Conduction system anatomy and intrinsic rates",
      "Ischemia, infarction, hypertrophy, cardiomyopathy",
      "Pulmonary embolism and electrolyte ECG effects",
      "Normal axis (−30 to +90°) and hypertrophy criteria (Romhilt–Estes)",
    ],
  },
  {
    id: "pharm",
    code: "4.2",
    title: "Cardiac pharmacology",
    weightPercent: 5,
    area: "foundational",
    summary:
      "Exam lists generic and brand names. Focus on antiarrhythmics, rate control, anticoag, and emergency cardiac drugs.",
    studyTips: [
      "Group drugs by Vaughan-Williams class and clinical use.",
      "Know effects that change ECG (digoxin, class Ia/III QT prolongation).",
      "Review ACLS emergency meds indications/contraindications.",
    ],
    keyPoints: [
      "Antiarrhythmics and QT risk",
      "Beta blockers, calcium channel blockers, digoxin",
      "Anticoagulation / antiplatelet in AF and ACS",
      "Emergency drugs: epinephrine, atropine, amiodarone, adenosine",
      "How meds relate to ECG findings and symptoms",
    ],
  },
];

export function getTopic(id: string): BlueprintTopic | undefined {
  return blueprintTopics.find((t) => t.id === id);
}

export function topicsByPriority(): BlueprintTopic[] {
  return [...blueprintTopics].sort((a, b) => b.weightPercent - a.weightPercent);
}
