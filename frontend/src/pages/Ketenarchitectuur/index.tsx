import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import * as dagre from 'dagre'
import { useQuery } from '@tanstack/react-query'
import { processesApi } from '../../api/processes'
import { biaApi } from '../../api/bia'
import { GitBranch, Monitor, X, Search, RotateCcw, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

const NODE_W = 210
const NODE_H = 60

// --- Dagre layout ---
function applyLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 55, marginx: 60, marginy: 60 })
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return {
    nodes: nodes.map(n => {
      const pos = g.node(n.id)
      return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } }
    }),
    edges,
  }
}

// --- Custom nodes ---
function ProcessNode({ data, selected }: NodeProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border-2 px-3 py-2.5 bg-blue-50 text-blue-900 shadow-sm text-sm select-none',
        selected ? 'border-blue-600 shadow-blue-200 shadow-md' : 'border-blue-200',
      )}
      style={{ width: NODE_W, cursor: 'pointer' }}
    >
      <Handle type="source" position={Position.Right} style={{ background: '#93c5fd', width: 8, height: 8 }} />
      <div className="flex items-center gap-2 min-w-0">
        <GitBranch size={14} className="shrink-0 text-blue-500" />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide leading-none mb-0.5">
            {data.code}
          </div>
          <div className="font-medium truncate leading-snug text-blue-900">{data.name}</div>
        </div>
      </div>
    </div>
  )
}

function ApplicationNode({ data, selected }: NodeProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border-2 px-3 py-2.5 bg-emerald-50 text-emerald-900 shadow-sm text-sm select-none',
        selected ? 'border-emerald-600 shadow-emerald-200 shadow-md' : 'border-emerald-200',
      )}
      style={{ width: NODE_W, cursor: 'pointer' }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#6ee7b7', width: 8, height: 8 }} />
      <div className="flex items-center gap-2 min-w-0">
        <Monitor size={14} className="shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide leading-none mb-0.5">
            {data.code}
          </div>
          <div className="font-medium truncate leading-snug text-emerald-900">{data.name}</div>
        </div>
      </div>
    </div>
  )
}

const nodeTypes = { process: ProcessNode, application: ApplicationNode }

// --- Types ---
type DetailNode = {
  id: string
  type: 'process' | 'application'
  code: string
  name: string
  linked: { id: string; code: string; name: string }[]
}

type FilterOption = { id: number; label: string; code: string }

