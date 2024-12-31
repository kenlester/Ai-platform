export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type Color = 'w' | 'b';
export type Square = string; // e.g., 'e4'

export interface Piece {
  type: PieceType;
  color: Color;
  position: Square;
}

export interface Move {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: Piece;
  promotion?: PieceType;
}
