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
    // Token kon niet stilzwijgend worden vernieuwd — redirect naar login
    await msalInstance.acquireTokenRedirect({ scopes: apiScopes })
  }

  return config
})

export default client
