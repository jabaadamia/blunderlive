"use client";

import { useEffect, useRef, useState } from "react";
import { getUsableAccessToken } from "@/features/auth/lib/auth-client";
import { applyUciMoveToSnapshot } from "@/features/game/lib/snapshot-utils";
import type { GameSnapshot } from "@/features/game/types";

export type WsStatus = "connecting" | "open" | "closed" | "error";

interface UseGameWebSocketResult {
  snapshot: GameSnapshot | null;
  wsStatus: WsStatus;
  error: string | null;
  sendMove: (uci: string) => void;
}

function wsBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_BASE_URL) {
    return process.env.NEXT_PUBLIC_WS_BASE_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}`;
  }
  return "ws://localhost";
}

export function useGameWebSocket(gameId: string): UseGameWebSocketResult {
  const [confirmedSnapshot, setConfirmedSnapshot] = useState<GameSnapshot | null>(null);
  const [optimisticSnapshot, setOptimisticSnapshot] = useState<GameSnapshot | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const optimisticMoveCountRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    let effectCancelled = false;
    let ws: WebSocket | null = null;

    async function connect() {
      const token = await getUsableAccessToken();

      if (effectCancelled || !mountedRef.current) {
        return;
      }

      if (!token) {
        setWsStatus("error");
        setError("Not authenticated");
        return;
      }

      const base = wsBaseUrl();
      const url = `${base}/ws/games/${gameId}/ws?token=${encodeURIComponent(token)}`;
      ws = new WebSocket(url);
      wsRef.current = ws;
      setWsStatus("connecting");

      ws.onopen = () => {
        if (effectCancelled || !mountedRef.current) return;
        setWsStatus("open");
        setError(null);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (effectCancelled || !mountedRef.current) return;
        let msg: {
          type: string;
          state?: GameSnapshot;
          reason?: string;
          code?: string;
          detail?: string;
        };
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }

        switch (msg.type) {
          case "game_state":
          case "move_accepted":
          case "game_over":
            if (msg.state) {
              const incoming = msg.state;
              setConfirmedSnapshot((prev) => {
                if (
                  prev &&
                  prev.fen === incoming.fen &&
                  prev.move_count === incoming.move_count &&
                  prev.status === incoming.status &&
                  prev.result === incoming.result
                ) {
                  return prev;
                }
                return incoming;
              });

              if (
                optimisticMoveCountRef.current !== null &&
                incoming.move_count >= optimisticMoveCountRef.current
              ) {
                optimisticMoveCountRef.current = null;
                setOptimisticSnapshot(null);
              }
            }
            break;

          case "move_rejected":
            optimisticMoveCountRef.current = null;
            setOptimisticSnapshot(null);
            setError(msg.reason ?? "Move rejected");
            break;

          case "error":
            setError(msg.detail ?? msg.code ?? "Unknown error");
            break;

          case "pong":
            break;

          default:
            break;
        }
      };

      ws.onerror = () => {
        if (effectCancelled || !mountedRef.current) return;
        setWsStatus("error");
      };

      ws.onclose = () => {
        if (effectCancelled || !mountedRef.current) return;
        setWsStatus("closed");
      };
    }

    void connect();

    return () => {
      effectCancelled = true;
      mountedRef.current = false;
      wsRef.current = null;
      optimisticMoveCountRef.current = null;
      // Avoid closing while CONNECTING (React Strict Mode remount triggers this and
      // surfaces a noisy "closed before connection is established" in the console).
      // Browsers only allow script-initiated close codes 1000 or 3000–4999 (not 1001).
      const socket = ws;

      if (!socket) {
        return;
      }

      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000);
      } else if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener(
          "open",
          () => {
            socket.close(1000);
          },
          { once: true },
        );
      }
    };
  }, [gameId]);

  const sendMove = (uci: string) => {
    setError(null);

    const baseSnapshot = optimisticSnapshot ?? confirmedSnapshot;

    if (baseSnapshot) {
      const nextSnapshot = applyUciMoveToSnapshot(baseSnapshot, uci);

      if (nextSnapshot) {
        optimisticMoveCountRef.current = nextSnapshot.move_count;
        setOptimisticSnapshot(nextSnapshot);
      }
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "move", uci }));
    }
  };

  return {
    snapshot: optimisticSnapshot ?? confirmedSnapshot,
    wsStatus,
    error,
    sendMove,
  };
}
