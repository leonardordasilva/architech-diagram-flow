import RecoveryBanner from '@/components/RecoveryBanner';

interface DiagramStatusOverlaysProps {
  saving: boolean;
}

export default function DiagramStatusOverlays({ saving }: DiagramStatusOverlaysProps) {
  return (
    <>
      <RecoveryBanner />
      {saving && (
        <div className="absolute top-2 right-2 z-10 rounded-md bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm border border-border">
          Salvando…
        </div>
      )}
    </>
  );
}
