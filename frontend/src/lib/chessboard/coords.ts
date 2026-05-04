// Shared coordinate helpers used by Board, Square, and BoardWithControls
 
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
 
export type File = (typeof FILES)[number];
export type Rank = (typeof RANKS)[number];
export type SquareCoord = string; // "a1", "h8"
 
/** "e4" -> index (0 = a8, 63 = h1) */
export function coordToIndex(square: SquareCoord): number {
  const file = square[0] as File;
  const rank = parseInt(square[1]) as Rank;
  return (8 - rank) * 8 + FILES.indexOf(file);
}
 
/** index -> "e4" */
export function indexToCoord(index: number): SquareCoord {
  const rank = 8 - Math.floor(index / 8);
  const file = FILES[index % 8];
  return `${file}${rank}`;
}
 