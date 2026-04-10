import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import fastifyMultipart from '@fastify/multipart'
import fastifyRateLimit from '@fastify/rate-limit'
import { loadConfig, isOidcConfigured } from './config.js'
import { authPlugin } from './plugins/auth.js'
import { storagePlugin } from './plugins/storage.js'

const config = loadConfig()

// Validate config at startup
if (!config.sessionSecret) {
  console.error('SESSION_SECRET is required (or set DEV_MODE=true for development)')
  process.exit(1)
}

if (!isOidcConfigured(config) && !config.devMode) {
  console.error('OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_REDIRECT_URI are required.')
  console.error('Set DEV_MODE=true to run without OIDC (dev-mode auto-login).')
  process.exit(1)
}

const app = Fastify({
  logger: true,
  trustProxy: config.trustProxy,
  bodyLimit: config.maxFileSizeMb * 1024 * 1024,
})

// Plugins
await app.register(fastifyCookie)
await app.register(fastifySession, {
  secret: config.sessionSecret,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  },
  saveUninitialized: false,
})
await app.register(fastifyMultipart, {
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
  },
})
await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '1 minute',
})

// App plugins
await app.register(authPlugin, { config })
await app.register(storagePlugin, { config })

// Health check
app.get('/api/health', async () => ({ status: 'ok' }))

// Catch-all: if someone hits the backend directly, tell them where the frontend is
app.setNotFoundHandler(async (_request, reply) => {
  reply.code(404).send({
    error: 'Not found',
    hint: 'This is the SignDesk API server. Open the frontend at http://localhost:5173 during development.',
  })
})

// Start
try {
  await app.listen({ port: config.port, host: config.host })
  app.log.info(`SignDesk server listening on ${config.host}:${config.port}`)
  if (config.devMode) {
    app.log.info('DEV_MODE enabled — click "Sign In" to auto-login as dev-user')
  }
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
