import type { FastifyInstance } from 'fastify'
import { mkdir } from 'node:fs/promises'
import type { Config } from '../config.js'
import { assetsRoutes } from '../routes/assets.js'
import { documentsRoutes } from '../routes/documents.js'

interface StoragePluginOpts {
  config: Config
}

export async function storagePlugin(app: FastifyInstance, opts: StoragePluginOpts): Promise<void> {
  const { config } = opts

  // Ensure storage root exists
  await mkdir(config.storageRoot, { recursive: true })

  // Register route modules
  await app.register(assetsRoutes, { config })
  await app.register(documentsRoutes, { config })
}
