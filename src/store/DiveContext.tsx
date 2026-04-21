import { createContext, useContext, useState, type ReactNode } from 'react';
import type { DiveSession } from '../types/dive';

interface DiveContextValue {
  session: DiveSession | null;
  setSession: (s: DiveSession | null) => void;
}

const DiveContext = createContext<DiveContextValue | null>(null);

export function DiveProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DiveSession | null>(null);
  return (
    <DiveContext.Provider value={{ session, setSession }}>
      {children}
    </DiveContext.Provider>
  );
}

export function useDiveSession(): DiveContextValue {
  const ctx = useContext(DiveContext);
  if (!ctx) throw new Error('useDiveSession must be used within DiveProvider');
  return ctx;
}
