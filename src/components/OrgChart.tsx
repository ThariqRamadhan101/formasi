import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { eselonColor } from '../lib/colors'
import { CATEGORY_OPTIONS } from '../lib/fungsional'
import { isAssistant } from '../lib/formasi'
import type { FungsionalCategory, OrgNode, OrgNodeKind } from '../lib/types'

interface OrgChartProps {
  tree: OrgNode
  selectedId: string | null
  onSelect: (node: OrgNode) => void
  query: string
  onQuery: (value: string) => void
  formasiFilter: string
  onFormasiFilter: (value: string) => void
  formasiOptions: string[]
  jenisFilter: string
  onJenisFilter: (value: string) => void
  jenisOptions: string[]
  jabatanFilter: string
  onJabatanFilter: (value: string) => void
  jabatanOptions: string[]
  jenjangFilter: string
  onJenjangFilter: (value: string) => void
  jenjangOptions: string[]
  kategoriFilter: FungsionalCategory | 'ALL'
  onKategoriFilter: (value: FungsionalCategory | 'ALL') => void
}

type LinkKind = 'line' | 'assistant'

const KIND_STYLE: Record<OrgNodeKind, string> = {
  root: 'border-brand-700 bg-brand-700 text-white',
  group: 'border-cyan-600 bg-cyan-600 text-white',
  unit: 'border-brand-500 bg-brand-50 text-brand-900',
  balai: 'border-emerald-500 bg-emerald-50 text-emerald-900',
  subunit: 'border-amber-400 bg-amber-50 text-amber-900',
  seksi: 'border-violet-400 bg-violet-50 text-violet-900',
}

/** Warna kartu berdasarkan eselon: I merah pekat, II kuning, III hijau muda, IV biru muda. */
function cardStyle(node: OrgNode): string {
  const color = eselonColor(node.eselon)
  if (color) return color.card
  return KIND_STYLE[node.kind]
}

function badgeText(node: OrgNode): string {
  if (node.kind === 'group') return 'UPT BALAI'
  if (node.kind === 'root' || node.eselon === 'I') return 'Eselon I'
  if (node.eselon) return `Eselon ${node.eselon}`
  return 'Non-Eselon'
}

function nodeMatches(node: OrgNode, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  if (node.label.toLowerCase().includes(q)) return true
  if (badgeText(node).toLowerCase().includes(q)) return true
  if (node.structural?.jabatan.toLowerCase().includes(q)) return true
  return node.rows.some((row) => row.jabatan.toLowerCase().includes(q))
}

function ancestorsOf(tree: OrgNode, ids: Set<string>): Set<string> {
  const result = new Set<string>()
  const walk = (node: OrgNode, ancestors: string[]) => {
    if (ids.has(node.id)) ancestors.forEach((id) => result.add(id))
    for (const child of node.children) walk(child, [...ancestors, node.id])
  }
  walk(tree, [])
  return result
}

function collectExpandable(tree: OrgNode): string[] {
  const ids: string[] = []
  const walk = (node: OrgNode) => {
    if (node.children.length > 0) ids.push(node.id)
    node.children.forEach(walk)
  }
  walk(tree)
  return ids
}

interface NodeCardProps {
  node: OrgNode
  parentId: string | null
  link: LinkKind
  expanded: boolean
  selected: boolean
  matched: boolean
  onSelect: () => void
  onToggle: () => void
}

