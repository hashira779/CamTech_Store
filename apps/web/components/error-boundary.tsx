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
      <div className="flex min-h-[60vh] w-full items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md rounded-xl border bg-background p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {this.props.label ? `${this.props.label} hit an error` : 'This screen hit an error'}
          </h2>
          <p className="mt-2 text-sm text-foreground/60">
            The rest of the app is still running — retry this view or use the menu to go elsewhere.
          </p>
          <p className="mt-3 rounded-md bg-foreground/5 px-3 py-2 text-xs font-mono text-foreground/60 break-words">
            {this.state.error.message || 'Unknown error'}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Retry view
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
