'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@mystore/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { useThemeStore } from '@/lib/theme-store';
import { useExperienceStore, EXPERIENCE_CONFIGS } from '@/lib/experience-store';
import { Store, KeyRound, ArrowRight, ShieldCheck, Zap, Mail, Sun, Moon } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const { theme, setTheme } = useThemeStore();
  const { resolveDefaultExperience, setExperience } = useExperienceStore();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await api.login(values.email, values.password);
      setAuth(result.accessToken, result.user);
      const targetExp = resolveDefaultExperience(result.user.roles || []);
      setExperience(targetExp);
      const targetRoute = EXPERIENCE_CONFIGS[targetExp]?.defaultRoute || '/dashboard';
      navigate(targetRoute);
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : 'Login failed');
    }
  });

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-background text-foreground transition-colors">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border bg-card/90 backdrop-blur-md text-xs font-semibold text-foreground hover:bg-accent transition-all shadow-xs cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-blue-500" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Aurora background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="lw-blob left-[-10%] top-[-12%] h-[520px] w-[520px]"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.45), transparent 70%)' }}
        />
        <div
          className="lw-blob right-[-12%] top-[18%] h-[480px] w-[480px]"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.40), transparent 70%)', animationDelay: '-6s' }}
        />
        <div
          className="lw-blob bottom-[-18%] left-[28%] h-[460px] w-[460px]"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.42), transparent 70%)', animationDelay: '-12s' }}
        />
        {/* faint grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
      </div>

      {/* Left — brand + credential card */}
      <div className="relative z-10 hidden w-1/2 flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-2.5 text-xl font-bold tracking-tight animate-fade-up">
          <div className="bg-brand grid h-10 w-10 place-items-center rounded-xl brand-glow">
            <Store className="h-5 w-5 text-white" />
          </div>
          MyStore
        </div>

        <div className="max-w-lg">
          <p
            className="mb-5 inline-flex items-center gap-2 rounded-full border-brand border bg-card/40 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur animate-fade-up"
            style={{ animationDelay: '60ms' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Universal Enterprise Platform
          </p>
          <h1
            className="animate-fade-up text-5xl font-extrabold leading-[1.05] tracking-tight"
            style={{ animationDelay: '120ms' }}
          >
            Run your entire
            <br />
            <span className="text-gradient">business empire</span>
          </h1>
          <p
            className="mt-5 max-w-md text-lg text-muted-foreground animate-fade-up"
            style={{ animationDelay: '180ms' }}
          >
            POS, inventory, finance, CRM &amp; delivery — unified across every branch, in real time.
          </p>

          {/* Credential ID card */}
          <div className="mt-10 max-w-sm animate-float">
            <div className="glass-panel brand-glow rounded-3xl p-5">
              <div className="flex items-center gap-3">
                <div className="bg-brand grid h-12 w-12 place-items-center rounded-2xl font-bold text-white">
                  MS
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold leading-tight">MyStore Enterprise</p>
                  <p className="truncate text-xs text-muted-foreground">Universal Business Platform</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>

              <div className="my-4 h-px bg-border" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Modules</p>
                  <p className="font-semibold">30+ Suites</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Deployment</p>
                  <p className="font-semibold">Multi-Branch</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Uptime</p>
                  <p className="font-semibold">99.98%</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Security</p>
                  <p className="font-semibold">RBAC · Isolated</p>
                </div>
              </div>

              {/* barcode */}
              <div className="mt-5 flex h-9 items-end gap-[3px]">
                {Array.from({ length: 46 }).map((_, i) => (
                  <span
                    key={i}
                    className="bg-foreground/70"
                    style={{ height: `${10 + ((i * 7) % 5) * 6}px`, width: i % 3 === 0 ? '2px' : '1px' }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>MS-ENTERPRISE-2026</span>
                <span>CamTech</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-muted-foreground animate-fade-up" style={{ animationDelay: '240ms' }}>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Enterprise Security
          </span>
          <span className="inline-flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Real-time Sync
          </span>
        </div>
      </div>

      {/* Right — auth form */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center p-6 lg:w-1/2 lg:p-12">
        <div className="w-full max-w-[420px] animate-fade-up">
          <div className="mb-8 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight lg:hidden">
            <div className="bg-brand grid h-9 w-9 place-items-center rounded-xl">
              <Store className="h-5 w-5 text-white" />
            </div>
            MyStore
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-muted-foreground">Sign in to your command center</p>
          </div>

          <form onSubmit={onSubmit} className="glass-panel brand-glow space-y-5 rounded-3xl p-8">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email or Username</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-11 w-full rounded-xl border border-input bg-card text-foreground pl-10 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring shadow-xs"
                  type="text"
                  placeholder="admin@camtechstore"
                  autoComplete="username"
                  {...register('email')}
                />
              </div>
              {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Password</label>
                <a href="#" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-11 w-full rounded-xl border border-input bg-card text-foreground pl-10 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring shadow-xs"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                />
              </div>
              {errors.password && <span className="text-xs text-destructive">{errors.password.message}</span>}
            </div>

            {serverError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                {serverError}
              </div>
            )}

            <button
              className="bg-brand brand-glow group flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Authenticating…' : 'Sign In'}
              {!isSubmitting && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Demo · <span className="font-mono text-foreground">admin@demo.test</span> /{' '}
            <span className="font-mono text-foreground">Admin123!</span>
          </p>
        </div>
      </div>
    </main>
  );
}
