import type {HostAPI} from '../../@types/globals.d';
import {DEFAULT_TEMPLATE} from './types';
import type {EntityInfo, TemplateResponse, BackendResponse} from './types';

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
