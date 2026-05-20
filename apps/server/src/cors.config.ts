/** Allowed browser origins for local Vite dev (REST + Socket.IO). */

export const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
] as const;

export const LOCAL_DEV_HTTP_CORS = {
  origin: [...LOCAL_DEV_ORIGINS],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const,
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export const LOCAL_DEV_SOCKET_CORS = {
  origin: [...LOCAL_DEV_ORIGINS],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
