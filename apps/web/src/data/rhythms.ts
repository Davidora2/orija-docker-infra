export type RhythmTopic = {
  id: string;
  name: string;
  category: string;
  hallmarks: string[];
  watchFor: string[];
};

/** Categories mirror the CSCT ECG Analysis Study Guide groupings. */
export const rhythmCategories = [
  "SA Node",
  "Atria",
  "AV Node / Junction",
  "Ventricles",
  "Reentry Tachycardias",
  "Pre-excitation",
  "Blocks",
  "Structural Abnormalities",
  "Myocardial Ischemia / Injury / Infarction",
  "Miscellaneous ST Changes",
  "Electrolyte Imbalances",
  "Miscellaneous",
  "Pacemaker",
] as const;

/**
 * Full identify-list from:
 * https://www.csct.ca/ECG-Analysis-Study-Guide
 * (“For the purposes of the CSCT Certification examination, can you identify the following?”)
 */
export const rhythmTopics: RhythmTopic[] = [
  // SA Node
  {
    id: "nsr",
    name: "Sinus Rhythm",
    category: "SA Node",
    hallmarks: ["Upright P in II", "P before every QRS", "Rate 60–100", "Regular"],
    watchFor: ["Compare to prior tracing", "Subtle PR/QRS changes with meds"],
  },
  {
    id: "sb",
    name: "Sinus Bradycardia",
    category: "SA Node",
    hallmarks: ["Sinus P waves", "Rate < 60", "Regular"],
    watchFor: ["Athletic vs symptomatic", "Drug effects (beta blockers)"],
  },
  {
    id: "st",
    name: "Sinus Tachycardia",
    category: "SA Node",
    hallmarks: ["Sinus P waves", "Rate > 100", "Gradual onset/offset"],
    watchFor: ["Secondary causes: pain, fever, hypovolemia, PE"],
  },
  {
    id: "sa",
    name: "Sinus Arrhythmia",
    category: "SA Node",
    hallmarks: ["Sinus P waves", "Phasic RR variation (often respiratory)"],
    watchFor: ["Usually benign", "Distinguish from sinus arrest"],
  },
  {
    id: "sinus-arrest",
    name: "Sinus Arrest",
    category: "SA Node",
    hallmarks: ["Pause without P", "Pause not an exact multiple of PP"],
    watchFor: ["Escape beats", "Sick sinus context"],
  },
  {
    id: "sinus-block",
    name: "Sinus Block",
    category: "SA Node",
    hallmarks: ["Pause equals exact multiple of basic PP cycle"],
    watchFor: ["Exit block grades", "Differentiate from arrest"],
  },
  {
    id: "sss",
    name: "Sick Sinus Syndrome",
    category: "SA Node",
    hallmarks: ["Inappropriate bradycardia", "Arrests/blocks", "Tachy-brady possible"],
    watchFor: ["Correlation with symptoms", "Pacing indications"],
  },

  // Atria
  {
    id: "mat",
    name: "Multifocal Atrial Tachycardia",
    category: "Atria",
    hallmarks: ["≥3 P morphologies", "Irregular", "Rate usually >100"],
    watchFor: ["COPD/hypoxia association", "Not AF — discrete P waves present"],
  },
  {
    id: "pat",
    name: "Paroxysmal Atrial Tachycardia",
    category: "Atria",
    hallmarks: ["Sudden onset/offset atrial tach", "P′ morphology differs from sinus"],
    watchFor: ["Warm-up vs abrupt", "AV block with digitalis toxicity patterns"],
  },
  {
    id: "apb",
    name: "Atrial Premature Beats",
    category: "Atria",
    hallmarks: ["Early abnormal P′", "Usually narrow QRS"],
    watchFor: ["Aberrancy after APBs", "Frequent APBs preceding AF"],
  },
  {
    id: "afib",
    name: "Atrial Fibrillation",
    category: "Atria",
    hallmarks: ["No discrete P waves", "Irregularly irregular RR", "Fibrillatory baseline"],
    watchFor: ["Ashman aberrancy", "Pre-excitation + AF (wide irregular — emergency)"],
  },
  {
    id: "aflutter",
    name: "Atrial Flutter",
    category: "Atria",
    hallmarks: ["Sawtooth flutter waves", "Often ~300 atrial rate", "Fixed or variable conduction"],
    watchFor: ["2:1 conduction looking “regular SVT”", "Flutter waves in inferior leads"],
  },
  {
    id: "ashman",
    name: "Ashman Phenomenon",
    category: "Atria",
    hallmarks: ["Aberrancy after long–short cycle", "Often RBBB morphology in AF"],
    watchFor: ["Do not call VT solely on wide beat in AF"],
  },
  {
    id: "aberrancy",
    name: "Aberrancy",
    category: "Atria",
    hallmarks: ["Wide QRS from abnormal conduction of a supraventricular impulse"],
    watchFor: ["Ashman", "Rate-related bundle branch block"],
  },

  // AV Node / Junction
  {
    id: "je",
    name: "Junctional Escape Rhythm",
    category: "AV Node / Junction",
    hallmarks: ["Rate ~40–60", "Narrow QRS usually", "Inverted/absent/after-QRS P"],
    watchFor: ["Escape after sinus slowing"],
  },
  {
    id: "ajr",
    name: "Accelerated Junctional Rhythm",
    category: "AV Node / Junction",
    hallmarks: ["Junctional morphology", "Rate ~60–100"],
    watchFor: ["Post-op / ischemia / digoxin"],
  },
  {
    id: "jb",
    name: "Junctional Bradycardia",
    category: "AV Node / Junction",
    hallmarks: ["Junctional origin", "Rate slower than typical junctional escape"],
    watchFor: ["Symptoms", "Escape reliability"],
  },
  {
    id: "jt",
    name: "Junctional Tachycardia",
    category: "AV Node / Junction",
    hallmarks: ["Junctional origin", "Rate typically >100"],
    watchFor: ["Differentiate from AVNRT"],
  },
  {
    id: "pjb",
    name: "Premature Junctional Beats",
    category: "AV Node / Junction",
    hallmarks: ["Early narrow QRS", "Retrograde/absent P"],
    watchFor: ["Junctional bigeminy"],
  },

  // Ventricles
  {
    id: "ivr",
    name: "Idioventricular Rhythm",
    category: "Ventricles",
    hallmarks: ["Wide QRS", "Rate ~20–40", "No associated P driving QRS"],
    watchFor: ["Escape after AV block", "Do not suppress escape blindly"],
  },
  {
    id: "aivr",
    name: "Accelerated Ventricular Rhythm",
    category: "Ventricles",
    hallmarks: ["Wide QRS ventricular rhythm", "Faster than escape, usually <100"],
    watchFor: ["Reperfusion AIVR after MI"],
  },
  {
    id: "pvb",
    name: "Premature Ventricular Beats",
    category: "Ventricles",
    hallmarks: ["Early wide bizarre QRS", "No preceding P", "Full compensatory pause common"],
    watchFor: ["R-on-T", "Multiform PVCs", "Runs → NSVT"],
  },
  {
    id: "vt",
    name: "Ventricular Tachycardia",
    category: "Ventricles",
    hallmarks: ["Wide complex tachycardia", "Usually regular", "AV dissociation / capture / fusion support VT"],
    watchFor: ["Unstable → treat emergently", "Assume VT until proven otherwise in adults"],
  },
  {
    id: "vf",
    name: "Ventricular Fibrillation",
    category: "Ventricles",
    hallmarks: ["Chaotic undulations", "No QRS/T", "No pulse"],
    watchFor: ["Immediate defibrillation / ACLS"],
  },
  {
    id: "vflutter",
    name: "Ventricular Flutter",
    category: "Ventricles",
    hallmarks: ["Sine-wave appearance", "Very rapid ventricular rate"],
    watchFor: ["Treat as pulseless VT/VF equivalent"],
  },
  {
    id: "agonal",
    name: "Agonal Rhythm",
    category: "Ventricles",
    hallmarks: ["Very slow wide complexes", "Dying heart pattern"],
    watchFor: ["Terminal rhythm — resuscitation context"],
  },
  {
    id: "tdp",
    name: "Torsades de Pointes",
    category: "Ventricles",
    hallmarks: ["Polymorphic VT", "Twisting QRS axis", "Long QT association"],
    watchFor: ["MgSO4", "Stop QT-prolonging drugs"],
  },
  {
    id: "parasystole",
    name: "Parasystole",
    category: "Ventricles",
    hallmarks: ["Independent ectopic ventricular focus", "Entrance block", "Variable coupling"],
    watchFor: ["Mathematically related interectopic intervals"],
  },

  // Reentry
  {
    id: "psvt",
    name: "Paroxysmal Supraventricular Tachycardia",
    category: "Reentry Tachycardias",
    hallmarks: ["Sudden onset/offset", "Narrow complex usually", "Rate often 150–250"],
    watchFor: ["Adenosine diagnostic/therapeutic"],
  },
  {
    id: "svt",
    name: "Supraventricular Tachycardia",
    category: "Reentry Tachycardias",
    hallmarks: ["Narrow-complex tach above the ventricles (umbrella term)"],
    watchFor: ["Identify mechanism when possible (AVNRT/AVRT/AT/flutter)"],
  },
  {
    id: "avnrt",
    name: "AV Nodal Reentry Tachycardia",
    category: "Reentry Tachycardias",
    hallmarks: ["Reentry in dual AV nodal pathways", "P often buried/pseudo r′ in V1"],
    watchFor: ["Most common PSVT mechanism in adults"],
  },
  {
    id: "sa-reentry",
    name: "SA Node Reentry",
    category: "Reentry Tachycardias",
    hallmarks: ["P morphology similar to sinus", "Abrupt onset/offset"],
    watchFor: ["Distinguish from sinus tach (gradual)"],
  },

  // Pre-excitation (CSCT lists types + LGL; WPW is classic type discussed in guidelines)
  {
    id: "pre-ex-1",
    name: "Pre-excitation type 1",
    category: "Pre-excitation",
    hallmarks: ["Accessory pathway pattern (CSCT study-guide category)", "Short PR / delta features may be present"],
    watchFor: ["CSCT guideline: WPW is one type of pre-excitation — others exist"],
  },
  {
    id: "pre-ex-2",
    name: "Pre-excitation type 2",
    category: "Pre-excitation",
    hallmarks: ["Alternate pre-excitation pattern category on CSCT list"],
    watchFor: ["Compare pathway locations / delta polarity across leads"],
  },
  {
    id: "lgl",
    name: "LGL (Lown–Ganong–Levine)",
    category: "Pre-excitation",
    hallmarks: ["Short PR", "Normal QRS (no delta wave)"],
    watchFor: ["Differentiate from WPW (which has delta + wide QRS)"],
  },

  // Blocks
  {
    id: "avb1",
    name: "1st Degree AV Block",
    category: "Blocks",
    hallmarks: ["PR prolonged", "Every P conducts"],
    watchFor: ["Meds, elevated vagal tone, inferior ischemia"],
  },
  {
    id: "mobitz1",
    name: "2nd Degree AVB type 1 (Mobitz I)",
    category: "Blocks",
    hallmarks: ["PR lengthens then dropped QRS"],
    watchFor: ["Usually AV nodal", "Often better prognosis than type 2"],
  },
  {
    id: "mobitz2",
    name: "2nd Degree AVB type 2 (Mobitz II)",
    category: "Blocks",
    hallmarks: ["Sudden dropped QRS", "PR constant when conducted"],
    watchFor: ["Infra-His risk", "Pacing considerations"],
  },
  {
    id: "avb3",
    name: "3rd Degree AV Block",
    category: "Blocks",
    hallmarks: ["AV dissociation", "P and QRS independent"],
    watchFor: ["Escape width/rate", "Unstable → pacing/ACLS"],
  },
  {
    id: "high-grade",
    name: "High Grade AV Block (Ventricular Standstill)",
    category: "Blocks",
    hallmarks: ["Multiple consecutive nonconducted P waves", "May include ventricular standstill"],
    watchFor: ["Emergency pacing / ACLS readiness"],
  },
  {
    id: "rbbb",
    name: "Right Bundle Branch Block",
    category: "Blocks",
    hallmarks: ["Wide QRS", "rsR′ in V1", "Wide S in I/V6"],
    watchFor: ["New RBBB with symptoms — urgent evaluation"],
  },
  {
    id: "lbbb",
    name: "Left Bundle Branch Block",
    category: "Blocks",
    hallmarks: ["Wide QRS", "Broad monophasic R in I/V6", "Poor R progression / QS in V1"],
    watchFor: ["Sgarbossa / modified criteria if ischemia suspected"],
  },
  {
    id: "bifascicular",
    name: "Bifascicular Block",
    category: "Blocks",
    hallmarks: ["RBBB + LAFB or RBBB + LPFB (common patterns)", "Or complete LBBB conceptually as both left fascicles"],
    watchFor: ["Progression risk with symptoms/syncope"],
  },
  {
    id: "trifascicular",
    name: "Trifascicular Block",
    category: "Blocks",
    hallmarks: ["Bifascicular block + prolonged PR (incomplete trifascicular)", "Or alternating bundle patterns"],
    watchFor: ["High-grade block risk — correlate clinically"],
  },
  {
    id: "lafb",
    name: "Left Anterior Fascicular Block",
    category: "Blocks",
    hallmarks: ["Left axis deviation", "qR in I/aVL", "rS in II/III/aVF", "QRS usually not very wide"],
    watchFor: ["Often with RBBB as bifascicular block"],
  },
  {
    id: "lpfb",
    name: "Left Posterior Fascicular Block",
    category: "Blocks",
    hallmarks: ["Right axis deviation", "rS in I/aVL", "qR in III/aVF", "Exclude other causes of RAD"],
    watchFor: ["Less common; rule out lateral MI / RVH first"],
  },

  // Structural
  {
    id: "bae",
    name: "Bi-Atrial Enlargement",
    category: "Structural Abnormalities",
    hallmarks: ["Features of both RAE and LAE", "Tall and wide/notched P components"],
    watchFor: ["Lead II and V1 P morphology"],
  },
  {
    id: "rae",
    name: "Right Atrial Enlargement",
    category: "Structural Abnormalities",
    hallmarks: ["Tall peaked P (P pulmonale) in II", "Prominent positive P in V1"],
    watchFor: ["Lung disease / right heart strain context"],
  },
  {
    id: "lae",
    name: "Left Atrial Enlargement",
    category: "Structural Abnormalities",
    hallmarks: ["Broad notched P (P mitrale) in II", "Deep negative terminal P in V1"],
    watchFor: ["Mitral disease / LV pressure overload"],
  },
  {
    id: "rvh",
    name: "Right Ventricular Hypertrophy",
    category: "Structural Abnormalities",
    hallmarks: ["Right axis", "Tall R in V1", "Strain pattern possible"],
    watchFor: ["Pulmonary hypertension / congenital context"],
  },
  {
    id: "lvh",
    name: "Left Ventricular Hypertrophy",
    category: "Structural Abnormalities",
    hallmarks: ["CSCT uses Romhilt–Estes criteria", "Voltage + ST-T (“strain”) patterns"],
    watchFor: ["Do not overcall ischemia on strain pattern alone"],
  },

  // Ischemia / injury / infarction
  {
    id: "ischemia-t",
    name: "Myocardial Ischemia / T Wave Abnormalities",
    category: "Myocardial Ischemia / Injury / Infarction",
    hallmarks: ["ST depression patterns", "T inversion (symmetrical concerning)", "Territory mapping"],
    watchFor: ["Compare prior ECGs", "Symptoms and serial tracings"],
  },
  {
    id: "wellens",
    name: "Wellen’s Syndrome",
    category: "Myocardial Ischemia / Injury / Infarction",
    hallmarks: ["Deep inverted or biphasic T in V2–V3", "Often isoelectric/minimally elevated ST", "History of anginal pain now resolved"],
    watchFor: ["Critical proximal LAD lesion pattern — urgent pathway"],
  },
  {
    id: "stemi",
    name: "STEMI",
    category: "Myocardial Ischemia / Injury / Infarction",
    hallmarks: ["ST elevation in a territory", "Reciprocal changes", "Hyperacute T → Q waves evolving"],
    watchFor: ["Right-sided / posterior leads when indicated"],
  },
  {
    id: "nstemi",
    name: "NSTEMI",
    category: "Myocardial Ischemia / Injury / Infarction",
    hallmarks: ["Ischemic ST/T changes without qualifying ST elevation", "Clinical + biomarker diagnosis"],
    watchFor: ["Dynamic changes", "Wellens / posterior OMI mimics"],
  },
  {
    id: "hyperacute-t",
    name: "Hyperacute T Waves",
    category: "Myocardial Ischemia / Injury / Infarction",
    hallmarks: ["Broad, tall, asymmetric T waves early in occlusion", "May precede frank ST elevation"],
    watchFor: ["Serial ECGs", "Differentiate from hyperK peaked T"],
  },

  // Misc ST
  {
    id: "early-repel",
    name: "Early Repolarization",
    category: "Miscellaneous ST Changes",
    hallmarks: ["J-point elevation", "Often concave ST elevation", "Common in younger patients"],
    watchFor: ["Differentiate from STEMI / pericarditis"],
  },
  {
    id: "pericarditis",
    name: "Pericarditis",
    category: "Miscellaneous ST Changes",
    hallmarks: ["Diffuse ST elevation", "PR depression", "Usually concave"],
    watchFor: ["Not territorial like STEMI", "Pain positional"],
  },
  {
    id: "brugada",
    name: "Brugada Syndrome",
    category: "Miscellaneous ST Changes",
    hallmarks: ["Coved ST elevation V1–V2 (type 1)", "Incomplete RBBB-like appearance"],
    watchFor: ["Fever/drug triggers", "Syncope / SCD risk"],
  },
  {
    id: "v-aneurysm",
    name: "Ventricular Aneurysm",
    category: "Miscellaneous ST Changes",
    hallmarks: ["Persistent ST elevation after old MI", "Q waves in same leads"],
    watchFor: ["Chronic finding vs acute occlusion — history/priors matter"],
  },

  // Electrolytes
  {
    id: "hyperca",
    name: "Hypercalcemia",
    category: "Electrolyte Imbalances",
    hallmarks: ["Shortened QT", "May have shortened ST segment"],
    watchFor: ["Correlate with labs"],
  },
  {
    id: "hypoca",
    name: "Hypocalcemia",
    category: "Electrolyte Imbalances",
    hallmarks: ["Prolonged QT (long ST segment)"],
    watchFor: ["TdP risk if markedly prolonged"],
  },
  {
    id: "hyperk",
    name: "Hyperkalemia",
    category: "Electrolyte Imbalances",
    hallmarks: ["Peaked T waves", "QRS widening", "P wave flattening → sine wave"],
    watchFor: ["Emergency treatment pathway"],
  },
  {
    id: "hypok",
    name: "Hypokalemia",
    category: "Electrolyte Imbalances",
    hallmarks: ["U waves", "Flattened T waves", "ST depression", "QT(U) prolongation"],
    watchFor: ["Arrhythmia risk with digoxin"],
  },

  // Miscellaneous
  {
    id: "dextrocardia",
    name: "Dextrocardia",
    category: "Miscellaneous",
    hallmarks: ["Global negativity in I", "Reverse R-wave progression", "Right-axis appearance"],
    watchFor: ["Confirm lead placement / technical dextrocardia vs true"],
  },
  {
    id: "hypothermia",
    name: "Hypothermia",
    category: "Miscellaneous",
    hallmarks: ["Osborne (J) waves", "Bradycardia", "Prolonged intervals possible"],
    watchFor: ["Tremor artifact", "Core temperature"],
  },
  {
    id: "electrical-alternans",
    name: "Electrical Alternans",
    category: "Miscellaneous",
    hallmarks: ["Beat-to-beat QRS amplitude alternation"],
    watchFor: ["Large pericardial effusion / tamponade context"],
  },
  {
    id: "pe",
    name: "Pulmonary Embolism",
    category: "Miscellaneous",
    hallmarks: ["Sinus tach common", "S1Q3T3 classic but uncommon", "Right strain patterns"],
    watchFor: ["ECG supportive, not diagnostic"],
  },
  {
    id: "pea",
    name: "Pulseless Electrical Activity (PEA)",
    category: "Miscellaneous",
    hallmarks: ["Organized ECG activity", "No palpable pulse"],
    watchFor: ["Hs/Ts", "Not a rhythm diagnosis alone — clinical state"],
  },

  // Pacemaker
  {
    id: "pacing-modes",
    name: "Pacing modes",
    category: "Pacemaker",
    hallmarks: ["NBG code: chamber paced / sensed / response", "DDD, VVI, AAI examples"],
    watchFor: ["Rate response (R)", "Magnet behavior"],
  },
  {
    id: "capture",
    name: "Capture",
    category: "Pacemaker",
    hallmarks: ["Spike followed by myocardial depolarization"],
    watchFor: ["Failure to capture vs failure to output"],
  },
  {
    id: "sense",
    name: "Sense",
    category: "Pacemaker",
    hallmarks: ["Device detects intrinsic activity and responds per mode"],
    watchFor: ["Undersensing / oversensing"],
  },
  {
    id: "fusion",
    name: "Fusion",
    category: "Pacemaker",
    hallmarks: ["Paced + intrinsic hybrid QRS morphology"],
    watchFor: ["Not necessarily malfunction"],
  },
  {
    id: "pseudofusion",
    name: "Pseudofusion",
    category: "Pacemaker",
    hallmarks: ["Spike on intrinsic QRS without contributing to depolarization"],
    watchFor: ["Timing coincidence — evaluate sensing windows"],
  },
  {
    id: "pmt",
    name: "Pacemaker Mediated Tachycardia (PMT)",
    category: "Pacemaker",
    hallmarks: ["Endless-loop in dual-chamber devices", "Retrograde P sensed → ventricular pace"],
    watchFor: ["Magnet / PVARP programming concepts"],
  },
];

export function rhythmsByCategory(): Record<string, RhythmTopic[]> {
  return rhythmTopics.reduce<Record<string, RhythmTopic[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});
}
