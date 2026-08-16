import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  APP_ORIGINS: z.string().default('http://localhost:3001,http://localhost:3002'),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:3001'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  AUTO_MIGRATE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  GOOGLE_CLIENT_IDS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_APP_PASSWORD: z.string().optional(),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().default(465),
  AUTH_DEBUG_CODES: z.enum(['true', 'false']).optional(),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  appOrigins: string[];
  publicAppUrl: string;
  accessTokenTtl: string;
  refreshTokenDays: number;
  autoMigrate: boolean;
  googleClientIds: string[];
  resendApiKey: string | null;
  emailFrom: string;
  smtpUser: string | null;
  smtpAppPassword: string | null;
  smtpHost: string;
  smtpPort: number;
  authDebugCodes: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const smtpUser = parsed.SMTP_USER?.trim() || null;
  const authDebugCodes =
    parsed.AUTH_DEBUG_CODES === 'true' ||
    parsed.NODE_ENV === 'test' ||
    parsed.NODE_ENV === 'development';

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    jwtSecret: parsed.JWT_SECRET,
    appOrigins: parsed.APP_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    publicAppUrl: parsed.PUBLIC_APP_URL.replace(/\/$/, ''),
    accessTokenTtl: parsed.ACCESS_TOKEN_TTL,
    refreshTokenDays: parsed.REFRESH_TOKEN_DAYS,
    autoMigrate: parsed.AUTO_MIGRATE,
    googleClientIds: (parsed.GOOGLE_CLIENT_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    resendApiKey: parsed.RESEND_API_KEY ?? null,
    emailFrom:
      parsed.EMAIL_FROM?.trim() ||
      (smtpUser ? `Life OS <${smtpUser}>` : 'Life OS <onboarding@resend.dev>'),
    smtpUser,
    smtpAppPassword: parsed.SMTP_APP_PASSWORD?.replace(/\s+/g, '') || null,
    smtpHost: parsed.SMTP_HOST,
    smtpPort: parsed.SMTP_PORT,
    authDebugCodes,
  };
}
