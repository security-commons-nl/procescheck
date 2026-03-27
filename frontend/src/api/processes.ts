import client from './client'
import type { Process } from '../types'

export const processesApi = {
  list: (params?: { is_critical?: boolean; department?: string; search?: string }) =>
    client.get<Process[]>('/processes', { params }).then(r => r.data),
  get: (id: number) =>
    client.get<Process>(`/processes/${id}`).then(r => r.data),
  nextCode: () =>
    client.get<{ code: string }>('/processes/next-code').then(r => r.data.code),
  create: (data: Partial<Process>) =>
    client.post<Process>('/processes', data).then(r => r.data),
  update: (id: number, data: Partial<Process>) =>
    client.put<Process>(`/processes/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    client.delete(`/processes/${id}`),
  linkApp: (processId: number, applicationId: number) =>
    client.post(`/processes/${processId}/applications`, { application_id: applicationId }),
  unlinkApp: (processId: number, appId: number) =>
    client.delete(`/processes/${processId}/applications/${appId}`),
}
