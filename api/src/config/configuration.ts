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
  /** Where an invite tells a new colleague to sign in. */
  signInUrl: string;
  storage: {
    /** Where uploaded files are written. A mounted volume in Compose. */
    root: string;
  };
  ai: {
    /** The bridge that runs the Claude CLI on the host. Empty disables AI. */
    bridgeUrl: string;
    bridgeToken: string;
    timeoutMs: number;
  };
  mail: {
    acsConnectionString: string;
    acsSenderAddress: string;
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
    // The first CORS origin is where the browser loads the app from, which is
    // exactly the address an invite has to send someone to.
    signInUrl: `${(process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim()}/login`,
    corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    storage: {
      root: process.env.STORAGE_ROOT ?? './storage',
    },
    ai: {
      /**
       * Empty by default: an install without the bridge running should say
       * the feature is not set up, not fail on a connection refused.
       */
      bridgeUrl: process.env.AI_BRIDGE_URL ?? '',
      bridgeToken: process.env.AI_BRIDGE_TOKEN ?? '',
      timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 150000),
    },
    mail: {
      /**
       * Delivery provider, chosen by what is configured rather than by a flag:
       * Azure Communication Services if it has a connection string, SMTP if it
       * has a host, otherwise nothing leaves the building and the attempt is
       * only recorded in the outbox.
       */
      acsConnectionString: process.env.ACS_EMAIL_CONNECTION_STRING ?? '',
      /**
       * Must be a verified sender on the ACS domain. Azure rejects anything
       * else outright, so it is worth checking before blaming the code.
       */
      acsSenderAddress: process.env.ACS_SENDER_ADDRESS ?? '',
      host: process.env.SMTP_HOST ?? '',
      port: Number(process.env.SMTP_PORT ?? 587),
      user: process.env.SMTP_USER ?? '',
      password: process.env.SMTP_PASSWORD ?? '',
      from: process.env.MAIL_FROM ?? 'payroll@peoplepay360.com',
    },
  };
};
