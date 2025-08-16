// backend/src/server.ts
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors, { CorsOptions } from 'cors';
import morgan from 'morgan'; // optional: only for local proxy debugging; remove if noisy
import crypto from 'crypto';

// our unified logger
import { httpLogger, logger, isProduction, toSafeErr } from './utils/logger.js';

// ROUTES WE'RE KEEPING
import healthRoutes from './routes/healthRoutes.js';
import { workerRoutes } from './routes/workerRoutes.js';

// -------------------------------------------------------------------------------------
// CONFIG
// -------------------------------------------------------------------------------------
const app = express();

// Render/Proxies: trust X-Forwarded-* for HTTPS redirects & correct IPs
app.set('trust proxy', 1);

// Strict JSON limits (uploads go direct-to-S3 with presigned URLs)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Compression
app.use(compression());

// Security headers (loosen CSP since this is an API server)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// CORS (tight allowlist + env override)
const defaultAllowed = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://adapt-v3.vercel.app',
  'https://adaptord.com',
];
const extraAllowed = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowlist = Array.from(new Set([...defaultAllowed, ...extraAllowed]));
const corsOptions: CorsOptions = {
  origin(origin, cb) {
    // no origin (curl, health checks) -> allow
    if (!origin) return cb(null, true);
    if (allowlist.includes(origin)) return cb(null, true);
    // allow Vercel preview deployments (*.vercel.app)
    if (/\.vercel\.app$/.test(new URL(origin).hostname)) return cb(null, true);
    cb(new Error(`CORS: origin not allowed: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Accept',
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Job-Secret',
    'X-Request-Id',
    'X-Clerk-Auth',
    'X-Clerk-Signature',
    'Pragma',
    'Cache-Control',
  ],
  credentials: false, // using bearer tokens, not cookies
  maxAge: 86400,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // explicit preflight

// HTTPS-only in prod (required for mic access on mobile)
if (isProduction) {
  app.use((req, res, next) => {
    const proto = req.get('x-forwarded-proto');
    if (proto && proto !== 'https') {
      const url = new URL(req.originalUrl, `https://${req.headers.host}`);
      return res.redirect(308, url.toString());
    }
    next();
  });
}

// Structured HTTP logs (pino)
app.use(httpLogger);

// OPTIONAL: dev-friendly one-liner for quick tailing (remove if noisy)
if (process.env.DEV_MORGAN === 'true') {
  app.use(morgan('dev'));
}

// Attach/propagate a request id header
app.use((req, res, next) => {
  const reqId = (req as any).id || req.get('x-request-id') || crypto.randomUUID();
  (req as any).id = reqId;
  res.setHeader('x-request-id', reqId);
  next();
});

// -------------------------------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------------------------------

// Health & diagnostics (JSON only; no UI banners)
app.use('/api', healthRoutes);

// Background worker (QStash / internal)
app.use('/api/worker', workerRoutes);

// NOTE: DO NOT mount legacy/duplicate upload routes:
// - enhancedUploadRoutes, multipartRoutes, legacy uploadController
// We’re S3-direct only. Add only the presign + enqueue endpoints you keep.

// Example (when you add your presign controller):
// import presignedUploadRoutes from './routes/presignedUploadRoutes.js';
// app.use('/api/upload', presignedUploadRoutes);

// -------------------------------------------------------------------------------------
// 404
// -------------------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// -------------------------------------------------------------------------------------
// ERROR HANDLER
// -------------------------------------------------------------------------------------
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || 500;
  const safe = toSafeErr(err);
  logger.error(
    {
      err: safe,
      status,
      path: req.path,
      method: req.method,
      reqId: (req as any).id,
    },
    'unhandled error'
  );

  // Avoid leaking stack in prod
  res.status(status).json({
    error: safe.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' ? { details: safe } : {}),
  });
});

// -------------------------------------------------------------------------------------
// BOOT
// -------------------------------------------------------------------------------------
const PORT = Number(process.env.PORT || 8000);
app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'server started');
});

export default app;
