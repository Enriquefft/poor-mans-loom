/**
 * AI Processing Hook
 *
 * React hook for managing AI processing jobs with state management.
 * Handles transcription, silence detection, and caption generation jobs.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AIJobType,
  AIProcessingError,
  AIProcessingJob,
  JobStatus,
} from '@/lib/ai/types';
import { storageService } from '@/lib/storage/persistence';

// ============================================================================
// Hook State Interface
// ============================================================================

interface AIProcessingState {
  jobs: Map<string, AIProcessingJob>;
  activeJobCount: number;
  isProcessing: boolean;
}

interface UseAIProcessingReturn {
  // Job management
  startJob: (
    type: AIJobType,
    recordingId: string,
    input: unknown,
  ) => Promise<string>;
  cancelJob: (jobId: string) => Promise<void>;
  getJob: (jobId: string) => AIProcessingJob | undefined;
  getJobsByRecording: (recordingId: string) => AIProcessingJob[];

  // State
  jobs: Map<string, AIProcessingJob>;
  activeJobCount: number;
  isProcessing: boolean;

  // Subscriptions
  subscribe: (
    jobId: string,
    callback: (job: AIProcessingJob) => void,
  ) => () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAIProcessing(): UseAIProcessingReturn {
  const [state, setState] = useState<AIProcessingState>({
    activeJobCount: 0,
    isProcessing: false,
    jobs: new Map(),
  });

  // Subscription callbacks
  const subscribersRef = useRef<
    Map<string, Set<(job: AIProcessingJob) => void>>
  >(new Map());

  /**
   * Generate unique job ID
   */
  const generateJobId = useCallback((): string => {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  /**
   * Update job state and notify subscribers
   */
  const updateJobState = useCallback((job: AIProcessingJob) => {
    setState((prev) => {
      const newJobs = new Map(prev.jobs);
      newJobs.set(job.id, job);

      const activeCount = Array.from(newJobs.values()).filter(
        (j) => j.status === 'processing' || j.status === 'loading_model',
      ).length;

      return {
        activeJobCount: activeCount,
        isProcessing: activeCount > 0,
        jobs: newJobs,
      };
    });

    // Persist to storage
    storageService.saveAIJob(job);

    // Notify subscribers
    const subscribers = subscribersRef.current.get(job.id);
    if (subscribers) {
      subscribers.forEach((callback) => callback(job));
    }
  }, []);

  /**
   * Start a new AI processing job
   */
  const startJob = useCallback(
    async (
      type: AIJobType,
      recordingId: string,
      _input: unknown,
    ): Promise<string> => {
      const jobId = generateJobId();

      const newJob: AIProcessingJob = {
        id: jobId,
        progress: 0,
        recordingId,
        startedAt: Date.now(),
        status: 'queued',
        type,
      };

      updateJobState(newJob);

      // Job processing will be implemented in service layer
      // This hook only manages state

      return jobId;
    },
    [generateJobId, updateJobState],
  );

  /**
   * Cancel a running job
   */
  const cancelJob = useCallback(
    async (jobId: string): Promise<void> => {
      const job = state.jobs.get(jobId);
      if (!job) return;

      const cancelledJob: AIProcessingJob = {
        ...job,
        completedAt: Date.now(),
        status: 'cancelled',
      };

      updateJobState(cancelledJob);
    },
    [state.jobs, updateJobState],
  );

  /**
   * Get job by ID
   */
  const getJob = useCallback(
    (jobId: string): AIProcessingJob | undefined => {
      return state.jobs.get(jobId);
    },
    [state.jobs],
  );

  /**
   * Get all jobs for a recording
   */
  const getJobsByRecording = useCallback(
    (recordingId: string): AIProcessingJob[] => {
      return Array.from(state.jobs.values()).filter(
        (job) => job.recordingId === recordingId,
      );
    },
    [state.jobs],
  );

  /**
   * Subscribe to job updates
   */
  const subscribe = useCallback(
    (jobId: string, callback: (job: AIProcessingJob) => void): (() => void) => {
      const subscribers = subscribersRef.current.get(jobId) || new Set();
      subscribers.add(callback);
      subscribersRef.current.set(jobId, subscribers);

      // Return unsubscribe function
      return () => {
        const subs = subscribersRef.current.get(jobId);
        if (subs) {
          subs.delete(callback);
          if (subs.size === 0) {
            subscribersRef.current.delete(jobId);
          }
        }
      };
    },
    [],
  );

  /**
   * Load existing jobs from storage on mount
   */
  useEffect(() => {
    // This will be populated when we load recordings
    // For now, start with empty state
  }, []);

  /**
   * Cleanup subscriptions on unmount
   */
  useEffect(() => {
    return () => {
      subscribersRef.current.clear();
    };
  }, []);

  return {
    activeJobCount: state.activeJobCount,
    cancelJob,
    getJob,
    getJobsByRecording,
    isProcessing: state.isProcessing,
    jobs: state.jobs,
    startJob,
    subscribe,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Update job progress
 * Helper for service implementations to update job progress
 */
export function createJobProgressUpdate(
  job: AIProcessingJob,
  progress: number,
  status?: JobStatus,
): AIProcessingJob {
  return {
    ...job,
    progress: Math.min(1, Math.max(0, progress)),
    status: status || job.status,
  };
}

/**
 * Complete job successfully
 */
export function completeJob(
  job: AIProcessingJob,
  result: unknown,
): AIProcessingJob {
  return {
    ...job,
    completedAt: Date.now(),
    progress: 1,
    result,
    status: 'completed',
  };
}

/**
 * Fail job with error
 */
export function failJob(
  job: AIProcessingJob,
  error: AIProcessingError,
): AIProcessingJob {
  return {
    ...job,
    completedAt: Date.now(),
    error,
    status: 'failed',
  };
}

/**
 * Check if job is active (processing or loading)
 */
export function isJobActive(job: AIProcessingJob): boolean {
  return job.status === 'processing' || job.status === 'loading_model';
}

/**
 * Check if job is complete (success or failure)
 */
export function isJobDone(job: AIProcessingJob): boolean {
  return (
    job.status === 'completed' ||
    job.status === 'failed' ||
    job.status === 'cancelled'
  );
}
