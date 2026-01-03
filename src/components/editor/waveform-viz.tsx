/**
 * Waveform Visualization Component
 *
 * Displays audio waveform in timeline for better visual editing.
 * Enhancement: High-priority UX improvement from Phase 7 audit.
 */

import { useMemo } from 'react';
import type { SilenceSegment } from '@/lib/ai/types';
import type { WaveformData } from '@/lib/editor/waveform';

interface WaveformVizProps {
  waveformData: WaveformData | null;
  silenceSegments?: SilenceSegment[];
  width: number;
  height?: number;
}

/**
 * Check if a time falls within any silence segment
 */
function isInSilence(time: number, silenceSegments: SilenceSegment[]): boolean {
  return silenceSegments.some(
    (segment) =>
      !segment.deleted && time >= segment.startTime && time <= segment.endTime,
  );
}

export function WaveformViz({
  waveformData,
  silenceSegments = [],
  width,
  height = 60,
}: WaveformVizProps) {
  const bars = useMemo(() => {
    if (!waveformData || waveformData.amplitudes.length === 0) {
      return null;
    }

    const { amplitudes, duration } = waveformData;
    const barCount = amplitudes.length;
    const barWidth = width / barCount;

    return amplitudes.map((amplitude, index) => {
      const barHeight = amplitude * (height * 0.8); // 80% of container height
      const x = index * barWidth;
      const y = (height - barHeight) / 2; // Center vertically

      // Calculate time for this bar to check if it's in silence
      const time = (index / barCount) * duration;
      const inSilence = isInSilence(time, silenceSegments);

      return {
        barHeight,
        barWidth,
        inSilence,
        key: index,
        x,
        y,
      };
    });
  }, [waveformData, silenceSegments, width, height]);

  if (!waveformData || !bars) {
    return (
      <div
        className="flex items-center justify-center bg-neutral-900/30 rounded"
        style={{ height, width }}
      >
        <span className="text-xs text-neutral-600">No waveform data</span>
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      className="rounded"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
    >
      {/* Waveform bars */}
      {bars.map((bar) => (
        <rect
          key={bar.key}
          x={bar.x}
          y={bar.y}
          width={Math.max(1, bar.barWidth - 0.5)} // Leave small gap between bars
          height={Math.max(1, bar.barHeight)}
          fill={bar.inSilence ? '#6b7280' : '#3b82f6'} // Gray for silence, blue for speech
          opacity={bar.inSilence ? 0.4 : 0.8}
        />
      ))}

      {/* Center line */}
      <line
        x1={0}
        y1={height / 2}
        x2={width}
        y2={height / 2}
        stroke="#374151"
        strokeWidth={1}
        opacity={0.3}
      />
    </svg>
  );
}
