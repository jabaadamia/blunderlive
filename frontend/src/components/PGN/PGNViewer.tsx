"use client";

import { useEffect, useMemo, useRef } from "react";

import { getActiveLine, type MoveTree, type MoveTreeNode } from "@/lib/chessboard/history";

interface PGNViewerProps {
  tree: MoveTree;
  currentNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

interface RenderCtx {
  currentNodeId: string;
  activeLineIds: Set<string>;
  onSelect: (nodeId: string) => void;
}

function collectLineSegment(
  tree: MoveTree,
  startNodeId: string,
): { nodes: MoveTreeNode[]; branchNodeId: string | null; resumeFromId: string | null } {
  const nodes: MoveTreeNode[] = [];
  let nodeId: string | null = startNodeId;

  while (nodeId) {
    const node: MoveTreeNode = tree.nodes[nodeId];

    if (node.parentId !== null) {
      nodes.push(node);
    }

    if (node.children.length === 0) {
      return { nodes, branchNodeId: null, resumeFromId: null };
    }

    if (node.children.length > 1) {
      const mainChildId = node.children[0];
      const mainChild = tree.nodes[mainChildId];
      nodes.push(mainChild);
      return {
        nodes,
        branchNodeId: node.id,
        resumeFromId: mainChild.children[0] ?? null,
      };
    }

    nodeId = node.children[0];
  }

  return { nodes, branchNodeId: null, resumeFromId: null };
}

// Font shrinks a bit per depth level, depth 0 (mainline) is handled separately.
const VARIATION_TEXT_SIZE = [
  "text-[0.8125rem]", // depth 1
  "text-[0.75rem]", // depth 2
  "text-[0.6875rem]", // depth 3
  "text-[0.625rem]", // depth 4+
];

function textSizeForDepth(depth: number) {
  return VARIATION_TEXT_SIZE[Math.min(depth - 1, VARIATION_TEXT_SIZE.length - 1)];
}

/** L-shaped branch connector + indent wrapper for one variation block. */
function Branch({ depth, children }: { depth: number; children: React.ReactNode }) {
  return (
    <div className="relative mt-0.5 mb-0.5 pl-3" style={{ marginLeft: depth > 1 ? 6 : 2 }}>
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-1.5 w-px bg-neutral-300 dark:bg-neutral-700"
      />
      <span
        aria-hidden
        className="absolute left-0 top-[0.65em] w-2 h-px bg-neutral-300 dark:bg-neutral-700"
      />
      {children}
    </div>
  );
}

function MoveToken({
  node,
  showNumber,
  ctx,
  className,
}: {
  node: MoveTreeNode;
  showNumber: boolean;
  ctx: RenderCtx;
  className: string;
}) {
  const isWhite = node.ply % 2 === 1;
  const moveNumber = Math.ceil(node.ply / 2);
  const isActive = node.id === ctx.currentNodeId;
  const isOnActiveLine = ctx.activeLineIds.has(node.id);

  return (
    <span className="inline-flex items-baseline">
      {showNumber && (
        <span className="mr-0.5 tabular-nums text-neutral-400 dark:text-neutral-500">
          {moveNumber}
          {isWhite ? "." : "..."}
        </span>
      )}
      <button
        type="button"
        data-active={isActive ? "true" : undefined}
        onClick={() => ctx.onSelect(node.id)}
        title={`${node.ply}. ${node.san}`}
        className={[
          "rounded-sm px-1 py-0.5 font-mono transition",
          "hover:bg-neutral-100 dark:hover:bg-neutral-800",
          isActive
            ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            : isOnActiveLine
              ? "text-neutral-900 dark:text-neutral-100"
              : "text-neutral-600 dark:text-neutral-400",
          className,
        ].join(" ")}
      >
        {node.san}
      </button>
    </span>
  );
}

// --- Mainline: pair-row / scorecard layout, bigger font ---
interface PairRow {
  key: string;
  moveNumber: number;
  white?: MoveTreeNode;
  black?: MoveTreeNode;
}

function toPairRows(nodes: MoveTreeNode[]): PairRow[] {
  const rows: PairRow[] = [];
  let i = 0;

  while (i < nodes.length) {
    const node = nodes[i];
    const isWhite = node.ply % 2 === 1;
    const moveNumber = Math.ceil(node.ply / 2);

    if (isWhite) {
      const next = nodes[i + 1];
      const pairsWithNext = Boolean(next && next.ply === node.ply + 1);
      rows.push({
        key: node.id,
        moveNumber,
        white: node,
        black: pairsWithNext ? next : undefined,
      });
      i += pairsWithNext ? 2 : 1;
    } else {
      rows.push({ key: node.id, moveNumber, black: node });
      i += 1;
    }
  }

  return rows;
}

function MainlinePairRow({ row, ctx }: { row: PairRow; ctx: RenderCtx }) {
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-1 py-0.5 text-base">
      <span className="tabular-nums text-neutral-400 dark:text-neutral-500 font-semibold">
        {row.moveNumber}
        {row.white ? "." : "..."}
      </span>
      {row.white ? (
        <MoveButtonCell node={row.white} ctx={ctx} />
      ) : (
        <span />
      )}
      {row.black ? (
        <MoveButtonCell node={row.black} ctx={ctx} />
      ) : (
        <span />
      )}
    </div>
  );
}

