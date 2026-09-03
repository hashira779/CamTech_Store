'use client';

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-store';

export default function HomePage() {
  const navigate = useNavigate();
  const token = useAuth((s) => s.token);

  useEffect(() => {
    navigate(token ? '/dashboard' : '/login', { replace: true });
  }, [token, navigate]);

  return <main style={{ padding: 24 }}>Loading…</main>;
}
