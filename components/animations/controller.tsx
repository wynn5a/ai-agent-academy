"use client";

import React, { createContext, useContext } from "react";

export type AnimPlayback = {
  /** effective playing state: user intent AND in-view */
  playing: boolean;
  /** current step for step-driven animations; 0 for loop animations */
  step: number;
};

const AnimPlaybackContext = createContext<AnimPlayback>({
  playing: true,
  step: 0,
});

export function AnimPlaybackProvider({
  value,
  children,
}: {
  value: AnimPlayback;
  children: React.ReactNode;
}) {
  return (
    <AnimPlaybackContext.Provider value={value}>
      {children}
    </AnimPlaybackContext.Provider>
  );
}

export function useAnimPlayback(): AnimPlayback {
  return useContext(AnimPlaybackContext);
}

function CtrlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="focus-visible:ring-accent/60 grid h-7 w-7 place-items-center rounded-md text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:ring-2 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

export function ControlBar({
  playing,
  step,
  stepCount,
  onToggle,
  onReplay,
  onStep,
}: {
  playing: boolean;
  step: number;
  stepCount?: number;
  onToggle: () => void;
  onReplay: () => void;
  onStep?: (dir: 1 | -1) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {stepCount && onStep ? (
        <>
          <CtrlButton label="Previous step" onClick={() => onStep(-1)}>
            ⏮
          </CtrlButton>
          <CtrlButton label={playing ? "Pause" : "Play"} onClick={onToggle}>
            {playing ? "⏸" : "▶"}
          </CtrlButton>
          <CtrlButton label="Next step" onClick={() => onStep(1)}>
            ⏭
          </CtrlButton>
          <CtrlButton label="Replay" onClick={onReplay}>
            ↺
          </CtrlButton>
          <span className="ml-1 font-mono text-[10px] text-slate-500 tabular-nums">
            {step + 1}/{stepCount}
          </span>
        </>
      ) : (
        <>
          <CtrlButton label={playing ? "Pause" : "Play"} onClick={onToggle}>
            {playing ? "⏸" : "▶"}
          </CtrlButton>
          <CtrlButton label="Replay" onClick={onReplay}>
            ↺
          </CtrlButton>
        </>
      )}
    </div>
  );
}