function MoveButtonCell({ node, ctx }: { node: MoveTreeNode; ctx: RenderCtx }) {
  const isActive = node.id === ctx.currentNodeId;
  const isOnActiveLine = ctx.activeLineIds.has(node.id);

  return (
    <button
      type="button"
      data-active={isActive ? "true" : undefined}
      onClick={() => ctx.onSelect(node.id)}
      title={`${node.ply}. ${node.san}`}
      className={[
        "min-w-0 truncate rounded-sm px-1.5 py-0.5 text-left font-mono font-medium transition",
        "hover:bg-neutral-100 dark:hover:bg-neutral-800",
        isActive
          ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          : isOnActiveLine
            ? "text-neutral-900 dark:text-neutral-100"
            : "text-neutral-700 dark:text-neutral-300",
      ].join(" ")}
    >
      {node.san}
    </button>
  );
}

function renderMainline(tree: MoveTree, rootId: string, ctx: RenderCtx): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let segmentStart: string | null = rootId;

  while (segmentStart) {
    const { nodes, branchNodeId, resumeFromId } = collectLineSegment(tree, segmentStart);

    if (nodes.length > 0) {
      const rows = toPairRows(nodes);
      elements.push(
        <div key={`main-seg-${nodes[0].id}`}>
          {rows.map((row) => (
            <MainlinePairRow key={row.key} row={row} ctx={ctx} />
          ))}
        </div>,
      );
    }

    if (branchNodeId) {
      const branchNode = tree.nodes[branchNodeId];

      for (const altChildId of branchNode.children.slice(1)) {
        elements.push(
          <Branch key={`var-${altChildId}`} depth={1}>
            {renderVariationFlow(tree, altChildId, 1, ctx)}
          </Branch>,
        );
      }

      segmentStart = resumeFromId;
    } else {
      segmentStart = null;
    }
  }

  return elements;
}

// --- Variations: flowing wrapped text, shrinking font per depth ---
function renderVariationFlow(
  tree: MoveTree,
  startNodeId: string,
  depth: number,
  ctx: RenderCtx,
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let segmentStart: string | null = startNodeId;
  let isFirstSegment = true;

  while (segmentStart) {
    const { nodes, branchNodeId, resumeFromId } = collectLineSegment(tree, segmentStart);

    elements.push(
      <div
        key={`varflow-${nodes[0].id}`}
        className={`flex flex-wrap items-baseline gap-x-0.5 gap-y-0.5 ${textSizeForDepth(depth)}`}
      >
        {nodes.map((node, i) => (
          <MoveToken
            key={node.id}
            node={node}
            // Show the move number on every white move, and on the very
            // first token of the variation even if it starts on black.
            showNumber={node.ply % 2 === 1 || (isFirstSegment && i === 0)}
            ctx={ctx}
            className=""
          />
        ))}
      </div>,
    );

    isFirstSegment = false;

    if (branchNodeId) {
      const branchNode = tree.nodes[branchNodeId];

      for (const altChildId of branchNode.children.slice(1)) {
        elements.push(
          <Branch key={`subvar-${altChildId}`} depth={depth + 1}>
            {renderVariationFlow(tree, altChildId, depth + 1, ctx)}
          </Branch>,
        );
      }

      segmentStart = resumeFromId;
    } else {
      segmentStart = null;
    }
  }

  return elements;
}

export default function PGNViewer({ tree, currentNodeId, onSelectNode }: PGNViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeLineIds = useMemo(
    () => new Set(getActiveLine(tree, currentNodeId).map((n) => n.id)),
    [tree, currentNodeId],
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const active = container.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();

    if (activeRect.top < containerRect.top || activeRect.bottom > containerRect.bottom) {
      container.scrollTo({
        top: active.offsetTop - container.clientHeight / 2 + active.clientHeight / 2,
        behavior: "smooth",
      });
    }
  }, [currentNodeId]);

  const rootNode = tree.nodes[tree.rootId];

  const content = useMemo(() => {
    if (!rootNode || rootNode.children.length === 0) return [];
    return renderMainline(tree, tree.rootId, {
      currentNodeId,
      activeLineIds,
      onSelect: onSelectNode,
    });
  }, [tree, rootNode, currentNodeId, activeLineIds, onSelectNode]);

  return (
    <aside className="flex h-full w-full min-w-0 max-w-[20rem] flex-col overflow-hidden rounded-sm border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 xl:h-full xl:min-h-28 xl:max-w-[20rem]">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 py-3">
        {content.length > 0 ? <div>{content}</div> : null}
      </div>
    </aside>
  );
}
