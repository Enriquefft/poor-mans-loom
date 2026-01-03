/**
 * Hardware Capability Detection
 *
 * Detects browser capabilities and hardware resources to warn users
 * about insufficient resources for AI processing (T137, FR-025)
 */

export interface HardwareCapabilities {
  /** SharedArrayBuffer support (required for transformer.js) */
  hasSharedArrayBuffer: boolean;
  /** WebGL support (for GPU acceleration) */
  hasWebGL: boolean;
  /** Available device memory in GB (estimate) */
  deviceMemoryGB?: number;
  /** Logical processor count */
  hardwareConcurrency?: number;
  /** Whether device meets minimum requirements */
  meetsMinimumRequirements: boolean;
  /** Warnings for insufficient capabilities */
  warnings: string[];
}

/**
 * Minimum requirements for AI processing
 */
const MINIMUM_REQUIREMENTS = {
  deviceMemoryGB: 2, // 2GB minimum for Whisper model + processing
  hardwareConcurrency: 2, // 2 cores minimum for reasonable performance
  requiredFeatures: ['SharedArrayBuffer', 'WebGL'],
} as const;

/**
 * Check if browser supports WebGL
 */
function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

/**
 * Check if SharedArrayBuffer is available
 * Required for transformer.js and FFmpeg.wasm
 */
function checkSharedArrayBufferSupport(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}

/**
 * Get device memory estimate (if available)
 * Chrome/Edge only - navigator.deviceMemory
 */
function getDeviceMemory(): number | undefined {
  // @ts-expect-error - deviceMemory is not in standard TypeScript types
  if (navigator.deviceMemory) {
    // @ts-expect-error
    return navigator.deviceMemory as number;
  }
  return undefined;
}

/**
 * Get number of logical processors
 */
function getHardwareConcurrency(): number | undefined {
  return navigator.hardwareConcurrency;
}

/**
 * Detect hardware capabilities and return warnings
 */
export function detectHardwareCapabilities(): HardwareCapabilities {
  const hasSharedArrayBuffer = checkSharedArrayBufferSupport();
  const hasWebGL = checkWebGLSupport();
  const deviceMemoryGB = getDeviceMemory();
  const hardwareConcurrency = getHardwareConcurrency();

  const warnings: string[] = [];

  // Check critical requirements
  if (!hasSharedArrayBuffer) {
    warnings.push(
      'SharedArrayBuffer not available. AI features require HTTPS and cross-origin isolation headers.',
    );
  }

  if (!hasWebGL) {
    warnings.push(
      'WebGL not available. GPU acceleration disabled - AI processing will be slower.',
    );
  }

  // Check recommended requirements
  if (
    deviceMemoryGB !== undefined &&
    deviceMemoryGB < MINIMUM_REQUIREMENTS.deviceMemoryGB
  ) {
    warnings.push(
      `Low device memory (${deviceMemoryGB}GB). Minimum ${MINIMUM_REQUIREMENTS.deviceMemoryGB}GB recommended for AI processing.`,
    );
  }

  if (
    hardwareConcurrency !== undefined &&
    hardwareConcurrency < MINIMUM_REQUIREMENTS.hardwareConcurrency
  ) {
    warnings.push(
      `Low CPU count (${hardwareConcurrency} cores). Minimum ${MINIMUM_REQUIREMENTS.hardwareConcurrency} cores recommended.`,
    );
  }

  const meetsMinimumRequirements =
    hasSharedArrayBuffer &&
    hasWebGL &&
    (deviceMemoryGB === undefined ||
      deviceMemoryGB >= MINIMUM_REQUIREMENTS.deviceMemoryGB) &&
    (hardwareConcurrency === undefined ||
      hardwareConcurrency >= MINIMUM_REQUIREMENTS.hardwareConcurrency);

  return {
    deviceMemoryGB,
    hardwareConcurrency,
    hasSharedArrayBuffer,
    hasWebGL,
    meetsMinimumRequirements,
    warnings,
  };
}

/**
 * Get user-friendly capability summary
 */
export function getCapabilitySummary(
  capabilities: HardwareCapabilities,
): string {
  if (capabilities.meetsMinimumRequirements) {
    return 'Your device meets the requirements for AI processing.';
  }

  const criticalIssues = !capabilities.hasSharedArrayBuffer;

  if (criticalIssues) {
    return 'AI features unavailable. Please use HTTPS and ensure your browser supports modern web standards.';
  }

  return 'Your device may experience slow AI processing. Consider using a more powerful device for better performance.';
}
