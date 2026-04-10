import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { UserInfo } from '../types'

interface AuthState {
  isLoading: boolean
  isAuthenticated: boolean
  user: UserInfo | null
}

interface AuthContextValue {
  auth: AuthState
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
  })

  useEffect(() => {
    let cancelled = false

    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'same-origin' })
        if (!cancelled && response.ok) {
          const user: UserInfo = await response.json()
          setAuth({ isLoading: false, isAuthenticated: true, user })
        } else if (!cancelled) {
          setAuth({ isLoading: false, isAuthenticated: false, user: null })
        }
      } catch {
        // Backend not available — graceful degradation, local-only mode
        if (!cancelled) {
          setAuth({ isLoading: false, isAuthenticated: false, user: null })
        }
      }
    }

    checkAuth()
    return () => { cancelled = true }
  }, [])

  function login() {
    window.location.href = '/api/auth/login'
  }

  function logout() {
    window.location.href = '/api/auth/logout'
  }

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
