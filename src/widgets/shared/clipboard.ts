import type {RefObject} from 'react';

export async function copyWithNavigator(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ignore, will fallback
  }
  return false;
}

export function copyWithInputRef(inputRef: RefObject<HTMLInputElement | null>): boolean {
  if (inputRef.current) {
    inputRef.current.select();
    return document.execCommand('copy');
  }
  return false;
}

export function copyWithTextarea(text: string): boolean {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textArea);
  return ok;
}
