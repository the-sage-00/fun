import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';

// ── Types ────────────────────────────────────────────────────
export interface TreeNode {
    title: string;
    node_id: string;
    summary?: string;
    prefix_summary?: string;
    line_num?: number;
    nodes?: TreeNode[];
}

interface TreeVisualizationProps {
    treeData: TreeNode[] | null;
    traversalPath: string[];
    isSearching: boolean;
    thinking: string;
    hoveredSource?: string | null;
    relevanceMap?: Record<string, number>;
}

interface D3Node {
    name: string;
    nodeId: string;
    summary: string;
    lineNum?: number;
    children?: D3Node[];
    _children?: D3Node[]; // To store collapsed children
}

// ── Helpers ──────────────────────────────────────────────────

/** Convert the PageIndex tree JSON into a single-root D3 hierarchy */
function convertToD3Tree(nodes: TreeNode[]): D3Node {
    if (nodes.length === 1) {
        return mapNode(nodes[0]);
    }
    return {
        name: 'Document Root',
        nodeId: 'root',
        summary: 'Root of the document structure.',
        lineNum: 1,
        children: nodes.map(mapNode),
    };
}

function mapNode(node: TreeNode): D3Node {
    return {
        name: node.title || 'Untitled',
        nodeId: node.node_id,
        summary: node.summary || node.prefix_summary || '',
        lineNum: node.line_num,
        children: node.nodes?.map(mapNode),
    };
}

/** Get all ancestor node IDs for a given set of target IDs */
function getAncestorIds(
    root: d3.HierarchyNode<D3Node>,
    targetIds: Set<string>
): Set<string> {
    const ancestors = new Set<string>();
    root.each((node) => {
        if (targetIds.has(node.data.nodeId)) {
            let current: d3.HierarchyNode<D3Node> | null = node;
            while (current) {
                ancestors.add(current.data.nodeId);
                current = current.parent;
            }
        }
    });
    return ancestors;
}

/** 
 * Wraps text into multiple lines if it exceeds maxWidth.
 * Returns an array of text strings.
 */
function wrapText(text: string, maxWidth: number = 18): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        if (currentLine.length + word.length + 1 <= maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);

    // Truncate to max 3 lines to fit cleanly in the node box
    if (lines.length > 3) {
        return [...lines.slice(0, 2), lines[2] + '...'];
    }
    return lines;
}

// ── Component ────────────────────────────────────────────────

