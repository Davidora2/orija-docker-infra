import type { UserProgress } from "./types";

const STORAGE_KEY = "creo-lingo-progress-v1";

export const DEFAULT_PROGRESS: UserProgress = {
  activeDialectId: null,
  streak: 0,
  lastPracticeDate: null,
  totalXp: 0,
  hearts: 5,
  dialects: {},
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function loadProgress(): UserProgress {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) } as UserProgress;
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveProgress(progress: UserProgress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function setActiveDialect(
  progress: UserProgress,
  dialectId: string,
): UserProgress {
  const next = {
    ...progress,
    activeDialectId: dialectId,
    dialects: {
      ...progress.dialects,
      [dialectId]: progress.dialects[dialectId] ?? {
        completedLessons: [],
        xp: 0,
      },
    },
  };
  saveProgress(next);
  return next;
}

export function completeLesson(
  progress: UserProgress,
  dialectId: string,
  lessonId: string,
  xp: number,
): UserProgress {
  const dialect = progress.dialects[dialectId] ?? {
    completedLessons: [],
    xp: 0,
  };
  const alreadyDone = dialect.completedLessons.includes(lessonId);
  const today = todayKey();
  let streak = progress.streak;
  if (progress.lastPracticeDate === today) {
    // same day
  } else if (progress.lastPracticeDate === yesterdayKey()) {
    streak += 1;
  } else {
    streak = 1;
  }

  const next: UserProgress = {
    ...progress,
    activeDialectId: dialectId,
    streak,
    lastPracticeDate: today,
    totalXp: alreadyDone ? progress.totalXp : progress.totalXp + xp,
    hearts: Math.min(5, progress.hearts + (alreadyDone ? 0 : 1)),
    dialects: {
      ...progress.dialects,
      [dialectId]: {
        completedLessons: alreadyDone
          ? dialect.completedLessons
          : [...dialect.completedLessons, lessonId],
        xp: alreadyDone ? dialect.xp : dialect.xp + xp,
      },
    },
  };
  saveProgress(next);
  return next;
}

export function loseHeart(progress: UserProgress): UserProgress {
  const next = { ...progress, hearts: Math.max(0, progress.hearts - 1) };
  saveProgress(next);
  return next;
}

export function refillHearts(progress: UserProgress): UserProgress {
  const next = { ...progress, hearts: 5 };
  saveProgress(next);
  return next;
}
