process.env.DATABASE_URL ??=
  'postgresql://inscripciones:inscripciones@localhost:5434/inscripciones';
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= 'clave-de-prueba-larga-123';
process.env.JWT_EXPIRES_IN ??= '24h';
process.env.CORS_ORIGINS ??= 'http://localhost:3000';
process.env.STORAGE_DRIVER ??= 'disk';
process.env.UPLOADS_DIR ??= './uploads-test';
process.env.NODE_ENV ??= 'test';
process.env.FONTS_DIR ??= './assets/fonts';
