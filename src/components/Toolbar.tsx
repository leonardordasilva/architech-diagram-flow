import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Database, Mail, Globe, Trash2, Undo2, Redo2, LayoutGrid,
  Download, Upload, Image, Moon, Sun, ChevronDown, XCircle,
  FileCode, FileImage, FileJson, Lock, ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { NodeType } from '@/types/diagram';
import { MAX_DIAGRAM_NAME_LENGTH, DIAGRAM_NAME_WARNING_THRESHOLD } from '@/constants/diagramConstants';

interface ToolbarProps {
  onAddNode: (type: NodeType, subType?: string) => void;
  onDelete: () => void;
  onClearCanvas: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: (engine: string, direction: string) => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportMermaid: () => void;
  onExportJSON: () => void;
  onImportJSON: () => void;
  diagramName: string;
  onDiagramNameChange: (name: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  allowedExportFormats?: string[];
  onUpgradeRequest?: (featureName: string) => void;
  actionsDisabled?: boolean;
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  variant = 'ghost',
  actionsDisabled,
  onDisabledClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'ghost' | 'outline' | 'default';
  actionsDisabled?: boolean;
  onDisabledClick?: () => void;
}) {
  const { t } = useTranslation();
  const handleClick = actionsDisabled ? (onDisabledClick ?? (() => {})) : onClick;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          className={`h-9 w-9${actionsDisabled ? ' opacity-40 cursor-not-allowed' : ''}`}
          onClick={handleClick}
          aria-label={actionsDisabled ? t('limits.toolbarLockedUnsaved') : label}
          aria-disabled={actionsDisabled}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {actionsDisabled ? t('limits.toolbarLockedUnsaved') : label}
      </TooltipContent>
    </Tooltip>
  );
}

interface ToolbarDropdownProps {
  icon: React.ElementType;
  label: string;
  actionsDisabled?: boolean;
  onDisabledClick?: () => void;
  children: React.ReactNode;
}

