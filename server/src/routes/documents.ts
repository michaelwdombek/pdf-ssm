import type { FastifyInstance } from 'fastify'
import { readFile, writeFile, unlink, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Config } from '../config.js'
import type { DocumentMeta } from '../types.js'
import { ensureUserDir, getUserDirPath } from '../utils/userDir.js'
import { requireAuth } from '../middleware/requireAuth.js'

const PDF_MAGIC = Buffer.from('%PDF-')

export async function documentsRoutes(app: FastifyInstance, opts: { config: Config }): Promise<void> {
  const { config } = opts

  app.addHook('preHandler', requireAuth)

  // Get saved document metadata
  app.get('/api/documents/current', async (request, reply) => {
    const userDir = getUserDirPath(config.storageRoot, request.session.userId!)
    const metaPath = join(userDir, 'documents', 'current-meta.json')

    try {
      const raw = await readFile(metaPath, 'utf-8')
      return JSON.parse(raw) as DocumentMeta
    } catch {
      return reply.code(404).send({ error: 'No saved document' })
    }
  })

  // Download saved PDF
  app.get('/api/documents/current/file', async (request, reply) => {
    const userDir = getUserDirPath(config.storageRoot, request.session.userId!)
    const filePath = join(userDir, 'documents', 'current.pdf')

    try {
      const fileBuffer = await readFile(filePath)
      return reply.type('application/pdf').send(fileBuffer)
    } catch {
      return reply.code(404).send({ error: 'No saved document' })
    }
  })

  // Get saved annotations
  app.get('/api/documents/current/annotations', async (request, reply) => {
    const userDir = getUserDirPath(config.storageRoot, request.session.userId!)
    const annotPath = join(userDir, 'documents', 'current-annotations.json')

    try {
      const raw = await readFile(annotPath, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return reply.code(404).send({ error: 'No saved annotations' })
    }
  })

  // Save document (multipart: PDF file + annotations JSON + meta JSON)
  app.put('/api/documents/current', async (request, reply) => {
    const parts = request.parts()
    let pdfBuffer: Buffer | null = null
    let annotations: string | null = null
    let meta: { fileName: string; pageCount: number } | null = null

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        pdfBuffer = await part.toBuffer()
      } else if (part.type === 'field') {
        if (part.fieldname === 'annotations') {
          annotations = part.value as string
        } else if (part.fieldname === 'meta') {
          meta = JSON.parse(part.value as string)
        }
      }
    }

    if (!pdfBuffer || !meta) {
      return reply.code(400).send({ error: 'Missing file or metadata' })
    }

    // Validate PDF magic bytes
    if (pdfBuffer.length < 5 || !pdfBuffer.subarray(0, 5).equals(PDF_MAGIC)) {
      return reply.code(400).send({ error: 'File must be a PDF document' })
    }

    const maxBytes = config.maxFileSizeMb * 1024 * 1024
    if (pdfBuffer.length > maxBytes) {
      return reply.code(413).send({ error: `Document too large (max ${config.maxFileSizeMb}MB)` })
    }

    const userDir = await ensureUserDir(config.storageRoot, request.session.userId!)
    const docsDir = join(userDir, 'documents')

    // Write PDF
    await writeFile(join(docsDir, 'current.pdf'), pdfBuffer)

    // Write annotations (if provided)
    if (annotations) {
      await writeFile(join(docsDir, 'current-annotations.json'), annotations, 'utf-8')
    }

    // Write metadata
    const docMeta: DocumentMeta = {
      fileName: meta.fileName,
      pageCount: meta.pageCount,
      savedAt: new Date().toISOString(),
      sizeBytes: pdfBuffer.length,
    }
    await writeFile(join(docsDir, 'current-meta.json'), JSON.stringify(docMeta, null, 2), 'utf-8')

    return { ok: true, meta: docMeta }
  })

  // Delete saved document
  app.delete('/api/documents/current', async (request, reply) => {
    const userDir = getUserDirPath(config.storageRoot, request.session.userId!)
    const docsDir = join(userDir, 'documents')

    const files = ['current.pdf', 'current-annotations.json', 'current-meta.json']
    for (const file of files) {
      try {
        await unlink(join(docsDir, file))
      } catch {
        // File may not exist
      }
    }

    return { ok: true }
  })
}
