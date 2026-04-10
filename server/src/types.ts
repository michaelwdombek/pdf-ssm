declare module 'fastify' {
  interface Session {
    userId?: string
    displayName?: string
    email?: string
    accessToken?: string
    refreshToken?: string
    idToken?: string
    tokenExpiresAt?: number
    codeVerifier?: string
    returnTo?: string
  }
}

export interface AssetMeta {
  type: 'signature' | 'stamp'
  slot: number
  name: string
  width: number
  height: number
  savedAt: string
}

export interface UserProfile {
  userId: string
  displayName: string
  email: string
  createdAt: string
  assets: AssetMeta[]
}

export interface DocumentMeta {
  fileName: string
  pageCount: number
  savedAt: string
  sizeBytes: number
}
