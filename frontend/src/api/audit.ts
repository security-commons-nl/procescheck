import client from './client'
import type { AuditLogEntry } from '../types'

export const auditApi = {
  list: (params?: { entity_type?: string; entity_id?: number; process_id?: number; limit?: number; offset?: number }) =>
    client.get<AuditLogEntry[]>('/audit', { params }).then(r => r.data),
}