function ToolbarDropdown({ icon: Icon, label, actionsDisabled, onDisabledClick, children }: ToolbarDropdownProps) {
  const { t } = useTranslation();
  if (actionsDisabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 opacity-40 cursor-not-allowed"
            onClick={onDisabledClick} aria-disabled aria-label={t('limits.toolbarLockedUnsaved')}>
            <Icon className="h-4 w-4" />
            <ChevronDown className="h-3 w-3 ml-[-2px]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{t('limits.toolbarLockedUnsaved')}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={label}>
              <Icon className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 ml-[-2px]" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="z-50">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Toolbar({
  onAddNode, onDelete, onClearCanvas, onUndo, onRedo, onAutoLayout,
  onExportPNG, onExportSVG, onExportMermaid, onExportJSON, onImportJSON,
  diagramName, onDiagramNameChange,
  darkMode, onToggleDarkMode,
  allowedExportFormats,
  onUpgradeRequest,
  actionsDisabled,
}: ToolbarProps) {
  const { t } = useTranslation();
  const [localName, setLocalName] = useState(diagramName);

  const isFormatAllowed = (format: string) =>
    !allowedExportFormats || allowedExportFormats.includes(format);

  const handleLockedFormat = (featureName: string) => {
    onUpgradeRequest?.(featureName);
  };

  const handleDisabledClick = () => onUpgradeRequest?.('Diagramas ilimitados');

  useEffect(() => {
    setLocalName(diagramName);
  }, [diagramName]);

  const commitName = () => {
    const trimmed = localName.trim();
    if (trimmed && trimmed !== diagramName) {
      onDiagramNameChange(trimmed);
    } else {
      setLocalName(diagramName);
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-1.5 shadow-sm">
      <div className="relative">
        <Input
          className="h-8 w-40 text-sm font-semibold bg-transparent border-transparent focus-visible:border-border focus-visible:ring-1 px-2"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitName();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') {
              setLocalName(diagramName);
              (e.target as HTMLInputElement).blur();
            }
          }}
          maxLength={MAX_DIAGRAM_NAME_LENGTH}
          placeholder={t('toolbar.diagramName')}
          aria-label={t('toolbar.diagramName')}
        />
        <div aria-live="polite" aria-atomic="true" className="absolute -bottom-4 right-0 text-[10px] text-muted-foreground">
          {localName.length > DIAGRAM_NAME_WARNING_THRESHOLD ? `${localName.length}/${MAX_DIAGRAM_NAME_LENGTH}` : ''}
        </div>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <ToolbarButton icon={Box} label={t('toolbar.service')} onClick={() => onAddNode('service')} actionsDisabled={actionsDisabled} onDisabledClick={handleDisabledClick} />

      <ToolbarDropdown icon={Database} label={t('toolbar.database')} actionsDisabled={actionsDisabled} onDisabledClick={handleDisabledClick}>
        <DropdownMenuItem onClick={() => onAddNode('database', 'Oracle')}>Oracle</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAddNode('database', 'Redis')}>Redis</DropdownMenuItem>
      </ToolbarDropdown>

      <ToolbarDropdown icon={Mail} label={t('toolbar.queue')} actionsDisabled={actionsDisabled} onDisabledClick={handleDisabledClick}>
        <DropdownMenuItem onClick={() => onAddNode('queue', 'IBM MQ')}>IBM MQ</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAddNode('queue', 'Kafka')}>Kafka</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAddNode('queue', 'RabbitMQ')}>RabbitMQ</DropdownMenuItem>
      </ToolbarDropdown>

      <ToolbarDropdown icon={Globe} label={t('toolbar.api')} actionsDisabled={actionsDisabled} onDisabledClick={handleDisabledClick}>
        <DropdownMenuItem onClick={() => onAddNode('external', 'REST')}>REST</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAddNode('external', 'gRPC')}>gRPC</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAddNode('external', 'GraphQL')}>GraphQL</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAddNode('external', 'WebSocket')}>WebSocket</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAddNode('external', 'HTTPS')}>HTTPS</DropdownMenuItem>
      </ToolbarDropdown>

      <Separator orientation="vertical" className="h-6" />

      <ToolbarButton icon={Trash2} label={t('toolbar.deleteSelected')} onClick={onDelete} actionsDisabled={actionsDisabled} onDisabledClick={handleDisabledClick} />
      <ToolbarButton icon={XCircle} label={t('toolbar.clearDiagram')} onClick={onClearCanvas} actionsDisabled={actionsDisabled} onDisabledClick={handleDisabledClick} />
      <ToolbarButton icon={Undo2} label={t('toolbar.undo')} onClick={onUndo} actionsDisabled={actionsDisabled} onDisabledClick={handleDisabledClick} />
      <ToolbarButton icon={Redo2} label={t('toolbar.redo')} onClick={onRedo} actionsDisabled={actionsDisabled} onDisabledClick={handleDisabledClick} />

      <ToolbarDropdown icon={LayoutGrid} label={t('toolbar.autoLayout')} actionsDisabled={actionsDisabled} onDisabledClick={handleDisabledClick}>
        <DropdownMenuItem onClick={() => onAutoLayout('elk', 'LR')}>{t('toolbar.elkLR')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAutoLayout('elk', 'TB')}>{t('toolbar.elkTB')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAutoLayout('dagre', 'LR')}>{t('toolbar.dagreH')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAutoLayout('dagre', 'TB')}>{t('toolbar.dagreV')}</DropdownMenuItem>
      </ToolbarDropdown>

      <Separator orientation="vertical" className="h-6" />

      <ToolbarDropdown icon={Download} label={t('toolbar.export')} actionsDisabled={actionsDisabled} onDisabledClick={handleDisabledClick}>
        <DropdownMenuItem onClick={onExportPNG} className="gap-2">
          <Image className="h-4 w-4" /> PNG
        </DropdownMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuItem
              className="gap-2"
              onClick={isFormatAllowed('svg') ? onExportSVG : () => handleLockedFormat('SVG')}
              disabled={false}
            >
              <FileImage className="h-4 w-4" />
              SVG
              {!isFormatAllowed('svg') && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
            </DropdownMenuItem>
          </TooltipTrigger>
          {!isFormatAllowed('svg') && (
            <TooltipContent side="right" className="text-xs">{t('limits.availableOnPro')}</TooltipContent>
          )}
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuItem
              className="gap-2"
              onClick={isFormatAllowed('mermaid') ? onExportMermaid : () => handleLockedFormat('Mermaid.js')}
              disabled={false}
            >
              <FileCode className="h-4 w-4" />
              Mermaid.js
              {!isFormatAllowed('mermaid') && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
            </DropdownMenuItem>
          </TooltipTrigger>
          {!isFormatAllowed('mermaid') && (
            <TooltipContent side="right" className="text-xs">{t('limits.availableOnPro')}</TooltipContent>
          )}
        </Tooltip>
        <DropdownMenuItem onClick={onExportJSON} className="gap-2">
          <FileJson className="h-4 w-4" /> JSON
        </DropdownMenuItem>
      </ToolbarDropdown>

      <ToolbarButton icon={Upload} label={t('toolbar.importJSON')} onClick={onImportJSON} actionsDisabled={actionsDisabled} onDisabledClick={handleDisabledClick} />

      <Separator orientation="vertical" className="h-6" />

      {actionsDisabled && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-amber-500 cursor-pointer" onClick={handleDisabledClick} aria-label={t('limits.toolbarLockedUnsaved')}>
              <ShieldAlert className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-52 text-center">{t('limits.toolbarLockedUnsaved')}</TooltipContent>
        </Tooltip>
      )}

      <ToolbarButton
        icon={darkMode ? Sun : Moon}
        label={darkMode ? t('toolbar.lightMode') : t('toolbar.darkMode')}
        onClick={onToggleDarkMode}
      />
    </div>
  );
}

export default React.memo(Toolbar);
