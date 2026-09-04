'use client';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@mystore/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { Store, KeyRound, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { signInWithGoogle, supabase } from '@/lib/supabase';

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

  // Check Supabase Google OAuth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const metadata = session.user.user_metadata || {};
        setAuth(session.access_token, {
          id: session.user.id,
          email: session.user.email || '',
          name: metadata.full_name || metadata.name || session.user.email?.split('@')[0] || 'Google User',
          organizationId: 'org-default',
          roles: ['SUPER_ADMIN'],
          permissions: ['*'],
        });
        navigate('/dashboard');
      }
    });
  }, [navigate, setAuth]);

  const handleGoogleLogin = async () => {
    try {
      setServerError(null);
      await signInWithGoogle(`${window.location.origin}/dashboard`);
    } catch (err: any) {
      setServerError(err?.message || 'Failed to initialize Google Sign In');
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await api.login(values.email, values.password);
      setAuth(result.accessToken, result.user);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : 'Login failed');
    }
  });

  const fillDemo = (email: string, password: string) => {
    setValue('email', email);
    setValue('password', password);
  };

  return (
    <main className="flex min-h-screen bg-background">
      {/* Left Pane - Brand / Visual */}
      <div className="relative hidden w-1/2 overflow-hidden bg-zinc-950 lg:flex lg:flex-col lg:justify-between p-12 text-zinc-300">
        <div className="relative z-10 flex items-center gap-2 text-white font-bold text-2xl tracking-tight">
          <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/30">
            <Store className="w-6 h-6 text-white" />
          </div>
          MyStore
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
            The Universal Enterprise Business Platform
          </h1>
          <p className="text-lg text-zinc-400 mb-12">
            Seamlessly manage your retail, F&B, wholesale, and multi-branch operations from a single unified dashboard.
          </p>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-zinc-900 border border-zinc-800">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Enterprise Security</h3>
                <p className="text-sm text-zinc-400">Bank-grade RBAC and tenant isolation</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-zinc-900 border border-zinc-800">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Real-time Sync</h3>
                <p className="text-sm text-zinc-400">Instant updates across Web, POS & Mobile</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/4 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />
      </div>

      {/* Right Pane - Auth Form */}
      <div className="flex w-full flex-col justify-center items-center lg:w-1/2 p-6 lg:p-12 relative overflow-hidden">
        {/* Subtle background glow for right pane */}
        <div className="absolute inset-0 bg-gradient-to-b from-background to-secondary/20 -z-10" />

        <div className="w-full max-w-[420px]">
          <div className="mb-10 text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-8 text-foreground font-bold text-2xl tracking-tight">
              <div className="bg-primary p-2 rounded-xl">
                <Store className="w-6 h-6 text-white" />
              </div>
              MyStore
            </div>
            <h2 className="text-3xl font-semibold tracking-tight mb-2">Welcome back</h2>
            <p className="text-muted-foreground">Sign in to access your dashboard</p>
          </div>

          <form onSubmit={onSubmit} className="glass-panel rounded-2xl p-8 space-y-6">
            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-2.5 px-4 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold text-sm transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow"
            >
              <GoogleIcon className="w-4 h-4" />
              <span>Sign In with Google</span>
            </button>

            <div className="relative my-2 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <span className="relative bg-background/90 px-3 text-xs text-muted-foreground uppercase tracking-wider">
                or sign in with email
              </span>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email address</label>
                <div className="relative">
                  <input 
                    className="input pl-4 bg-background/50 focus:bg-background" 
                    type="email" 
                    placeholder="name@enterprise.com"
                    autoComplete="username" 
                    {...register('email')} 
                  />
                </div>
                {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <a href="#" className="text-xs font-medium text-primary hover:underline">Forgot password?</a>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    className="input pl-10 bg-background/50 focus:bg-background"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <span className="text-xs text-destructive">{errors.password.message}</span>
                )}
              </div>
            </div>

            {serverError && (
              <div className="p-3 text-sm bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                {serverError}
              </div>
            )}

            <button className="btn w-full flex items-center justify-center gap-2 group" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Authenticating…' : 'Sign In'}
              {!isSubmitting && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          {/* Demo Login Injectors */}
          <div className="mt-10">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 text-center lg:text-left">
              Quick Test Environments
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                className="flex flex-col items-start p-3 text-sm border rounded-xl hover:bg-accent hover:border-accent-foreground/20 transition-all text-left"
                onClick={() => fillDemo('admin@demo.test', 'Admin123!')}
              >
                <span className="font-semibold text-foreground">Enterprise Admin</span>
                <span className="text-muted-foreground text-xs mt-0.5">Global access</span>
              </button>
              <button
                type="button"
                className="flex flex-col items-start p-3 text-sm border rounded-xl hover:bg-accent hover:border-accent-foreground/20 transition-all text-left"
                onClick={() => fillDemo('cashier@demo.test', 'Cashier123!')}
              >
                <span className="font-semibold text-foreground">Branch Cashier</span>
                <span className="text-muted-foreground text-xs mt-0.5">Central Cafe branch</span>
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </main>
  );
}
