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
