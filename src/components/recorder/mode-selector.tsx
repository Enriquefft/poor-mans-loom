'use client';

import { Monitor, MonitorPlay, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RecordingMode } from '@/lib/types';

interface ModeSelectorProps {
  selected: RecordingMode;
  onSelect: (mode: RecordingMode) => void;
  disabled?: boolean;
}

export function ModeSelector({
  selected,
  onSelect,
  disabled = false,
}: ModeSelectorProps) {
  const modes: Array<{
    value: RecordingMode;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      icon: <Monitor className="h-3.5 w-3.5" />,
      label: 'Screen',
      value: 'screen-only',
    },
    {
      icon: <Video className="h-3.5 w-3.5" />,
      label: 'Camera',
      value: 'camera-only',
    },
    {
      icon: <MonitorPlay className="h-3.5 w-3.5" />,
      label: 'Both',
      value: 'screen+camera',
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-neutral-500">Mode:</span>
      <div className="flex gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
        {modes.map((mode) => (
          <Button
            key={mode.value}
            variant={selected === mode.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSelect(mode.value)}
            disabled={disabled}
            className="gap-1.5 font-mono text-xs h-8"
          >
            {mode.icon}
            {mode.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
