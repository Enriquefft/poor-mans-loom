/**
 * Caption Editor Component
 *
 * T114-T121: UI for customizing caption appearance and position
 * Features:
 * - Font controls (family, size, bold, italic)
 * - Color controls (text, background, outline)
 * - Position controls (horizontal/vertical alignment)
 * - Real-time preview toggle
 * - Export options (burned-in vs separate file)
 */

import { useCallback, useState } from 'react';
import { CAPTION_CONFIG } from '@/lib/ai/config';
import type { Caption, CaptionPosition, CaptionStyle } from '@/lib/ai/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface CaptionEditorProps {
  captions: Caption[];
  onCaptionsChange: (captions: Caption[]) => void;
  showPreview: boolean;
  onShowPreviewChange: (show: boolean) => void;
  disabled?: boolean;
}

// Font family options
const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Impact',
  'Comic Sans MS',
] as const;

export function CaptionEditor({
  captions,
  onCaptionsChange,
  showPreview,
  onShowPreviewChange,
  disabled = false,
}: CaptionEditorProps) {
  // Get current style from first caption (all captions share same style)
  const currentStyle: CaptionStyle = captions[0]?.style || CAPTION_CONFIG.DEFAULT_STYLE;
  const currentPosition: CaptionPosition = captions[0]?.position || CAPTION_CONFIG.DEFAULT_POSITION;

  const [activeTab, setActiveTab] = useState<'style' | 'position'>('style');

  // T115: Update caption style across all captions
  const updateStyle = useCallback(
    (updates: Partial<CaptionStyle>) => {
      const newStyle = { ...currentStyle, ...updates };
      const updatedCaptions = captions.map((caption) => ({
        ...caption,
        style: newStyle,
      }));
      onCaptionsChange(updatedCaptions);
    },
    [captions, currentStyle, onCaptionsChange],
  );

  // T118: Update caption position across all captions
  const updatePosition = useCallback(
    (updates: Partial<CaptionPosition>) => {
      const newPosition = { ...currentPosition, ...updates };
      const updatedCaptions = captions.map((caption) => ({
        ...caption,
        position: newPosition,
      }));
      onCaptionsChange(updatedCaptions);
    },
    [captions, currentPosition, onCaptionsChange],
  );

  if (captions.length === 0) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 noise-texture noise-texture-subtle">
        <p className="text-neutral-500 text-sm text-center">
          No captions available. Generate captions from a transcript first.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg noise-texture noise-texture-subtle">
      {/* Header with preview toggle */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div>
          <h3 className="font-mono text-sm font-semibold text-neutral-200">
            Caption Settings
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {captions.length} caption{captions.length !== 1 ? 's' : ''} • Customize appearance and position
          </p>
        </div>
        <Button
          onClick={() => onShowPreviewChange(!showPreview)}
          variant={showPreview ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
        >
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </Button>
      </div>

      {/* Tabs for Style and Position */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'style' | 'position')}>
        <TabsList className="w-full justify-start border-b border-neutral-800 bg-transparent rounded-none p-0">
          <TabsTrigger
            value="style"
            className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
          >
            Style
          </TabsTrigger>
          <TabsTrigger
            value="position"
            className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
          >
            Position
          </TabsTrigger>
        </TabsList>

        {/* T115-T117: Style Tab */}
        <TabsContent value="style" className="p-4 space-y-4">
          {/* Font Family */}
          <div className="space-y-2">
            <Label htmlFor="font-family" className="text-xs text-neutral-400">
              Font Family
            </Label>
            <Select
              value={currentStyle.fontFamily}
              onValueChange={(value) => updateStyle({ fontFamily: value })}
              disabled={disabled}
            >
              <SelectTrigger id="font-family" className="bg-neutral-950 border-neutral-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="font-size" className="text-xs text-neutral-400">
                Font Size
              </Label>
              <span className="text-xs text-neutral-500 font-mono">
                {currentStyle.fontSize}px
              </span>
            </div>
            <Slider
              id="font-size"
              min={12}
              max={72}
              step={1}
              value={[currentStyle.fontSize]}
              onValueChange={([value]) => updateStyle({ fontSize: value })}
              disabled={disabled}
            />
          </div>

          {/* Font Weight and Style */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => updateStyle({ bold: !currentStyle.bold })}
              variant={currentStyle.bold ? 'default' : 'outline'}
              size="sm"
              disabled={disabled}
              className="font-bold"
            >
              Bold
            </Button>
            <Button
              onClick={() => updateStyle({ italic: !currentStyle.italic })}
              variant={currentStyle.italic ? 'default' : 'outline'}
              size="sm"
              disabled={disabled}
              className="italic"
            >
              Italic
            </Button>
          </div>

          {/* Text Color */}
          <div className="space-y-2">
            <Label htmlFor="text-color" className="text-xs text-neutral-400">
              Text Color
            </Label>
            <div className="flex items-center gap-2">
              <input
                id="text-color"
                type="color"
                value={currentStyle.fontColor}
                onChange={(e) => updateStyle({ fontColor: e.target.value })}
                disabled={disabled}
                className="w-12 h-10 rounded border border-neutral-700 bg-neutral-950 cursor-pointer"
              />
              <input
                type="text"
                value={currentStyle.fontColor}
                onChange={(e) => updateStyle({ fontColor: e.target.value })}
                disabled={disabled}
                className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-700 rounded text-sm font-mono"
                placeholder="#FFFFFF"
              />
            </div>
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <Label htmlFor="bg-color" className="text-xs text-neutral-400">
              Background Color
            </Label>
            <div className="flex items-center gap-2">
              <input
                id="bg-color"
                type="color"
                value={currentStyle.backgroundColor.slice(0, 7)} // Remove alpha for color picker
                onChange={(e) => {
                  // Preserve alpha channel
                  const alpha = currentStyle.backgroundColor.slice(7) || 'AA';
                  updateStyle({ backgroundColor: e.target.value + alpha });
                }}
                disabled={disabled}
                className="w-12 h-10 rounded border border-neutral-700 bg-neutral-950 cursor-pointer"
              />
              <input
                type="text"
                value={currentStyle.backgroundColor}
                onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                disabled={disabled}
                className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-700 rounded text-sm font-mono"
                placeholder="#000000AA"
              />
            </div>
            <p className="text-xs text-neutral-600">
              Use 8-digit hex for transparency (e.g., #000000AA)
            </p>
          </div>

          {/* Outline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="outline-toggle" className="text-xs text-neutral-400">
                Text Outline
              </Label>
              <Button
                id="outline-toggle"
                onClick={() => updateStyle({ outline: !currentStyle.outline })}
                variant={currentStyle.outline ? 'default' : 'outline'}
                size="sm"
                disabled={disabled}
              >
                {currentStyle.outline ? 'Enabled' : 'Disabled'}
              </Button>
            </div>

            {currentStyle.outline && (
              <div className="space-y-2 pl-4 border-l-2 border-neutral-800">
                <Label htmlFor="outline-color" className="text-xs text-neutral-400">
                  Outline Color
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="outline-color"
                    type="color"
                    value={currentStyle.outlineColor || '#000000'}
                    onChange={(e) => updateStyle({ outlineColor: e.target.value })}
                    disabled={disabled}
                    className="w-12 h-10 rounded border border-neutral-700 bg-neutral-950 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={currentStyle.outlineColor || '#000000'}
                    onChange={(e) => updateStyle({ outlineColor: e.target.value })}
                    disabled={disabled}
                    className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-700 rounded text-sm font-mono"
                    placeholder="#000000"
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* T118-T119: Position Tab */}
        <TabsContent value="position" className="p-4 space-y-4">
          {/* Horizontal Alignment */}
          <div className="space-y-2">
            <Label className="text-xs text-neutral-400">Horizontal Alignment</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['left', 'center', 'right'] as const).map((align) => (
                <Button
                  key={align}
                  onClick={() => updatePosition({ horizontal: align })}
                  variant={currentPosition.horizontal === align ? 'default' : 'outline'}
                  size="sm"
                  disabled={disabled}
                  className="capitalize"
                >
                  {align}
                </Button>
              ))}
            </div>
          </div>

          {/* Vertical Alignment */}
          <div className="space-y-2">
            <Label className="text-xs text-neutral-400">Vertical Alignment</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['top', 'middle', 'bottom'] as const).map((align) => (
                <Button
                  key={align}
                  onClick={() => updatePosition({ vertical: align })}
                  variant={currentPosition.vertical === align ? 'default' : 'outline'}
                  size="sm"
                  disabled={disabled}
                  className="capitalize"
                >
                  {align}
                </Button>
              ))}
            </div>
          </div>

          {/* Position Grid Preview */}
          <div className="space-y-2">
            <Label className="text-xs text-neutral-400">Position Preview</Label>
            <div className="aspect-video bg-neutral-950 border border-neutral-700 rounded-lg relative overflow-hidden">
              {/* Grid lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-neutral-800" />
                ))}
              </div>

              {/* Caption indicator */}
              <div
                className={`absolute px-2 py-1 text-xs font-mono bg-blue-500/20 border border-blue-500 rounded
                  ${currentPosition.horizontal === 'left' ? 'left-2' : ''}
                  ${currentPosition.horizontal === 'center' ? 'left-1/2 -translate-x-1/2' : ''}
                  ${currentPosition.horizontal === 'right' ? 'right-2' : ''}
                  ${currentPosition.vertical === 'top' ? 'top-2' : ''}
                  ${currentPosition.vertical === 'middle' ? 'top-1/2 -translate-y-1/2' : ''}
                  ${currentPosition.vertical === 'bottom' ? 'bottom-2' : ''}
                `}
              >
                Caption
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview Sample */}
      {showPreview && (
        <div className="p-4 border-t border-neutral-800">
          <Label className="text-xs text-neutral-400 block mb-2">Preview</Label>
          <div className="aspect-video bg-neutral-950 border border-neutral-700 rounded-lg relative overflow-hidden flex items-center justify-center">
            <div
              className={`absolute px-4 py-2 rounded
                ${currentPosition.horizontal === 'left' ? 'left-4' : ''}
                ${currentPosition.horizontal === 'center' ? 'left-1/2 -translate-x-1/2' : ''}
                ${currentPosition.horizontal === 'right' ? 'right-4' : ''}
                ${currentPosition.vertical === 'top' ? 'top-4' : ''}
                ${currentPosition.vertical === 'middle' ? 'top-1/2 -translate-y-1/2' : ''}
                ${currentPosition.vertical === 'bottom' ? 'bottom-4' : ''}
              `}
              style={{
                backgroundColor: currentStyle.backgroundColor,
                color: currentStyle.fontColor,
                fontFamily: currentStyle.fontFamily,
                fontSize: `${currentStyle.fontSize * 0.5}px`, // Scale down for preview
                fontWeight: currentStyle.bold ? 'bold' : 'normal',
                fontStyle: currentStyle.italic ? 'italic' : 'normal',
                textShadow: currentStyle.outline
                  ? `
                    -1px -1px 0 ${currentStyle.outlineColor || '#000000'},
                    1px -1px 0 ${currentStyle.outlineColor || '#000000'},
                    -1px 1px 0 ${currentStyle.outlineColor || '#000000'},
                    1px 1px 0 ${currentStyle.outlineColor || '#000000'}
                  `
                  : 'none',
              }}
            >
              Sample Caption Text
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
