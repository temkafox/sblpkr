/** Allowed browser origins for local Vite dev (REST + Socket.IO). */

export const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
] as const;

/** Extra origins from env, e.g. `CORS_ORIGINS=http://1.2.3.4,https://poker.example.com`. */
export function resolveAllowedOrigins(): string[] {
  const fromEnv =
    process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ??
    [];
  return [...LOCAL_DEV_ORIGINS, ...fromEnv];
}

export function resolveHttpCors() {
  return {
    origin: resolveAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const,
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

export function resolveSocketCors() {
  return {
    origin: resolveAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
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
