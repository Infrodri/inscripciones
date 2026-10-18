import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { authRoutes } from './routes/authRoutes.js';
import { eventRoutes } from './routes/eventRoutes.js';
import { publicRoutes } from './routes/publicRoutes.js';
import { participantRoutes } from './routes/participantRoutes.js';
import { attendanceRoutes } from './routes/attendanceRoutes.js';
import { certificateTemplateRoutes } from './routes/certificateTemplateRoutes.js';
import { certificateRecipientRoutes } from './routes/certificateRecipientRoutes.js';
import { certificateExportRoutes } from './routes/certificateExportRoutes.js';
import { certificateMailRoutes } from './routes/certificateMailRoutes.js';
import { walkinRoutes } from './routes/walkinRoutes.js';
import { exportRoutes } from './routes/exportRoutes.js';
import { sessionRoutes } from './routes/sessionRoutes.js';
import { speakerRoutes } from './routes/speakerRoutes.js';
import { sponsorRoutes } from './routes/sponsorRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { selfCheckinAdminRoutes, selfCheckinPublicRoutes } from './routes/selfCheckinRoutes.js';
import { errorMiddleware } from './middlewares/errorMiddleware.js';
import { authMiddleware } from './middlewares/authMiddleware.js';
import { parseEnv, type AppEnv } from './env.js';
import { getPrisma } from '../infrastructure/prisma.js';
import { createStorage } from '../infrastructure/storage.js';
import { logger } from '../shared/logger.js';

export function buildApp(env: AppEnv): express.Express {
  const app = express();
  // Express detrás de proxy (Render).
  app.set('trust proxy', 1);
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      logger.info('http_request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - started,
      });
    });
    next();
  });

  const publicLimiter = rateLimit({ windowMs: 60_000, max: 30 });
  const verifyLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    message: {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Demasiadas consultas de verificación. Por favor intente más tarde.',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  // QR de sala ANTES del limitador general: tiene su propio límite de 60/min.
  app.use('/api/v1', selfCheckinPublicRoutes(env));
  app.use('/api/v1/public/certificates/verify', verifyLimiter);
  app.use('/api/v1/public/', publicLimiter);

  // Sin auth: prueba la BD con una consulta trivial.
  app.get('/health', (_req, res) => {
    getPrisma().$queryRaw`SELECT 1`
      .then(() => res.json({ ok: true }))
      .catch(() => res.status(503).json({ ok: false }));
  });

  if (env.STORAGE_DRIVER === 'disk') {
    app.use('/uploads', express.static(`${env.UPLOADS_DIR}/public`));
  }

  const storage = createStorage(env);
  app.use('/api/v1/auth', authRoutes(env.JWT_SECRET, env.JWT_EXPIRES_IN));
  app.use('/api/v1/public', publicRoutes(env, storage.publicStorage));
  app.use(
    '/api/v1/events',
    authMiddleware(env.JWT_SECRET),
    eventRoutes(storage.publicStorage, env)
  );
  app.use('/api/v1/participants', authMiddleware(env.JWT_SECRET), participantRoutes());
  app.use('/api/v1', authMiddleware(env.JWT_SECRET), attendanceRoutes());
  app.use('/api/v1', authMiddleware(env.JWT_SECRET), selfCheckinAdminRoutes(env));
  // Certificados: solo ADMIN (el router lo exige; las plantillas son privadas).
  app.use(
    '/api/v1',
    authMiddleware(env.JWT_SECRET),
    certificateTemplateRoutes(storage.privateStorage)
  );
  app.use('/api/v1', authMiddleware(env.JWT_SECRET), certificateRecipientRoutes());
  app.use(
    '/api/v1',
    authMiddleware(env.JWT_SECRET),
    certificateExportRoutes(storage.privateStorage)
  );
  app.use(
    '/api/v1',
    authMiddleware(env.JWT_SECRET),
    certificateMailRoutes(env, storage.privateStorage)
  );
  app.use('/api/v1', authMiddleware(env.JWT_SECRET), walkinRoutes());
  app.use('/api/v1', authMiddleware(env.JWT_SECRET), exportRoutes());
  app.use('/api/v1/sessions', authMiddleware(env.JWT_SECRET), sessionRoutes());
  app.use('/api/v1/speakers', authMiddleware(env.JWT_SECRET), speakerRoutes());
  app.use('/api/v1/sponsors', authMiddleware(env.JWT_SECRET), sponsorRoutes());
  app.use('/api/v1/users', authMiddleware(env.JWT_SECRET), userRoutes());
  app.use(errorMiddleware);
  return app;
}

export function start(): void {
  let env: AppEnv;
  try {
    env = parseEnv(process.env);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : 'Error de configuración');
    process.exit(1);
  }
  const app = buildApp(env);
  app.listen(env.PORT, '0.0.0.0', () => {
    logger.info('api_listening', { port: env.PORT });
  });
}

if (process.env.VITEST !== 'true') {
  start();
}

export default buildApp;
