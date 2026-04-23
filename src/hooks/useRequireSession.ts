import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDiveSession } from '../store/DiveContext';
import type { DiveSession } from '../types/dive';

/**
 * Redirects to '/' if no session is loaded.
 * Returns the session (or null before redirect fires).
 *
 * Usage:
 *   const session = useRequireSession();
 *   if (!session) return null;
 */
export function useRequireSession(): DiveSession | null {
  const { session } = useDiveSession();
  const navigate    = useNavigate();

  useEffect(() => {
    if (!session) navigate('/');
  }, [session, navigate]);

  return session;
}
