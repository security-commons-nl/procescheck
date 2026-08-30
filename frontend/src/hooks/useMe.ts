import { useQuery } from '@tanstack/react-query'
import client from '../api/client'

export interface Me {
  email?: string | null
  name?: string | null
  role: 'lezer' | 'redacteur' | 'beheerder'
  rbac_enforced: boolean
}

/**
 * Ingelogde gebruiker + rol. Zolang RBAC niet is afgedwongen geeft de
 * backend iedereen 'beheerder', zodat de UI onveranderd blijft.
 */
export function useMe() {
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: () => client.get<Me>('/me').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const role = data?.role ?? 'beheerder'
  return {
    me: data,
    role,
    canEdit: role !== 'lezer',
    isAdmin: role === 'beheerder',
  }
}
