const chessboard = document.getElementById('chessboard');
const currentPlayerDisplay = document.getElementById('current-player-display');
const messageDisplay = document.getElementById('message');
const newGameBtn = document.getElementById('new-game-btn');
const undoBtn = document.getElementById('undo-btn'); // Get new undo button
const redoBtn = document.getElementById('redo-btn'); // Get new redo button


// Unicode chess pieces
const pieces = {
    'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙', // Black
    'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟'  // White
};

// Initial board setup (FEN string like representation)
let board = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

let selectedSquare = null;
let currentPlayer = 'white'; // 'white' or 'black'
let gameOver = false;

// --- New: History for Undo/Redo ---
let boardHistory = []; // Stores states AFTER a move and turn switch
let redoHistory = [];  // Stores states for redoing undone moves

// Helper for deep copying the board array
function deepCopyBoard(boardToCopy) {
    return boardToCopy.map(row => [...row]);
}

// Helper to capture the current game state and add it to history
function captureCurrentStateToHistory() {
    boardHistory.push({
        boardState: deepCopyBoard(board),
        player: currentPlayer,
        gameOverState: gameOver
    });
    // If a new move is made (or game starts), any 'redo' paths are invalid
    redoHistory = [];
    console.log("State captured. History length:", boardHistory.length);
}

// Piece values for basic AI evaluation (existing, for context)
const pieceValues = {
    'p': 10, 'n': 30, 'b': 30, 'r': 50, 'q': 90, 'k': 900,
    'P': 10, 'N': 30, 'B': 30, 'R': 50, 'Q': 90, 'K': 900
};

// --- Game Initialization and Board Rendering ---

function initBoard() {
    chessboard.innerHTML = ''; // Clear existing board
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((i + j) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = i;
            square.dataset.col = j;
            square.addEventListener('click', handleSquareClick);
            chessboard.appendChild(square);
        }
    }
    renderBoard();
    updateStatus('White');
    messageDisplay.textContent = 'Welcome to Indian Traditional Chess!';
    gameOver = false;
    currentPlayer = 'white';
    selectedSquare = null;

    // Initialize history with the starting board state
    boardHistory = []; // Clear history for a new game
    redoHistory = [];  // Clear redo history
    captureCurrentStateToHistory(); // Save the initial board state
}

function renderBoard() {
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => {
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        const pieceCode = board[row][col];
        square.innerHTML = ''; // Clear piece
        square.classList.remove('selected', 'highlight'); // Clear highlights
        if (pieceCode) {
            const pieceDiv = document.createElement('div');
            pieceDiv.classList.add('piece');
            pieceDiv.classList.add(isWhite(pieceCode) ? 'white' : 'black');
            pieceDiv.innerHTML = pieces[pieceCode];
            square.appendChild(pieceDiv);
        }
    });

    if (selectedSquare) {
        document.querySelector(`.square[data-row="${selectedSquare.row}"][data-col="${selectedSquare.col}"]`).classList.add('selected');
        highlightLegalMoves(selectedSquare.row, selectedSquare.col);
    }
}

function updateStatus(player) {
    currentPlayerDisplay.textContent = player.charAt(0).toUpperCase() + player.slice(1);
}

// --- Helper Functions for Piece and Player Identification (No changes) ---

function isWhite(piece) {
    return piece === piece.toUpperCase() && piece !== '';
}

function isBlack(piece) {
    return piece === piece.toLowerCase() && piece !== '';
}

function getPlayerColor(piece) {
    if (piece === '') return null;
    return isWhite(piece) ? 'white' : 'black';
}

function getCurrentPlayerPieceType(piece) {
    return (currentPlayer === 'white' && isWhite(piece)) || (currentPlayer === 'black' && isBlack(piece));
}

// --- Move Validation Logic (No changes, except pawn promotion simplified check) ---

