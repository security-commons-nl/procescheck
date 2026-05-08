import { useEffect } from 'react'
import {
  useIsAuthenticated,
  useMsal,
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from '@azure/msal-react'
import { authEnabled, apiScopes } from './msalConfig'

// In dev-mode (geen Azure AD config) geeft AuthGuard altijd children terug
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  if (!authEnabled) return <>{children}</>

  return (
    <>
      <AuthenticatedTemplate>{children}</AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <LoginRedirect />
      </UnauthenticatedTemplate>
    </>
  )
}

function LoginRedirect() {
  const { instance } = useMsal()

  useEffect(() => {
    instance.loginRedirect({ scopes: apiScopes })
  }, [instance])

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <p className="text-gray-500 text-sm">Doorsturen naar Microsoft login…</p>
    </div>
  )
}
