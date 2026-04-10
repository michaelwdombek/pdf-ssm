import type { FastifyInstance } from 'fastify'
import * as client from 'openid-client'
import { type Config, isOidcConfigured } from '../config.js'

interface AuthPluginOpts {
  config: Config
}

export async function authPlugin(app: FastifyInstance, opts: AuthPluginOpts): Promise<void> {
  const { config } = opts

  if (!isOidcConfigured(config)) {
    // No OIDC configured — register dev-mode auth routes
    registerDevAuthRoutes(app, config)
    return
  }

  // Discover OIDC provider configuration
  const issuerUrl = new URL(config.oidcIssuer!)
  const oidcConfig = await client.discovery(issuerUrl, config.oidcClientId!, config.oidcClientSecret!)

  // --- Login: redirect to IdP ---
  app.get('/api/auth/login', async (request, reply) => {
    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)

    request.session.codeVerifier = codeVerifier
    request.session.returnTo = (request.query as Record<string, string>).returnTo ?? '/'
    await request.session.save()

    const authUrl = client.buildAuthorizationUrl(oidcConfig, {
      redirect_uri: config.oidcRedirectUri!,
      scope: config.oidcScopes,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    return reply.redirect(authUrl.href)
  })

  // --- Callback: exchange code for tokens ---
  app.get('/api/auth/callback', async (request, reply) => {
    const codeVerifier = request.session.codeVerifier
    if (!codeVerifier) {
      return reply.code(400).send({ error: 'Missing code verifier in session' })
    }

    const currentUrl = new URL(request.url, config.oidcRedirectUri!)
    const tokens = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: client.skipStateCheck,
    })

    const claims = tokens.claims()!
    const userinfo = await client.fetchUserInfo(oidcConfig, tokens.access_token, claims.sub)

    request.session.userId = claims.sub
    request.session.displayName =
      userinfo.name ??
      userinfo.preferred_username ??
      claims.sub
    request.session.email = (userinfo.email as string) ?? ''
    request.session.accessToken = tokens.access_token
    request.session.refreshToken = tokens.refresh_token
    request.session.idToken = tokens.id_token!
    request.session.tokenExpiresAt = Date.now() + (tokens.expires_in ?? 3600) * 1000

    delete request.session.codeVerifier
    const returnTo = request.session.returnTo ?? '/'
    delete request.session.returnTo
    await request.session.save()

    return reply.redirect(returnTo)
  })

  // --- Logout ---
  app.get('/api/auth/logout', async (request, reply) => {
    const idToken = request.session.idToken

    request.session.destroy()

    if (idToken && oidcConfig.serverMetadata().end_session_endpoint) {
      const logoutUrl = client.buildEndSessionUrl(oidcConfig, {
        id_token_hint: idToken,
        post_logout_redirect_uri: config.oidcPostLogoutUri,
      })
      return reply.redirect(logoutUrl.href)
    }

    return reply.redirect(config.oidcPostLogoutUri)
  })

  // --- Current user info ---
  app.get('/api/auth/me', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' })
    }

    return {
      userId: request.session.userId,
      displayName: request.session.displayName,
      email: request.session.email,
    }
  })
}

/**
 * Dev-mode auth: no OIDC provider needed.
 * GET /api/auth/login sets a dev session immediately and redirects back.
 */
function registerDevAuthRoutes(app: FastifyInstance, config: Config): void {
  app.log.warn('OIDC not configured — running with dev-mode auth (auto-login as dev-user)')

  app.get('/api/auth/login', async (request, reply) => {
    request.session.userId = 'dev-user'
    request.session.displayName = 'Dev User'
    request.session.email = 'dev@localhost'
    request.session.accessToken = 'dev-token'
    request.session.tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000
    await request.session.save()

    const returnTo = (request.query as Record<string, string>).returnTo ?? '/'
    return reply.redirect(returnTo)
  })

  app.get('/api/auth/callback', async (_request, reply) => {
    return reply.redirect('/')
  })

  app.get('/api/auth/logout', async (request, reply) => {
    request.session.destroy()
    return reply.redirect('/')
  })

  app.get('/api/auth/me', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' })
    }

    return {
      userId: request.session.userId,
      displayName: request.session.displayName,
      email: request.session.email,
    }
  })
}
