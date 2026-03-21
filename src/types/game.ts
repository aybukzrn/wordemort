export type Direction = 'H' | 'V';

export type GameMode = 'TR' | 'TR_EN' | 'EN_TR';

export interface WordPlacement {
  word: string;
  row: number;
  col: number;
  dir: Direction;
}

export interface Level {
  level: number;
  letters: string[];
  words: string[];
  meanings: Record<string, string>;
  placements: WordPlacement[];
  gridRows: number;
  gridCols: number;
}

export interface GridCell {
  row: number;
  col: number;
  letter: string;
  isRevealed: boolean;
}
