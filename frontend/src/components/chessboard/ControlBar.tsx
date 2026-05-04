'use client';

interface ControlBarProps {
  onFlipBoard?: () => void;
}

export default function ControlBar({ onFlipBoard }: ControlBarProps) {
  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={onFlipBoard}
        className="px-3 py-1 border rounded"
      >
        Flip Board
      </button>
    </div>
  );
}