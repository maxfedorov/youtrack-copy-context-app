/* eslint-disable @typescript-eslint/no-explicit-any */

export const extractResult = (response: unknown): any => {
  if (response && typeof response === 'object' && 'result' in (response as object)) {
    return (response as any).result;
  }
  return response;
};

export function safe<T>(val: T | undefined | null, def: T): T {
  return (val === undefined || val === null ? def : val);
}

export function humanDate(ts?: number): string {
  if (!ts) { return ''; }
  try {
    return new Date(ts).toISOString();
  } catch {
    return '';
  }
}

export function bytesToSize(bytes?: number): string {
  const b = bytes || 0;
  if (b === 0) { return '0 B'; }
  const k = 1024;
  const DECIMALS = 2;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(DECIMALS)} ${sizes[i]}`;
}

function copyWithTextarea(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
  } catch {
    return false;
  }
}

// Tries Clipboard API first; falls back to execCommand-based copy
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ignore and fallback
  }
  return copyWithTextarea(text);
}
