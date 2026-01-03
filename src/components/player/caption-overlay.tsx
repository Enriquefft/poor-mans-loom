/**
 * Caption Overlay Component
 *
 * Displays captions synchronized with video playback.
 * Respects user-defined caption styling and positioning.
 *
 * Enhancement: High-priority UX improvement from Phase 7 audit
 */

import type { Caption, CaptionPosition, CaptionStyle } from '@/lib/ai/types';

interface CaptionOverlayProps {
  captions: Caption[];
  currentTime: number;
  visible: boolean;
}

/**
 * Find the active caption for the current playback time
 */
function findActiveCaption(
  captions: Caption[],
  currentTime: number,
): Caption | null {
  return (
    captions.find(
      (caption) =>
        currentTime >= caption.startTime && currentTime <= caption.endTime,
    ) || null
  );
}

/**
 * Convert CaptionPosition to CSS positioning classes
 */
function getPositionClasses(position: CaptionPosition): string {
  const vertical =
    position.vertical === 'top'
      ? 'top-12'
      : position.vertical === 'middle'
        ? 'top-1/2 -translate-y-1/2'
        : 'bottom-20'; // bottom (leave room for controls)

  const horizontal =
    position.horizontal === 'left'
      ? 'left-8 text-left'
      : position.horizontal === 'right'
        ? 'right-8 text-right'
        : 'left-1/2 -translate-x-1/2 text-center'; // center

  return `${vertical} ${horizontal}`;
}

/**
 * Apply caption style to create inline styles
 */
function getCaptionStyles(style: CaptionStyle): React.CSSProperties {
  return {
    backgroundColor: style.backgroundColor,
    color: style.textColor,
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    maxWidth: '80%',
    lineHeight: '1.4',
    wordWrap: 'break-word',
  };
}

export function CaptionOverlay({
  captions,
  currentTime,
  visible,
}: CaptionOverlayProps) {
  if (!visible || captions.length === 0) {
    return null;
  }

  const activeCaption = findActiveCaption(captions, currentTime);

  if (!activeCaption) {
    return null;
  }

  const positionClasses = getPositionClasses(activeCaption.position);
  const captionStyles = getCaptionStyles(activeCaption.style);

  return (
    <div
      className={`absolute ${positionClasses} pointer-events-none z-10 transition-opacity duration-200`}
      style={{
        textShadow:
          activeCaption.style.backgroundColor === 'transparent'
            ? '2px 2px 4px rgba(0,0,0,0.8)'
            : 'none',
      }}
    >
      <div style={captionStyles}>{activeCaption.text}</div>
    </div>
  );
}
