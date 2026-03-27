import client from './client'
import type { BusinessContext } from '../types'

export const businessContextApi = {
  get: (processId: number) =>
    client.get<BusinessContext>(`/business-context/${processId}`).then(r => r.data),
  upsert: (processId: number, data: Partial<BusinessContext>) =>
    client.put<BusinessContext>(`/business-context/${processId}`, data).then(r => r.data),
  delete: (processId: number) =>
    client.delete(`/business-context/${processId}`),
}
