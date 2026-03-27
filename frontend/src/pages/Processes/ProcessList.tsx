import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { processesApi } from '../../api/processes'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { Input } from '../../components/common/FormField'
import { Plus, Trash2 } from 'lucide-react'

export default function ProcessList() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['processes', search],
    queryFn: () => processesApi.list({ search: search || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => processesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['processes'] }); setDeleteId(null) },
  })

  return (
    <div>
      <PageHeader
        title="Kritische Processen"
        subtitle={`${data.length} processen`}
        actions={
          <Button onClick={() => navigate('/processes/new')}>
            <Plus size={16} /> Nieuw proces
          </Button>
        }
      />

      <Card>
        <div className="mb-4">
          <Input
            placeholder="Zoek op naam of code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {isLoading ? (
          <p className="text-gray-400 text-sm py-8 text-center">Laden...</p>
        ) : data.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">Geen processen gevonden.</p>
        ) : (
          <table className="w-full text-sm">
            <colgroup>
              <col className="w-28" />
              <col />
              <col className="w-10" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Code</th>
                <th className="pb-2 pr-4 font-medium">Naam</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {data.map(p => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/processes/${p.id}`)}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="py-2.5 pr-4 font-mono text-xs text-gray-500 whitespace-nowrap">{p.code}</td>
                  <td className="py-2.5 pr-4 font-medium text-gray-900">{p.name}</td>
                  <td className="py-2.5 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteId(p.id) }}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
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
