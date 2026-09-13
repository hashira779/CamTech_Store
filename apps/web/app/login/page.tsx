'use client';

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@mystore/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { useThemeStore } from '@/lib/theme-store';
import { useExperienceStore, EXPERIENCE_CONFIGS } from '@/lib/experience-store';
import { Store, KeyRound, ArrowRight, ShieldCheck, Zap, Mail, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get('expired') === 'true';
  const isInactive = searchParams.get('inactive') === 'true';
  const setAuth = useAuth((s) => s.setAuth);
  const { theme, setTheme } = useThemeStore();
  const { resolveDefaultExperience, setExperience } = useExperienceStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      toast.success(`Welcome back, ${result.user.name || 'Admin'}!`, {
        description: 'Signed in successfully.',
      });
      navigate(targetRoute);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Login failed. Please check your credentials.';
      setServerError(msg);
      toast.error('Authentication Failed', {
        description: msg,
      });
    }
  });

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-background text-foreground transition-colors">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-30">
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Left — brand panel */}
      <div className="relative z-10 hidden w-1/2 flex-col justify-between p-12 lg:flex bg-card border-r border-border">
        <div className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
          <div className="bg-primary grid h-10 w-10 place-items-center rounded-lg text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          MyStore
        </div>

        <div className="max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-accent px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Enterprise Platform
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Run your entire
            <br />
            <span className="text-primary">business empire</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            POS, inventory, finance, CRM &amp; delivery — unified across every branch, in real time.
          </p>

          {/* Stats card */}
          <div className="mt-8 max-w-sm">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="bg-primary grid h-10 w-10 place-items-center rounded-lg font-bold text-primary-foreground text-sm">
                  MS
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-tight">MyStore Enterprise</p>
                  <p className="truncate text-xs text-muted-foreground">Universal Business Platform</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>

              <div className="my-4 h-px bg-border" />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-muted-foreground">Modules</p>
                  <p className="font-semibold">30+ Suites</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Deployment</p>
                  <p className="font-semibold">Multi-Branch</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Uptime</p>
                  <p className="font-semibold">99.98%</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Security</p>
                  <p className="font-semibold">RBAC · Isolated</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-muted-foreground">
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
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center justify-center gap-2 text-xl font-bold tracking-tight lg:hidden">
            <div className="bg-primary grid h-9 w-9 place-items-center rounded-lg text-primary-foreground">
              <Store className="h-5 w-5" />
            </div>
            MyStore
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
          </div>

          {isExpired && (
            <div className="mb-5 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-600 dark:text-amber-400">
              <KeyRound className="h-4 w-4 shrink-0" />
              <span>Your session has expired. Please sign in again.</span>
            </div>
          )}

          {isInactive && (
            <div className="mb-5 flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-xs font-medium text-blue-600 dark:text-blue-400">
              <KeyRound className="h-4 w-4 shrink-0" />
              <span>Signed out after 30 minutes of inactivity.</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-10 w-full rounded-md border border-input bg-background text-foreground pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-ring"
                  type="text"
                  placeholder="admin@camtechstore"
                  autoComplete="username"
                  {...register('email')}
                />
              </div>
              {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Password</label>
                <a href="#" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-10 w-full rounded-md border border-input bg-background text-foreground pl-9 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-ring"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <span className="text-xs text-destructive">{errors.password.message}</span>}
            </div>

            {serverError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <div className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                {serverError}
              </div>
            )}

            <button
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Authenticating…' : 'Sign In'}
              {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Demo · <span className="font-mono text-foreground">admin@demo.test</span> /{' '}
            <span className="font-mono text-foreground">Admin123!</span>
          </p>
        </div>
      </div>
    </main>
  );
}
