/* eslint-disable @typescript-eslint/no-explicit-any */

import type {HostAPI} from '../../../@types/globals.d';
import {copyToClipboard} from './clipboard';
export {copyToClipboard};

export const DEFAULT_TEMPLATE = '[{{id}}]({{url}}) {{summary}}';

export interface EntityInfo {
  id: string;
  url: string;
  summary: string;
}

export interface TemplateResponse {
  template: string;
}

export interface BackendResponse<T> {
  result?: T;
}

export function extractResult<T>(data: BackendResponse<T> | T): T {
  if (data != null && typeof data === 'object' && 'result' in data) {
    return (data as BackendResponse<T>).result as T;
  }
  return data as T;
}

export function buildMarkdownLink(template: string, entity: EntityInfo): string {
  return template
    .replace(/\{\{id}}/g, entity.id)
    .replace(/\{\{url}}/g, entity.url)
    .replace(/\{\{summary}}/g, entity.summary);
}

function normalizeEntity(data: BackendResponse<EntityInfo> | EntityInfo): EntityInfo {
  const entity = extractResult(data);
  return {
    id: entity?.id || '',
    url: entity?.url || '',
    summary: entity?.summary || ''
  };
}

function resolveTemplate(data: BackendResponse<TemplateResponse> | TemplateResponse): string {
  const result = extractResult(data);
  return result?.template || DEFAULT_TEMPLATE;
}

export async function fetchEntityAndTemplate(
  host: HostAPI,
  infoEndpoint: string
): Promise<string> {
  const [entityData, templateData] = await Promise.all([
    host.fetchApp<BackendResponse<EntityInfo> | EntityInfo>(infoEndpoint, {scope: true}),
    host.fetchApp<BackendResponse<TemplateResponse> | TemplateResponse>('backend/get-template', {scope: true})
  ]);
  return buildMarkdownLink(resolveTemplate(templateData), normalizeEntity(entityData));
}

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


/**
 * Wraps text in a markdown code block, using a fence length (backticks) 
 * one greater than the longest sequence of backticks in the text.
 */
export function wrapInCodeBlock(text: string, lang: string = 'markdown'): string {
  const trimmed = (text || '').trim();
  if (!trimmed) { return ''; }

  const matches = trimmed.match(/`+/g);
  const maxBackticks = matches ? Math.max(...matches.map(m => m.length)) : 0;
  const MIN_FENCE_LENGTH = 3;
  const fenceLength = Math.max(MIN_FENCE_LENGTH, maxBackticks + 1);
  const fence = '`'.repeat(fenceLength);

  return `${fence}${lang}\n${trimmed}\n${fence}`;
}

export interface UserRef { login?: string; fullName?: string }
export interface ProjectRef { shortName?: string; name?: string }
export interface TagRef { name?: string }
export interface AttachmentRef { id?: string; name?: string; url?: string; size?: number; mimeType?: string; created?: number; author?: UserRef }

export interface ActivityItem { author?: UserRef; timestamp?: number; category?: { id?: string }; added?: any; removed?: any }

export function extractComments(activities: ActivityItem[]): { author?: string; text?: string; timestamp?: number }[] {
  const res: { author?: string; text?: string; timestamp?: number }[] = [];
  // eslint-disable-next-line complexity
  activities.forEach(act => {
    try {
      const isCommentCat = (act.category?.id || '').toLowerCase().includes('comment');
      if (!isCommentCat) { return; }
      const author = act.author?.fullName || act.author?.login || '';
      const extractText = (val: any): string[] => {
        if (!val) { return []; }
        const arr = Array.isArray(val) ? val : [val];
        return arr.map(v => {
          if (!v) { return ''; }
          if (typeof v === 'string') { return v; }
          if (typeof v === 'object' && 'text' in v && typeof (v as any).text === 'string') { return (v as any).text; }
          return '';
        }).filter(Boolean);
      };
      const texts = [...extractText(act.added), ...extractText(act.removed)];
      texts.forEach(t => res.push({author, text: t, timestamp: act.timestamp}));
    } catch { /* ignore item */ }
  });
  return res;
}
