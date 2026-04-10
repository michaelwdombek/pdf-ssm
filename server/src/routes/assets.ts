import type { FastifyInstance } from 'fastify'
import { readFile, writeFile, unlink, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Config } from '../config.js'
import type { AssetMeta, UserProfile } from '../types.js'
import { ensureUserDir, getUserDirPath } from '../utils/userDir.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { loadProfile, saveProfile } from '../utils/profile.js'

const SLOT_LIMITS: Record<string, number> = { signatures: 2, stamps: 1 }
const ASSET_MAX_BYTES = 5 * 1024 * 1024 // 5MB

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function isValidType(type: string): type is 'signatures' | 'stamps' {
  return type === 'signatures' || type === 'stamps'
}

function isValidSlot(type: string, slot: number): boolean {
  return Number.isInteger(slot) && slot >= 1 && slot <= (SLOT_LIMITS[type] ?? 0)
}

function assetTypeFromDir(dir: string): 'signature' | 'stamp' {
  return dir === 'signatures' ? 'signature' : 'stamp'
}

export async function assetsRoutes(app: FastifyInstance, opts: { config: Config }): Promise<void> {
  const { config } = opts

  app.addHook('preHandler', requireAuth)

  // List all saved assets
  app.get('/api/assets', async (request) => {
    const profile = await loadProfile(config.storageRoot, request.session.userId!)
    const signatures = profile.assets.filter(a => a.type === 'signature')
    const stamps = profile.assets.filter(a => a.type === 'stamp')
    return { signatures, stamps }
  })

  // Download asset image
  app.get<{ Params: { type: string; slot: string } }>(
    '/api/assets/:type/:slot',
    async (request, reply) => {
      const { type, slot: slotStr } = request.params
      const slot = parseInt(slotStr, 10)

      if (!isValidType(type) || !isValidSlot(type, slot)) {
        return reply.code(400).send({ error: 'Invalid type or slot' })
      }

      const userDir = getUserDirPath(config.storageRoot, request.session.userId!)
      const filePath = join(userDir, type, `${type === 'signatures' ? 'sig' : 'stamp'}-${slot}.png`)

      try {
        const fileBuffer = await readFile(filePath)
        return reply.type('image/png').send(fileBuffer)
      } catch {
        return reply.code(404).send({ error: 'Asset not found' })
      }
    }
  )

  // Upload / replace asset
  app.put<{ Params: { type: string; slot: string } }>(
    '/api/assets/:type/:slot',
    async (request, reply) => {
      const { type, slot: slotStr } = request.params
      const slot = parseInt(slotStr, 10)

      if (!isValidType(type) || !isValidSlot(type, slot)) {
        return reply.code(400).send({ error: 'Invalid type or slot' })
      }

      const data = await request.file()
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' })
      }

      const buffer = await data.toBuffer()

      if (buffer.length > ASSET_MAX_BYTES) {
        return reply.code(413).send({ error: 'Asset too large (max 5MB)' })
      }

      // Validate PNG magic bytes
      if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_MAGIC)) {
        return reply.code(400).send({ error: 'File must be a PNG image' })
      }

      const userDir = await ensureUserDir(config.storageRoot, request.session.userId!)
      const fileName = `${type === 'signatures' ? 'sig' : 'stamp'}-${slot}.png`
      const filePath = join(userDir, type, fileName)

      await writeFile(filePath, buffer)

      // Read PNG dimensions from IHDR chunk (bytes 16-23)
      const width = buffer.readUInt32BE(16)
      const height = buffer.readUInt32BE(20)

      // Update profile
      const profile = await loadProfile(config.storageRoot, request.session.userId!)
      const assetMeta: AssetMeta = {
        type: assetTypeFromDir(type),
        slot,
        name: data.filename ?? fileName,
        width,
        height,
        savedAt: new Date().toISOString(),
      }

      // Replace existing entry for this slot or add new
      profile.assets = profile.assets.filter(
        a => !(a.type === assetTypeFromDir(type) && a.slot === slot)
      )
      profile.assets.push(assetMeta)
      await saveProfile(config.storageRoot, request.session.userId!, profile)

      return { ok: true, asset: assetMeta }
    }
  )

  // Delete asset
  app.delete<{ Params: { type: string; slot: string } }>(
    '/api/assets/:type/:slot',
    async (request, reply) => {
      const { type, slot: slotStr } = request.params
      const slot = parseInt(slotStr, 10)

      if (!isValidType(type) || !isValidSlot(type, slot)) {
        return reply.code(400).send({ error: 'Invalid type or slot' })
      }

      const userDir = getUserDirPath(config.storageRoot, request.session.userId!)
      const fileName = `${type === 'signatures' ? 'sig' : 'stamp'}-${slot}.png`
      const filePath = join(userDir, type, fileName)

      try {
        await unlink(filePath)
      } catch {
        // File may not exist, that's ok
      }

      // Update profile
      const profile = await loadProfile(config.storageRoot, request.session.userId!)
      profile.assets = profile.assets.filter(
        a => !(a.type === assetTypeFromDir(type) && a.slot === slot)
      )
      await saveProfile(config.storageRoot, request.session.userId!, profile)

      return { ok: true }
    }
  )
}
