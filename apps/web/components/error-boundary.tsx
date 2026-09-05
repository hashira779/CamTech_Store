import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** When any value here changes after an error, the boundary auto-resets
   *  (e.g. pass the current route so navigating away clears a crashed view). */
  resetKeys?: unknown[];
  /** Human name of the area being guarded, shown in the fallback. */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Contains a runtime crash to the subtree it wraps. Without this, an uncaught
 * error anywhere in the super-app white-screens every experience at once; with
 * it, only the failed view shows a fallback while the nav and other routes keep
 * working. This is the frontend's fault-isolation boundary.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface it for debugging without taking the app down.
    console.error('[ErrorBoundary] contained a crash:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (!this.state.error) return;
    const a = prev.resetKeys ?? [];
    const b = this.props.resetKeys ?? [];
    if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
      this.setState({ error: null });
    }
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center p-6 bg-[#0a0a0a] relative overflow-hidden font-sans">
        {/* Animated background blobs for premium aesthetic */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-rose-600/20 blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '1.5s' }} />
        
        {/* Glassmorphic card */}
        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl transition-all hover:border-white/20">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-orange-400 text-white shadow-[0_0_30px_rgba(244,63,94,0.4)] transform transition-transform duration-500 hover:scale-110">
            <AlertTriangle className="h-8 w-8" />
          </div>
          
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            {this.props.label ? `${this.props.label} encountered an issue` : 'Something went wrong'}
          </h2>
          
          <p className="mt-3 text-base text-white/70 leading-relaxed">
            Our system caught an unexpected error in this view. The rest of your session is safely isolated and continues to run seamlessly.
          </p>
          
          <div className="mt-8 text-left rounded-xl bg-black/40 border border-white/5 p-4 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </div>
              <span className="text-xs font-semibold text-rose-400 uppercase tracking-widest">Error Details</span>
            </div>
            <p className="text-sm font-mono text-white/80 break-words max-h-32 overflow-y-auto custom-scrollbar">
              {this.state.error.message || 'Unknown error occurred in the component tree.'}
            </p>
          </div>
          
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <button
              type="button"
              onClick={this.reset}
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-white px-6 py-3 font-medium text-black transition duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                Retry Connection
              </span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-medium text-white transition duration-300 hover:bg-white/10 hover:border-white/20 active:scale-95"
            >
              Reload Application
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
