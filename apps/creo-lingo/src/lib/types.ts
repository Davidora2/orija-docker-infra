export type ExerciseType =
  | "multiple_choice"
  | "translate"
  | "match_pairs"
  | "fill_blank";

export type MultipleChoiceExercise = {
  id: string;
  type: "multiple_choice";
  prompt: string;
  promptDialect?: string;
  options: string[];
  answer: string;
  tip?: string;
};

export type TranslateExercise = {
  id: string;
  type: "translate";
  direction: "to_dialect" | "to_english";
  prompt: string;
  answer: string;
  acceptedAnswers?: string[];
  tip?: string;
};

export type MatchPairsExercise = {
  id: string;
  type: "match_pairs";
  prompt: string;
  pairs: { left: string; right: string }[];
  tip?: string;
};

export type FillBlankExercise = {
  id: string;
  type: "fill_blank";
  prompt: string;
  sentence: string;
  blank: string;
  options: string[];
  tip?: string;
};

export type Exercise =
  | MultipleChoiceExercise
  | TranslateExercise
  | MatchPairsExercise
  | FillBlankExercise;

export type Lesson = {
  id: string;
  title: string;
  description: string;
  xp: number;
  culturalNote?: string;
  exercises: Exercise[];
};

export type Unit = {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
};

export type Dialect = {
  id: string;
  name: string;
  nativeName: string;
  region: string;
  flagEmoji: string;
  accent: string;
  blurb: string;
  learners: string;
  units: Unit[];
};

export type DialectProgress = {
  completedLessons: string[];
  xp: number;
};

export type UserProgress = {
  activeDialectId: string | null;
  streak: number;
  lastPracticeDate: string | null;
  totalXp: number;
  hearts: number;
  dialects: Record<string, DialectProgress>;
};
