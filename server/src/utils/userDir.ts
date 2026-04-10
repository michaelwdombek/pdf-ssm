import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export function hashSub(sub: string): string {
  return createHash('sha256').update(sub).digest('hex').slice(0, 16)
}

export function getUserDirPath(storageRoot: string, sub: string): string {
  return join(storageRoot, 'users', hashSub(sub))
}

export async function ensureUserDir(storageRoot: string, sub: string): Promise<string> {
  const userDir = getUserDirPath(storageRoot, sub)
  await mkdir(join(userDir, 'signatures'), { recursive: true })
  await mkdir(join(userDir, 'stamps'), { recursive: true })
  await mkdir(join(userDir, 'documents'), { recursive: true })
  return userDir
}
