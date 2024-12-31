"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChessBoard = void 0;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_svg_1 = __importStar(require("react-native-svg"));
const BOARD_SIZE = Math.min(react_native_1.Dimensions.get('window').width - 32, 400);
const SQUARE_SIZE = BOARD_SIZE / 8;
// SVG paths for chess pieces (minimalist design)
const PIECE_PATHS = {
    k: 'M9,26c8.5-1.5,21-1.5,27,0l2-12l-7,11V11l-5.5,13.5l-3-15l-3,15l-5.5-14V25L7,14L9,26z',
    q: 'M9,26c8.5-1.5,21-1.5,27,0l2.5-12.5L31,25l-0.3-14.1L25,26l-4-15l-4,15l-5.7-15L11,25L9,26z',
    r: 'M9,25H31V24L28,21V9h3V6H9v3h3v12l-3,3V25z',
    b: 'M11.5,15c5.5,3.5,15.5,3.5,21,0v-3c-5.5,3.5-15.5,3.5-21,0V15z M12,13h16v-3H12V13z',
    n: 'M22,10c10.5,1,16.5,8,16,25H15c0-17,5.5-24,16-25',
    p: 'M20,25c-4.5,0-8.5-1-11.5-3c4.5-2,7.5-3,11.5-3c4,0,7,1,11.5,3C28.5,24,24.5,25,20,25z'
};
const ChessBoard = ({ engine, onMove, playerColor = 'w' }) => {
    const [selectedSquare, setSelectedSquare] = (0, react_1.useState)(null);
    const [validMoves, setValidMoves] = (0, react_1.useState)([]);
    const board = engine.getBoard();
    const handleSquarePress = (0, react_1.useCallback)((square) => {
        if (!selectedSquare) {
            const piece = board.get(square);
            if (piece && piece.color === playerColor) {
                setSelectedSquare(square);
                // Calculate valid moves for the selected piece
                const moves = Array.from(board.keys()).filter(toSquare => engine.isValidMove({
                    from: square,
                    to: toSquare,
                    piece: piece
                }));
                setValidMoves(moves);
            }
        }
        else {
            if (validMoves.includes(square)) {
                const piece = board.get(selectedSquare);
                const move = {
                    from: selectedSquare,
                    to: square,
                    piece: piece,
                    captured: board.get(square)
                };
                if (engine.makeMove(move)) {
                    onMove?.(move);
                }
            }
            setSelectedSquare(null);
            setValidMoves([]);
        }
    }, [selectedSquare, validMoves, board, engine, onMove, playerColor]);
    const renderSquare = (0, react_1.useCallback)((square, index) => {
        const file = index % 8;
        const rank = Math.floor(index / 8);
        const isDark = (file + rank) % 2 === 1;
        const piece = board.get(square);
        const isSelected = square === selectedSquare;
        const isValidMove = validMoves.includes(square);
        return (<react_native_1.TouchableOpacity key={square} onPress={() => handleSquarePress(square)} style={[
                styles.square,
                {
                    backgroundColor: isDark ? '#B58863' : '#F0D9B5',
                    borderColor: isSelected ? '#58A4B0' :
                        isValidMove ? '#A7C7E7' : 'transparent',
                    borderWidth: isSelected || isValidMove ? 2 : 0,
                }
            ]}>
        {piece && (<react_native_svg_1.default width={SQUARE_SIZE} height={SQUARE_SIZE} viewBox="0 0 40 40">
            <react_native_svg_1.G transform="translate(4, 4) scale(0.8)" fill={piece.color === 'w' ? '#FFF' : '#000'} stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <react_native_svg_1.Path d={PIECE_PATHS[piece.type]}/>
            </react_native_svg_1.G>
          </react_native_svg_1.default>)}
      </react_native_1.TouchableOpacity>);
    }, [board, selectedSquare, validMoves, handleSquarePress]);
    return (<react_native_1.View style={styles.container}>
      <react_native_1.View style={styles.board}>
        {Array.from({ length: 64 }, (_, i) => {
            const file = String.fromCharCode(97 + (i % 8));
            const rank = Math.floor(i / 8) + 1;
            const square = `${file}${rank}`;
            return renderSquare(square, i);
        })}
      </react_native_1.View>
    </react_native_1.View>);
};
exports.ChessBoard = ChessBoard;
const styles = react_native_1.StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    board: {
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderWidth: 2,
        borderColor: '#8B4513',
    },
    square: {
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
//# sourceMappingURL=ChessBoard.js.map