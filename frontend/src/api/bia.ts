import client from './client'
import type { BiaAssessment } from '../types'

export const biaApi = {
  get: (processId: number) =>
    client.get<BiaAssessment>(`/bia/${processId}`).then(r => r.data),
  upsert: (processId: number, data: Partial<BiaAssessment> & { expected_updated_at?: string }) =>
    client.put<BiaAssessment>(`/bia/${processId}`, data).then(r => r.data),
  delete: (processId: number) =>
    client.delete(`/bia/${processId}`),
}
