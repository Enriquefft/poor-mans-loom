'use client';

import { Circle, Maximize2, Minimize2, Move, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CAMERA_POSITION_MAP,
  CAMERA_SIZE_MAP,
  type CameraPosition,
  type CameraSettings,
  type CameraShape,
  type CameraSize,
  type RecordingMode,
} from '@/lib/types';

interface CameraOverlayProps {
  stream: MediaStream | null;
  settings: CameraSettings;
  onSettingsChange: (settings: Partial<CameraSettings>) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isRecording: boolean;
  mode: RecordingMode;
}

const POSITION_PRESETS: CameraPosition[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'bottom-center',
];

const _SIZE_PRESETS: CameraSize[] = ['small', 'medium', 'large'];

/**
 * Delay in milliseconds before hiding camera controls after mouse/touch leaves.
 *
 * **Configurability**: Modify this constant to adjust the hide delay timing.
 * - Lower values (e.g., 150ms) provide quicker UI response but may be harder to reach buttons
 * - Higher values (e.g., 500ms) give more time to reach buttons but may feel sluggish
 * - Default 300ms balances accessibility and responsiveness
 *
 * Adjust this value to accommodate different user speeds and accessibility needs.
 *
 * @default 300
 * @see FR-003 in specs/001-fix-camera-controls/spec.md
 * @see T001, T005 in specs/001-fix-camera-controls/tasks.md
 */
export const CAMERA_CONTROLS_HIDE_DELAY_MS = 300;

export function CameraOverlay({
  stream,
  settings,
  onSettingsChange,
  containerRef,
  isRecording,
  mode,
}: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((e) => {
        if (e.name !== 'AbortError')
          console.error('Camera preview play failed:', e);
      });
    }
  }, [stream]);

  // T003: Touch device detection with cleanup
  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    setIsTouchDevice(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // T005: Implement 300ms delay on controlsVisible (hide only)
  useEffect(() => {
    if (isHovering) {
      // Show immediately when hovering
      setControlsVisible(true);
    } else {
      // Hide after delay when not hovering
      const timeout = setTimeout(() => {
        setControlsVisible(false);
      }, CAMERA_CONTROLS_HIDE_DELAY_MS);

      return () => clearTimeout(timeout);
    }
  }, [isHovering]);

  const getPositionStyles = useCallback(() => {
    if (settings.customPosition) {
      return {
        left: settings.customPosition.x,
        position: 'absolute' as const,
        top: settings.customPosition.y,
      };
    }

    const positionStyles = CAMERA_POSITION_MAP[settings.position];
    return {
      position: 'absolute' as const,
      ...positionStyles,
      ...(settings.position === 'bottom-center' && {
        transform: 'translateX(-50%)',
      }),
    };
  }, [settings.position, settings.customPosition]);

  const getSizeStyles = useCallback(() => {
    if (settings.customSize) {
      return settings.customSize;
    }
    return CAMERA_SIZE_MAP[settings.size];
  }, [settings.size, settings.customSize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    const rect = overlayRef.current?.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (rect && containerRect) {
      positionRef.current = {
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
      };
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const containerRect = containerRef.current?.getBoundingClientRect();
      const size = getSizeStyles();

      if (containerRect) {
        const newX = Math.max(
          0,
          Math.min(
            positionRef.current.x + dx,
            containerRect.width - size.width,
          ),
        );
        const newY = Math.max(
          0,
          Math.min(
            positionRef.current.y + dy,
            containerRect.height - size.height,
          ),
        );

        onSettingsChange({
          customPosition: { x: newX, y: newY },
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, containerRef, getSizeStyles, onSettingsChange]);

  const handlePositionPreset = (position: CameraPosition) => {
    onSettingsChange({
      customPosition: undefined,
      position,
    });
  };

  const handleSizeChange = (size: CameraSize) => {
    onSettingsChange({
      customSize: undefined,
      size,
    });
  };

  const handleShapeChange = (shape: CameraShape) => {
    onSettingsChange({ shape });
  };

  /**
   * Toggle camera controls visibility for touch devices.
   * Shows controls on first tap, hides on second tap.
   * Only active when not recording.
   *
   * @see T017, T018 in specs/001-fix-camera-controls/tasks.md
   */
  const handleTouchToggle = () => {
    setControlsVisible((prev) => !prev);
  };

  // Only show camera overlay for screen+camera mode
  if (!stream || mode !== 'screen+camera') return null;

  const positionStyles = getPositionStyles();
  const sizeStyles = getSizeStyles();

  return (
    <div
      ref={overlayRef}
      className={`z-50 group ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        ...positionStyles,
        height: sizeStyles.height,
        transition: isDragging ? 'none' : 'all 0.2s ease-out',
        width: sizeStyles.width,
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => !isDragging && setIsHovering(false)}
      onClick={isTouchDevice && !isRecording ? handleTouchToggle : undefined}
    >
      <div
        className={`w-full h-full overflow-hidden border-2 border-white/20 shadow-lg ${
          settings.shape === 'circle' ? 'rounded-full' : 'rounded-lg'
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover scale-x-[-1] ${
            settings.shape === 'circle' ? 'rounded-full' : ''
          }`}
        />
      </div>

      {/* Drag indicator */}
      <div className="absolute top-2 left-2 bg-black/60 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        <Move className="w-3 h-3 text-white" />
      </div>

      {/* Controls panel - only show when not recording */}
      {controlsVisible && !isRecording && (
        <div
          className="absolute -bottom-12 left-1/2 -translate-x-1/2 z-[60] bg-neutral-900/95 border border-neutral-700 rounded-lg p-2 flex items-center gap-2 shadow-xl backdrop-blur-sm"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {/* Position presets */}
          <div className="flex gap-1">
            {POSITION_PRESETS.slice(0, 4).map((pos) => (
              <button
                key={pos}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePositionPreset(pos);
                }}
                className={`w-6 h-6 rounded border ${
                  settings.position === pos && !settings.customPosition
                    ? 'border-white bg-white/20'
                    : 'border-neutral-600 hover:border-neutral-400'
                } flex items-center justify-center`}
                title={pos.replace('-', ' ')}
              >
                <div
                  className={`w-2 h-2 rounded-sm bg-white/80 ${
                    pos === 'top-left'
                      ? '-translate-x-0.5 -translate-y-0.5'
                      : pos === 'top-right'
                        ? 'translate-x-0.5 -translate-y-0.5'
                        : pos === 'bottom-left'
                          ? '-translate-x-0.5 translate-y-0.5'
                          : 'translate-x-0.5 translate-y-0.5'
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-neutral-700" />

          {/* Size controls */}
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSizeChange('small');
              }}
              className={`p-1 rounded ${
                settings.size === 'small' ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
              title="Small"
            >
              <Minimize2 className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSizeChange('large');
              }}
              className={`p-1 rounded ${
                settings.size === 'large' ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
              title="Large"
            >
              <Maximize2 className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="w-px h-6 bg-neutral-700" />

          {/* Shape controls */}
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShapeChange('rectangle');
              }}
              className={`p-1 rounded ${
                settings.shape === 'rectangle'
                  ? 'bg-white/20'
                  : 'hover:bg-white/10'
              }`}
              title="Rectangle"
            >
              <Square className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShapeChange('circle');
              }}
              className={`p-1 rounded ${
                settings.shape === 'circle'
                  ? 'bg-white/20'
                  : 'hover:bg-white/10'
              }`}
              title="Circle"
            >
              <Circle className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
