/** Typed application configuration loaded once at bootstrap. */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  corsOrigins: string[];
  mail: {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  };
}

export default (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const jwtSecret = process.env.JWT_SECRET ?? '';

  // A weak secret in production would let anyone mint a valid admin token, so
  // fail fast at boot rather than silently accepting a default.
  if (nodeEnv === 'production' && jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set to at least 32 characters when NODE_ENV=production.'
    );
  }

  return {
    nodeEnv,
    port: Number(process.env.PORT ?? 4000),
    databaseUrl: process.env.DATABASE_URL ?? '',
    jwt: {
      secret: jwtSecret || 'peoplepay360-development-secret-do-not-use-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    },
    corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    mail: {
      host: process.env.SMTP_HOST ?? '',
      port: Number(process.env.SMTP_PORT ?? 587),
      user: process.env.SMTP_USER ?? '',
      password: process.env.SMTP_PASSWORD ?? '',
      from: process.env.MAIL_FROM ?? 'payroll@peoplepay360.com',
    },
  };
};
