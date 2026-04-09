import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import i18n from '@/i18n';
import { toast } from '@/hooks/use-toast';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError?: boolean;
}

/**
 * R6 — Global React ErrorBoundary.
 * PRD-0035 T2: reports errors to Sentry.
 * PRD-0039 T4: auto-reloads on ChunkLoadError (once per session).
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const isChunkError = error.name === 'ChunkLoadError'
      || error.message.includes('Loading chunk')
      || error.message.includes('Failed to fetch dynamically imported module');

    if (isChunkError) {
      const alreadyReloaded = sessionStorage.getItem('__chunk_reload__');
      if (!alreadyReloaded) {
        sessionStorage.setItem('__chunk_reload__', '1');
        window.location.reload();
        return;
      }
      sessionStorage.removeItem('__chunk_reload__');
      this.setState({ isChunkError: true });
    }

    console.error('[ErrorBoundary]', error, info.componentStack);
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
      tags: { source: 'ErrorBoundary', isChunkError: String(isChunkError) },
    });
    toast({
      title: i18n.t('errors.unexpected'),
      description: i18n.t('errors.unexpectedDesc'),
      variant: 'destructive',
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center space-y-4 p-8 max-w-md">
            <h2 className="text-xl font-semibold text-foreground">
              {i18n.t('errors.somethingWrong')}
            </h2>
            {this.state.isChunkError ? (
              <p className="text-sm text-muted-foreground">
                {i18n.t('errors.newVersionAvailable', 'A new version of the app is available.')}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {i18n.t('errors.unexpectedDesc')}
              </p>
            )}
            <button
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={() => {
                if (this.state.isChunkError) {
                  window.location.reload();
                } else {
                  this.setState({ hasError: false, isChunkError: false });
                }
              }}
            >
              {this.state.isChunkError
                ? i18n.t('errors.reload')
                : i18n.t('common.tryAgain')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/* R6-b / PRD-0035 T3: Catch unhandled promise rejections globally */
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[UnhandledRejection]', event.reason);
    Sentry.captureException(
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason)),
      { tags: { source: 'unhandledRejection' } },
    );
    toast({
      title: i18n.t('errors.networkOp'),
      description:
        event.reason?.message ?? i18n.t('errors.asyncFailed'),
      variant: 'destructive',
    });
  });
}