function NodeCard({ node, parentId, link, expanded, selected, matched, onSelect, onToggle }: NodeCardProps) {
  const hasChildren = node.children.length > 0
  // Employee/bezetting figures only apply down to the Unit Kerja level.
  const unitLevel = node.kind !== 'subunit' && node.kind !== 'seksi'
  const style = cardStyle(node)
  const ring = selected
    ? 'ring-2 ring-offset-2 ring-brand-500'
    : matched
      ? 'ring-2 ring-offset-2 ring-amber-400'
      : ''

  return (
    <div
      role="button"
      tabIndex={0}
      data-node-id={node.id}
      data-parent-id={parentId ?? undefined}
      data-link={link}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={`w-56 cursor-pointer rounded-lg border-2 px-3 py-2 text-left shadow-sm transition hover:shadow-md ${style} ${ring}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          {badgeText(node)}
        </span>
        {hasChildren && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
            className="rounded bg-white/70 px-1.5 text-xs font-bold text-slate-700 hover:bg-white"
            aria-label={expanded ? 'Tutup cabang' : 'Buka cabang'}
          >
            {expanded ? '−' : '+'} {node.children.length}
          </button>
        )}
      </div>

      <p className="mt-1.5 line-clamp-3 text-xs font-semibold leading-snug" title={node.label}>
        {node.label}
      </p>
      {node.structural && (
        <p className="mt-0.5 line-clamp-2 text-[11px] opacity-80" title={node.structural.jabatan}>
          {node.structural.jabatan}
        </p>
      )}

      {unitLevel ? (
        <div className="mt-2 grid grid-cols-3 gap-1 text-center">
          <div className="rounded bg-white/70 py-0.5">
            <p className="truncate text-[8px] font-medium uppercase text-slate-500" title="Kebutuhan">
              K
            </p>
            <p className="text-[11px] font-bold tabular-nums text-slate-700">{node.kebutuhan.toLocaleString('id-ID')}</p>
          </div>
          <div className="rounded bg-white/70 py-0.5">
            <p className="truncate text-[8px] font-medium uppercase text-slate-500" title="Bezetting (terisi)">
              B
            </p>
            <p className="text-[11px] font-bold tabular-nums text-emerald-700">{node.bezetting.toLocaleString('id-ID')}</p>
          </div>
          <div className="rounded bg-white/70 py-0.5">
            <p className="truncate text-[8px] font-medium uppercase text-slate-500" title="Formasi (Kebutuhan - Bezetting)">
              F
            </p>
            <p className="text-[11px] font-bold tabular-nums text-brand-700">
              {(node.kebutuhan - node.bezetting).toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between text-[10px] font-medium">
          <span className="rounded bg-white/70 px-1.5 py-0.5 text-slate-700">
            Kebutuhan {node.kebutuhan.toLocaleString('id-ID')}
          </span>
          <span className="opacity-80">{node.positionCount} posisi</span>
        </div>
      )}
    </div>
  )
}

function NodeItem({
  node,
  parentId,
  link = 'line',
  expandedIds,
  matchIds,
  selectedId,
  onSelect,
  onToggle,
}: {
  node: OrgNode
  parentId: string | null
  link?: LinkKind
  expandedIds: Set<string>
  matchIds: Set<string>
  selectedId: string | null
  onSelect: (node: OrgNode) => void
  onToggle: (id: string) => void
}) {
  const expanded = expandedIds.has(node.id)

  // Assistant units sit to the right (connector "I-"); other children below.
  const assistantChildren = expanded ? node.children.filter((child) => isAssistant(child.label)) : []
  const lineChildren = expanded ? node.children.filter((child) => !isAssistant(child.label)) : []
  const regularChildren = lineChildren.filter((child) => child.kind !== 'group')
  const groupChildren = lineChildren.filter((child) => child.kind === 'group')

  const renderChildren = (children: OrgNode[]) => (
    <div className="oc-children">
      {children.map((child) => (
        <div key={child.id} className="oc-cell">
          <NodeItem
            node={child}
            parentId={node.id}
            expandedIds={expandedIds}
            matchIds={matchIds}
            selectedId={selectedId}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        </div>
      ))}
    </div>
  )

  return (
    <div className="oc-branch">
      <div className="oc-head">
        {assistantChildren.map((child) => (
          <div key={`ghost-${child.id}`} className="oc-assistant-ghost" aria-hidden />
        ))}
        <NodeCard
          node={node}
          parentId={parentId}
          link={link}
          expanded={expanded}
          selected={selectedId === node.id}
          matched={matchIds.has(node.id)}
          onSelect={() => onSelect(node)}
          onToggle={() => onToggle(node.id)}
        />
        {assistantChildren.map((child) => (
          <div key={child.id} className="oc-assistant">
            <NodeItem
              node={child}
              parentId={node.id}
              link="assistant"
              expandedIds={expandedIds}
              matchIds={matchIds}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          </div>
        ))}
      </div>
      {regularChildren.length > 0 && renderChildren(regularChildren)}
      {groupChildren.length > 0 && renderChildren(groupChildren)}
    </div>
  )
}

interface CardBox {
  left: number
  right: number
  top: number
  bottom: number
  cx: number
  cy: number
}

interface Links {
  paths: string[]
  width: number
  height: number
}

export function OrgChart({
  tree,
  selectedId,
  onSelect,
  query,
  onQuery,
  formasiFilter,
  onFormasiFilter,
  formasiOptions,
  jenisFilter,
  onJenisFilter,
  jenisOptions,
  jabatanFilter,
  onJabatanFilter,
  jabatanOptions,
  jenjangFilter,
  onJenjangFilter,
  jenjangOptions,
  kategoriFilter,
  onKategoriFilter,
}: OrgChartProps) {
  const expandable = useMemo(() => collectExpandable(tree), [tree])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([tree.id]))
  const [zoom, setZoom] = useState(1)
  const [links, setLinks] = useState<Links>({ paths: [], width: 0, height: 0 })

  const canvasRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const draggedRef = useRef(false)
  const dragState = useRef({ active: false, x: 0, y: 0, left: 0, top: 0 })
  const [panning, setPanning] = useState(false)

  const onScrollMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!el) return
    dragState.current = { active: true, x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop }
    draggedRef.current = false
  }

  const onScrollMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!el || !dragState.current.active) return
    const dx = event.clientX - dragState.current.x
    const dy = event.clientY - dragState.current.y
    if (!draggedRef.current && Math.abs(dx) + Math.abs(dy) < 5) return
    draggedRef.current = true
    setPanning(true)
    el.scrollLeft = dragState.current.left - dx
    el.scrollTop = dragState.current.top - dy
  }

  const endPan = () => {
    dragState.current.active = false
    setPanning(false)
  }

  const selectNode = (node: OrgNode) => {
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    onSelect(node)
  }

  const matchIds = useMemo(() => {
    const ids = new Set<string>()
    if (!query.trim()) return ids
    const walk = (node: OrgNode) => {
      if (nodeMatches(node, query)) ids.add(node.id)
      node.children.forEach(walk)
    }
    walk(tree)
    return ids
  }, [tree, query])

  useEffect(() => {
    if (matchIds.size === 0) return
    setExpanded((prev) => {
      const next = new Set(prev)
      ancestorsOf(tree, matchIds).forEach((id) => next.add(id))
      matchIds.forEach((id) => next.add(id))
      return next
    })
  }, [matchIds, tree])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const compute = () => {
      const scale = zoom || 1
      const canvasRect = canvas.getBoundingClientRect()
      const cards = canvas.querySelectorAll<HTMLElement>('[data-node-id]')
      const boxes = new Map<string, CardBox>()
      let width = 0
      let height = 0

      cards.forEach((card) => {
        const rect = card.getBoundingClientRect()
        const id = card.dataset.nodeId
        if (!id) return
        const left = (rect.left - canvasRect.left) / scale
        const right = (rect.right - canvasRect.left) / scale
        const top = (rect.top - canvasRect.top) / scale
        const bottom = (rect.bottom - canvasRect.top) / scale
        boxes.set(id, { left, right, top, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 })
        width = Math.max(width, right)
        height = Math.max(height, bottom)
      })

      const paths: string[] = []
      cards.forEach((card) => {
        const parentId = card.dataset.parentId
        const id = card.dataset.nodeId
        if (!parentId || !id) return
        const parent = boxes.get(parentId)
        const child = boxes.get(id)
        if (!parent || !child) return
        if (card.dataset.link === 'assistant') {
          // L-shaped "I-" connector: down from the principal, then right into the
          // left edge of the assistant card (at its vertical center).
          paths.push(`M ${parent.cx} ${parent.bottom} V ${child.cy} H ${child.left}`)
        } else {
          const midY = child.top - 14
          paths.push(`M ${parent.cx} ${parent.bottom} V ${midY} H ${child.cx} V ${child.top}`)
        }
      })

      setLinks({ paths, width, height })
    }

    compute()
    const observer = new ResizeObserver(compute)
    observer.observe(canvas)
    window.addEventListener('resize', compute)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [expanded, zoom, tree, query])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const formasiChoices = useMemo(
    () => [...new Set(['YA', 'TIDAK', ...formasiOptions])],
    [formasiOptions],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <button
          type="button"
          onClick={() => setExpanded(new Set(expandable))}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
        >
          Buka semua
        </button>
        <button
          type="button"
          onClick={() => setExpanded(new Set([tree.id]))}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
        >
          Tutup semua
        </button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Cari unit / jabatan…"
          className="w-44 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Formasi
          <select
            value={formasiFilter}
            onChange={(event) => onFormasiFilter(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="ALL">Semua</option>
            {formasiChoices.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Jenis
          <select
            value={jenisFilter}
            onChange={(event) => onJenisFilter(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="ALL">Semua</option>
            {jenisOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Jabatan
          <select
            value={jabatanFilter}
            onChange={(event) => onJabatanFilter(event.target.value)}
            className="max-w-[14rem] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="ALL">Semua</option>
            {jabatanOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Jenjang
          <select
            value={jenjangFilter}
            onChange={(event) => onJenjangFilter(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="ALL">Semua</option>
            {jenjangOptions.map((option) => (
              <option key={option} value={option}>
                {option === '-' ? '—' : option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Kategori
          <select
            value={kategoriFilter}
            onChange={(event) => onKategoriFilter(event.target.value as FungsionalCategory | 'ALL')}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
            className="h-7 w-7 rounded-md border border-slate-300 text-sm font-bold hover:bg-slate-50"
            aria-label="Perkecil"
          >
            −
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))}
            className="h-7 w-7 rounded-md border border-slate-300 text-sm font-bold hover:bg-slate-50"
            aria-label="Perbesar"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
          >
            100%
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onMouseDown={onScrollMouseDown}
        onMouseMove={onScrollMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        className={`scroll-thin min-h-0 flex-1 select-none overflow-auto p-6 ${
          panning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {query.trim() && matchIds.size === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada unit/jabatan yang cocok dengan “{query}”.</p>
        ) : (
          <div className="flex min-w-max justify-center">
            <div
              ref={canvasRef}
              className="oc-canvas"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            >
              <svg
                className="oc-links"
                width={links.width || 1}
                height={links.height || 1}
                viewBox={`0 0 ${links.width || 1} ${links.height || 1}`}
              >
                {links.paths.map((path, index) => (
                  <path
                    key={index}
                    d={path}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
              <NodeItem
                node={tree}
                parentId={null}
                expandedIds={expanded}
                matchIds={matchIds}
                selectedId={selectedId}
                onSelect={selectNode}
                onToggle={toggle}
              />
            </div>
          </div>
        )}
      </div>
      <p className="border-t border-slate-200 bg-white px-4 py-1.5 text-[11px] text-slate-400">
        <strong className="font-semibold text-slate-500">
          K = Kebutuhan · B = Bezetting · F = Formasi (Kebutuhan − Bezetting)
        </strong>{' '}
        · Klik kartu untuk rincian · tombol +/− membuka cabang · geser untuk melihat cabang lain
      </p>
    </div>
  )
}
