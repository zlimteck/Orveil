import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../styles/topology.css';
import { monitors as monitorsApi } from '../api';
import { useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';
import { Network, AlertCircle, Settings, PanelRightOpen, PanelRightClose, Layers } from 'lucide-react';
import Portal from '../components/Portal';
import ServiceModal from '../components/ServiceModal';
import * as dagreLib from 'dagre';

const dagre = dagreLib.default ?? dagreLib;

const NODE_W = 200;
const NODE_H = 44;

function statusColors(status, enabled) {
  if (!enabled) return { dot: 'rgb(var(--nh-muted))',    border: 'rgb(var(--nh-granite))' };
  if (status === 'online')  return { dot: 'rgb(var(--nh-celadon))',  border: 'rgb(var(--nh-celadon))' };
  if (status === 'warning') return { dot: '#f59e0b',                 border: '#d97706' };
  if (status === 'down')    return { dot: '#ef4444',                 border: '#dc2626' };
  return { dot: 'rgb(var(--nh-muted))', border: 'rgb(var(--nh-granite))' };
}

function edgeStroke(status, enabled) {
  if (!enabled) return 'rgb(var(--nh-granite))';
  if (status === 'down')    return '#ef4444';
  if (status === 'warning') return '#f59e0b';
  return 'rgb(var(--nh-periwinkle))';
}

function layoutGraph(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 120 });
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map(n => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

function clusterAggregate(members) {
  if (members.some(m => m.enabled && m.status === 'down'))    return 'down';
  if (members.some(m => m.enabled && m.status === 'warning')) return 'warning';
  if (members.every(m => !m.enabled || m.status === 'online')) return 'online';
  return 'unknown';
}

function ClusterCard({ parent, children }) {
  const [open, setOpen] = useState(false);
  const members = [parent, ...children];
  const aggStatus = clusterAggregate(members);
  const { dot, border } = statusColors(aggStatus, true);
  const onlineCount = members.filter(m => m.enabled && m.status === 'online').length;
  const downCount   = members.filter(m => m.enabled && m.status === 'down').length;

  return (
    <div className="mx-3 my-2 rounded-lg border overflow-hidden" style={{ borderColor: border, background: 'rgb(var(--nh-surface))' }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:opacity-80 transition-opacity"
        style={{ background: 'rgb(var(--nh-surface))' }}
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: dot }} />
        <span className="text-sm font-semibold truncate flex-1 text-left" style={{ color: 'rgb(var(--nh-ink))' }}>{parent.name}</span>
        <span className="text-xs flex-shrink-0 mr-1" style={{ color: 'rgb(var(--nh-muted))' }}>
          {onlineCount}/{members.length}
          {downCount > 0 && <span className="ml-1 text-red-400">{downCount}✗</span>}
        </span>
        <span className="text-xs flex-shrink-0 transition-transform duration-200" style={{ color: 'rgb(var(--nh-muted))', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block' }}>▾</span>
      </button>

      {/* Children list */}
      {open && (
        <div className="border-t" style={{ borderColor: border + '55' }}>
          {children.map(m => {
            const { dot: cdot } = statusColors(m.status, m.enabled);
            return (
              <div key={String(m._id)} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0" style={{ borderColor: 'rgb(var(--nh-border) / 0.4)' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cdot }} />
                <span className="text-xs truncate flex-1" style={{ color: 'rgb(var(--nh-ink))' }}>{m.name}</span>
                {m.enabled && m.status === 'down' && <span className="text-xs text-red-400 flex-shrink-0">down</span>}
                {m.enabled && m.status === 'warning' && <span className="text-xs flex-shrink-0" style={{ color: '#f59e0b' }}>warn</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarContent({ clusters, unconfigured, loading, t, onEdit, onClose }) {
  return (
    <>
      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'rgb(var(--nh-border))' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--nh-muted))' }}>
            {t('topology.unconfigured')}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--nh-muted))' }}>
            {unconfigured.length} {t('topology.unconfiguredCount')}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'rgb(var(--nh-muted))' }}>
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Cluster cards */}
      {clusters.length > 0 && (
        <div className="border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--nh-border))' }}>
          <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
            <Layers className="w-3 h-3" style={{ color: 'rgb(var(--nh-muted))' }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--nh-muted))' }}>
              Clusters
            </p>
          </div>
          <div className="pb-2 overflow-y-auto">
            {clusters.map(c => (
              <ClusterCard key={String(c.parent._id)} parent={c.parent} children={c.children} />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-xs" style={{ color: 'rgb(var(--nh-muted))' }}>{t('topology.loading')}</div>
        ) : unconfigured.length === 0 ? (
          <div className="p-4 text-xs italic" style={{ color: 'rgb(var(--nh-muted))' }}>{t('topology.allConfigured')}</div>
        ) : (
          <ul>
            {unconfigured.map(m => {
              const { dot } = statusColors(m.status, m.enabled);
              return (
                <li key={m._id} className="flex items-center gap-2.5 px-4 py-2.5 group border-b" style={{ borderColor: 'rgb(var(--nh-border) / 0.5)' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
                  <span className="flex-1 text-sm truncate" style={{ color: 'rgb(var(--nh-ink))' }}>{m.name}</span>
                  <button
                    onClick={() => onEdit(m)}
                    title={t('topology.configure')}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'rgb(var(--nh-muted))' }}
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {unconfigured.length > 0 && (
        <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: 'rgb(var(--nh-border))' }}>
          <div className="flex items-start gap-2 text-xs" style={{ color: 'rgb(var(--nh-muted))' }}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{t('topology.sidebarHint')}</span>
          </div>
        </div>
      )}
    </>
  );
}

export default function Topology() {
  const { t } = useLang();
  const toast = useToast();
  const [allMonitors, setAllMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    monitorsApi.list()
      .then(setAllMonitors)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { graphMonitors, unconfigured } = useMemo(() => {
    const idSet = new Set(allMonitors.map(m => String(m._id)));
    const hasRelation = new Set();
    allMonitors.forEach(m => {
      if (m.dependsOn?.length) {
        hasRelation.add(String(m._id));
        m.dependsOn.forEach(pid => { if (idSet.has(String(pid))) hasRelation.add(String(pid)); });
      }
    });
    return {
      graphMonitors: allMonitors.filter(m => hasRelation.has(String(m._id))),
      unconfigured:  allMonitors.filter(m => !hasRelation.has(String(m._id))),
    };
  }, [allMonitors]);

  // Build clusters: group children by their parent
  const clusters = useMemo(() => {
    const parentMap = new Map(); // parentId -> [child monitors]
    graphMonitors.forEach(m => {
      (m.dependsOn ?? []).forEach(pid => {
        const pidStr = String(pid);
        if (!parentMap.has(pidStr)) parentMap.set(pidStr, []);
        parentMap.get(pidStr).push(m);
      });
    });
    return Array.from(parentMap.entries()).map(([parentId, children]) => {
      const parent = graphMonitors.find(m => String(m._id) === parentId);
      return parent ? { parent, children } : null;
    }).filter(Boolean);
  }, [graphMonitors]);

  const openEdit = useCallback(m => setEditTarget(m), []);
  const noDeps = !loading && graphMonitors.length === 0;

  useEffect(() => {
    if (!graphMonitors.length) { setNodes([]); setEdges([]); return; }

    const monitorById = new Map(graphMonitors.map(m => [String(m._id), m]));

    const rawNodes = graphMonitors.map(m => {
      const { dot, border } = statusColors(m.status, m.enabled);
      return {
        id: String(m._id),
        position: { x: 0, y: 0 },
        width: NODE_W,
        height: NODE_H,
        style: {
          background: 'rgb(var(--nh-card))',
          border: `2px solid ${border}`,
          borderRadius: 8,
          padding: '8px 12px',
          width: NODE_W,
          cursor: 'pointer',
          fontSize: 13,
          color: 'rgb(var(--nh-ink))',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        },
        data: {
          label: (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', overflow: 'hidden' }} onClick={() => openEdit(m)}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
            </div>
          ),
        },
      };
    });

    const rawEdges = [];
    graphMonitors.forEach(m => {
      (m.dependsOn ?? []).forEach(pid => {
        const srcId = String(pid);
        const tgtId = String(m._id);
        if (!rawNodes.some(n => n.id === srcId)) return;
        const parent = monitorById.get(srcId);
        const stroke = edgeStroke(parent?.status, parent?.enabled);
        const isDown = parent?.enabled && parent?.status === 'down';
        rawEdges.push({
          id: `e-${rawEdges.length}`,
          source: srcId,
          target: tgtId,
          animated: isDown,
          style: { stroke },
        });
      });
    });

    setNodes(layoutGraph(rawNodes, rawEdges));
    setEdges(rawEdges);
  }, [graphMonitors, openEdit]);

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Graph ── */}
      <div className="flex-1 min-w-0 relative min-h-0" style={{ background: 'rgb(var(--nh-surface))' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: 'rgb(var(--nh-muted))' }}>
            {t('topology.loading')}
          </div>
        ) : noDeps ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <Network className="w-12 h-12 opacity-30" style={{ color: 'rgb(var(--nh-muted))' }} />
            <div>
              <p className="text-base font-medium mb-1" style={{ color: 'rgb(var(--nh-ink))' }}>{t('topology.emptyTitle')}</p>
              <p className="text-sm max-w-sm" style={{ color: 'rgb(var(--nh-muted))' }}>{t('topology.emptyHint')}</p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            fitViewOptions={{ padding: window.innerWidth < 768 ? 0.6 : 0.3 }}
            minZoom={0.2}
            nodesDraggable={false}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="rgb(var(--nh-border))" />
            <Controls showInteractive={false} />
            <Panel position="top-left">
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs shadow border" style={{ background: 'rgb(var(--nh-card))', borderColor: 'rgb(var(--nh-border))', color: 'rgb(var(--nh-muted))' }}>
                <Network className="w-3.5 h-3.5" />
                <span>Parent → Enfant</span>
              </div>
            </Panel>
            <Panel position="top-right" className="md:hidden">
              <button
                onClick={() => setMobileSidebar(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs shadow border"
                style={{ background: 'rgb(var(--nh-card))', borderColor: 'rgb(var(--nh-border))', color: 'rgb(var(--nh-muted))' }}
              >
                <PanelRightOpen className="w-3.5 h-3.5" />
                <span>{unconfigured.length} non config.</span>
              </button>
            </Panel>
          </ReactFlow>
        )}
      </div>

      {/* ── Sidebar desktop ── */}
      <aside
        className="hidden md:flex w-64 flex-col flex-shrink-0 overflow-hidden border-l"
        style={{ background: 'rgb(var(--nh-card))', borderColor: 'rgb(var(--nh-border))' }}
      >
        <SidebarContent clusters={clusters} unconfigured={unconfigured} loading={loading} t={t} onEdit={openEdit} />
      </aside>

      {/* ── Sidebar mobile (drawer) ── */}
      {mobileSidebar && (
        <div className="md:hidden fixed inset-0 z-40 flex" onClick={() => setMobileSidebar(false)}>
          <div className="flex-1" />
          <aside
            className="w-72 flex flex-col overflow-hidden border-l shadow-2xl"
            style={{ background: 'rgb(var(--nh-card))', borderColor: 'rgb(var(--nh-border))' }}
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent clusters={clusters} unconfigured={unconfigured} loading={loading} t={t} onEdit={openEdit} onClose={() => setMobileSidebar(false)} />
          </aside>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <Portal>
          <ServiceModal
            monitor={editTarget}
            onClose={() => setEditTarget(null)}
            onSave={async (form) => {
              try {
                await monitorsApi.update(editTarget._id, form);
                setAllMonitors(await monitorsApi.list());
                setEditTarget(null);
              } catch (err) {
                toast.add(err.response?.data?.error || err.message, 'error');
              }
            }}
          />
        </Portal>
      )}
    </div>
  );
}
