import client from './client'
import type { DashboardSummary, ProcessCompleteness, BivTopStats } from '../types'

export const dashboardApi = {
  summary: () =>
    client.get<DashboardSummary>('/dashboard/summary').then(r => r.data),
  completeness: () =>
    client.get<ProcessCompleteness[]>('/dashboard/completeness').then(r => r.data),
  bivTop: (limit = 5) =>
    client.get<BivTopStats>('/dashboard/biv-top', { params: { limit } }).then(r => r.data),
}
