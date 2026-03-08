import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TreeVisualization, { type TreeNode } from './TreeVisualization';
import { Network, Tags, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';

interface TreePanelProps {
    treeData: TreeNode[] | null;
    traversalPath: string[];
    isSearching: boolean;
    thinking: string;
    documentName: string;
}

export default function TreePanel({
    treeData,
    traversalPath,
    isSearching,
    thinking,
    documentName,
}: TreePanelProps) {
    const [showLabels, setShowLabels] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const legendItems = [
        { color: 'rgba(255,255,255,0.25)', label: 'Not searched', border: 'rgba(255,255,255,0.08)' },
        { color: '#8b5cf6', label: 'Traversing', border: 'rgba(139,92,246,0.4)' },
        { color: '#10b981', label: 'Found', border: 'rgba(16,185,129,0.4)' },
    ];

    // Helper to count total nodes
    const getTotalNodes = (nodes: TreeNode[] | null): number => {
        if (!nodes) return 0;
        let count = 0;
        const traverse = (n: TreeNode) => {
            count++;
            n.nodes?.forEach(traverse);
        };
        nodes.forEach(traverse);
        return count;
    };

    const totalNodes = getTotalNodes(treeData);

    return (
        <div className="flex flex-col h-full bg-[#050508] border-l border-white/[0.06]">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border border-indigo-500/20 flex items-center justify-center shadow-lg">
                        <Network size={14} className="text-indigo-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-white/90 tracking-tight">
                                Document Map
                            </h3>
                            {totalNodes > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[9px] font-mono text-white/50 border border-white/[0.04]">
                                    {totalNodes} NODES
                                </span>
                            )}
                        </div>
                        {documentName && (
                            <p className="text-[11px] text-white/40 truncate max-w-[220px] mt-0.5 leading-none">
                                {documentName}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setShowLabels(!showLabels)}
                        className={`p-2 rounded-xl transition-all ${showLabels
                                ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20 shadow-inner'
                                : 'text-white/30 hover:text-white/60 hover:bg-white/[0.06] border border-transparent'
                            }`}
                        title="Toggle text labels"
                    >
                        <Tags size={14} />
                    </button>

                    <button
                        title="Expand / Collapse Panel"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="sm:hidden p-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all border border-transparent"
                    >
                        {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {/* Tree area */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="flex-1 min-h-0 relative bg-[#0a0a0f]"
                        style={{ flex: '1 1 0' }}
                    >
                        <TreeVisualization
                            treeData={treeData}
                            traversalPath={traversalPath}
                            isSearching={isSearching}
                            thinking={thinking}
                        />

                        {/* Interactive hint overlay */}
                        {treeData && !isSearching && traversalPath.length === 0 && (
                            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/[0.05] flex items-center gap-2 text-[10px] text-white/40 pointer-events-none data-hide-on-action">
                                <Maximize2 size={10} className="opacity-50" />
                                <span>Scroll to zoom, Click nodes to expand</span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Legend */}
            {!isCollapsed && (
                <div className="shrink-0 flex items-center justify-between px-4 h-12 border-t border-white/[0.06] bg-black/20">
                    <div className="flex items-center gap-4 sm:gap-5">
                        {legendItems.map((item) => (
                            <div key={item.label} className="flex items-center gap-2">
                                <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{
                                        backgroundColor: item.color,
                                        border: `1px solid ${item.border}`,
                                        boxShadow: item.color === '#8b5cf6' || item.color === '#10b981'
                                            ? `0 0 8px ${item.color}50`
                                            : 'none',
                                    }}
                                />
                                <span className="text-[10px] sm:text-[11px] font-medium tracking-wide text-white/40">{item.label}</span>
                            </div>
                        ))}
                    </div>

                    {traversalPath.length > 0 && (
                        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-violet-500/10 border border-violet-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                            <span className="text-[10px] sm:text-[11px] text-violet-300 font-semibold tracking-wide">
                                {traversalPath.length} NODE{traversalPath.length !== 1 ? 'S' : ''} HIT
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
