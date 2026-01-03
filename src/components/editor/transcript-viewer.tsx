/**
 * Transcript Viewer Component
 *
 * Display transcript with search, edit, and export functionality.
 * Implements UI for User Story 1 (Auto Transcription).
 */

import { AlertCircle, Check, Download, Edit, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { Transcript, TranscriptSegment } from '@/lib/ai/types';
import {
  editSegmentText,
  type SearchResult,
  searchTranscript,
  toSRT,
  toTXT,
  toTXTWithTimestamps,
  toVTT,
} from '@/lib/editor/transcript';

interface TranscriptViewerProps {
  transcript: Transcript;
  onTranscriptUpdate?: (transcript: Transcript) => void;
  onSeekTo?: (time: number) => void;
  currentTime?: number;
}

export function TranscriptViewer({
  transcript,
  onTranscriptUpdate,
  onSeekTo,
  currentTime = 0,
}: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  /**
   * Handle search input change
   */
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.trim()) {
        const results = searchTranscript(transcript, query, {
          caseSensitive: false,
          wholeWord: false,
        });
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    },
    [transcript],
  );

  /**
   * Handle segment click - seek to timestamp
   */
  const handleSegmentClick = useCallback(
    (segment: TranscriptSegment) => {
      if (onSeekTo) {
        onSeekTo(segment.startTime);
      }
    },
    [onSeekTo],
  );

  /**
   * Start editing a segment
   */
  const handleStartEdit = useCallback((segment: TranscriptSegment) => {
    setEditingSegmentId(segment.id);
    setEditText(segment.text);
  }, []);

  /**
   * Save edited segment
   */
  const handleSaveEdit = useCallback(() => {
    if (editingSegmentId && onTranscriptUpdate) {
      const updated = editSegmentText(transcript, editingSegmentId, editText);
      onTranscriptUpdate(updated);
      setEditingSegmentId(null);
      setEditText('');
    }
  }, [editingSegmentId, editText, transcript, onTranscriptUpdate]);

  /**
   * Cancel editing
   */
  const handleCancelEdit = useCallback(() => {
    setEditingSegmentId(null);
    setEditText('');
  }, []);

  /**
   * Export transcript to file
   */
  const handleExport = useCallback(
    (format: 'srt' | 'vtt' | 'txt' | 'txt-timestamps') => {
      let content: string;
      let filename: string;

      switch (format) {
        case 'srt':
          content = toSRT(transcript);
          filename = `transcript_${transcript.id}.srt`;
          break;
        case 'vtt':
          content = toVTT(transcript);
          filename = `transcript_${transcript.id}.vtt`;
          break;
        case 'txt':
          content = toTXT(transcript);
          filename = `transcript_${transcript.id}.txt`;
          break;
        case 'txt-timestamps':
          content = toTXTWithTimestamps(transcript);
          filename = `transcript_${transcript.id}_timestamped.txt`;
          break;
      }

      // Create download link
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [transcript],
  );

  /**
   * Auto-scroll to active segment
   */
  useEffect(() => {
    if (activeSegmentRef.current && scrollContainerRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, []);

  /**
   * Find active segment based on current time
   */
  const activeSegment = transcript.segments.find(
    (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime,
  );

  /**
   * Check if segment matches search
   */
  const isSearchMatch = useCallback(
    (segmentId: string) => {
      return searchResults.some((result) => result.segmentId === segmentId);
    },
    [searchResults],
  );

  /**
   * Highlight search matches in text
   */
  const highlightMatches = useCallback(
    (segment: TranscriptSegment) => {
      const result = searchResults.find((r) => r.segmentId === segment.id);
      if (!result || !searchQuery.trim()) {
        return segment.text;
      }

      let highlighted = segment.text;
      const matches = [...result.matches].reverse(); // Reverse to maintain indices

      matches.forEach((match) => {
        const before = highlighted.substring(0, match.start);
        const matchText = highlighted.substring(match.start, match.end);
        const after = highlighted.substring(match.end);
        highlighted = `${before}<mark class="bg-yellow-300 dark:bg-yellow-600">${matchText}</mark>${after}`;
      });

      return highlighted;
    },
    [searchResults, searchQuery],
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleExport('srt')}>
              Export as SRT
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('vtt')}>
              Export as VTT
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('txt')}>
              Export as TXT
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('txt-timestamps')}>
              Export as TXT (with timestamps)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Transcript segments */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {transcript.segments.map((segment) => {
          const isActive = activeSegment?.id === segment.id;
          const isMatch = isSearchMatch(segment.id);
          const isEditing = editingSegmentId === segment.id;

          return (
            <div
              key={segment.id}
              ref={isActive ? activeSegmentRef : undefined}
              className={`p-3 rounded-lg border transition-colors ${
                isActive
                  ? 'bg-primary/10 border-primary'
                  : isMatch
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                    : 'bg-card border-border hover:bg-accent'
              } ${segment.flagged ? 'border-l-4 border-l-orange-500' : ''}`}
            >
              {/* Timestamp and confidence */}
              <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                <button
                  onClick={() => handleSegmentClick(segment)}
                  className="hover:text-primary"
                >
                  {formatTime(segment.startTime)} -{' '}
                  {formatTime(segment.endTime)}
                </button>
                <div className="flex items-center gap-2">
                  {segment.flagged && (
                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                      <AlertCircle className="h-3 w-3" />
                      Low confidence
                    </span>
                  )}
                  {segment.edited && (
                    <span className="text-blue-600 dark:text-blue-400">
                      Edited
                    </span>
                  )}
                  {!isEditing && onTranscriptUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(segment)}
                      className="h-6 px-2"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Segment text */}
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p
                  className="text-sm cursor-pointer"
                  onClick={() => handleSegmentClick(segment)}
                  dangerouslySetInnerHTML={{
                    __html: highlightMatches(segment),
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="border-t p-3 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          {transcript.segments.length} segments •{' '}
          {transcript.metadata.wordCount} words
        </span>
        {searchResults.length > 0 && (
          <span>{searchResults.length} matches found</span>
        )}
      </div>
    </div>
  );
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
