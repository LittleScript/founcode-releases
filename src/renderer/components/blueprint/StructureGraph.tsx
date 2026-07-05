import {
  Background,
  BackgroundVariant,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo } from 'react'
import type { BlueprintStructure } from '../../../shared/blueprint-types'

const ROW_H = 62
const BAND_GAP = 26
const COL_PROJECT = 0
const COL_FEATURE = 300
const COL_SUB = 620

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-accent',
  medium: 'bg-phase-plan',
  low: 'bg-slate-600',
}

function ProjectNode({ data }: NodeProps) {
  return (
    <div className="w-52 rounded-lg border border-accent/40 bg-accent/[0.08] px-4 py-3 shadow-black/40 shadow-lg">
      <div className="font-mono text-[9px] text-accent uppercase tracking-[0.2em]">Product</div>
      <div className="mt-0.5 font-semibold text-[13px] text-slate-100 leading-snug">
        {String(data.label)}
      </div>
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-accent" />
    </div>
  )
}

function FeatureNode({ data }: NodeProps) {
  const priority = data.priority as string | undefined
  return (
    <div className="w-56 rounded-lg border border-edge bg-surface-raised px-3.5 py-2.5 shadow-black/30 shadow-md">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${PRIORITY_DOT[priority ?? 'medium']}`} />
        <span className="font-medium text-[13px] text-slate-100">{String(data.label)}</span>
        {priority && (
          <span className="ml-auto font-mono text-[9px] text-slate-600 uppercase tracking-wider">
            {priority}
          </span>
        )}
      </div>
      {data.description ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 leading-snug">
          {String(data.description)}
        </p>
      ) : null}
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-edge-2" />
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-edge-2" />
    </div>
  )
}

function SubFeatureNode({ data }: NodeProps) {
  return (
    <div className="w-52 rounded-md border border-edge bg-surface px-3 py-2">
      <span className="text-[12px] text-slate-300">{String(data.label)}</span>
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-edge-2" />
    </div>
  )
}

const nodeTypes = {
  project: ProjectNode,
  feature: FeatureNode,
  subfeature: SubFeatureNode,
}

function layout(structure: BlueprintStructure, projectName: string) {
  const nodes: Node[] = []
  const edges: Edge[] = []

  let cursor = 0
  const bands: number[] = structure.features.map((f) => Math.max(1, f.subFeatures.length))
  const totalHeight = bands.reduce((n, b) => n + b * ROW_H + BAND_GAP, 0) - BAND_GAP

  nodes.push({
    id: 'project',
    type: 'project',
    position: { x: COL_PROJECT, y: totalHeight / 2 - 30 },
    data: { label: projectName },
    draggable: false,
  })

  structure.features.forEach((f, i) => {
    const band = bands[i] ?? 1
    const bandTop = cursor
    const featureId = `f${i}`
    const featureY = bandTop + (band * ROW_H) / 2 - 26
    nodes.push({
      id: featureId,
      type: 'feature',
      position: { x: COL_FEATURE, y: featureY },
      data: { label: f.name, priority: f.priority, description: f.description },
      draggable: false,
    })
    edges.push({
      id: `e-project-${featureId}`,
      source: 'project',
      target: featureId,
      animated: false,
      style: { stroke: '#2b3850' },
    })

    f.subFeatures.forEach((sf, j) => {
      const subId = `${featureId}-s${j}`
      nodes.push({
        id: subId,
        type: 'subfeature',
        position: { x: COL_SUB, y: bandTop + j * ROW_H },
        data: { label: sf.name },
        draggable: false,
      })
      edges.push({
        id: `e-${featureId}-${subId}`,
        source: featureId,
        target: subId,
        animated: false,
        style: { stroke: '#232d3d' },
      })
    })

    cursor += band * ROW_H + BAND_GAP
  })

  return { nodes, edges }
}

export function StructureGraph({
  structure,
  projectName,
}: {
  structure: BlueprintStructure
  projectName: string
}) {
  const { nodes, edges } = useMemo(() => layout(structure, projectName), [structure, projectName])

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        nodesDraggable={false}
        edgesFocusable={false}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1e2734" />
      </ReactFlow>
    </div>
  )
}
