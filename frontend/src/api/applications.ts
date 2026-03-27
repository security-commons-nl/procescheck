import client from './client'
import type { Application } from '../types'

export const applicationsApi = {
  list: (params?: { search?: string }) =>
    client.get<Application[]>('/applications', { params }).then(r => r.data),
  nextCode: () =>
    client.get<{ code: string }>('/applications/next-code').then(r => r.data.code),
  get: (id: number) =>
    client.get<Application>(`/applications/${id}`).then(r => r.data),
  create: (data: Partial<Application>) =>
    client.post<Application>('/applications', data).then(r => r.data),
  update: (id: number, data: Partial<Application>) =>
    client.put<Application>(`/applications/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    client.delete(`/applications/${id}`),
}
