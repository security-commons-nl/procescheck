import client from './client'
import type { RtoRpo } from '../types'

export const rtoRpoApi = {
  get: (processId: number) =>
    client.get<RtoRpo>(`/rto-rpo/${processId}`).then(r => r.data),
  upsert: (processId: number, data: Partial<RtoRpo>) =>
    client.put<RtoRpo>(`/rto-rpo/${processId}`, data).then(r => r.data),
  delete: (processId: number) =>
    client.delete(`/rto-rpo/${processId}`),
}
