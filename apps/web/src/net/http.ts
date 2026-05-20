export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  const base =
    typeof configured === 'string' && configured.trim().length > 0
      ? configured.trim()
      : 'http://localhost:3000';
  return base.replace(/\/$/, '');
}

export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

type HttpErrorBody = {
  code?: string;
  message?: string;
};

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let code: string | undefined;
    let message = res.statusText || 'Request failed';
    try {
      const body = (await res.json()) as HttpErrorBody;
      if (typeof body.code === 'string') code = body.code;
      if (typeof body.message === 'string' && body.message.length > 0) {
        message = body.message;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new HttpError(message, res.status, code);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
