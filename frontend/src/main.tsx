import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MsalProvider } from '@azure/msal-react'
import { msalInstance, authEnabled } from './auth/msalConfig'
import './index.css'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

const tree = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)

createRoot(document.getElementById('root')!).render(
  authEnabled ? <MsalProvider instance={msalInstance}>{tree}</MsalProvider> : tree,
)
