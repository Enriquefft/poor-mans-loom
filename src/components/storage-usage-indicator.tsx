/**
 * Storage Usage Indicator Component
 *
 * Displays localStorage usage percentage and provides cleanup suggestions
 * when quota is running low. (T133)
 */

import { AlertTriangle, HardDrive, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { StorageStats } from '@/lib/ai/types';
import { storageService } from '@/lib/storage/persistence';

export function StorageUsageIndicator() {
  const [stats, setStats] = useState<StorageStats | null>(null);

  useEffect(() => {
    const updateStats = () => {
      setStats(storageService.getStorageStats());
    };

    // Initial load
    updateStats();

    // Update every 5 seconds
    const interval = setInterval(updateStats, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  const usagePercent = Math.round(stats.usagePercentage);
  const isWarning = usagePercent >= 80;
  const isDanger = usagePercent >= 95;

  // Format bytes to human-readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
  };

  // Get color based on usage
  const getColor = () => {
    if (isDanger) return 'text-red-600';
    if (isWarning) return 'text-yellow-600';
    return 'text-gray-600';
  };

  // Get background color based on usage
  const getBgColor = () => {
    if (isDanger) return 'bg-red-100';
    if (isWarning) return 'bg-yellow-100';
    return 'bg-gray-100';
  };

  const handleClearAllData = async () => {
    if (
      confirm(
        'Are you sure you want to delete all stored transcripts, captions, and AI data? This cannot be undone.',
      )
    ) {
      await storageService.clearAll();
      setStats(storageService.getStorageStats());
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-2 rounded px-2 py-1 text-sm transition-colors hover:bg-gray-200 ${getColor()}`}
          title="Storage usage"
        >
          {isDanger || isWarning ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <HardDrive className="h-4 w-4" />
          )}
          <span className="font-medium">{usagePercent}%</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 font-semibold">Storage Usage</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used:</span>
                <span className="font-mono">
                  {formatBytes(stats.totalBytes)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Available:</span>
                <span className="font-mono">
                  {formatBytes(stats.availableBytes)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total:</span>
                <span className="font-mono">10 MB</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full transition-all ${isDanger ? 'bg-red-600' : isWarning ? 'bg-yellow-600' : 'bg-blue-600'}`}
                style={{ width: `${Math.min(100, usagePercent)}%` }}
              />
            </div>
          </div>

          {/* Breakdown */}
          <div>
            <h4 className="mb-2 text-sm font-medium">Breakdown</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Transcripts:</span>
                <span className="font-mono">
                  {formatBytes(stats.breakdown.transcripts)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Captions:</span>
                <span className="font-mono">
                  {formatBytes(stats.breakdown.captions)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Silence data:</span>
                <span className="font-mono">
                  {formatBytes(stats.breakdown.silenceSegments)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>AI jobs:</span>
                <span className="font-mono">
                  {formatBytes(stats.breakdown.aiJobs)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Other:</span>
                <span className="font-mono">
                  {formatBytes(stats.breakdown.other)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm">
              <span>Recordings:</span>
              <span className="font-mono">{stats.recordingCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Transcripts:</span>
              <span className="font-mono">{stats.transcriptCount}</span>
            </div>
          </div>

          {/* Warning message */}
          {(isWarning || isDanger) && (
            <div className={`rounded-md p-3 text-sm ${getBgColor()}`}>
              <p className="font-medium">
                {isDanger ? 'Storage critically low!' : 'Storage running low'}
              </p>
              <p className="mt-1 text-xs">
                Delete old recordings or clear AI data to free up space.
              </p>
            </div>
          )}

          {/* Clear data button */}
          <Button
            onClick={handleClearAllData}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear All AI Data
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
