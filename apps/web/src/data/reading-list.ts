export type ReadingItem = {
  id: string;
  title: string;
  citation: string;
  href?: string;
  note?: string;
};

export type ReadingSection = {
  id: string;
  title: string;
  topicIds: string[];
  description: string;
  items: ReadingItem[];
};

/**
 * CSCT Recommended Reading List for the Certification Exam.
 * Source: https://www.csct.ca/reading-list (and candidate-provided list).
 */
export const readingList: ReadingSection[] = [
  {
    id: "ecg",
    title: "ECG",
    topicIds: ["ecg", "anatomy-patho"],
    description:
      "Core 12-lead interpretation and arrhythmia workout references for the largest exam slice (ECG analysis).",
    items: [
      {
        id: "garcia",
        title: "12-Lead ECG: The Art of Interpretation",
        citation:
          "2nd edition — Tomas B. Garcia, Neil E. Holtz — Jones and Bartlett Learning — ISBN 9781284040883",
      },
      {
        id: "huff-ecg",
        title: "ECG Workout: Exercises in Arrhythmia Interpretation",
        citation:
          "7th edition — Jane Huff — Lippincott, Williams and Wilkins — ISBN 9781469899824",
      },
    ],
  },
  {
    id: "holter",
    title: "Holter / Ambulatory ECG",
    topicIds: ["ambulatory"],
    description: "Ambulatory monitoring analysis practice plus ACC/AHA ambulatory ECG guidance.",
    items: [
      {
        id: "huff-holter",
        title: "ECG Workout: Exercises in Arrhythmia Interpretation",
        citation:
          "7th edition — Jane Huff — Lippincott, Williams and Wilkins — ISBN 9781469899824",
      },
      {
        id: "aha-ambulatory",
        title: "ACC/AHA Guidelines for Ambulatory Electrocardiography",
        citation: "Executive Summary and Recommendations",
        href: "http://circ.ahajournals.org/cgi/content/full/100/8/886",
      },
    ],
  },
  {
    id: "ett",
    title: "Exercise Tolerance Testing (ETT)",
    topicIds: ["ett"],
    description: "Exercise testing standards, protocols, and practical stress-testing guidance.",
    items: [
      {
        id: "acsm",
        title: "ACSM’s Guidelines for Exercise Testing and Prescription",
        citation:
          "9th Edition — American College of Sports Medicine — Wolters Kluwer — ISBN 9781609136055",
      },
      {
        id: "chung",
        title: "Pocket Guide to Stress Testing",
        citation: "1st edition — Edward Chung — Blackwell Science — ISBN 978-0-8654-2509-5",
        note: "ISBN as commonly listed for this title; confirm edition when purchasing.",
      },
      {
        id: "aha-exercise",
        title: "AHA Guidelines — Exercise Standards for Testing and Training",
        citation: "Circulation scientific statement",
        href: "http://circ.ahajournals.org/content/early/2013/07/22/CIR.0b013e31829b5b44",
      },
    ],
  },
  {
    id: "ep",
    title: "Electrophysiology (EP)",
    topicIds: ["ep", "devices"],
    description: "Introductory EP concepts aligned with blueprint emphasis on indications and mechanisms.",
    items: [
      {
        id: "sweesy",
        title: "EP: Getting Started",
        citation: "Mark W. Sweesy — Cardiac Device Consultants, Inc. — Cardiotext Publishing",
        href: "https://cardiotextpublishing.com/cardiology-titles/ep-getting-started",
      },
    ],
  },
];

export const ecgAnalysisSteps = [
  { id: "rhythm", label: "Rhythm", tip: "Regular vs irregular; underlying pacemaker site" },
  { id: "rate", label: "Rate", tip: "Atrial and ventricular rates when they differ" },
  { id: "axis", label: "Axis", tip: "CSCT normal axis: −30° to +90°" },
  { id: "pri", label: "PRI", tip: "CSCT exam guideline PR listed as 0.12 s" },
  { id: "qrst", label: "QRST", tip: "QRS width/morphology and QT relationship" },
  { id: "qtc", label: "QTc (Bazett’s)", tip: "QTc = QT/√RR; CSCT upper normal 450 msec" },
  {
    id: "p-morph",
    label: "P wave morphology",
    tip: "Sinus vs ectopic; enlargement patterns",
  },
  {
    id: "st",
    label: "ST segment",
    tip: "Elevated · isoelectric · downsloping · upsloping · horizontal depression",
  },
  {
    id: "t",
    label: "T wave",
    tip: "Upright · inverted (sym/asym) · flat · pointed/tenting",
  },
] as const;

export function readingForTopic(topicId: string): ReadingSection[] {
  return readingList.filter((section) => section.topicIds.includes(topicId));
}
