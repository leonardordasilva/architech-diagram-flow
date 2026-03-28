import { Component, type ErrorInfo, type ReactNode } from 'react';
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
 *
 * Catches unhandled render-phase errors, shows a toast to the user,
 * and logs the error + component stack to the console.
 *
 * Unhandled promise rejections are caught with
 * `window.onunhandledrejection` at module scope below.
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
    toast({
      title: i18n.t('errors.unexpected'),
      description: i18n.t('errors.unexpectedDesc'),
      variant: 'destructive',
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <h2>{i18n.t('errors.somethingWrong')}</h2>
          <button
            style={{
              marginTop: 16,
              padding: '8px 24px',
              borderRadius: 8,
              background: '#3b82f6',
              color: '#fff',
              cursor: 'pointer',
              border: 'none',
            }}
            onClick={() => this.setState({ hasError: false })}
          >
            {i18n.t('common.tryAgain')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/* R6-b: Catch unhandled promise rejections globally */
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[UnhandledRejection]', event.reason);
    toast({
      title: i18n.t('errors.networkOp'),
      description:
        event.reason?.message ?? i18n.t('errors.asyncFailed'),
      variant: 'destructive',
    });
  });
}