// --- BIA score helpers ---
const SCORE_STYLES: Record<number, { text: string; bg: string; border: string }> = {
  1: { text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'    },
  2: { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  3: { text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  4: { text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  5: { text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200'  },
}
const SCORE_LABEL: Record<number, string> = {
  1: 'Catastrofaal',
  2: 'Kritiek',
  3: 'Gemiddeld',
  4: 'Gering',
  5: 'Verwaarloosbaar',
}


// --- Multi-select filter dropdown ---
function MultiSelect({
  label,
  options,
  selected,
  onChange,
  color,
}: {
  label: string
  options: FilterOption[]
  selected: number[]
  onChange: (ids: number[]) => void
  color: 'blue' | 'emerald'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isBlue = color === 'blue'

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  const activeCount = selected.length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
          activeCount > 0
            ? isBlue
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-emerald-50 border-emerald-300 text-emerald-700'
            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300',
        )}
      >
        {isBlue ? <GitBranch size={13} /> : <Monitor size={13} />}
        <span>{label}</span>
        {activeCount > 0 && (
          <span
            className={clsx(
              'text-xs rounded-full px-1.5 py-0.5 font-semibold leading-none',
              isBlue ? 'bg-blue-200 text-blue-700' : 'bg-emerald-200 text-emerald-700',
            )}
          >
            {activeCount}
          </span>
        )}
        <ChevronDown size={12} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <button
              onClick={() => { onChange([]); setOpen(false) }}
              className={clsx(
                'w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors',
                activeCount === 0
                  ? isBlue
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50',
              )}
            >
              Alle {label.toLowerCase()}
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto p-2 space-y-0.5">
            {options.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-2 italic">Geen opties beschikbaar</p>
            ) : (
              options.map(opt => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.id)}
                    onChange={() => toggle(opt.id)}
                    className={clsx('rounded shrink-0', isBlue ? 'accent-blue-600' : 'accent-emerald-600')}
                  />
                  <span className="text-[10px] font-mono text-gray-400 shrink-0">{opt.code}</span>
                  <span className="text-sm text-gray-700 truncate">{opt.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Main component ---
export default function Ketenarchitectuur() {
  const [showProcesses, setShowProcesses] = useState(true)
  const [showApplications, setShowApplications] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedProcessIds, setSelectedProcessIds] = useState<number[]>([])
  const [selectedAppIds, setSelectedAppIds] = useState<number[]>([])
  const [detail, setDetail] = useState<DetailNode | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const edgesRef = useRef(edges)
  edgesRef.current = edges

  const { data: processes = [], isLoading } = useQuery({
    queryKey: ['processes'],
    queryFn: () => processesApi.list(),
  })

  // Derive processId from detail (format: 'p-{id}')
  const detailProcessId = detail?.type === 'process' ? parseInt(detail.id.slice(2), 10) : null

  // Lazy BIA fetch when a process node is selected
  const { data: biaDet, isLoading: biaLoading } = useQuery({
    queryKey: ['bia', detailProcessId],
    queryFn: () => biaApi.get(detailProcessId!),
    enabled: !!detailProcessId,
    retry: false,
  })

  // Filter options derived from processes data
  const processOptions = useMemo<FilterOption[]>(
    () =>
      [...processes]
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(p => ({ id: p.id, label: p.name, code: p.code })),
    [processes],
  )

  const appOptions = useMemo<FilterOption[]>(() => {
    const map = new Map<number, FilterOption>()
    processes.forEach(p =>
      p.applications.forEach(a => {
        if (!map.has(a.id)) map.set(a.id, { id: a.id, label: a.name, code: a.code })
      }),
    )
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
  }, [processes])

  const hasActiveFilters =
    selectedProcessIds.length > 0 || selectedAppIds.length > 0 || search.trim() !== ''

  const resetFilters = () => {
    setSelectedProcessIds([])
    setSelectedAppIds([])
    setSearch('')
  }

  // Build and layout graph whenever data/filters change
  useEffect(() => {
    if (!processes.length) {
      setNodes([])
      setEdges([])
      return
    }

    const appMap = new Map<number, { id: number; code: string; name: string }>()
    processes.forEach(p => p.applications.forEach(a => appMap.set(a.id, a)))

    const searchLower = search.trim().toLowerCase()

    // Step 1: text search
    const searchFiltered = searchLower
      ? processes.filter(
          p =>
            p.name.toLowerCase().includes(searchLower) ||
            p.code.toLowerCase().includes(searchLower),
        )
      : processes

    // Step 2: process selection filter
    const processFiltered =
      selectedProcessIds.length > 0
        ? searchFiltered.filter(p => selectedProcessIds.includes(p.id))
        : searchFiltered

    // Step 3: app selection filter — keep processes that have at least one selected app
    const finalProcesses =
      selectedAppIds.length > 0
        ? processFiltered.filter(p => p.applications.some(a => selectedAppIds.includes(a.id)))
        : processFiltered

    // Compute visible app IDs: apps linked to finalProcesses, intersected with selectedAppIds if set
    const linkedAppIds = new Set<number>()
    finalProcesses.forEach(p => p.applications.forEach(a => linkedAppIds.add(a.id)))

    // If search matched app names/codes directly (no process filter), include those too
    if (searchLower && selectedProcessIds.length === 0 && selectedAppIds.length === 0) {
      appMap.forEach((a, id) => {
        if (
          a.name.toLowerCase().includes(searchLower) ||
          a.code.toLowerCase().includes(searchLower)
        ) {
          linkedAppIds.add(id)
        }
      })
    }

    const finalAppIds =
      selectedAppIds.length > 0
        ? new Set([...linkedAppIds].filter(id => selectedAppIds.includes(id)))
        : linkedAppIds

    // Build nodes
    const rawNodes: Node[] = []
    const rawEdges: Edge[] = []

    if (showProcesses) {
      finalProcesses.forEach(p => {
        rawNodes.push({
          id: `p-${p.id}`,
          type: 'process',
          position: { x: 0, y: 0 },
          data: { code: p.code, name: p.name, processId: p.id, applications: p.applications },
        })
      })
    }

    if (showApplications) {
      finalAppIds.forEach(appId => {
        const a = appMap.get(appId)
        if (!a) return
        rawNodes.push({
          id: `a-${appId}`,
          type: 'application',
          position: { x: 0, y: 0 },
          data: { code: a.code, name: a.name, appId },
        })
      })
    }

    if (showProcesses && showApplications) {
      finalProcesses.forEach(p => {
        p.applications.forEach(a => {
          if (!finalAppIds.has(a.id)) return
          rawEdges.push({
            id: `e-p${p.id}-a${a.id}`,
            source: `p-${p.id}`,
            target: `a-${a.id}`,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1', width: 14, height: 14 },
            style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
          })
        })
      })
    }

    if (rawNodes.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    const { nodes: ln, edges: le } = applyLayout(rawNodes, rawEdges)
    setNodes(ln)
    setEdges(le)
  }, [processes, showProcesses, showApplications, search, selectedProcessIds, selectedAppIds])

  // Hover: dim unconnected nodes/edges
  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    const currentEdges = edgesRef.current
    const connectedIds = new Set<string>([node.id])
    currentEdges.forEach(e => {
      if (e.source === node.id) connectedIds.add(e.target)
      if (e.target === node.id) connectedIds.add(e.source)
    })

    setNodes(nds =>
      nds.map(n => ({
        ...n,
        style: { ...n.style, opacity: connectedIds.has(n.id) ? 1 : 0.12, transition: 'opacity 0.15s' },
      })),
    )
    setEdges(eds =>
      eds.map(e => ({
        ...e,
        style: {
          ...e.style,
          opacity: e.source === node.id || e.target === node.id ? 1 : 0.08,
          transition: 'opacity 0.15s',
        },
      })),
    )
  }, [])

  const onNodeMouseLeave = useCallback(() => {
    setNodes(nds => nds.map(n => ({ ...n, style: { ...n.style, opacity: 1 } })))
    setEdges(eds => eds.map(e => ({ ...e, style: { ...e.style, opacity: 1 } })))
  }, [])

  // Click: show detail panel
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const isProcess = node.type === 'process'
      const linked: DetailNode['linked'] = []

      if (isProcess) {
        const apps: { id: number; code: string; name: string }[] = node.data.applications ?? []
        apps.forEach(a => linked.push({ id: `a-${a.id}`, code: a.code, name: a.name }))
      } else {
        const appId: number = node.data.appId
        processes.forEach(p => {
          if (p.applications.some(a => a.id === appId)) {
            linked.push({ id: `p-${p.id}`, code: p.code, name: p.name })
          }
        })
      }

      setDetail({
        id: node.id,
        type: isProcess ? 'process' : 'application',
        code: node.data.code,
        name: node.data.name,
        linked,
      })
    },
    [processes],
  )

  const onPaneClick = useCallback(() => setDetail(null), [])

  const nodeCount = nodes.length
  const edgeCount = edges.length

  // Combined BIV score (most severe = lowest value)
  const combinedScore =
    biaDet?.availability_score != null ||
    biaDet?.integrity_score != null ||
    biaDet?.confidentiality_score != null
      ? Math.min(
          biaDet?.availability_score ?? 5,
          biaDet?.integrity_score ?? 5,
          biaDet?.confidentiality_score ?? 5,
        )
      : undefined

  return (
    <div className="-m-6 flex flex-col" style={{ height: '100vh' }}>
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        {/* Row 1: title + search + visibility toggles */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 mr-auto">
            <h1 className="text-xl font-bold text-gray-900">Ketenarchitectuur</h1>
            {!isLoading && (
              <span className="text-xs text-gray-400">
                {nodeCount} nodes · {edgeCount} relaties
              </span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Zoek op naam of code…"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
          </div>

          {/* Visibility toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProcesses(v => !v)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                showProcesses
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-400',
              )}
            >
              <GitBranch size={13} />
              <span className={clsx(!showProcesses && 'line-through')}>Processen</span>
            </button>
            <button
              onClick={() => setShowApplications(v => !v)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                showApplications
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-gray-200 text-gray-400',
              )}
            >
              <Monitor size={13} />
              <span className={clsx(!showApplications && 'line-through')}>Applicaties</span>
            </button>
          </div>
        </div>

        {/* Row 2: filter dropdowns + reset */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <span className="text-xs text-gray-400 font-medium mr-1">Filter:</span>

          <MultiSelect
            label="Processen"
            options={processOptions}
            selected={selectedProcessIds}
            onChange={setSelectedProcessIds}
            color="blue"
          />

          <MultiSelect
            label="Applicaties"
            options={appOptions}
            selected={selectedAppIds}
            onChange={setSelectedAppIds}
            color="emerald"
          />

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <RotateCcw size={12} />
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Canvas + detail panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* React Flow canvas */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                <div className="text-sm">Laden…</div>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <p className="text-sm mb-2">Geen nodes om te tonen.</p>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto"
                  >
                    <RotateCcw size={12} /> Filters resetten
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeMouseLeave={onNodeMouseLeave}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.1}
              maxZoom={2.5}
              deleteKeyCode={null}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
              <Controls showInteractive={false} className="!shadow-sm !border !border-gray-200 !rounded-lg" />
              <MiniMap
                nodeColor={n => (n.type === 'process' ? '#bfdbfe' : '#a7f3d0')}
                maskColor="rgba(248,250,252,0.85)"
                style={{ border: '1px solid #e2e8f0', borderRadius: 10 }}
                nodeStrokeWidth={0}
              />
            </ReactFlow>
          )}
        </div>

        {/* Detail panel */}
        {detail && (
          <div className="w-72 border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-hidden">
            {/* Panel header */}
            <div
              className={clsx(
                'px-4 py-3 border-b flex items-start justify-between gap-2 shrink-0',
                detail.type === 'process'
                  ? 'bg-blue-50 border-blue-100'
                  : 'bg-emerald-50 border-emerald-100',
              )}
            >
              <div className="flex items-start gap-2 min-w-0">
                {detail.type === 'process' ? (
                  <GitBranch size={16} className="text-blue-600 mt-0.5 shrink-0" />
                ) : (
                  <Monitor size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div
                    className={clsx(
                      'text-[10px] font-semibold uppercase tracking-wide',
                      detail.type === 'process' ? 'text-blue-500' : 'text-emerald-500',
                    )}
                  >
                    {detail.type === 'process' ? 'Proces' : 'Applicatie'} · {detail.code}
                  </div>
                  <div className="font-semibold text-sm text-gray-900 break-words">{detail.name}</div>
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="p-1 rounded hover:bg-black/5 text-gray-400 shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Procesclassificatie — only for process nodes */}
              {detail.type === 'process' && (
                <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
                    Procesclassificatie
                  </div>
                  {biaLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <div className="w-3 h-3 rounded-full border-b border-blue-400 animate-spin" />
                      Laden…
                    </div>
                  ) : combinedScore !== undefined ? (
                    (() => {
                      const s = SCORE_STYLES[combinedScore]
                      return (
                        <span className={clsx('inline-flex items-center text-sm font-semibold px-3 py-1 rounded-lg border', s.text, s.bg, s.border)}>
                          {SCORE_LABEL[combinedScore]}
                        </span>
                      )
                    })()
                  ) : (
                    <p className="text-xs text-gray-400 italic">Geen BIA ingevuld voor dit proces.</p>
                  )}
                </div>
              )}

              {/* Linked items */}
              <div className="p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {detail.type === 'process' ? 'Gekoppelde applicaties' : 'Gekoppelde processen'}
                  <span className="ml-1.5 font-normal normal-case text-gray-400">
                    ({detail.linked.length})
                  </span>
                </div>
                {detail.linked.length === 0 ? (
                  <div className="text-sm text-gray-400 italic">Geen koppelingen</div>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.linked.map(item => (
                      <li
                        key={item.id}
                        className={clsx(
                          'flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm',
                          detail.type === 'process'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-blue-50 text-blue-800',
                        )}
                      >
                        {detail.type === 'process' ? (
                          <Monitor size={12} className="shrink-0 text-emerald-600" />
                        ) : (
                          <GitBranch size={12} className="shrink-0 text-blue-500" />
                        )}
                        <span className="text-[10px] font-mono opacity-50 shrink-0">{item.code}</span>
                        <span className="truncate">{item.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
