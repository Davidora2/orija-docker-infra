"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UserProgress } from "@/lib/types";
import {
  completeLesson,
  DEFAULT_PROGRESS,
  loadProgress,
  loseHeart,
  refillHearts,
  setActiveDialect,
} from "@/lib/progress";

type ProgressContextValue = {
  progress: UserProgress;
  ready: boolean;
  selectDialect: (id: string) => void;
  finishLesson: (dialectId: string, lessonId: string, xp: number) => void;
  missHeart: () => void;
  restoreHearts: () => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<UserProgress>(DEFAULT_PROGRESS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
    setReady(true);
  }, []);

  const selectDialect = useCallback((id: string) => {
    setProgress((p) => setActiveDialect(p, id));
  }, []);

  const finishLesson = useCallback(
    (dialectId: string, lessonId: string, xp: number) => {
      setProgress((p) => completeLesson(p, dialectId, lessonId, xp));
    },
    [],
  );

  const missHeart = useCallback(() => {
    setProgress((p) => loseHeart(p));
  }, []);

  const restoreHearts = useCallback(() => {
    setProgress((p) => refillHearts(p));
  }, []);

  const value = useMemo(
    () => ({
      progress,
      ready,
      selectDialect,
      finishLesson,
      missHeart,
      restoreHearts,
    }),
    [
      progress,
      ready,
      selectDialect,
      finishLesson,
      missHeart,
      restoreHearts,
    ],
  );

  return (
    <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
  );
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider");
  return ctx;
}
