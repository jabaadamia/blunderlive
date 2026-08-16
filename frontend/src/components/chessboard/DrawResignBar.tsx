'use client';

import { useState } from 'react';
import type { IconType } from 'react-icons';
import { FaHandshake } from 'react-icons/fa';
import { FaFlag } from "react-icons/fa6";

type ConfirmAction = 'draw' | 'resign' | null;

function DrawResignButton({
  icon: Icon,
  title,
  disabled = false,
  onClick,
}: {
  icon: IconType;
  title: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-9 w-9 items-center justify-center text-ink-secondary transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

interface DrawResignBarProps {
  canOfferDraw?: boolean;
  canResign?: boolean;
  hasIncomingDrawOffer?: boolean;
  hasOutgoingDrawOffer?: boolean;
  actionPending?: boolean;
  onDrawOffer?: () => void;
  onDrawAccept?: () => void;
  onDrawDecline?: () => void;
  onResign?: () => void;
}

export default function DrawResignBar({
  canOfferDraw = true,
  canResign = true,
  hasIncomingDrawOffer = false,
  hasOutgoingDrawOffer = false,
  actionPending = false,
  onDrawOffer,
  onDrawAccept,
  onDrawDecline,
  onResign,
}: DrawResignBarProps) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const visibleConfirmAction =
    actionPending || hasIncomingDrawOffer || hasOutgoingDrawOffer ? null : confirmAction;

  if (hasIncomingDrawOffer) {
    return (
      <div className="flex items-center justify-center gap-3 py-1">
        <button
          type="button"
          onClick={onDrawAccept}
          disabled={actionPending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-text transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Accept draw
        </button>
        <button
          type="button"
          onClick={onDrawDecline}
          disabled={actionPending}
          className="rounded-md border border-line-strong px-3 py-2 text-sm font-medium text-ink-secondary transition hover:border-ink-faint hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-50 dark:text-ink"
        >
          Decline
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-1">
      <div className="flex items-center gap-2">
        <DrawResignButton
          icon={FaHandshake}
          title={hasOutgoingDrawOffer ? "Draw offered" : "Offer Draw"}
          disabled={!canOfferDraw || hasOutgoingDrawOffer || actionPending}
          onClick={() => setConfirmAction((value) => (value === 'draw' ? null : 'draw'))}
        />
        {hasOutgoingDrawOffer ? (
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
            Draw offered
          </span>
        ) : null}
        {visibleConfirmAction === 'draw' ? (
          <div className="flex items-center gap-2 text-sm text-ink-secondary">
            <span>Offer draw?</span>
            <button
              type="button"
              onClick={() => {
                setConfirmAction(null);
                onDrawOffer?.();
              }}
              disabled={actionPending}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-text transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              disabled={actionPending}
              className="rounded-md border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-secondary transition hover:border-ink-faint hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-50 dark:text-ink"
            >
              No
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <DrawResignButton
          icon={FaFlag}
          title="Resign"
          disabled={!canResign || actionPending}
          onClick={() => setConfirmAction((value) => (value === 'resign' ? null : 'resign'))}
        />
        {visibleConfirmAction === 'resign' ? (
          <div className="flex items-center gap-2 text-sm text-ink-secondary">
            <span>Resign?</span>
            <button
              type="button"
              onClick={() => {
                setConfirmAction(null);
                onResign?.();
              }}
              disabled={actionPending}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-text transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              disabled={actionPending}
              className="rounded-md border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-secondary transition hover:border-ink-faint hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-50 dark:text-ink"
            >
              No
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
