import type { FieldError } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string, public errors: FieldError[] = []) {
    super(message);
  }
}

// Revision of the config this browser last loaded. Sent as If-Match, so the
// device refuses a save based on an outdated copy.
let revision = '';

export const currentRevision = () => revision;

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && revision) headers['If-Match'] = `"${revision}"`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Device not reachable');
  }

  const etag = res.headers.get('ETag');
  if (etag) revision = etag.replace(/"/g, '');

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data?.errors);
  return data as T;
}
