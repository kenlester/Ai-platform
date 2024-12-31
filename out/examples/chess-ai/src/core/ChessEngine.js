"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChessEngine = void 0;
const handler_1 = require("../../../../ai_core/protocols/handler");
const crypto_1 = require("crypto");
class ChessEngine {
    constructor() {
        this.board = new Map();
        this.moveHistory = [];
        this.protocolHandler = handler_1.ProtocolHandler.getInstance();
        this.patternCache = new Map();
        this.initializeBoard();
    }
    initializeBoard() {
        // Initialize pawns
        for (let file of 'abcdefgh') {
            this.board.set(`${file}2`, { type: 'p', color: 'w', position: `${file}2` });
            this.board.set(`${file}7`, { type: 'p', color: 'b', position: `${file}7` });
        }
        // Initialize other pieces
        const pieces = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
        pieces.forEach((piece, index) => {
            const file = String.fromCharCode(97 + index); // 'a' through 'h'
            this.board.set(`${file}1`, { type: piece, color: 'w', position: `${file}1` });
            this.board.set(`${file}8`, { type: piece, color: 'b', position: `${file}8` });
        });
    }
    async evaluatePosition() {
        const positionHash = this.getBoardHash();
        // Check pattern cache first
        if (this.patternCache.has(positionHash)) {
            return this.patternCache.get(positionHash);
        }
        // Use AI protocol for position evaluation
        const response = await this.protocolHandler.handleMessage({
            protocol_version: '1.0.0',
            message_id: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
            sender: {
                id: 'chess_engine',
                type: 'agent',
                capabilities: ['pattern_recognition', 'position_evaluation']
            },
            intent: {
                type: 'query',
                action: 'evaluate_position',
                priority: 2
            },
            content: {
                format: 'json',
                data: {
                    position: this.serializePosition(),
                    move_history: this.moveHistory
                }
            },
            optimization: {
                pattern_id: positionHash,
                caching: {
                    ttl: 3600,
                    strategy: 'memory'
                }
            }
        });
        const evaluation = response.content.data.evaluation;
        this.patternCache.set(positionHash, evaluation);
        return evaluation;
    }
    async getBestMove(color) {
        const response = await this.protocolHandler.handleMessage({
            protocol_version: '1.0.0',
            message_id: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
            sender: {
                id: 'chess_engine',
                type: 'agent',
                capabilities: ['pattern_recognition', 'move_generation']
            },
            intent: {
                type: 'query',
                action: 'get_best_move',
                priority: 1
            },
            content: {
                format: 'json',
                data: {
                    position: this.serializePosition(),
                    color,
                    move_history: this.moveHistory
                }
            },
            optimization: {
                compression: true,
                caching: {
                    ttl: 1800,
                    strategy: 'memory'
                }
            }
        });
        return response.content.data.move;
    }
    getBoardHash() {
        return Array.from(this.board.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([square, piece]) => `${square}:${piece.type}${piece.color}`)
            .join('|');
    }
    serializePosition() {
        let fen = '';
        for (let rank = 8; rank >= 1; rank--) {
            let emptySquares = 0;
            for (let file = 0; file < 8; file++) {
                const square = `${String.fromCharCode(97 + file)}${rank}`;
                const piece = this.board.get(square);
                if (piece) {
                    if (emptySquares > 0) {
                        fen += emptySquares;
                        emptySquares = 0;
                    }
                    const pieceChar = piece.color === 'w'
                        ? piece.type.toUpperCase()
                        : piece.type.toLowerCase();
                    fen += pieceChar;
                }
                else {
                    emptySquares++;
                }
            }
            if (emptySquares > 0) {
                fen += emptySquares;
            }
            if (rank > 1) {
                fen += '/';
            }
        }
        return fen;
    }
    isValidMove(move) {
        const piece = this.board.get(move.from);
        if (!piece)
            return false;
        // Basic move validation
        const [fromFile, fromRank] = move.from.split('');
        const [toFile, toRank] = move.to.split('');
        // Prevent capturing own pieces
        const targetPiece = this.board.get(move.to);
        if (targetPiece && targetPiece.color === piece.color) {
            return false;
        }
        // Simplified piece movement validation
        switch (piece.type) {
            case 'p': // Pawn
                const direction = piece.color === 'w' ? 1 : -1;
                const startRank = piece.color === 'w' ? '2' : '7';
                const rankDiff = parseInt(toRank) - parseInt(fromRank);
                const fileDiff = Math.abs(toFile.charCodeAt(0) - fromFile.charCodeAt(0));
                // Basic pawn moves
                if (fileDiff === 0 && !targetPiece) {
                    if (rankDiff === direction)
                        return true;
                    if (fromRank === startRank && rankDiff === 2 * direction)
                        return true;
                }
                // Captures
                if (fileDiff === 1 && rankDiff === direction && targetPiece)
                    return true;
                break;
            case 'r': // Rook
                return fromFile === toFile || fromRank === toRank;
            case 'n': // Knight
                const fileChange = Math.abs(toFile.charCodeAt(0) - fromFile.charCodeAt(0));
                const rankChange = Math.abs(parseInt(toRank) - parseInt(fromRank));
                return (fileChange === 2 && rankChange === 1) || (fileChange === 1 && rankChange === 2);
            case 'b': // Bishop
                return Math.abs(toFile.charCodeAt(0) - fromFile.charCodeAt(0)) ===
                    Math.abs(parseInt(toRank) - parseInt(fromRank));
            case 'q': // Queen
                return fromFile === toFile || fromRank === toRank ||
                    Math.abs(toFile.charCodeAt(0) - fromFile.charCodeAt(0)) ===
                        Math.abs(parseInt(toRank) - parseInt(fromRank));
            case 'k': // King
                return Math.abs(toFile.charCodeAt(0) - fromFile.charCodeAt(0)) <= 1 &&
                    Math.abs(parseInt(toRank) - parseInt(fromRank)) <= 1;
        }
        return false;
    }
    makeMove(move) {
        if (!this.isValidMove(move))
            return false;
        const piece = this.board.get(move.from);
        if (!piece)
            return false;
        // Update piece position
        this.board.delete(move.from);
        this.board.set(move.to, { ...piece, position: move.to });
        // Handle promotion
        if (move.promotion && piece.type === 'p') {
            const lastRank = piece.color === 'w' ? '8' : '1';
            if (move.to.endsWith(lastRank)) {
                this.board.set(move.to, { ...piece, type: move.promotion });
            }
        }
        this.moveHistory.push(move);
        return true;
    }
    getBoard() {
        return new Map(this.board);
    }
    getMoveHistory() {
        return [...this.moveHistory];
    }
}
exports.ChessEngine = ChessEngine;
//# sourceMappingURL=ChessEngine.js.map