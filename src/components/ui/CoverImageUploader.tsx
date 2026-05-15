'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { resolveCoverImage } from '@/lib/api/trips.api';

interface Props {
  /** Current image URL (may be relative `/uploads/...`). */
  value: string | null | undefined;
  onSelect: (file: File) => Promise<void> | void;
  onClear?: () => void;
  uploading?: boolean;
  className?: string;
  /** Visual variant: card (full aspect-video) or inline (compact). */
  variant?: 'card' | 'inline';
}

export function CoverImageUploader({
  value, onSelect, onClear, uploading = false, className = '', variant = 'card',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const display = previewUrl ?? resolveCoverImage(value);

  function pick() {
    inputRef.current?.click();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError('');
    if (file.size > 5 * 1024 * 1024) {
      setError('檔案不能超過 5 MB');
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('只接受 JPG / PNG / WEBP');
      return;
    }
    const local = URL.createObjectURL(file);
    setPreviewUrl(local);
    try {
      await onSelect(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : '上傳失敗');
      setPreviewUrl(null);
    }
  }

  if (variant === 'inline') {
    return (
      <div className={className}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          {value ? '更換封面' : '上傳封面'}
        </button>
        {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 group">
        {display ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={display} alt="封面" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={pick}
                disabled={uploading}
                className="inline-flex items-center gap-1 bg-white/95 text-slate-900 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md hover:bg-white cursor-pointer disabled:opacity-60"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                更換封面
              </button>
              {onClear && !uploading && (
                <button
                  type="button"
                  onClick={() => { setPreviewUrl(null); onClear(); }}
                  className="inline-flex items-center gap-1 bg-white/95 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md hover:bg-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  移除
                </button>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={pick}
            disabled={uploading}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50/40 cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <ImagePlus className="w-7 h-7" strokeWidth={1.5} />
            )}
            <span className="text-xs font-medium">點此上傳封面（JPG / PNG / WEBP，5 MB 內）</span>
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

export default CoverImageUploader;
