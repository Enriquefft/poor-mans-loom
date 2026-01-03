'use client';

import {
  AlertCircle,
  CheckCircle,
  Download,
  FileVideo,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ExportOptions, ExportProgress } from '@/lib/types';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: ExportOptions) => void;
  progress: ExportProgress | null;
  isExporting: boolean;
}

export function ExportDialog({
  open,
  onOpenChange,
  onExport,
  progress,
  isExporting,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportOptions['format']>('webm');
  const [quality, setQuality] = useState<ExportOptions['quality']>('medium');

  const handleExport = () => {
    onExport({ format, quality });
  };

  const getStageIcon = () => {
    if (!progress) return null;

    switch (progress.stage) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <FileVideo className="w-5 h-5" />
            Export Video
          </DialogTitle>
          <DialogDescription className="font-mono text-sm">
            Choose format and quality for your recording
          </DialogDescription>
        </DialogHeader>

        {isExporting ? (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center gap-3">
              {getStageIcon()}
              <span className="font-mono text-sm">
                {progress?.message || 'Processing...'}
              </span>
            </div>

            <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress?.progress || 0}%` }}
              />
            </div>

            <p className="text-center text-xs text-neutral-500 font-mono">
              {progress?.progress || 0}% complete
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Format selection */}
            <div className="space-y-3">
              <div className="text-sm font-mono text-neutral-400">Format</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormat('webm')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    format === 'webm'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-neutral-700 hover:border-neutral-600'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-mono font-medium">.webm</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Smaller file, faster export
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('mp4')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    format === 'mp4'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-neutral-700 hover:border-neutral-600'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-mono font-medium">.mp4</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Universal compatibility
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Quality selection */}
            <div className="space-y-3">
              <div className="text-sm font-mono text-neutral-400">Quality</div>
              <div className="grid grid-cols-3 gap-2">
                {(['low', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuality(q)}
                    className={`py-2 px-3 rounded-lg border transition-all text-sm font-mono ${
                      quality === q
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-neutral-700 hover:border-neutral-600 text-neutral-400'
                    }`}
                  >
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-neutral-500 font-mono">
                {quality === 'low' && 'Fastest export, smaller file size'}
                {quality === 'medium' && 'Balanced quality and file size'}
                {quality === 'high' && 'Best quality, larger file size'}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {!isExporting && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </>
          )}

          {isExporting && progress?.stage === 'complete' && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}

          {isExporting && progress?.stage === 'error' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport}>Retry</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
