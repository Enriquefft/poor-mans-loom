import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { ExportProgress } from '../types';

let ffmpegInstance: FFmpeg | null = null;
let isLoading = false;
let loadPromise: Promise<FFmpeg> | null = null;

const CORE_VERSION = '0.12.6';
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

export async function getFFmpeg(
  onProgress?: (progress: ExportProgress) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }
  
  if (loadPromise) {
    return loadPromise;
  }
  
  if (isLoading) {
    return new Promise((resolve) => {
      const checkLoaded = setInterval(() => {
        if (ffmpegInstance && ffmpegInstance.loaded) {
          clearInterval(checkLoaded);
          resolve(ffmpegInstance);
        }
      }, 100);
    });
  }
  
  isLoading = true;
  
  loadPromise = (async () => {
    onProgress?.({
      stage: 'preparing',
      progress: 0,
      message: 'Loading video processor...',
    });
    
    const ffmpeg = new FFmpeg();
    
    ffmpeg.on('progress', ({ progress }) => {
      onProgress?.({
        stage: 'processing',
        progress: Math.round(progress * 100),
        message: `Processing: ${Math.round(progress * 100)}%`,
      });
    });
    
    try {
      // Load FFmpeg core from CDN using UMD build (more compatible)
      const coreURL = await toBlobURL(
        `${BASE_URL}/ffmpeg-core.js`,
        'text/javascript'
      );
      const wasmURL = await toBlobURL(
        `${BASE_URL}/ffmpeg-core.wasm`,
        'application/wasm'
      );
      
      await ffmpeg.load({
        coreURL,
        wasmURL,
      });
      
      ffmpegInstance = ffmpeg;
      isLoading = false;
      
      onProgress?.({
        stage: 'preparing',
        progress: 100,
        message: 'Video processor ready',
      });
      
      return ffmpeg;
    } catch (error) {
      isLoading = false;
      loadPromise = null;
      console.error('FFmpeg load error:', error);
      throw new Error('Failed to load video processor. Please try again.');
    }
  })();
  
  return loadPromise;
}

export async function writeFileToFFmpeg(
  ffmpeg: FFmpeg,
  filename: string,
  data: Blob | Uint8Array | string
): Promise<void> {
  if (data instanceof Blob) {
    const arrayBuffer = await data.arrayBuffer();
    await ffmpeg.writeFile(filename, new Uint8Array(arrayBuffer));
  } else if (typeof data === 'string') {
    const response = await fetch(data);
    const arrayBuffer = await response.arrayBuffer();
    await ffmpeg.writeFile(filename, new Uint8Array(arrayBuffer));
  } else {
    await ffmpeg.writeFile(filename, data);
  }
}

export async function readFileFromFFmpeg(
  ffmpeg: FFmpeg,
  filename: string
): Promise<Uint8Array> {
  const data = await ffmpeg.readFile(filename);
  return data as Uint8Array;
}

export async function deleteFileFromFFmpeg(
  ffmpeg: FFmpeg,
  filename: string
): Promise<void> {
  try {
    await ffmpeg.deleteFile(filename);
  } catch {
    // File might not exist
  }
}

export function isFFmpegLoaded(): boolean {
  return ffmpegInstance !== null && ffmpegInstance.loaded;
}

export function resetFFmpeg(): void {
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
  }
  isLoading = false;
  loadPromise = null;
}
