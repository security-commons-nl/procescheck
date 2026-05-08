import { PublicClientApplication, Configuration } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID ?? ''
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID ?? ''

export const authEnabled = Boolean(clientId && tenantId)

const msalConfig: Configuration = {
  auth: {
    clientId: clientId || 'placeholder',
    authority: `https://login.microsoftonline.com/${tenantId || 'common'}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
}

export const msalInstance = new PublicClientApplication(msalConfig)

// Scope voor de ProcesCheck API (Azure AD token)
export const apiScopes = [`api://${clientId}/user_impersonation`]
