/** Allowed browser origins for local Vite dev (REST + Socket.IO). */

export const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
] as const;

/** Extra origins from env, e.g. `CORS_ORIGINS=http://1.2.3.4` or `CORS_ORIGINS=*`. */
export function resolveAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw === '*') {
    return [];
  }
  const fromEnv =
    raw?.split(',').map((o) => o.trim()).filter(Boolean) ?? [];
  return [...LOCAL_DEV_ORIGINS, ...fromEnv];
}

/** `true` = allow any browser origin (set `CORS_ORIGINS=*`). */
export function resolveCorsOrigin():
  | boolean
  | string[]
  | ((
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => void) {
  if (process.env.CORS_ORIGINS?.trim() === '*') {
    return true;
  }
  const allowed = resolveAllowedOrigins();
  return (origin, callback) => {
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  };
}

export function resolveHttpCors() {
  return {
    origin: resolveCorsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const,
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

export function resolveSocketCors() {
  return {
    origin: resolveCorsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

export function logCorsConfig(): void {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw === '*') {
    console.log('CORS: allow all origins (CORS_ORIGINS=*)');
    return;
  }
  if (raw) {
    console.log(`CORS: dev localhost + ${raw}`);
    return;
  }
  console.warn(
    'CORS: only localhost — browser on VPS IP will fail Socket.IO. Set CORS_ORIGINS=http://YOUR_IP',
  );
}

/** @deprecated Use resolveHttpCors() — kept for tests importing the shape. */
export const LOCAL_DEV_HTTP_CORS = {
  origin: [...LOCAL_DEV_ORIGINS],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const,
  allowedHeaders: ['Content-Type', 'Authorization'],
};

/** @deprecated Use resolveSocketCors(). */
export const LOCAL_DEV_SOCKET_CORS = {
  origin: [...LOCAL_DEV_ORIGINS],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
