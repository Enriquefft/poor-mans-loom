'use client';

import { Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CanvasDimension } from '@/lib/types';
import { CANVAS_PRESETS } from '@/lib/types';

interface DimensionSelectorProps {
  selected: CanvasDimension;
  onSelect: (dimension: CanvasDimension) => void;
  disabled?: boolean;
}

export function DimensionSelector({
  selected,
  onSelect,
  disabled = false,
}: DimensionSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="font-mono text-xs"
        >
          <Monitor className="h-3 w-3 mr-2" />
          {selected.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {Object.values(CANVAS_PRESETS).map((preset) => (
          <DropdownMenuItem
            key={preset.label}
            onClick={() => onSelect(preset)}
            className={selected.label === preset.label ? 'bg-neutral-800' : ''}
          >
            <span className="font-mono text-xs">
              {preset.label} ({preset.width}×{preset.height})
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
