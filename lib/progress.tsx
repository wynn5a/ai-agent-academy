"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { GATES, PASS_THRESHOLD } from "./types";
import { modules } from "@/content/registry";

export interface ProgressState {
  completedLessons: Record<string, boolean>; // key: `${moduleSlug}/${lessonSlug}`
  quizScores: Record<string, number>; // key: moduleSlug, value: best fraction 0..1
  labsDone: Record<string, boolean>; // key: moduleSlug
  // key: moduleSlug, value: checked state per acceptance-criterion index
  labChecks: Record<string, Record<number, boolean>>;
  // key: moduleSlug, value: free-form notes (repo URL, reflections)
  labNotes: Record<string, string>;
}

const EMPTY: ProgressState = {
  completedLessons: {},
  quizScores: {},
  labsDone: {},
  labChecks: {},
  labNotes: {},
};
const STORAGE_KEY = "aea-progress-v1";

interface ProgressApi extends ProgressState {
  ready: boolean;
  toggleLesson: (moduleSlug: string, lessonSlug: string) => void;
  completeLesson: (moduleSlug: string, lessonSlug: string) => void;
  recordQuiz: (moduleSlug: string, score: number) => void;
  toggleLab: (moduleSlug: string) => void;
  toggleLabCheck: (moduleSlug: string, index: number) => void;
  setLabNote: (moduleSlug: string, note: string) => void;
  resetAll: () => void;
  moduleStats: (moduleSlug: string) => {
    lessonsDone: number;
    lessonsTotal: number;
    quizBest: number | null;
    quizPassed: boolean;
    labDone: boolean;
    percent: number;
  };
  gatePassed: (gateId: string) => boolean;
}

const Ctx = createContext<ProgressApi | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgressState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // One-time hydration from localStorage, which is only available client-side —
    // can't be done via lazy useState() init without a hydration mismatch.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      /* corrupted storage — start fresh */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: ProgressState) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full or unavailable */
    }
  }, []);

  const toggleLesson = useCallback(
    (m: string, l: string) => {
      const key = `${m}/${l}`;
      const next = {
        ...state,
        completedLessons: {
          ...state.completedLessons,
          [key]: !state.completedLessons[key],
        },
      };
      persist(next);
    },
    [state, persist],
  );

  // Idempotent "set done" — used when navigation implies completion, so it
  // never un-completes a lesson the way toggleLesson would.
  const completeLesson = useCallback(
    (m: string, l: string) => {
      const key = `${m}/${l}`;
      if (state.completedLessons[key]) return;
      persist({
        ...state,
        completedLessons: { ...state.completedLessons, [key]: true },
      });
    },
    [state, persist],
  );

  const recordQuiz = useCallback(
    (m: string, score: number) => {
      const best = Math.max(state.quizScores[m] ?? 0, score);
      persist({ ...state, quizScores: { ...state.quizScores, [m]: best } });
    },
    [state, persist],
  );

  const toggleLab = useCallback(
    (m: string) => {
      persist({
        ...state,
        labsDone: { ...state.labsDone, [m]: !state.labsDone[m] },
      });
    },
    [state, persist],
  );

  const toggleLabCheck = useCallback(
    (m: string, index: number) => {
      const current = state.labChecks[m] ?? {};
      persist({
        ...state,
        labChecks: {
          ...state.labChecks,
          [m]: { ...current, [index]: !current[index] },
        },
      });
    },
    [state, persist],
  );

  const setLabNote = useCallback(
    (m: string, note: string) => {
      persist({ ...state, labNotes: { ...state.labNotes, [m]: note } });
    },
    [state, persist],
  );

  const resetAll = useCallback(() => persist(EMPTY), [persist]);

  const moduleStats = useCallback(
    (moduleSlug: string) => {
      const mod = modules.find((m) => m.slug === moduleSlug);
      const lessonsTotal = mod?.lessons.length ?? 0;
      const lessonsDone =
        mod?.lessons.filter(
          (l) => state.completedLessons[`${moduleSlug}/${l.slug}`],
        ).length ?? 0;
      const quizBest = state.quizScores[moduleSlug] ?? null;
      const quizPassed = (quizBest ?? 0) >= PASS_THRESHOLD;
      const labDone = !!state.labsDone[moduleSlug];
      // weight: lessons 60%, quiz 25%, lab 15%
      const percent = Math.round(
        (lessonsTotal ? (lessonsDone / lessonsTotal) * 60 : 0) +
          (quizPassed ? 25 : 0) +
          (labDone ? 15 : 0),
      );
      return {
        lessonsDone,
        lessonsTotal,
        quizBest,
        quizPassed,
        labDone,
        percent,
      };
    },
    [state],
  );

  const gatePassed = useCallback(
    (gateId: string) => {
      const gate = GATES.find((g) => g.id === gateId);
      if (!gate) return false;
      const required = modules.filter((m) => m.id <= gate.afterModule);
      return required.every((m) => {
        const s = moduleStats(m.slug);
        return s.quizPassed && s.labDone && s.lessonsDone === s.lessonsTotal;
      });
    },
    [moduleStats],
  );

  return (
    <Ctx.Provider
      value={{
        ...state,
        ready,
        toggleLesson,
        completeLesson,
        recordQuiz,
        toggleLab,
        toggleLabCheck,
        setLabNote,
        resetAll,
        moduleStats,
        gatePassed,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useProgress(): ProgressApi {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useProgress must be used inside <ProgressProvider>");
  return ctx;
}