function isValidMove(startRow, startCol, endRow, endCol) {
    if (startRow === endRow && startCol === endCol) return false; // Cannot move to same square

    const piece = board[startRow][startCol];
    const targetPiece = board[endRow][endCol];

    if (!piece || !getCurrentPlayerPieceType(piece)) {
        return false; // No piece, or not current player's piece
    }

    if (getPlayerColor(piece) === getPlayerColor(targetPiece)) {
        return false; // Cannot capture your own piece
    }

    // Piece-specific move validation - perform this first to filter invalid moves
    const type = piece.toLowerCase();
    let isBasicMoveValid = false;
    switch (type) {
        case 'p': isBasicMoveValid = isValidPawnMove(startRow, startCol, endRow, endCol, piece); break;
        case 'r': isBasicMoveValid = isValidRookMove(startRow, startCol, endRow, endCol); break;
        case 'n': isBasicMoveValid = isValidKnightMove(startRow, startCol, endRow, endCol); break;
        case 'b': isBasicMoveValid = isValidBishopMove(startRow, startCol, endRow, endCol); break;
        case 'q': isBasicMoveValid = isValidQueenMove(startRow, startCol, endRow, endCol); break;
        case 'k': isBasicMoveValid = isValidKingMove(startRow, startCol, endRow, endCol); break;
        default: return false; // Unknown piece type
    }

    if (!isBasicMoveValid) {
        return false;
    }

    // Temporarily make the move to check if king is in check (king safety)
    const originalPiece = board[startRow][startCol];
    const originalTargetPiece = board[endRow][endCol];
    board[endRow][endCol] = originalPiece;
    board[startRow][startCol] = '';

    const kingPos = getKingPosition(currentPlayer);
    const isKingInCheck = checkKingInCheck(kingPos.row, kingPos.col, currentPlayer);

    // Revert the move
    board[startRow][startCol] = originalPiece;
    board[endRow][endCol] = originalTargetPiece;

    if (isKingInCheck) return false; // Move would put own king in check

    return true; // The move is valid
}

function isPathClear(startRow, startCol, endRow, endCol) {
    const rowDiff = Math.abs(startRow - endRow);
    const colDiff = Math.abs(startCol - endCol);

    // Horizontal
    if (startRow === endRow) {
        const step = (endCol > startCol) ? 1 : -1;
        for (let c = startCol + step; c !== endCol; c += step) {
            if (board[startRow][c] !== '') return false;
        }
    }
    // Vertical
    else if (startCol === endCol) {
        const step = (endRow > startRow) ? 1 : -1;
        for (let r = startRow + step; r !== endRow; r += step) {
            if (board[r][startCol] !== '') return false;
        }
    }
    // Diagonal
    else if (rowDiff === colDiff) {
        const rowStep = (endRow > startRow) ? 1 : -1;
        const colStep = (endCol > startCol) ? 1 : -1;
        let r = startRow + rowStep;
        let c = startCol + colStep;
        while (r !== endRow && c !== endCol) {
            if (board[r][c] !== '') return false;
            r += rowStep;
            c += colStep;
        }
    }
    return true;
}

// Individual Piece Move Validations (No changes)
function isValidPawnMove(startRow, startCol, endRow, endCol, piece) {
    const direction = isWhite(piece) ? -1 : 1; // White moves up (-1), Black moves down (+1)
    const startRowPawn = isWhite(piece) ? 6 : 1; // White pawns start on row 6, Black on row 1

    // 1 square forward
    if (startCol === endCol && endRow === startRow + direction && board[endRow][endCol] === '') {
        return true;
    }
    // 2 squares forward (first move only)
    if (startCol === endCol && startRow === startRowPawn && endRow === startRow + 2 * direction && board[endRow][endCol] === '' && board[startRow + direction][startCol] === '') {
        return true;
    }
    // Capture diagonally
    // Note: getPlayerColor(board[endRow][endCol]) !== currentPlayer is handled in isValidMove general check
    if (Math.abs(startCol - endCol) === 1 && endRow === startRow + direction && board[endRow][endCol] !== '') {
        return true;
    }
    // En passant is not implemented for brevity
    return false;
}

