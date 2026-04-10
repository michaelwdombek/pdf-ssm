export interface Config {
  port: number
  host: string
  sessionSecret: string
  oidcIssuer: string | null
  oidcClientId: string | null
  oidcClientSecret: string | null
  oidcRedirectUri: string | null
  oidcPostLogoutUri: string
  oidcScopes: string
  storageRoot: string
  maxFileSizeMb: number
  trustProxy: boolean
  devMode: boolean
}

export function isOidcConfigured(config: Config): boolean {
  return !!(config.oidcIssuer && config.oidcClientId && config.oidcClientSecret && config.oidcRedirectUri)
}

export function loadConfig(): Config {
  const devMode = process.env.DEV_MODE === 'true'

  return {
    port: parseInt(process.env.PORT ?? '3001', 10),
    host: process.env.HOST ?? '0.0.0.0',
    sessionSecret: process.env.SESSION_SECRET ?? (devMode ? 'dev-session-secret-not-for-production!!' : ''),
    oidcIssuer: process.env.OIDC_ISSUER ?? null,
    oidcClientId: process.env.OIDC_CLIENT_ID ?? null,
    oidcClientSecret: process.env.OIDC_CLIENT_SECRET ?? null,
    oidcRedirectUri: process.env.OIDC_REDIRECT_URI ?? null,
    oidcPostLogoutUri: process.env.OIDC_POST_LOGOUT_URI ?? '/',
    oidcScopes: process.env.OIDC_SCOPES ?? 'openid profile email',
    storageRoot: process.env.STORAGE_ROOT ?? './data',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB ?? '50', 10),
    trustProxy: process.env.TRUST_PROXY !== 'false',
    devMode,
  }
}
