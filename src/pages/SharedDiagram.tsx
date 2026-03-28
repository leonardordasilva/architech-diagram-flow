import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DiagramCanvas from '@/components/DiagramCanvas';
import { loadDiagramByToken } from '@/services/diagramService';
import { useDiagramStore } from '@/store/diagramStore';
import { useAuth } from '@/hooks/useAuth';

export default function SharedDiagram() {
  const { t } = useTranslation();
  const { shareToken } = useParams<{ shareToken: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Public share links are ALWAYS read-only.
  // Collaborators invited by email edit via "Compartilhados comigo" in the app.
  const readOnly = true;

  useEffect(() => {
    if (!shareToken) return;
    let cancelled = false;

    async function load() {
      const diagram = await loadDiagramByToken(shareToken!);
      if (cancelled) return;

      if (diagram) {
        const store = useDiagramStore.getState();
        store.loadDiagram(diagram.nodes, diagram.edges);
        store.setDiagramName(diagram.title);
      } else {
        setNotFound(true);
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [shareToken]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{t('sharedDiagram.loading')}</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{t('sharedDiagram.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen">
      {readOnly && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-lg border bg-card/90 backdrop-blur px-4 py-2 shadow text-sm">
          <span className="text-muted-foreground">{t('sharedDiagram.readOnlyBadge')}</span>
          {!user && (
            <Link to="/" className="text-primary font-medium hover:underline text-xs">
              {t('sharedDiagram.signUpToEdit')}
            </Link>
          )}
        </div>
      )}
      <DiagramCanvas shareToken={shareToken} readOnly={readOnly} />
    </div>
  );
}