function isValidRookMove(startRow, startCol, endRow, endCol) {
    if ((startRow === endRow && startCol !== endCol) || (startCol === endCol && startRow !== endRow)) {
        return isPathClear(startRow, startCol, endRow, endCol);
    }
    return false;
}

function isValidKnightMove(startRow, startCol, endRow, endCol) {
    const rowDiff = Math.abs(startRow - endRow);
    const colDiff = Math.abs(startCol - endCol);
    return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
}

function isValidBishopMove(startRow, startCol, endRow, endCol) {
    if (Math.abs(startRow - endRow) === Math.abs(startCol - endCol)) {
        return isPathClear(startRow, startCol, endRow, endCol);
    }
    return false;
}

function isValidQueenMove(startRow, startCol, endRow, endCol) {
    return isValidRookMove(startRow, startCol, endRow, endCol) || isValidBishopMove(startRow, startCol, endRow, endCol);
}

function isValidKingMove(startRow, startCol, endRow, endCol) {
    const rowDiff = Math.abs(startRow - endRow);
    const colDiff = Math.abs(startCol - endCol);
    return (rowDiff <= 1 && colDiff <= 1);
    // Castling is not implemented for brevity
}

// --- Game Flow and Event Handling ---

function handleSquareClick(event) {
    if (gameOver) return;

    const targetSquare = event.currentTarget;
    const row = parseInt(targetSquare.dataset.row);
    const col = parseInt(targetSquare.dataset.col);
    const clickedPiece = board[row][col];

    if (selectedSquare) {
        // A piece is already selected, attempt to move
        if (isValidMove(selectedSquare.row, selectedSquare.col, row, col)) {
            // Perform the move
            movePiece(selectedSquare.row, selectedSquare.col, row, col);
            selectedSquare = null; // Deselect after move
            renderBoard(); // Update board state

            // Switch turn and handle game state updates (check, checkmate, stalemate, history capture)
            switchTurn();
        } else {
            // Invalid move, or clicked on own piece (deselect and reselect)
            if (selectedSquare.row === row && selectedSquare.col === col) {
                 selectedSquare = null;
                 renderBoard(); // Remove highlights
                 messageDisplay.textContent = '';
            } else if (clickedPiece && getPlayerColor(clickedPiece) === currentPlayer) {
                // If clicked on own piece, select it
                selectedSquare = { row, col };
                renderBoard(); // Re-render to highlight new selection
                messageDisplay.textContent = ''; // Clear message
            } else {
                messageDisplay.textContent = 'Invalid move!';
                selectedSquare = null; // Deselect for clarity
                renderBoard(); // Remove highlights
            }
        }
    } else {
        // No piece selected, try to select one
        if (clickedPiece && getPlayerColor(clickedPiece) === currentPlayer) {
            selectedSquare = { row, col };
            renderBoard(); // Highlight selected piece and its legal moves
            messageDisplay.textContent = ''; // Clear message
        } else {
            messageDisplay.textContent = 'Select one of your pieces.';
        }
    }
}

function highlightLegalMoves(startRow, startCol) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            // Temporarily clear selectedSquare so isValidMove can properly test all moves
            // without being influenced by a currently selected piece, then restore.
            const originalSelectedSquare = selectedSquare;
            selectedSquare = null;
            if (isValidMove(startRow, startCol, r, c)) {
                document.querySelector(`.square[data-row="${r}"][data-col="${c}"]`).classList.add('highlight');
            }
            selectedSquare = originalSelectedSquare; // Restore selectedSquare
        }
    }
}

