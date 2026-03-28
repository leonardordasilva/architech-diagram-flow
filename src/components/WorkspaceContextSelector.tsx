import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, User, Users, FolderOpen } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { usePlanStore } from '@/store/planStore';

interface WorkspaceContextSelectorProps {
  /** Called when user switches context (personal ↔ workspace) */
  onContextChange?: (workspaceId: string | null) => void;
}

export default function WorkspaceContextSelector({ onContextChange }: WorkspaceContextSelectorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const plan = usePlanStore((s) => s.limits.plan);

  if (plan !== 'team') return null;

  const label = currentWorkspace
    ? currentWorkspace.name
    : t('workspace.personal');

  const Icon = currentWorkspace ? FolderOpen : User;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 max-w-[180px] gap-1.5 truncate text-xs"
          title={label}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-52">
        {/* Contexto pessoal */}
        <DropdownMenuItem
          className="gap-2"
          onClick={() => {
            setWorkspace(null);
            onContextChange?.(null);
          }}
        >
          <User className="h-4 w-4" />
          {t('workspace.personal')}
          {!currentWorkspace && <span className="ml-auto text-primary text-xs">✓</span>}
        </DropdownMenuItem>

        {/* Workspace */}
        {currentWorkspace && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2"
              onClick={() => onContextChange?.(currentWorkspace.id)}
            >
              <FolderOpen className="h-4 w-4" />
              <span className="truncate">{currentWorkspace.name}</span>
              <span className="ml-auto text-primary text-xs">✓</span>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 text-xs text-muted-foreground" onClick={() => navigate('/workspace')}>
          <Users className="h-4 w-4" />
          {t('workspace.manage')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
