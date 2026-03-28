import { Component, type ReactNode } from 'react';
import i18n from '@/i18n';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class DiagramErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[DiagramErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  handleFullReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">{i18n.t('errors.diagramRender')}</h2>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            {i18n.t('errors.diagramRenderDesc')}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleReload}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {i18n.t('common.tryAgain')}
            </Button>
            <Button onClick={this.handleFullReload}>
              {i18n.t('errors.reload')}
            </Button>
          </div>
          {this.state.error && (
            <pre className="mt-4 max-w-lg overflow-auto rounded border bg-muted p-3 text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
