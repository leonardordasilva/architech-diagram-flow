import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Collaborator } from '@/hooks/useRealtimeCollab';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const MAX_VISIBLE_AVATARS = 5;

interface CollaboratorAvatarsProps {
  collaborators: Collaborator[];
}

function CollaboratorAvatars({ collaborators }: CollaboratorAvatarsProps) {
  const { t } = useTranslation();
  if (collaborators.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2">
      {collaborators.slice(0, MAX_VISIBLE_AVATARS).map((c) => (
        <Tooltip key={c.userId}>
          <TooltipTrigger asChild>
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold text-white"
              style={{ backgroundColor: c.color }}
            >
              {(c.email?.[0] || '?').toUpperCase()}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {c.email || t('collaborators.anonymous')}
          </TooltipContent>
        </Tooltip>
      ))}
      {collaborators.length > MAX_VISIBLE_AVATARS && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-bold text-muted-foreground">
          +{collaborators.length - MAX_VISIBLE_AVATARS}
        </div>
      )}
    </div>
  );
}

export default React.memo(CollaboratorAvatars);
