/**
 * Background Controls Component
 *
 * UI controls for background blur/removal effects in camera recordings.
 * Implements T087-T093 (Phase 5 - Background Processing UI).
 */

'use client';

import { AlertCircle, Check, Image as ImageIcon, Palette } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { segmentationService } from '@/lib/ai/segmentation';
import type { BackgroundEffect } from '@/lib/ai/types';

interface BackgroundControlsProps {
  effect: BackgroundEffect;
  onEffectChange: (effect: BackgroundEffect) => void;
  disabled?: boolean;
}

export function BackgroundControls({
  effect,
  onEffectChange,
  disabled = false,
}: BackgroundControlsProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // T088: Toggle between blur and removal modes
  const handleModeChange = useCallback(
    (mode: 'blur' | 'removal') => {
      onEffectChange({ ...effect, type: mode });
    },
    [effect, onEffectChange],
  );

  // T087: Enable/disable effect toggle
  const handleToggle = useCallback(
    (enabled: boolean) => {
      onEffectChange({ ...effect, enabled });
      if (enabled) {
        toast.success(`Background ${effect.type} enabled`);
      } else {
        toast.info('Background effects disabled');
      }
    },
    [effect, onEffectChange],
  );

  // T089: Blur intensity slider
  const handleBlurIntensityChange = useCallback(
    (values: number[]) => {
      onEffectChange({ ...effect, blurIntensity: values[0] });
    },
    [effect, onEffectChange],
  );

  // T090: Color picker for removal mode
  const handleColorChange = useCallback(
    (color: string) => {
      onEffectChange({ ...effect, replacementColor: color });
      setShowColorPicker(false);
      toast.success('Background color updated');
    },
    [effect, onEffectChange],
  );

  // T091: Custom image upload
  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image too large (max 5MB)');
        return;
      }

      setUploadingImage(true);

      try {
        // Convert to base64
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Data = event.target?.result as string;

          // Load into segmentation service
          const success = await segmentationService.loadReplacementImage(
            base64Data,
          );

          if (success) {
            onEffectChange({
              ...effect,
              replacementImage: base64Data,
            });
            toast.success('Background image uploaded');
          } else {
            toast.error('Failed to load image');
          }

          setUploadingImage(false);
        };

        reader.onerror = () => {
          toast.error('Failed to read image file');
          setUploadingImage(false);
        };

        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Image upload failed:', error);
        toast.error('Image upload failed');
        setUploadingImage(false);
      }
    },
    [effect, onEffectChange],
  );

  // T093: Performance warning if GPU unavailable
  const showGPUWarning = segmentationService.isReady() && !segmentationService.isGPUEnabled();

  return (
    <div className="space-y-4">
      {/* T087: Main toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-neutral-200">
            Background Effects
          </label>
          <p className="text-xs text-neutral-500">
            Blur or remove background in camera recordings
          </p>
        </div>
        <Switch
          checked={effect.enabled}
          onCheckedChange={handleToggle}
          disabled={disabled}
        />
      </div>

      {effect.enabled && (
        <>
          {/* T088: Mode selection */}
          <div className="flex items-center gap-2">
            <Button
              variant={effect.type === 'blur' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleModeChange('blur')}
              disabled={disabled}
              className="flex-1"
            >
              <Check
                className={`w-4 h-4 mr-2 ${effect.type === 'blur' ? 'opacity-100' : 'opacity-0'}`}
              />
              Blur
            </Button>
            <Button
              variant={effect.type === 'removal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleModeChange('removal')}
              disabled={disabled}
              className="flex-1"
            >
              <Check
                className={`w-4 h-4 mr-2 ${effect.type === 'removal' ? 'opacity-100' : 'opacity-0'}`}
              />
              Remove
            </Button>
          </div>

          {/* T089: Blur intensity slider */}
          {effect.type === 'blur' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-400">
                Blur Intensity: {effect.blurIntensity ?? 50}%
              </label>
              <Slider
                value={[effect.blurIntensity ?? 50]}
                onValueChange={handleBlurIntensityChange}
                min={0}
                max={100}
                step={5}
                disabled={disabled}
                className="w-full"
              />
            </div>
          )}

          {/* T090-T091: Removal mode options */}
          {effect.type === 'removal' && (
            <div className="space-y-3">
              {/* Color picker */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-400">
                  Replacement Color
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    disabled={disabled}
                    className="w-10 h-10 rounded border-2 border-neutral-700 hover:border-neutral-500 transition-colors"
                    style={{
                      backgroundColor: effect.replacementColor ?? '#00FF00',
                    }}
                    aria-label="Pick color"
                  />
                  {showColorPicker && (
                    <div className="flex flex-wrap gap-2">
                      {[
                        '#00FF00',
                        '#0000FF',
                        '#FFFFFF',
                        '#000000',
                        '#FF0000',
                      ].map((color) => (
                        <button
                          key={color}
                          onClick={() => handleColorChange(color)}
                          className="w-8 h-8 rounded border border-neutral-700 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          aria-label={`Set color to ${color}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Image upload */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-400">
                  Custom Image
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={disabled || uploadingImage}
                    className="hidden"
                    id="bg-image-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      document.getElementById('bg-image-upload')?.click()
                    }
                    disabled={disabled || uploadingImage}
                    className="flex-1"
                  >
                    {uploadingImage ? (
                      <>
                        <div className="w-4 h-4 border-2 border-neutral-600 border-t-blue-500 rounded-full animate-spin mr-2" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Upload Image
                      </>
                    )}
                  </Button>
                  {effect.replacementImage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onEffectChange({ ...effect, replacementImage: undefined })
                      }
                      disabled={disabled}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-neutral-600">Max 5MB</p>
              </div>
            </div>
          )}

          {/* T093: GPU warning */}
          {showGPUWarning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-900/20 border border-yellow-800/50">
              <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-200">
                <p className="font-medium">GPU acceleration unavailable</p>
                <p className="text-yellow-400 mt-1">
                  Background effects running on CPU. Performance may be slower.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
