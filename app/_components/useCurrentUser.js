'use client';

import { useState, useEffect } from 'react';

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbOffline, setDbOffline] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (r.status === 503) { setDbOffline(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        setUser(data?.user ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { user, loading, dbOffline };
}
