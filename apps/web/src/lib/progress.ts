"use client";

export type ProgressState = {
  modulesCompleted: string[];
  rhythmsStudied: string[];
  flashcardsSeen: Record<string, number>;
  quizScores: Record<string, { correct: number; total: number; at: string }>;
  lastVisit: string;
};

const KEY = "traceready-progress-v1";

export const emptyProgress = (): ProgressState => ({
  modulesCompleted: [],
  rhythmsStudied: [],
  flashcardsSeen: {},
  quizScores: {},
  lastVisit: new Date().toISOString(),
});

export function loadProgress(): ProgressState {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as ProgressState;
    return { ...emptyProgress(), ...parsed };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(state: ProgressState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify({ ...state, lastVisit: new Date().toISOString() }));
}

export function markModuleComplete(topicId: string): ProgressState {
  const current = loadProgress();
  if (!current.modulesCompleted.includes(topicId)) {
    current.modulesCompleted.push(topicId);
  }
  saveProgress(current);
  return current;
}

export function markRhythmStudied(rhythmId: string): ProgressState {
  const current = loadProgress();
  if (!current.rhythmsStudied.includes(rhythmId)) {
    current.rhythmsStudied.push(rhythmId);
  }
  saveProgress(current);
  return current;
}

export function bumpFlashcard(deckId: string): ProgressState {
  const current = loadProgress();
  current.flashcardsSeen[deckId] = (current.flashcardsSeen[deckId] ?? 0) + 1;
  saveProgress(current);
  return current;
}

export function saveQuizScore(topicId: string, correct: number, total: number): ProgressState {
  const current = loadProgress();
  current.quizScores[topicId] = { correct, total, at: new Date().toISOString() };
  saveProgress(current);
  return current;
}

export function progressPercent(state: ProgressState, moduleCount: number): number {
  if (moduleCount === 0) return 0;
  return Math.round((state.modulesCompleted.length / moduleCount) * 100);
}
