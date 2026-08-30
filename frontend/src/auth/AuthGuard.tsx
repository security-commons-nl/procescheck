import { useEffect, useRef } from 'react'
import {
  useMsal,
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
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
  const { instance, inProgress } = useMsal()
  // Voorkomt dubbele loginRedirect-aanroepen (o.a. StrictMode double-invoke)
  const started = useRef(false)

  useEffect(() => {
    if (inProgress !== InteractionStatus.None || started.current) return
    started.current = true
    instance.loginRedirect({ scopes: apiScopes }).catch(() => {
      started.current = false
    })
  }, [instance, inProgress])

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <p className="text-gray-500 text-sm">Doorsturen naar Microsoft login…</p>
    </div>
  )
}
