// Temp page for testing the chessboard in isolation.
'use client';
import BoardWithControls from '@/components/chessboard/BoardWithControls';
 
export default function BoardPage() {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-4xl">
        <BoardWithControls pgnViewer={true} controlBar={true} />
      </div>
    </div>
  );
}