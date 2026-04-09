import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { Link } from 'react-router-dom';
import i18n from '@/i18n';

interface Props {
  children: ReactNode;
  routeName?: string;
}

interface State {
  hasError: boolean;
  errorId?: string;
}

export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const errorId = crypto.randomUUID();
    this.setState({ errorId });

    console.error(`[RouteErrorBoundary:${this.props.routeName ?? 'unknown'}]`, error, info.componentStack);

    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack, routeName: this.props.routeName },
      tags: { source: 'RouteErrorBoundary', route: this.props.routeName ?? 'unknown' },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              {i18n.t('errors.somethingWrong')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {i18n.t('errors.unexpectedDesc')}
            </p>
            {this.state.errorId && (
              <p className="text-xs text-muted-foreground/60 font-mono">
                {i18n.t('errors.errorId', { defaultValue: 'Error ID:' })} {this.state.errorId}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              onClick={() => this.setState({ hasError: false, errorId: undefined })}
            >
              {i18n.t('common.tryAgain')}
            </button>
            <Link
              to="/"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {i18n.t('notFound.home')}
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
