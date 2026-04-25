import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { DiveSession } from '../types/dive';
import { saveMetadata, type SessionMetadata } from '../utils/db';

interface DiveContextValue {
  session:        DiveSession | null;
  sessionId:      number | null;
  memos:          Record<number, string>;
  favorites:      number[];
  /** Load a session from DB (or fresh parse). Replaces all context state. */
  loadSession:    (session: DiveSession, sessionId: number, meta: SessionMetadata) => void;
  /** Update a single memo and auto-persist. */
  setMemo:        (diveIdx: number, text: string) => void;
  /** Toggle favorite star for a dive and auto-persist. */
  toggleFavorite: (diveIdx: number) => void;
}

const DiveContext = createContext<DiveContextValue | null>(null);

export function DiveProvider({ children }: { children: ReactNode }) {
  const [session,   setSession]   = useState<DiveSession | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [memos,     setMemos]     = useState<Record<number, string>>({});
  const [favorites, setFavorites] = useState<number[]>([]);

  // Shared helper: persist current metadata snapshot
  const persist = useCallback(
    (sid: number, m: Record<number, string>, f: number[]) => {
      saveMetadata({ sessionId: sid, memos: m, favorites: f }).catch(console.error);
    },
    [],
  );

  const loadSession = useCallback(
    (s: DiveSession, id: number, meta: SessionMetadata) => {
      setSession(s);
      setSessionId(id);
      setMemos(meta.memos);
      setFavorites(meta.favorites);
    },
    [],
  );

  const setMemo = useCallback(
    (diveIdx: number, text: string) => {
      setMemos((prev) => {
        const next = { ...prev, [diveIdx]: text };
        setSessionId((sid) => {
          if (sid != null) persist(sid, next, favorites);
          return sid;
        });
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, favorites],
  );

  const toggleFavorite = useCallback(
    (diveIdx: number) => {
      setFavorites((prev) => {
        const next = prev.includes(diveIdx)
          ? prev.filter((i) => i !== diveIdx)
          : [...prev, diveIdx];
        setSessionId((sid) => {
          if (sid != null) persist(sid, memos, next);
          return sid;
        });
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, memos],
  );

  return (
    <DiveContext.Provider
      value={{ session, sessionId, memos, favorites, loadSession, setMemo, toggleFavorite }}
    >
      {children}
    </DiveContext.Provider>
  );
}

export function useDiveSession(): DiveContextValue {
  const ctx = useContext(DiveContext);
  if (!ctx) throw new Error('useDiveSession must be used within DiveProvider');
  return ctx;
}
