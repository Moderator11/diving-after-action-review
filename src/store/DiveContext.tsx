import { createContext, useContext, useState, type ReactNode } from 'react';
import type { DiveSession } from '../types/dive';

interface DiveContextValue {
  session: DiveSession | null;
  setSession: (s: DiveSession | null) => void;
  sessions: DiveSession[];
  addSession: (s: DiveSession) => void;
  removeSession: (filename: string) => void;
}

const DiveContext = createContext<DiveContextValue | null>(null);

export function DiveProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DiveSession | null>(null);
  const [sessions, setSessions] = useState<DiveSession[]>([]);

  const addSession = (s: DiveSession) => {
    setSessions((prev) => {
      // 같은 파일명이 이미 있으면 교체
      const exists = prev.findIndex((p) => p.filename === s.filename);
      if (exists !== -1) {
        const next = [...prev];
        next[exists] = s;
        return next;
      }
      return [...prev, s];
    });
  };

  const removeSession = (filename: string) => {
    setSessions((prev) => prev.filter((s) => s.filename !== filename));
    setSession((prev) => (prev?.filename === filename ? null : prev));
  };

  return (
    <DiveContext.Provider value={{ session, setSession, sessions, addSession, removeSession }}>
      {children}
    </DiveContext.Provider>
  );
}

export function useDiveSession(): DiveContextValue {
  const ctx = useContext(DiveContext);
  if (!ctx) throw new Error('useDiveSession must be used within DiveProvider');
  return ctx;
}
