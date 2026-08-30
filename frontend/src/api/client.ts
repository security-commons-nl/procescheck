import axios from 'axios'
import { msalInstance, apiScopes, authEnabled } from '../auth/msalConfig'

const client = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// Voeg Bearer token toe aan elke request als Azure AD auth is ingeschakeld
client.interceptors.request.use(async (config) => {
  if (!authEnabled) return config

  const accounts = msalInstance.getAllAccounts()
  if (accounts.length === 0) return config

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: apiScopes,
      account: accounts[0],
    })
    config.headers.Authorization = `Bearer ${result.accessToken}`
  } catch {
    // Token kon niet stilzwijgend worden vernieuwd — redirect naar login en
    // breek deze request af zodat hij niet zonder token wordt verstuurd.
    await msalInstance.acquireTokenRedirect({ scopes: apiScopes })
    throw new axios.CanceledError('Doorsturen naar Microsoft login')
  }

  return config
})

/** Leesbare foutmelding uit een API-error (FastAPI `detail` of axios message). */
export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map(d => (typeof d === 'object' && d !== null && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d)))
        .join('; ')
    }
  }
  return err instanceof Error ? err.message : String(err)
}

export default client