// movePiece now only handles the board state change, no history or turn switching
function movePiece(startRow, startCol, endRow, endCol) {
    const piece = board[startRow][startCol];
    board[endRow][endCol] = piece;
    board[startRow][startCol] = '';
    messageDisplay.textContent = ''; // Clear any previous invalid move message

    // Basic Pawn Promotion (simplified: auto-promote to Queen)
    if (piece.toLowerCase() === 'p' && (endRow === 0 || endRow === 7)) {
        board[endRow][endCol] = isWhite(piece) ? 'Q' : 'q';
    }
}

// switchTurn now handles history capture *after* the board and game state are updated
function switchTurn() {
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    updateStatus(currentPlayer);

    const kingPos = getKingPosition(currentPlayer);
    if (!kingPos) { // Should not happen in a valid game, but good to check
        console.error("King not found for current player:", currentPlayer);
        gameOver = true;
        messageDisplay.textContent = "Error: King not found!";
        return;
    }

    if (checkKingInCheck(kingPos.row, kingPos.col, currentPlayer)) {
        messageDisplay.textContent = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} King is in CHECK!`;
        if (isCheckmate(currentPlayer)) {
            messageDisplay.textContent = `CHECKMATE! ${currentPlayer === 'white' ? 'Black' : 'White'} Wins!`;
            gameOver = true;
        }
    } else {
        // Check for stalemate if not in check
        if (isStalemate(currentPlayer)) {
            messageDisplay.textContent = `STALEMATE! It's a draw.`;
            gameOver = true;
        }
    }

    // Capture the *new* state (after the move and turn switch) for history
    captureCurrentStateToHistory();

    if (!gameOver && currentPlayer === 'black') {
        setTimeout(computerMove, 500); // Give a slight delay for AI move
    }
}

// --- Check and Checkmate Logic (No changes) ---

function getKingPosition(player) {
    const kingPiece = player === 'white' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === kingPiece) {
                return { row: r, col: c };
            }
        }
    }
    return null; // Should not happen in a valid game
}

function checkKingInCheck(kingRow, kingCol, kingColor) {
    const opponentColor = kingColor === 'white' ? 'black' : 'white';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && getPlayerColor(piece) === opponentColor) {
                // Temporarily change current player to opponent to use isValidMove for attack check
                const originalCurrentPlayer = currentPlayer;
                currentPlayer = opponentColor;
                const attacking = isValidMove(r, c, kingRow, kingCol);
                currentPlayer = originalCurrentPlayer; // Revert
                if (attacking) {
                    return true;
                }
            }
        }
    }
    return false;
}

function isCheckmate(playerColor) {
    const kingPos = getKingPosition(playerColor);
    if (!kingPos || !checkKingInCheck(kingPos.row, kingPos.col, playerColor)) {
        return false; // Not in check, so can't be checkmate
    }

    // Check if any legal move can get the king out of check
    for (let startR = 0; startR < 8; startR++) {
        for (let startC = 0; startC < 8; startC++) {
            const piece = board[startR][startC];
            if (piece && getPlayerColor(piece) === playerColor) {
                for (let endR = 0; endR < 8; endR++) {
                    for (let endC = 0; endC < 8; endC++) {
                        if (isValidMove(startR, startC, endR, endC)) {
                            return false; // Found a legal move that resolves check, so not checkmate
                        }
                    }
                }
            }
        }
    }
    return true; // No legal moves found to escape check, thus checkmate
}

function isStalemate(playerColor) {
    // If in check, it's not stalemate
    const kingPos = getKingPosition(playerColor);
    if (!kingPos || checkKingInCheck(kingPos.row, kingPos.col, playerColor)) {
        return false;
    }

    // Check if any legal moves are available
    for (let startR = 0; startR < 8; startR++) {
        for (let startC = 0; startC < 8; startC++) {
            const piece = board[startR][startC];
            if (piece && getPlayerColor(piece) === playerColor) {
                for (let endR = 0; endR < 8; endR++) {
                    for (let endC = 0; endC < 8; endC++) {
                        if (isValidMove(startR, startC, endR, endC)) {
                            return false; // Found at least one legal move
                        }
                    }
                }
            }
        }
    }
    return true; // No legal moves available and not in check
}


