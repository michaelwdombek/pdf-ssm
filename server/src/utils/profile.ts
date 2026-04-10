import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { UserProfile } from '../types.js'
import { ensureUserDir, getUserDirPath } from './userDir.js'

export async function loadProfile(storageRoot: string, userId: string): Promise<UserProfile> {
  const userDir = getUserDirPath(storageRoot, userId)
  const profilePath = join(userDir, 'profile.json')

  try {
    const raw = await readFile(profilePath, 'utf-8')
    return JSON.parse(raw) as UserProfile
  } catch {
    // No profile yet — return empty
    return {
      userId,
      displayName: '',
      email: '',
      createdAt: new Date().toISOString(),
      assets: [],
    }
  }
}

export async function saveProfile(
  storageRoot: string,
  userId: string,
  profile: UserProfile
): Promise<void> {
  const userDir = await ensureUserDir(storageRoot, userId)
  const profilePath = join(userDir, 'profile.json')
  await writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf-8')
}
