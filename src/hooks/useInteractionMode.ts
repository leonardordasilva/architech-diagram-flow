import { useState, useCallback } from 'react';

export function useInteractionMode() {
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>(
    () => localStorage.getItem('microflow_interaction_mode') === 'select' ? 'select' : 'pan',
  );

  const handleSetInteractionMode = useCallback((mode: 'pan' | 'select') => {
    setInteractionMode(mode);
    localStorage.setItem('microflow_interaction_mode', mode);
  }, []);

  return { interactionMode, handleSetInteractionMode };
}
