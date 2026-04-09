import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import i18n from '@/i18n';
import { toast } from '@/hooks/use-toast';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * R6 — Global React ErrorBoundary.
 * PRD-0035 T2: reports errors to Sentry.
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
    console.error('[ErrorBoundary]', error, info.componentStack);
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
      tags: { source: 'ErrorBoundary' },
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
            <p className="text-sm text-muted-foreground">
              {i18n.t('errors.unexpectedDesc')}
            </p>
            <button
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={() => this.setState({ hasError: false })}
            >
              {i18n.t('common.tryAgain')}
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
