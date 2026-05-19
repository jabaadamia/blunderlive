"use client";

import { useEffect, useRef, useState } from "react";
import { getTokenUserId } from "@/features/auth/lib/jwt";
import { getUsableAccessToken } from "@/features/auth/lib/auth-client";
import { applyUciMoveToSnapshot } from "@/features/game/lib/snapshot-utils";
import type { GameSnapshot } from "@/features/game/types";

export type WsStatus = "connecting" | "open" | "closed" | "error";
export type DrawOfferState = "none" | "incoming" | "outgoing";
export type GameActionPending =
  | "draw_offer"
  | "draw_accept"
  | "draw_decline"
  | "resign"
  | null;

interface UseGameWebSocketResult {
  snapshot: GameSnapshot | null;
  wsStatus: WsStatus;
  error: string | null;
  drawOfferState: DrawOfferState;
  actionPending: GameActionPending;
  sendMove: (uci: string) => void;
  sendDrawOffer: () => void;
  acceptDrawOffer: () => void;
  declineDrawOffer: () => void;
  resign: () => void;
}

function deriveDrawOfferState(
  snapshot: GameSnapshot | null,
  userId: string | null,
): DrawOfferState {
  if (!snapshot?.draw_offer_by || !userId) {
    return "none";
  }

  return snapshot.draw_offer_by === userId ? "outgoing" : "incoming";
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
  const [drawOfferState, setDrawOfferState] = useState<DrawOfferState>("none");
  const [actionPending, setActionPending] = useState<GameActionPending>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const optimisticVersionRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);

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

      userIdRef.current = getTokenUserId(token);

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
              setDrawOfferState(deriveDrawOfferState(incoming, userIdRef.current));

              if (
                optimisticVersionRef.current !== null &&
                incoming.version >= optimisticVersionRef.current
              ) {
                optimisticVersionRef.current = null;
                setOptimisticSnapshot(null);
              }

              setActionPending(null);
            }
            break;

          case "move_rejected":
            optimisticVersionRef.current = null;
            setOptimisticSnapshot(null);
            setError(msg.reason ?? "Move rejected");
            break;

          case "draw_offered":
            setDrawOfferState((prev) => (prev === "outgoing" ? "outgoing" : "incoming"));
            setActionPending(null);
            break;

          case "draw_declined":
            setDrawOfferState("none");
            setActionPending(null);
            setError("Draw offer declined");
            break;

          case "error":
            setActionPending(null);
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
        setActionPending(null);
      };
    }

    void connect();

    return () => {
      effectCancelled = true;
      mountedRef.current = false;
      wsRef.current = null;
      optimisticVersionRef.current = null;
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

  const sendMessage = (payload: object) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setError("Connection is not open");
      return false;
    }

    wsRef.current.send(JSON.stringify(payload));
    return true;
  };

  const sendMove = (uci: string) => {
    setError(null);

    const baseSnapshot = optimisticSnapshot ?? confirmedSnapshot;

    if (baseSnapshot) {
      const nextSnapshot = applyUciMoveToSnapshot(baseSnapshot, uci);

      if (nextSnapshot) {
        optimisticVersionRef.current = nextSnapshot.version;
        setOptimisticSnapshot(nextSnapshot);
      }
    }

    void sendMessage({ type: "move", uci });
  };

  const sendDrawOffer = () => {
    setError(null);
    setActionPending("draw_offer");
    setDrawOfferState("outgoing");

    if (!sendMessage({ type: "draw_offer" })) {
      setActionPending(null);
      setDrawOfferState(deriveDrawOfferState(confirmedSnapshot, userIdRef.current));
    }
  };

  const acceptDrawOffer = () => {
    setError(null);
    setActionPending("draw_accept");

    if (!sendMessage({ type: "draw_accepted" })) {
      setActionPending(null);
    }
  };

  const declineDrawOffer = () => {
    setError(null);
    setActionPending("draw_decline");
    setDrawOfferState("none");

    if (!sendMessage({ type: "draw_decline" })) {
      setActionPending(null);
      setDrawOfferState(deriveDrawOfferState(confirmedSnapshot, userIdRef.current));
    }
  };

  const resign = () => {
    setError(null);
    setActionPending("resign");

    if (!sendMessage({ type: "resign" })) {
      setActionPending(null);
    }
  };

  return {
    snapshot: optimisticSnapshot ?? confirmedSnapshot,
    wsStatus,
    error,
    drawOfferState,
    actionPending,
    sendMove,
    sendDrawOffer,
    acceptDrawOffer,
    declineDrawOffer,
    resign,
  };
}
