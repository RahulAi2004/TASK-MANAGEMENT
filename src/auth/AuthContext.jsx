import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, setToken, hasToken } from '../data/api'

const AuthContext = createContext(null)

const SUITE_DOMAIN = '.decoinkssuite.com'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Why SSO didn't sign this visitor in — shown on the login screen so someone
  // who has suite access but no task-app account knows what to ask for.
  const [ssoError, setSsoError] = useState(null)

  useEffect(() => {
    let alive = true

    const bootstrap = async () => {
      if (hasToken()) {
        try {
          const d = await api.me()
          if (alive) setUser(d.user)
          return
        } catch {
          setToken(null) // expired or revoked — fall through to SSO
        }
      }
      // On tasks.decoinkssuite.com the Authentik forward-auth has already
      // identified the visitor, so trade those headers for a token rather than
      // asking for a password. Anywhere else this 403s and the form shows.
      try {
        const d = await api.sso()
        setToken(d.token)
        if (alive) setUser(d.user)
      } catch (err) {
        if (!alive) return
        setUser(null)
        // 'SSO unavailable' just means we're off the suite domain — not worth
        // showing. Anything else is a real reason the person can act on.
        if (err.message && err.message !== 'SSO unavailable') setSsoError(err.message)
      }
    }

    bootstrap().finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const d = await api.login(email, password)
    setToken(d.token)
    setUser(d.user)
    setSsoError(null)
    return d.user
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    // Under SSO, dropping only the local token would silently sign the user
    // back in on the next load — end the Authentik session instead.
    if (window.location.hostname.endsWith(SUITE_DOMAIN)) {
      window.location.replace('/outpost.goauthentik.io/sign_out')
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, ssoError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

/** Simple data hook: const {data, loading, error, reload} = useApi(() => api.tasks({...}), [deps]) */
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((e) => alive && setState({ data: null, loading: false, error: e.message }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { ...state, reload: () => setTick((t) => t + 1) }
}

export function initials(name = '') {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