export default function TreeVisualization({
    treeData,
    traversalPath,
    isSearching,
    thinking,
    hoveredSource,
    relevanceMap,
}: TreeVisualizationProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [tooltip, setTooltip] = useState<{
        x: number;
        y: number;
        text: string;
        title: string;
        lineNum?: number;
    } | null>(null);

    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    // Convert raw treeData to D3 hierarchy once
    const rootHierarchy = useMemo(() => {
        if (!treeData) return null;
        const d3Data = convertToD3Tree(
            Array.isArray(treeData) ? treeData : (treeData as any).structure || [treeData]
        );
        return d3.hierarchy(d3Data);
    }, [treeData]);

    // Expand all nodes in traversal path
    useEffect(() => {
        if (traversalPath.length > 0 && rootHierarchy) {
            const targetIds = new Set(traversalPath.map((id) => String(id).padStart(4, '0')));
            const activeIds = getAncestorIds(rootHierarchy, targetIds);
            setExpandedNodes((prev) => {
                const next = new Set(prev);
                activeIds.forEach(id => next.add(id));
                return next;
            });
        }
    }, [traversalPath, rootHierarchy]);

    // ── Resize observer ──
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            }
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Handle node click for expand/collapse
    const handleNodeClick = useCallback((event: any, d: d3.HierarchyNode<D3Node>) => {
        event.stopPropagation();
        if (!d.children && (!d.data.children || d.data.children.length === 0)) return; // Leaf node

        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(d.data.nodeId)) {
                next.delete(d.data.nodeId);
            } else {
                next.add(d.data.nodeId);
            }
            return next;
        });
    }, []);

    // ── Build & render the D3 tree ──
    const renderTree = useCallback(() => {
        if (!rootHierarchy || !svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove(); // Clear previous

        const { width, height } = dimensions;
        const margin = { top: 60, right: 60, bottom: 60, left: 60 };

        // Create a copy of the hierarchy to modify structure based on expanded state
        const root = rootHierarchy.copy();

        // Auto-expand logic based on state
        const initializeNodeState = (node: d3.HierarchyNode<D3Node>) => {
            if (node.children) {
                const shouldBeExpanded = expandedNodes.size === 0
                    ? node.depth < 2
                    : expandedNodes.has(node.data.nodeId);

                if (!shouldBeExpanded) {
                    node.data._children = node.children.map(c => c.data);
                    node.children = undefined;
                } else {
                    if (expandedNodes.size === 0 && node.depth < 2) {
                        expandedNodes.add(node.data.nodeId);
                    }
                    node.children.forEach(initializeNodeState);
                }
            }
        };

        initializeNodeState(root);

        // split children into left and right half for mindmap layout
        let leftChildren: d3.HierarchyNode<D3Node>[] = [];
        let rightChildren: d3.HierarchyNode<D3Node>[] = [];

        if (root.children) {
            const half = Math.ceil(root.children.length / 2);
            rightChildren = root.children.slice(0, half);
            leftChildren = root.children.slice(half);
        }

        // A fake node to compute standard D3 layouts for each half independently
        const createHalfTree = (children: d3.HierarchyNode<D3Node>[], isLeft: boolean) => {
            // Create a mock hierarchy for this half
            const mockData = { name: "mock", nodeId: "mock", summary: "" };
            const mockRoot = d3.hierarchy<D3Node>(mockData);
            // Link children to mockRoot so tree layout calculates their relative positions
            mockRoot.children = children;
            children.forEach(c => { c.parent = mockRoot as any; });

            let visibleNodes = 0;
            mockRoot.each(() => visibleNodes++);

            const rowHeight = 70; // Increased spacing for rectangular nodes
            const h = Math.max(height - margin.top - margin.bottom, visibleNodes * rowHeight);
            const w = (width / 2) - margin.left - 60; // 60px extra space near center

            // We use size[height, width], since it's a left/right branching map
            const layout = d3.tree<D3Node>()
                .size([h, w])
                .separation((a, b) => (a.parent === b.parent ? 1.2 : 1.5));

            layout(mockRoot);

            // Calculate Y offset to center this half's subtree
            // mockRoot.x is the vertical center of the tree according to the layout

            children.forEach(child => {
                child.each(c => {
                    // c.y is horizontal standard layout coordinate
                    // If it's a left child, invert horizontal direction
                    // We add some buffer from the center root node
                    const horizontalGap = 160;
                    (c as any).layoutY = isLeft ? - (c as any).y - horizontalGap : (c as any).y + horizontalGap;
                    (c as any).layoutX = (c as any).x;
                });
            });

            return { totalHeight: h, rootY: (mockRoot as any).x };
        };

        let leftStats = { totalHeight: 0, rootY: 0 };
        let rightStats = { totalHeight: 0, rootY: 0 };

        if (leftChildren.length > 0) leftStats = createHalfTree(leftChildren, true);
        if (rightChildren.length > 0) rightStats = createHalfTree(rightChildren, false);

        // Calculate maximum required area
        const maxTreeHeight = Math.max(leftStats.totalHeight, rightStats.totalHeight, height);

        // Re-assign parents for the root's direct children back to actual root
        if (root.children) {
            root.children.forEach(c => { c.parent = root; });
        }
        (root as any).layoutY = 0;

        // Center the root vertically based on the calculated layout heights
        // and adjust all children's X (which is vertical axis in d3 standard tree)
        const centerAlignX = maxTreeHeight / 2;
        (root as any).layoutX = centerAlignX;

        if (leftChildren.length > 0) {
            const offset = centerAlignX - leftStats.rootY;
            leftChildren.forEach(child => child.each(c => (c as any).layoutX += offset));
        }
        if (rightChildren.length > 0) {
            const offset = centerAlignX - rightStats.rootY;
            rightChildren.forEach(child => child.each(c => (c as any).layoutX += offset));
        }

        // Add defs for glow filter
        const defs = svg.append('defs');
        const filter = defs.append('filter').attr('id', 'glow');
        filter
            .append('feGaussianBlur')
            .attr('stdDeviation', '4')
            .attr('result', 'coloredBlur');
        const feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        const g = svg.append('g');

        // Pan & Zoom
        let currentZoom = d3.zoomIdentity.translate(width / 2, Math.max(margin.top, (height - maxTreeHeight) / 2));

        const zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);
        svg.call(zoom.transform, currentZoom);

        // Node Dimensions
        const nodeWidth = 140;
        const nodeHeight = 44;
        const rootRadius = 36; // Root is perfectly circular

        // ── Links (Orthogonal Step-Paths) ──
        g.selectAll('.tree-link')
            .data(root.links())
            .join('path')
            .attr('class', 'tree-link')
            .attr('data-target-id', (d) => d.target.data.nodeId)
            .attr('d', (d: any) => {
                const sx = d.source.layoutX;
                const sy = d.source.layoutY;
                const tx = d.target.layoutX;
                const ty = d.target.layoutY;

                // Root links start from edge of root cylinder
                let startY = sy;
                if (d.source.depth === 0) {
                    startY = ty < 0 ? sy - rootRadius : sy + rootRadius;
                } else {
                    // standard nodes anchor from left or right edge
                    startY = ty < 0 ? sy - (nodeWidth / 2) : sy + (nodeWidth / 2);
                }

                // children anchor at left or right inner edge
                const endY = ty < 0 ? ty + (nodeWidth / 2) : ty - (nodeWidth / 2);
                const midY = (startY + endY) / 2;

                return `M${startY},${sx} L${midY},${sx} L${midY},${tx} L${endY},${tx}`;
            })
            .attr('fill', 'none')
            .attr('stroke', 'rgba(255,255,255,0.1)') // Subtle border like screenshot
            .attr('stroke-width', 1.5)
            .attr('opacity', 0)
            .transition()
            .duration(400)
            .attr('opacity', 1);

        // ── Nodes ──
        const node = g
            .selectAll('.tree-node')
            .data(root.descendants())
            .join('g')
            .attr('class', 'tree-node')
            .attr('data-node-id', (d) => d.data.nodeId)
            .attr('transform', (d: any) => `translate(${d.layoutY},${d.layoutX})`)
            .attr('opacity', 0);

        node
            .transition()
            .duration(400)
            .attr('opacity', 1);

        // Node Rectangles (for non-root)
        node.filter(d => d.depth !== 0)
            .append('rect')
            .attr('class', 'node-box')
            .attr('x', -nodeWidth / 2)
            .attr('y', -nodeHeight / 2)
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 8) // Rounded corners
            .attr('fill', (d) => {
                if (d.data._children && !d.children) return 'rgba(30, 41, 59, 1)'; // collapsed look
                return 'rgba(15, 23, 42, 0.9)'; // Tailwind slate-900 with transparency
            })
            .attr('stroke', (d) => d.children || d.data._children ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.15)') // Deep blue border for parents like screenshot
            .attr('stroke-width', 1.5)
            .attr('cursor', d => d.children || d.data._children ? 'pointer' : 'default')
            .on('click', handleNodeClick)
            .on('mouseenter', (event, d) => {
                const [x, y] = d3.pointer(event, containerRef.current);
                const summary = d.data.summary
                    ? d.data.summary.substring(0, 200) + (d.data.summary.length > 200 ? '...' : '')
                    : 'No detailed summary available.';
                setTooltip({ x, y, text: summary, title: d.data.name, lineNum: d.data.lineNum });
            })
            .on('mouseleave', () => setTooltip(null));

        // Root Node (Circle/Pill)
        node.filter(d => d.depth === 0)
            .append('circle')
            .attr('class', 'node-box')
            .attr('r', rootRadius)
            .attr('fill', 'rgba(6, 78, 59, 0.8)') // Emerald/Green background for root like in screenshot
            .attr('stroke', 'rgba(16, 185, 129, 0.6)')
            .attr('stroke-width', 2)
            .attr('cursor', 'default')
            .on('mouseenter', (event, d) => {
                const [x, y] = d3.pointer(event, containerRef.current);
                setTooltip({ x, y, text: 'Root node connecting the document structure.', title: d.data.name, lineNum: 1 });
            })
            .on('mouseleave', () => setTooltip(null));

        // Expand/Collapse indicators (blue glowing dots on edges for branches)
        node.filter(d => !!(d.children || d.data._children) && d.depth !== 0)
            .append('circle')
            .attr('cx', (d: any) => d.layoutY < 0 ? -nodeWidth / 2 : nodeWidth / 2) // Anchor to outer edge
            .attr('cy', 0)
            .attr('r', 4)
            .attr('fill', '#3b82f6')
            .attr('filter', 'url(#glow)')
            .style('pointer-events', 'none');

        // Root node icon (book icon representation)
        node.filter(d => d.depth === 0)
            .append('path')
            .attr('d', "M6 8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v10a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2V8zm8 0a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2v10a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V8z")
            .attr('transform', 'translate(-10, -16)')
            .attr('fill', 'none')
            .attr('stroke', '#ffffff')
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('stroke-width', 1.5)
            .style('pointer-events', 'none');

        // Node Labels (multiline wrapper for rectangular nodes)
        node.filter(d => d.depth !== 0)
            .each(function (d) {
                const lines = wrapText(d.data.name);
                const yOffset = -(lines.length - 1) * 6;

                const textGroup = d3.select(this).append('text')
                    .attr('class', 'node-label')
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#e2e8f0') // Light blue/grey text like screenshot
                    .attr('font-size', '11px')
                    .attr('font-family', 'Inter, sans-serif')
                    .attr('font-weight', '500')
                    .style('pointer-events', 'none');

                lines.forEach((line, i) => {
                    textGroup.append('tspan')
                        .attr('x', 0)
                        .attr('y', yOffset + (i * 14))
                        .text(line);
                });
            });

        // Root Label
        node.filter(d => d.depth === 0)
            .append('text')
            .attr('class', 'node-label')
            .attr('dy', '18px') // Below the icon
            .attr('text-anchor', 'middle')
            .text((d) => d.data.name.length > 15 ? d.data.name.substring(0, 15) + '…' : d.data.name)
            .attr('fill', '#ffffff')
            .attr('font-size', '11px')
            .attr('font-family', 'Inter, sans-serif')
            .attr('font-weight', '600')
            .style('pointer-events', 'none');


        // Save final tree layout attributes to center on search
        (svg.node() as any).__d3TreeRoot = root;
        (svg.node() as any).__d3Zoom = zoom;

    }, [rootHierarchy, dimensions, expandedNodes, handleNodeClick]);

    // ── Animate traversal path ──
    useEffect(() => {
        if (!svgRef.current || !rootHierarchy || traversalPath.length === 0) return;

        const svg = d3.select(svgRef.current);
        const targetIds = new Set(traversalPath.map((id) => String(id).padStart(4, '0')));

        const root = (svg.node() as any).__d3TreeRoot as d3.HierarchyNode<D3Node>;
        if (!root) return;

        const activeIds = getAncestorIds(rootHierarchy, targetIds);

        // Dim everything first
        svg
            .selectAll('.tree-node')
            .transition()
            .duration(500)
            .attr('opacity', function () {
                const nodeId = d3.select(this).attr('data-node-id');
                return activeIds.has(nodeId) ? 1 : 0.15; // lighter dimming
            });

        svg
            .selectAll('.tree-link')
            .transition()
            .duration(500)
            .attr('opacity', function () {
                const targetId = d3.select(this).attr('data-target-id');
                return activeIds.has(targetId) ? 1 : 0.1;
            })
            .attr('stroke', function () {
                const targetId = d3.select(this).attr('data-target-id');
                return activeIds.has(targetId) ? '#3b82f6' : 'rgba(255,255,255,0.1)'; // Bright blue like screenshot
            })
            .attr('stroke-width', function () {
                const targetId = d3.select(this).attr('data-target-id');
                return activeIds.has(targetId) ? 2.5 : 1.5;
            });

        // Auto-pan to first target node if possible
        let firstTarget: d3.HierarchyPointNode<D3Node> | null = null;
        root.each((node) => {
            if (targetIds.has(node.data.nodeId) && !firstTarget) {
                firstTarget = node as unknown as d3.HierarchyPointNode<D3Node>;
            }
        });

        if (firstTarget) {
            const zoom = (svg.node() as any).__d3Zoom;
            if (zoom) {
                const scale = 1.1;
                const x = -(firstTarget as any).layoutY * scale + dimensions.width / 2;
                const y = -(firstTarget as any).layoutX * scale + dimensions.height / 2;

                svg
                    .transition()
                    .duration(1200)
                    .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
            }
        }

        // Animate traversed nodes with glowing heat highlight based on relevance score
        let delay = 300;

        // Setup color scale for Heatmap (0 to 1) -> (blue to pink)
        const nodeColorScale = d3.scaleLinear<string>().domain([0.0, 1.0]).range(['rgba(30, 64, 175, 0.4)', 'rgba(236, 72, 153, 0.5)']);
        const strokeColorScale = d3.scaleLinear<string>().domain([0.0, 1.0]).range(['#3b82f6', '#ec4899']);

        root.each((node) => {
            if (activeIds.has(node.data.nodeId) && node.depth !== 0) { // Keep root green
                const isTarget = targetIds.has(node.data.nodeId);
                const score = (relevanceMap && relevanceMap[node.data.nodeId]) ? relevanceMap[node.data.nodeId] : (isTarget ? 0.8 : 0.0);

                svg
                    .selectAll(`.tree-node[data-node-id="${node.data.nodeId}"] .node-box`)
                    .transition()
                    .delay(delay)
                    .duration(500)
                    .attr('fill', isTarget ? nodeColorScale(score) : 'rgba(30, 64, 175, 0.4)')
                    .attr('stroke', isTarget ? strokeColorScale(score) : '#3b82f6')
                    .attr('filter', isTarget ? 'url(#glow)' : null);

                svg
                    .selectAll(`.tree-node[data-node-id="${node.data.nodeId}"] .node-label`)
                    .transition()
                    .delay(delay)
                    .duration(500)
                    .attr('fill', '#ffffff')
                    .attr('font-weight', '700');

                delay += 100;
            }
        });
    }, [traversalPath, rootHierarchy, dimensions, relevanceMap]);

    // Re-render when dependencies change
    useEffect(() => {
        renderTree();
    }, [renderTree]);

    // ── Handle Hover Highlights ──
    useEffect(() => {
        if (!svgRef.current || !rootHierarchy) return;
        const svg = d3.select(svgRef.current);

        const targetIds = new Set(traversalPath.map((id) => String(id).padStart(4, '0')));
        const activeIds = getAncestorIds(rootHierarchy, targetIds);
        const isSearchedState = traversalPath.length > 0;

        if (hoveredSource) {
            svg.selectAll('.tree-node').each(function (d: any) {
                if (d.depth !== 0 && d.data.name === hoveredSource) {
                    d3.select(this).select('.node-box')
                        .transition().duration(200)
                        .attr('stroke', '#a78bfa') // Violet highlight
                        .attr('filter', 'url(#glow)')
                        .attr('fill', 'rgba(139, 92, 246, 0.4)');

                    // Make it fully opaque
                    d3.select(this).transition().duration(200).attr('opacity', 1);
                }
            });
        } else {
            // Revert state
            svg.selectAll('.tree-node').each(function (d: any) {
                if (d.depth !== 0) {
                    const isTarget = targetIds.has(d.data.nodeId);
                    const isActive = activeIds.has(d.data.nodeId);

                    if (isActive) {
                        d3.select(this).select('.node-box')
                            .transition().duration(200)
                            .attr('stroke', '#3b82f6')
                            .attr('fill', isTarget ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 64, 175, 0.4)')
                            .attr('filter', isTarget ? 'url(#glow)' : null);
                    } else {
                        d3.select(this).select('.node-box')
                            .transition().duration(200)
                            .attr('stroke', (n: any) => n.children || n.data._children ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.15)')
                            .attr('fill', (n: any) => (n.data._children && !n.children) ? 'rgba(30, 41, 59, 1)' : 'rgba(15, 23, 42, 0.9)')
                            .attr('filter', null);

                        d3.select(this).transition().duration(200).attr('opacity', isSearchedState && !isActive ? 0.15 : 1);
                    }
                }
            });
        }
    }, [hoveredSource, traversalPath, rootHierarchy]);

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#0a0a0f] rounded-tl-xl selection:bg-violet-500/30">
            {/* Background Grid Pattern for Premium Look */}
            <div
                className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage: `radial-gradient(#fff 1px, transparent 1px)`,
                    backgroundSize: '24px 24px'
                }}
            />

            {/* SVG Canvas */}
            <svg
                ref={svgRef}
                width={dimensions.width}
                height={dimensions.height}
                className="w-full h-full relative z-10"
                style={{ background: 'transparent' }}
            />

            {/* Glassmorphism Tooltip */}
            {tooltip && (
                <div
                    className="absolute z-50 max-w-[320px] px-4 py-3 rounded-xl pointer-events-none transform transition-all duration-200"
                    style={{
                        left: Math.min(tooltip.x + 20, dimensions.width - 340),
                        top: Math.min(tooltip.y + 20, dimensions.height - 120),
                        background: 'rgba(12, 12, 18, 0.85)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
                    }}
                >
                    <div className="flex justify-between items-start mb-1.5 gap-4">
                        <div className="font-semibold text-violet-300 text-[12px] tracking-wide leading-tight">
                            {tooltip.title}
                        </div>
                        {tooltip.lineNum && (
                            <div className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300/80 border border-violet-500/20">
                                L{tooltip.lineNum}
                            </div>
                        )}
                    </div>
                    <div className="text-white/60 leading-relaxed text-[11px]">
                        {tooltip.text}
                    </div>
                </div>
            )}

            {/* Thinking overlay Modal */}
            {isSearching && thinking && (
                <div
                    className="absolute bottom-6 left-6 right-6 px-5 py-4 rounded-xl z-20 animate-fade-in shadow-2xl"
                    style={{
                        background: 'rgba(18, 18, 26, 0.95)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 40px rgba(139, 92, 246, 0.05)',
                    }}
                >
                    <div className="flex items-center gap-3 mb-2 justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1.5 bg-violet-500/20 p-1.5 rounded-md">
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-violet-300 font-semibold text-sm tracking-wide">AI is traversing the tree...</span>
                        </div>
                    </div>
                    <div className="text-white/50 leading-relaxed text-xs p-2.5 rounded-lg bg-black/40 border border-white/[0.05] max-h-24 overflow-y-auto">
                        {thinking}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!treeData && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 z-10 w-full h-full bg-[#030303]">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/[0.02] to-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-4 shadow-xl">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium tracking-wide text-white/40">Waiting for document</p>
                    <p className="text-xs text-white/20 mt-2 text-center max-w-[240px] leading-relaxed">The AI will extract the table of contents and build an interactive map here.</p>
                </div>
            )}
        </div>
    );
}
