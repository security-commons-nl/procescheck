import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { processesApi } from '../../api/processes'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { Input } from '../../components/common/FormField'
import { Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useMe } from '../../hooks/useMe'
import type { Process } from '../../types'

type SortKey = 'code' | 'name' | 'owner' | 'department'

export default function ProcessList() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [onlyCritical, setOnlyCritical] = useState(false)
  const [department, setDepartment] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('code')
  const [sortAsc, setSortAsc] = useState(true)
  const { canEdit, isAdmin } = useMe()

  const { data = [], isLoading } = useQuery({
    queryKey: ['processes', search],
    queryFn: () => processesApi.list({ search: search || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => processesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['processes'] }); setDeleteId(null) },
  })

  // Afdelingsfilter-opties uit de (ongefilterde zoek)resultaten
  const departments = useMemo(
    () => Array.from(new Set(data.map(p => p.department).filter((d): d is string => !!d))).sort(),
    [data],
  )

  const rows = useMemo(() => {
    let list = data
    if (onlyCritical) list = list.filter(p => p.is_critical)
    if (department) list = list.filter(p => p.department === department)
    const dir = sortAsc ? 1 : -1
    return [...list].sort((a, b) => (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '', 'nl') * dir)
  }, [data, onlyCritical, department, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  return (
    <div>
      <PageHeader
        title="Kritische Processen"
        subtitle={`${rows.length} van ${data.length} processen`}
        actions={
          canEdit && (
            <Button onClick={() => navigate('/processes/new')}>
              <Plus size={16} /> Nieuw proces
            </Button>
          )
        }
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Zoek op naam, code, eigenaar of afdeling..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            value={department}
            onChange={e => setDepartment(e.target.value)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Alle afdelingen</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyCritical}
              onChange={e => setOnlyCritical(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Alleen kritieke processen
          </label>
        </div>

        {isLoading ? (
          <p className="text-ink-subtle text-sm py-8 text-center">Laden...</p>
        ) : rows.length === 0 ? (
          <p className="text-ink-subtle text-sm py-8 text-center">Geen processen gevonden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <SortHeader label="Code" k="code" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} className="w-24" />
                  <SortHeader label="Naam" k="name" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                  <SortHeader label="Eigenaar" k="owner" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                  <SortHeader label="Afdeling" k="department" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                  <th className="pb-2 pr-4 font-medium">Kritiek</th>
                  <th className="pb-2 pr-4 font-medium">Dossier</th>
                  <th className="pb-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/processes/${p.id}`)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-2.5 pr-4 font-mono text-xs text-gray-500 whitespace-nowrap">{p.code}</td>
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{p.name}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{p.owner || <span className="text-ink-subtle">—</span>}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{p.department || <span className="text-ink-subtle">—</span>}</td>
                    <td className="py-2.5 pr-4">
                      {p.is_critical
                        ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Kritisch</span>
                        : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Nee</span>}
                    </td>
                    <td className="py-2.5 pr-4">
                      <DossierStatus process={p} />
                    </td>
                    <td className="py-2.5 text-right">
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteId(p.id) }}
                          className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={deleteId !== null}
        title="Proces verwijderen"
        message="Weet je zeker dat je dit proces wilt verwijderen? Alle gekoppelde BIA-, RTO/RPO- en procescontext-gegevens worden ook verwijderd."
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

function SortHeader({ label, k, sortKey, sortAsc, onSort, className }: {
  label: string; k: SortKey; sortKey: SortKey; sortAsc: boolean
  onSort: (k: SortKey) => void; className?: string
}) {
  const active = k === sortKey
  return (
    <th className={`pb-2 pr-4 font-medium ${className ?? ''}`}>
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 hover:text-gray-800 ${active ? 'text-gray-800' : ''}`}
      >
        {label}
        {active ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="text-ink-subtle" />}
      </button>
    </th>
  )
}

// Compacte dossierstatus: één stip per onderdeel (BIA, RTO/RPO, context, apps)
function DossierStatus({ process: p }: { process: Process }) {
  const items = [
    { label: 'BIA', done: p.has_bia },
    { label: 'RTO/RPO', done: p.has_rto_rpo },
    { label: 'Context', done: p.has_business_context },
    { label: `Apps (${p.applications.length})`, done: p.applications.length > 0 },
  ]
  return (
    <span className="inline-flex items-center gap-1.5" title={items.map(i => `${i.label}: ${i.done ? '✓' : '—'}`).join('  ')}>
      {items.map(i => (
        <span
          key={i.label}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
            i.done ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-ink-subtle'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${i.done ? 'bg-green-500' : 'bg-gray-300'}`} />
          {i.label}
        </span>
      ))}
    </span>
  )
}