// --- Basic Computer AI (Black) (No changes except calling switchTurn) ---

function computerMove() {
    if (gameOver || currentPlayer !== 'black') return;

    const legalMoves = [];
    for (let startR = 0; startR < 8; startR++) {
        for (let startC = 0; startC < 8; startC++) {
            const piece = board[startR][startC];
            if (piece && isBlack(piece)) { // Ensure it's black's piece
                for (let endR = 0; endR < 8; endR++) {
                    for (let endC = 0; endC < 8; endC++) {
                        if (isValidMove(startR, startC, endR, endC)) {
                            legalMoves.push({ startR, startC, endR, endC });
                        }
                    }
                }
            }
        }
    }

    if (legalMoves.length === 0) {
        messageDisplay.textContent = 'Computer has no legal moves! Stalemate or Checkmate.';
        gameOver = true;
        captureCurrentStateToHistory(); // Capture the final state if no moves
        return;
    }

    // Basic AI strategy:
    // 1. Prioritize capturing opponent's pieces.
    // 2. If no captures, pick a random legal move.
    let bestMove = null;
    let maxCaptureValue = 0;

    for (const move of legalMoves) {
        const targetPiece = board[move.endR][move.endC];
        if (targetPiece && isWhite(targetPiece)) { // If it's a capture of white piece
            const capturedValue = pieceValues[targetPiece];
            if (capturedValue > maxCaptureValue) {
                maxCaptureValue = capturedValue;
                bestMove = move;
            }
        }
    }

    if (!bestMove) {
        // If no captures, pick a random move
        bestMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }

    // Execute the chosen move
    movePiece(bestMove.startR, bestMove.startC, bestMove.endR, bestMove.endC);
    renderBoard();
    switchTurn(); // switchTurn will now handle history capture
}

// --- New: Undo and Redo Functions ---
function undoMove() {
    if (boardHistory.length <= 1) { // 1 because the initial state is always present
        messageDisplay.textContent = 'No moves to undo.';
        return;
    }

    // The current state is the one we want to put into redo history
    redoHistory.push(boardHistory.pop()); // Pop the current state and push to redo stack

    // Restore to the *previous* state
    const previousState = boardHistory[boardHistory.length - 1];
    board = deepCopyBoard(previousState.boardState);
    currentPlayer = previousState.player;
    gameOver = previousState.gameOverState;

    renderBoard();
    updateStatus(currentPlayer);
    messageDisplay.textContent = 'Move undone.';
    selectedSquare = null; // Clear any selected piece
}

function redoMove() {
    if (redoHistory.length === 0) {
        messageDisplay.textContent = 'No moves to redo.';
        return;
    }

    // The state to redo is at the top of redoHistory.
    // First, push the *current* state (which was an undo) to boardHistory
    boardHistory.push(redoHistory.pop()); // Pop from redo and push to boardHistory

    // Restore to the re-done state (which is now the last in boardHistory)
    const currentState = boardHistory[boardHistory.length - 1];
    board = deepCopyBoard(currentState.boardState);
    currentPlayer = currentState.player;
    gameOver = currentState.gameOverState;

    renderBoard();
    updateStatus(currentPlayer);
    messageDisplay.textContent = 'Move redone.';
    selectedSquare = null; // Clear any selected piece
}


// --- Event Listeners and Initial Call ---

newGameBtn.addEventListener('click', () => {
    // Reset board to initial state
    board = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    initBoard(); // This now handles history reset and initial capture
});

// Add event listeners for Undo/Redo buttons
undoBtn.addEventListener('click', undoMove);
redoBtn.addEventListener('click', redoMove);

// Start the game when the script loads
initBoard();