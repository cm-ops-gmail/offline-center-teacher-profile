'use client';
import { useEffect, useState } from 'react';

const KEY = 'collect-access-key';

export class AccessKeyError extends Error {}

export const getAccessKey = (): string => {
  try {
    return sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};
export const setAccessKey = (v: string) => {
  try {
    sessionStorage.setItem(KEY, v);
  } catch {}
};

/** fetch → JSON, sending the access key, turning errors into readable messages. */
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const key = getAccessKey();
  if (key) headers.set('x-access-key', key);
  const res = await fetch(url, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && json.error === 'ACCESS_KEY_REQUIRED') throw new AccessKeyError('Enter the access key to continue.');
  if (!res.ok) throw Object.assign(new Error(json.error ?? `Request failed (${res.status})`), { status: res.status, code: json.error });
  return json as T;
}

/** Vercel rejects request bodies over 4.5 MB, so files are kept under this. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Phone photos are huge; shrink to ~2000px JPEG before uploading. PDFs pass through untouched. */
export async function prepareFile(file: File): Promise<File> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('This PDF is over 4 MB. Scan at a lower quality (150 dpi, greyscale) or split it into two files.');
    return file;
  }
  if (!file.type.startsWith('image/')) throw new Error('Use a JPG, PNG or WebP photo, or a PDF.');
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of [0.88, 0.75, 0.6]) {
      blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error('too large');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    throw new Error('Could not prepare this photo (it may be too large, or an iPhone HEIC image — export it as JPG first).');
  }
}

export interface Lookups {
  branches: string[];
  batches: string[];
  levels: string[];
  accessKeyRequired: boolean;
  ocrConfigured: boolean;
  production: boolean;
}

export function useLookups() {
  const [data, setData] = useState<Lookups | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Lookups>('/api/collect/lookups').then(setData, (e: Error) => setError(e.message));
  }, []);
  return { data, error };
}

/** Runs `worker` over `items` with at most `limit` in flight. */
export async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    }),
  );
}
