// Game Configuration
const COLS = 10;
const ROWS = 18; // Slightly shorter for better mobile fit
const BLOCK_SIZE = 30;
const COLORS = [
    '#FF006E', // Neon Pink
    '#00F5FF', // Neon Cyan
    '#FBFF00', // Neon Yellow
    '#FF5F00', // Neon Orange
    '#8B00FF', // Neon Purple
    '#00FF9F', // Neon Mint
    '#FF1744', // Neon Red
    '#FFD700', // Neon Gold
    '#00FFFF', // Neon Aqua
    '#FF10F0', // Neon Magenta (for small L)
    '#39FF14', // Neon Lime (for triple horizontal)
    '#FF007F'  // Neon Rose (for reverse L)
];

// Tetromino Shapes
const SHAPES = [
    [[1, 1, 1, 1]], // I
    [[1, 1], [1, 1]], // O
    [[0, 1, 0], [1, 1, 1]], // T
    [[1, 1, 0], [0, 1, 1]], // S
    [[0, 1, 1], [1, 1, 0]], // Z
    [[1, 0, 0], [1, 1, 1]], // L
    [[0, 0, 1], [1, 1, 1]], // J
    [[1]], // Single dot
    [[1, 1]], // Double dot (horizontal)
    [[1, 0], [1, 1]], // Small L (3 dots)
    [[1, 1, 1]], // Triple horizontal
    [[0, 1], [1, 1]] // Small reverse L (3 dots)
];

// Special Block Types
const BLOCK_TYPES = {
    NORMAL: 0,
    BOMB: 1
};

// Gravity Directions
const GRAVITY = {
    DOWN: 0,
    UP: 1
};

// Game State
let canvas, ctx;
let grid = [];
let blockTypes = []; // Track special block types
let currentPiece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let highScore = 0;
let gameLoop = null;
let dropInterval = 700;
let lastDropTime = 0;
let isGameOver = false;
let isPaused = false;
let inDangerZone = false;

// Gravity Shift
let currentGravity = GRAVITY.DOWN;
let gravityShiftInterval = 25000; // 25 seconds
let lastGravityShift = 0;
let gravityWarning = false;
let gravityWarningTime = 0;

// Audio
let audioContext;
let soundEnabled = true;
let musicEnabled = true;
let bgMusicOscillator = null;
let bgMusicGain = null;
let bgMusicInterval = null;

// Particles
let particles = [];

// Level up animation
let levelUpAnimation = null;

// Score popup animations
let scorePopups = [];

// Game over animation
let gameOverAnimation = {
    active: false,
    progress: 0,
    fadeWave: 0,
    textY: 0,
    textAlpha: 0,
    statsAlpha: 0
};

// Dynamic Viewport Height Management
function setViewportHeight() {
    // Get actual viewport height (excluding browser chrome)
    const vh = window.innerHeight;
    document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
}

// Initialize Game
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Set viewport height
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', () => {
        setTimeout(setViewportHeight, 100);
    });
    
    // Load high score from localStorage
    highScore = parseInt(localStorage.getItem('lineBreakerHighScore')) || 0;
    document.getElementById('highScore').textContent = highScore;
    
    // Load sound and music preferences
    const savedSound = localStorage.getItem('lineBreakerSoundEnabled');
    const savedMusic = localStorage.getItem('lineBreakerMusicEnabled');
    
    if (savedSound !== null) {
        soundEnabled = savedSound === 'true';
        const soundBtn = document.getElementById('soundToggle');
        soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
        soundBtn.classList.toggle('muted', !soundEnabled);
    }
    
    if (savedMusic !== null) {
        musicEnabled = savedMusic === 'true';
        const musicBtn = document.getElementById('musicToggle');
        musicBtn.textContent = musicEnabled ? '🎵' : '🎶';
        musicBtn.classList.toggle('muted', !musicEnabled);
    }
    
    // Initialize empty grid
    for (let row = 0; row < ROWS; row++) {
        grid[row] = [];
        for (let col = 0; col < COLS; col++) {
            grid[row][col] = 0;
        }
    }
    
    // Initialize Audio
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {
        console.log('Audio not supported');
    }
    
    // Event Listeners
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('resumeBtn').addEventListener('click', togglePause);
    document.getElementById('closeTutorial').addEventListener('click', startGame);
    document.addEventListener('keydown', handleKeyPress);
    
    document.getElementById('soundToggle').addEventListener('click', toggleSound);
    document.getElementById('musicToggle').addEventListener('click', toggleMusic);
    
    // Auto-pause when page loses focus (tab switch, minimize, etc.)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && !isPaused && !isGameOver) {
            togglePause();
        }
    });
    
    // Mobile touch controls
    setupMobileControls();
    
    // Desktop mouse controls
    setupMouseControls();
    
    // Show tutorial automatically on page load
    showTutorial();
}

// Show Tutorial
function showTutorial() {
    document.getElementById('tutorial').classList.remove('hidden');
}

// Start Game
function startGame() {
    document.getElementById('tutorial').classList.add('hidden');
    resetGame();
    document.getElementById('pauseBtn').classList.remove('hidden');
    document.getElementById('gameOver').classList.add('hidden');
    nextPiece = createPiece();
    spawnPiece();
    if (musicEnabled) startBackgroundMusic();
    
    // Initialize gravity shift timer to current time
    lastGravityShift = performance.now();
    
    gameLoop = requestAnimationFrame(update);
}

// Reset Game
function resetGame() {
    grid = [];
    blockTypes = [];
    for (let row = 0; row < ROWS; row++) {
        grid[row] = [];
        blockTypes[row] = [];
        for (let col = 0; col < COLS; col++) {
            grid[row][col] = 0;
            blockTypes[row][col] = BLOCK_TYPES.NORMAL;
        }
    }
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 700;
    isGameOver = false;
    inDangerZone = false;
    currentGravity = GRAVITY.DOWN;
    lastGravityShift = 0;
    gravityWarning = false;
    
    // Reset game over animation
    gameOverAnimation.active = false;
    gameOverAnimation.progress = 0;
    gameOverAnimation.fadeWave = 0;
    gameOverAnimation.textY = 0;
    gameOverAnimation.textAlpha = 0;
    gameOverAnimation.statsAlpha = 0;
    
    updateScore();
    
    // Remove danger effect
    gameOverAnimation.fadeWave = 0;
    gameOverAnimation.textY = 0;
    gameOverAnimation.textAlpha = 0;
    gameOverAnimation.statsAlpha = 0;
    
    // Remove danger effect
    document.querySelector('.canvas-container').classList.remove('danger');
}

// Toggle Pause
function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        document.getElementById('pauseScreen').classList.remove('hidden');
        document.getElementById('pauseBtn').textContent = '▶';
        document.getElementById('pauseBtn').title = 'Resume';
        stopBackgroundMusic();
    } else {
        document.getElementById('pauseScreen').classList.add('hidden');
        document.getElementById('pauseBtn').textContent = '⏸';
        document.getElementById('pauseBtn').title = 'Pause';
        lastDropTime = performance.now();
        if (musicEnabled) startBackgroundMusic();
    }
}

// Restart Game
function restartGame() {
    startGame();
}

// Create Random Piece
function createPiece() {
    const shapeIndex = Math.floor(Math.random() * SHAPES.length);
    const piece = {
        shape: SHAPES[shapeIndex],
        color: COLORS[shapeIndex],
        x: Math.floor(COLS / 2) - 1,
        y: 0,
        hasBomb: Math.random() < 0.1 // 10% chance of bomb block
    };
    return piece;
}

// Spawn New Piece
function spawnPiece() {
    currentPiece = nextPiece;
    nextPiece = createPiece();
    
    // Set X position (centered)
    currentPiece.x = Math.floor(COLS / 2) - 1;
    
    // Spawn at appropriate position based on gravity
    if (currentGravity === GRAVITY.DOWN) {
        // Normal gravity: spawn at top
        currentPiece.y = 0;
    } else {
        // UP gravity: spawn at bottom
        const pieceHeight = currentPiece.shape.length;
        currentPiece.y = ROWS - pieceHeight;
    }
    
    // Check if piece can be placed (game over check)
    if (collision(currentPiece.x, currentPiece.y, currentPiece.shape)) {
        gameOver();
    }
}

// Collision Detection
function collision(x, y, shape) {
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col]) {
                const newX = x + col;
                const newY = y + row;
                
                // Check boundaries - handle both gravity directions
                if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) {
                    return true;
                }
                
                // Check if position is already occupied
                if (grid[newY][newX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Move Piece
function move(dir) {
    if (isGameOver || !currentPiece) return;
    
    const newX = currentPiece.x + dir;
    if (!collision(newX, currentPiece.y, currentPiece.shape)) {
        currentPiece.x = newX;
        playSound('move');
        draw();
    }
}

// Rotate Piece
function rotate() {
    if (isGameOver || !currentPiece) return;
    
    const rotated = [];
    const shape = currentPiece.shape;
    
    for (let col = 0; col < shape[0].length; col++) {
        const newRow = [];
        for (let row = shape.length - 1; row >= 0; row--) {
            newRow.push(shape[row][col]);
        }
        rotated.push(newRow);
    }
    
    if (!collision(currentPiece.x, currentPiece.y, rotated)) {
        currentPiece.shape = rotated;
        playSound('rotate');
        draw();
    }
}

// Drop Piece
function drop() {
    if (isGameOver || !currentPiece) return;
    
    // Move based on gravity direction
    const newY = currentGravity === GRAVITY.DOWN ? currentPiece.y + 1 : currentPiece.y - 1;
    
    if (!collision(currentPiece.x, newY, currentPiece.shape)) {
        currentPiece.y = newY;
        draw();
    } else {
        playSound('drop');
        lockPiece();
        clearLines();
        spawnPiece();
    }
}

// Hard Drop
function hardDrop() {
    if (isGameOver || !currentPiece) return;
    
    // Drop based on gravity direction
    if (currentGravity === GRAVITY.DOWN) {
        while (!collision(currentPiece.x, currentPiece.y + 1, currentPiece.shape)) {
            currentPiece.y++;
            score += 2; // Bonus points for hard drop
        }
    } else {
        // UP gravity - drop to top
        while (!collision(currentPiece.x, currentPiece.y - 1, currentPiece.shape)) {
            currentPiece.y--;
            score += 2; // Bonus points for hard drop
        }
    }
    playSound('hardDrop');
    lockPiece();
    clearLines();
    spawnPiece();
    updateScore();
}

// Lock Piece to Grid
function lockPiece() {
    const shape = currentPiece.shape;
    
    // Find center block for bomb placement (if piece has bomb)
    let bombRow = -1, bombCol = -1;
    if (currentPiece.hasBomb) {
        let blockCount = 0;
        let totalRow = 0, totalCol = 0;
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    totalRow += currentPiece.y + row;
                    totalCol += currentPiece.x + col;
                    blockCount++;
                }
            }
        }
        if (blockCount > 0) {
            bombRow = Math.round(totalRow / blockCount);
            bombCol = Math.round(totalCol / blockCount);
        }
    }
    
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col]) {
                const gridY = currentPiece.y + row;
                const gridX = currentPiece.x + col;
                if (gridY >= 0) {
                    grid[gridY][gridX] = currentPiece.color;
                    // Mark bomb block
                    if (gridY === bombRow && gridX === bombCol && currentPiece.hasBomb) {
                        blockTypes[gridY][gridX] = BLOCK_TYPES.BOMB;
                    } else {
                        blockTypes[gridY][gridX] = BLOCK_TYPES.NORMAL;
                    }
                }
            }
        }
    }
    
    // Check if ANY blocks exist in danger zone
    // Danger zone changes based on gravity direction
    let dangerZone = false;
    if (currentGravity === GRAVITY.DOWN) {
        // Normal gravity: danger zone is top 4 rows
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < COLS; col++) {
                if (grid[row][col]) {
                    dangerZone = true;
                    break;
                }
            }
            if (dangerZone) break;
        }
    } else {
        // UP gravity: danger zone is bottom 4 rows
        for (let row = ROWS - 4; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (grid[row][col]) {
                    dangerZone = true;
                    break;
                }
            }
            if (dangerZone) break;
        }
    }
    
    // Add danger visual effect and switch music if blocks are in danger zone
    const canvasContainer = document.querySelector('.canvas-container');
    if (dangerZone) {
        canvasContainer.classList.add('danger');
        // Switch to danger music if not already playing
        if (!inDangerZone && musicEnabled) {
            inDangerZone = true;
            stopBackgroundMusic();
            startDangerMusic();
        }
    } else {
        canvasContainer.classList.remove('danger');
        // Switch back to normal music if leaving danger zone
        if (inDangerZone && musicEnabled) {
            inDangerZone = false;
            stopBackgroundMusic();
            startBackgroundMusic();
        }
    }
}

// Clear Completed Lines
function clearLines() {
    let linesCleared = 0;
    let rowsToClear = [];
    let colsToClear = [];
    
    // Check rows
    for (let row = ROWS - 1; row >= 0; row--) {
        if (grid[row].every(cell => cell !== 0)) {
            rowsToClear.push(row);
        }
    }
    
    // Check columns (vertical lines)
    for (let col = 0; col < COLS; col++) {
        let columnFilled = true;
        for (let row = 0; row < ROWS; row++) {
            if (grid[row][col] === 0) {
                columnFilled = false;
                break;
            }
        }
        if (columnFilled) {
            colsToClear.push(col);
        }
    }
    
    // If there are lines to clear, flash them first
    if (rowsToClear.length > 0 || colsToClear.length > 0) {
        flashLines(rowsToClear, colsToClear, () => {
            // Check for bomb blocks in cleared lines and trigger explosions
            let bombsTriggered = [];
            
            // Check rows for bombs
            for (let row of rowsToClear) {
                for (let col = 0; col < COLS; col++) {
                    if (blockTypes[row][col] === BLOCK_TYPES.BOMB) {
                        bombsTriggered.push({row, col});
                    }
                }
            }
            
            // Check columns for bombs
            for (let col of colsToClear) {
                for (let row = 0; row < ROWS; row++) {
                    if (blockTypes[row][col] === BLOCK_TYPES.BOMB) {
                        // Avoid duplicates
                        if (!bombsTriggered.some(b => b.row === row && b.col === col)) {
                            bombsTriggered.push({row, col});
                        }
                    }
                }
            }
            
            // Clear rows
            for (let i = rowsToClear.length - 1; i >= 0; i--) {
                const row = rowsToClear[i];
                // Create particles for cleared line
                for (let col = 0; col < COLS; col++) {
                    createParticles(col, row, 6, grid[row][col]);
                }
                grid.splice(row, 1);
                blockTypes.splice(row, 1);
                if (currentGravity === GRAVITY.DOWN) {
                    grid.unshift(new Array(COLS).fill(0));
                    blockTypes.unshift(new Array(COLS).fill(BLOCK_TYPES.NORMAL));
                } else {
                    grid.push(new Array(COLS).fill(0));
                    blockTypes.push(new Array(COLS).fill(BLOCK_TYPES.NORMAL));
                }
                linesCleared++;
            }
            
            // Clear columns
            for (let col of colsToClear) {
                // Create particles for cleared column
                for (let row = 0; row < ROWS; row++) {
                    createParticles(col, row, 6, grid[row][col]);
                    grid[row][col] = 0;
                    blockTypes[row][col] = BLOCK_TYPES.NORMAL;
                }
                // Drop blocks above
                dropColumn(col);
                linesCleared++;
            }
            
            // Trigger bomb explosions
            if (bombsTriggered.length > 0) {
                for (let bomb of bombsTriggered) {
                    explodeBomb(bomb.row, bomb.col);
                }
                playSound('bomb');
            }
            
            playSound('lineClear');
            lines += linesCleared;
            
            // Level progression: every 3 lines = new level
            const newLevel = Math.floor(lines / 3) + 1;
            if (newLevel > level) {
                level = newLevel;
                // Speed increases with each level
                dropInterval = Math.max(100, 700 - (level * 50));
            }
            
            // Score calculation: more points for multiple lines and higher levels
            const baseScore = linesCleared === 1 ? 100 : 
                             linesCleared === 2 ? 300 :
                             linesCleared === 3 ? 500 : 800;
            const earnedScore = baseScore * level;
            score += earnedScore;
            
            // Create score popup animation
            createScorePopup(earnedScore);
            
            // Update score/level display first
            updateScore();
            
            // Then trigger visual feedback for level up
            if (newLevel > (newLevel - 1)) {
                // Check if we just leveled up in this clear
                const previousLevel = Math.floor((lines - linesCleared) / 3) + 1;
                if (newLevel > previousLevel) {
                    createLevelUpEffect();
                }
            }
        });
    }
}

// Flash lines before clearing them
let flashingLines = { rows: [], cols: [], active: false, flashCount: 0 };

function flashLines(rows, cols, callback) {
    flashingLines.rows = rows;
    flashingLines.cols = cols;
    flashingLines.active = true;
    flashingLines.flashCount = 0;
    
    const flashDuration = 300; // Total flash duration
    const flashInterval = 75; // Flash every 75ms
    const totalFlashes = 4;
    
    const flashTimer = setInterval(() => {
        flashingLines.flashCount++;
        
        if (flashingLines.flashCount >= totalFlashes) {
            clearInterval(flashTimer);
            flashingLines.active = false;
            flashingLines.rows = [];
            flashingLines.cols = [];
            callback();
        }
    }, flashInterval);
}

// Drop Column After Vertical Line Clear
function dropColumn(col) {
    for (let row = ROWS - 1; row >= 0; row--) {
        if (grid[row][col] === 0) {
            // Find next non-empty cell above
            for (let r = row - 1; r >= 0; r--) {
                if (grid[r][col] !== 0) {
                    grid[row][col] = grid[r][col];
                    blockTypes[row][col] = blockTypes[r][col];
                    grid[r][col] = 0;
                    blockTypes[r][col] = BLOCK_TYPES.NORMAL;
                    break;
                }
            }
        }
    }
}

// Explode Bomb - clears 3x3 area
function explodeBomb(bombRow, bombCol) {
    // Clear 3x3 area around bomb
    for (let row = Math.max(0, bombRow - 1); row <= Math.min(ROWS - 1, bombRow + 1); row++) {
        for (let col = Math.max(0, bombCol - 1); col <= Math.min(COLS - 1, bombCol + 1); col++) {
            if (grid[row][col]) {
                // Create explosion particles
                createParticles(col, row, 12, grid[row][col]);
                grid[row][col] = 0;
                blockTypes[row][col] = BLOCK_TYPES.NORMAL;
                score += 10; // Bonus points for bomb clears
            }
        }
    }
    
    // Drop all columns affected
    for (let col = Math.max(0, bombCol - 1); col <= Math.min(COLS - 1, bombCol + 1); col++) {
        dropColumn(col);
    }
}

// Shift Gravity Direction
function shiftGravity() {
    // Calculate current piece's relative position before flip
    let pieceRelativeY = null;
    if (currentPiece) {
        const pieceHeight = currentPiece.shape.length;
        if (currentGravity === GRAVITY.DOWN) {
            // Distance from top
            pieceRelativeY = currentPiece.y;
        } else {
            // Distance from bottom
            pieceRelativeY = (ROWS - currentPiece.y - pieceHeight);
        }
    }
    
    // Toggle between UP and DOWN
    currentGravity = currentGravity === GRAVITY.DOWN ? GRAVITY.UP : GRAVITY.DOWN;
    
    // FLIP THE ENTIRE GRID VERTICALLY
    flipGrid();
    
    // Reposition the current piece to maintain relative position
    if (currentPiece && pieceRelativeY !== null) {
        const pieceHeight = currentPiece.shape.length;
        if (currentGravity === GRAVITY.DOWN) {
            // Now falling down, maintain distance from top
            currentPiece.y = pieceRelativeY;
        } else {
            // Now falling up, maintain distance from bottom
            currentPiece.y = ROWS - pieceRelativeY - pieceHeight;
        }
        
        // If new position causes collision, adjust to safe position
        if (collision(currentPiece.x, currentPiece.y, currentPiece.shape)) {
            if (currentGravity === GRAVITY.DOWN) {
                currentPiece.y = 0;
            } else {
                currentPiece.y = ROWS - pieceHeight;
            }
        }
    }
    
    // Create visual effect
    const colors = ['#FF006E', '#00F5FF', '#FBFF00', '#FF5F00'];
    for (let i = 0; i < 40; i++) {
        const randomX = Math.floor(Math.random() * COLS);
        const randomY = Math.floor(Math.random() * ROWS);
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        createParticles(randomX, randomY, 4, randomColor);
    }
    
    // Play gravity shift sound
    if (soundEnabled && audioContext) {
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.3);
        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    }
}

// Flip the entire grid vertically
function flipGrid() {
    // Reverse the grid array (flip vertically)
    grid.reverse();
    blockTypes.reverse();
    
    // Each row also needs to be recreated to maintain references
    for (let row = 0; row < ROWS; row++) {
        grid[row] = [...grid[row]];
        blockTypes[row] = [...blockTypes[row]];
    }
}

// Level Up Effect
function createLevelUpEffect() {
    // Rainbow colors for particles
    const colors = ['#FF006E', '#00F5FF', '#FBFF00', '#FF5F00', '#8B00FF', '#00FF9F', '#FFD700'];
    
    // Create more particles with rainbow colors
    for (let i = 0; i < 80; i++) {
        const randomX = Math.floor(Math.random() * COLS);
        const randomY = Math.floor(Math.random() * ROWS);
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        createParticles(randomX, randomY, 3, randomColor);
    }
    
    // Create even more particles - 180 particles bursting from center
    for (let i = 0; i < 180; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12 - 4,
            life: 1,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
    
    // Flash effect on level display
    const levelEl = document.getElementById('level');
    levelEl.style.transform = 'scale(1.5)';
    levelEl.style.transition = 'transform 0.3s ease';
    setTimeout(() => {
        levelEl.style.transform = 'scale(1)';
    }, 300);
    
    // Show "LEVEL UP!" animated text on canvas
    showLevelUpText();
    
    // Play celebratory sound with more notes
    if (soundEnabled && audioContext) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        const now = audioContext.currentTime;
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(523, now);
        oscillator.frequency.setValueAtTime(659, now + 0.1);
        oscillator.frequency.setValueAtTime(784, now + 0.2);
        oscillator.frequency.setValueAtTime(1047, now + 0.3);
        oscillator.frequency.setValueAtTime(1319, now + 0.4);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        oscillator.start(now);
        oscillator.stop(now + 0.6);
    }
}

// Show animated "LEVEL UP!" text on canvas
let levelUpTextAlpha = 0;
let levelUpTextScale = 0;
let levelUpTextY = 0;
let levelUpTextActive = false;

function showLevelUpText() {
    levelUpTextAlpha = 1;
    levelUpTextScale = 0.1; // Start with small scale, not 0
    levelUpTextY = 0;
    levelUpTextActive = true;
    
    const duration = 1800; // 1.8 seconds
    const startTime = Date.now();
    
    function animateText() {
        if (!levelUpTextActive) return;
        
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;
        
        if (progress < 1) {
            // Scale up with bounce effect
            if (progress < 0.2) {
                levelUpTextScale = 0.1 + (progress * 5); // Quick scale from 0.1 to 1.1
            } else if (progress < 0.3) {
                levelUpTextScale = 1.1 + ((progress - 0.2) * 3); // Bounce to 1.4
            } else if (progress < 0.5) {
                levelUpTextScale = 1.4 - ((progress - 0.3) * 1); // Settle to 1.2
            } else {
                levelUpTextScale = 1.2; // Hold at 1.2
            }
            
            // Fly upward
            levelUpTextY = -progress * 150;
            
            // Fade out in last 40%
            if (progress > 0.6) {
                levelUpTextAlpha = 1 - ((progress - 0.6) / 0.4);
            } else {
                levelUpTextAlpha = 1;
            }
            
            requestAnimationFrame(animateText);
        } else {
            levelUpTextActive = false;
            levelUpTextAlpha = 0;
            levelUpTextScale = 0;
        }
    }
    
    animateText();
}

function drawLevelUpText() {
    if (!levelUpTextActive) return;
    
    ctx.save();
    
    // Draw text with scale and position animation
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 + levelUpTextY;
    
    ctx.translate(centerX, centerY);
    ctx.scale(levelUpTextScale, levelUpTextScale);
    ctx.globalAlpha = levelUpTextAlpha;
    
    // Multi-layer glow effect
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#FFD700';
    
    // Draw stroke first
    ctx.font = 'bold 40px Arial';
    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('LEVEL UP!', 0, 0);
    
    // Inner text with gradient
    const gradient = ctx.createLinearGradient(0, -25, 0, 25);
    gradient.addColorStop(0, '#FFF700');
    gradient.addColorStop(0.5, '#FFD700');
    gradient.addColorStop(1, '#FF9500');
    ctx.fillStyle = gradient;
    ctx.fillText('LEVEL UP!', 0, 0);
    
    // Add sparkle effect (dimmer)
    ctx.shadowBlur = 35;
    ctx.shadowColor = '#FFFFFF';
    ctx.font = 'bold 42px Arial';
    ctx.globalAlpha = levelUpTextAlpha * 0.3;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('LEVEL UP!', 0, 0);
    
    ctx.restore();
}

// Draw Gravity Indicator and Warning
function drawGravityIndicator() {
    // Show gravity direction indicator
    const gravityText = currentGravity === GRAVITY.DOWN ? '↓ DOWN' : '↑ UP';
    const gravityColor = currentGravity === GRAVITY.DOWN ? '#00FF9F' : '#FF006E';
    ctx.save();
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = gravityColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = gravityColor;
    ctx.fillText(`Gravity: ${gravityText}`, canvas.width - 10, 10);
    ctx.restore();
    
    // Show warning countdown
    if (gravityWarning) {
        const timeLeft = Math.ceil((3000 - (performance.now() - gravityWarningTime)) / 1000);
        if (timeLeft > 0) {
            ctx.save();
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Pulse effect
            const pulse = Math.sin(performance.now() / 150) * 0.2 + 0.8;
            ctx.globalAlpha = pulse;
            
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#FFD700';
            ctx.fillStyle = '#FFD700';
            ctx.fillText(`GRAVITY SHIFT IN ${timeLeft}!`, canvas.width / 2, 40);
            ctx.restore();
        }
    }
}

// Update Score Display
function updateScore() {
    const scoreEl = document.getElementById('score');
    const linesEl = document.getElementById('lines');
    const levelEl = document.getElementById('level');
    
    // Add pulse animation on score update
    scoreEl.style.transform = 'scale(1.2)';
    setTimeout(() => scoreEl.style.transform = 'scale(1)', 200);
    
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
}

// Handle Keyboard Input
function handleKeyPress(e) {
    // Allow restart when game over animation is complete (progress = 1)
    if (isGameOver && gameOverAnimation.progress >= 1) {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            restartGame();
            return;
        }
    }
    
    if (isGameOver) return;
    
    // Pause with P or Escape key
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause();
        return;
    }
    
    if (isPaused) return;
    
    switch(e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
            move(-1);
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            move(1);
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            // Hard drop based on gravity direction
            if (currentGravity === GRAVITY.DOWN) {
                hardDrop();
            } else {
                // In UP gravity, down arrow rotates
                rotate();
            }
            break;
        case 'ArrowUp':
        case 'w':
        case 'W':
            // Hard drop based on gravity direction
            if (currentGravity === GRAVITY.UP) {
                e.preventDefault();
                hardDrop();
            } else {
                // In DOWN gravity, up arrow rotates
                e.preventDefault();
                rotate();
            }
            break;
        case ' ':
            e.preventDefault();
            rotate();
            break;
    }
}

// Sound Functions
function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('lineBreakerSoundEnabled', soundEnabled);
    const btn = document.getElementById('soundToggle');
    btn.textContent = soundEnabled ? '🔊' : '🔇';
    btn.classList.toggle('muted', !soundEnabled);
}

function toggleMusic() {
    musicEnabled = !musicEnabled;
    localStorage.setItem('lineBreakerMusicEnabled', musicEnabled);
    const btn = document.getElementById('musicToggle');
    btn.textContent = musicEnabled ? '🎵' : '🎶';
    btn.classList.toggle('muted', !musicEnabled);
    
    if (musicEnabled && !isGameOver) {
        startBackgroundMusic();
    } else {
        stopBackgroundMusic();
    }
}

function startBackgroundMusic() {
    if (!musicEnabled || !audioContext || bgMusicOscillator) return;
    
    const melody = [
        {freq: 523.25, duration: 0.3}, // C5
        {freq: 659.25, duration: 0.3}, // E5
        {freq: 783.99, duration: 0.3}, // G5
        {freq: 659.25, duration: 0.3}, // E5
        {freq: 587.33, duration: 0.3}, // D5
        {freq: 659.25, duration: 0.3}, // E5
        {freq: 523.25, duration: 0.6}, // C5
    ];
    
    let noteIndex = 0;
    
    function playNextNote() {
        if (!musicEnabled || inDangerZone) return;
        
        const note = melody[noteIndex % melody.length];
        
        bgMusicOscillator = audioContext.createOscillator();
        bgMusicGain = audioContext.createGain();
        
        bgMusicOscillator.connect(bgMusicGain);
        bgMusicGain.connect(audioContext.destination);
        
        bgMusicOscillator.type = 'sine';
        bgMusicOscillator.frequency.setValueAtTime(note.freq, audioContext.currentTime);
        bgMusicGain.gain.setValueAtTime(0.05, audioContext.currentTime);
        bgMusicGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + note.duration);
        
        bgMusicOscillator.start(audioContext.currentTime);
        bgMusicOscillator.stop(audioContext.currentTime + note.duration);
        
        noteIndex++;
        bgMusicInterval = setTimeout(playNextNote, note.duration * 1000);
    }
    
    playNextNote();
}

function startDangerMusic() {
    if (!musicEnabled || !audioContext || bgMusicOscillator) return;
    
    // Fast, urgent alert pattern
    const dangerPattern = [
        {freq: 880, duration: 0.15},   // A5 - high urgent beep
        {freq: 740, duration: 0.15},   // F#5
        {freq: 880, duration: 0.15},   // A5
        {freq: 740, duration: 0.15},   // F#5
    ];
    
    let noteIndex = 0;
    
    function playNextDangerNote() {
        if (!musicEnabled || !inDangerZone) return;
        
        const note = dangerPattern[noteIndex % dangerPattern.length];
        
        bgMusicOscillator = audioContext.createOscillator();
        bgMusicGain = audioContext.createGain();
        
        bgMusicOscillator.connect(bgMusicGain);
        bgMusicGain.connect(audioContext.destination);
        
        bgMusicOscillator.type = 'square'; // Harsher sound for urgency
        bgMusicOscillator.frequency.setValueAtTime(note.freq, audioContext.currentTime);
        bgMusicGain.gain.setValueAtTime(0.08, audioContext.currentTime);
        bgMusicGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + note.duration);
        
        bgMusicOscillator.start(audioContext.currentTime);
        bgMusicOscillator.stop(audioContext.currentTime + note.duration);
        
        noteIndex++;
        bgMusicInterval = setTimeout(playNextDangerNote, note.duration * 1000);
    }
    
    playNextDangerNote();
}

function stopBackgroundMusic() {
    if (bgMusicInterval) {
        clearTimeout(bgMusicInterval);
        bgMusicInterval = null;
    }
    if (bgMusicOscillator) {
        try {
            bgMusicOscillator.stop();
        } catch(e) {}
        bgMusicOscillator = null;
    }
}

function playSound(type) {
    if (!soundEnabled || !audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    const now = audioContext.currentTime;
    
    switch(type) {
        case 'move':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, now);
            gainNode.gain.setValueAtTime(0.08, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            oscillator.start(now);
            oscillator.stop(now + 0.08);
            break;
            
        case 'rotate':
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(523, now);
            oscillator.frequency.setValueAtTime(659, now + 0.05);
            oscillator.frequency.setValueAtTime(784, now + 0.1);
            gainNode.gain.setValueAtTime(0.12, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            oscillator.start(now);
            oscillator.stop(now + 0.15);
            break;
            
        case 'drop':
            oscillator.frequency.setValueAtTime(150, now);
            oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.1);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            oscillator.start(now);
            oscillator.stop(now + 0.1);
            break;
            
        case 'lineClear':
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(523, now);
            oscillator.frequency.setValueAtTime(659, now + 0.08);
            oscillator.frequency.setValueAtTime(784, now + 0.16);
            oscillator.frequency.setValueAtTime(1047, now + 0.24);
            gainNode.gain.setValueAtTime(0.25, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            oscillator.start(now);
            oscillator.stop(now + 0.4);
            break;
            
        case 'gameOver':
            // Create a dramatic descending arpeggio with multiple tones
            const frequencies = [523.25, 392, 293.66, 220]; // C5, G4, D4, A3
            frequencies.forEach((freq, index) => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                
                osc.connect(gain);
                gain.connect(audioContext.destination);
                
                osc.type = 'sine';
                const startTime = now + (index * 0.15);
                osc.frequency.setValueAtTime(freq, startTime);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.5, startTime + 0.3);
                
                gain.gain.setValueAtTime(0.4, startTime);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
                
                osc.start(startTime);
                osc.stop(startTime + 0.3);
            });
            
            // Add a deep bass rumble for impact
            const bass = audioContext.createOscillator();
            const bassGain = audioContext.createGain();
            bass.connect(bassGain);
            bassGain.connect(audioContext.destination);
            bass.type = 'triangle';
            bass.frequency.setValueAtTime(55, now);
            bassGain.gain.setValueAtTime(0.5, now);
            bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
            bass.start(now);
            bass.stop(now + 0.8);
            return; // Skip the default oscillator setup since we created custom ones
            break;
            
        case 'hardDrop':
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(600, now);
            oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.15);
            gainNode.gain.setValueAtTime(0.25, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            oscillator.start(now);
            oscillator.stop(now + 0.15);
            break;
            
        case 'bomb':
            // Explosion sound effect
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(400, now);
            oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.3);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            oscillator.start(now);
            oscillator.stop(now + 0.3);
            
            // Add crackle effect
            const noise = audioContext.createOscillator();
            const noiseGain = audioContext.createGain();
            noise.connect(noiseGain);
            noiseGain.connect(audioContext.destination);
            noise.type = 'square';
            noise.frequency.setValueAtTime(100, now);
            noiseGain.gain.setValueAtTime(0.15, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            noise.start(now);
            noise.stop(now + 0.2);
            break;
    }
}

// Particle System
function createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x * BLOCK_SIZE + BLOCK_SIZE / 2,
            y: y * BLOCK_SIZE + BLOCK_SIZE / 2,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 3,
            life: 1,
            color: color || '#FFD700'
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life -= 0.02;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Score popup animation
function createScorePopup(points) {
    scorePopups.push({
        text: `+${points}`,
        x: canvas.width / 2,
        y: canvas.height - 100,
        alpha: 1,
        scale: 0.1,
        life: 1
    });
}

function updateScorePopups() {
    for (let i = scorePopups.length - 1; i >= 0; i--) {
        const popup = scorePopups[i];
        
        // Rise upward
        popup.y -= 2;
        
        // Bounce scale animation
        if (popup.scale < 1) {
            popup.scale += 0.08;
        }
        
        // Fade out near the end
        popup.life -= 0.015;
        if (popup.life < 0.3) {
            popup.alpha = popup.life / 0.3;
        }
        
        if (popup.life <= 0) {
            scorePopups.splice(i, 1);
        }
    }
}

function drawScorePopups() {
    ctx.save();
    for (const popup of scorePopups) {
        ctx.globalAlpha = popup.alpha;
        ctx.font = `bold ${32 * popup.scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Glow effect
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FFD700';
        
        // Gold gradient
        const gradient = ctx.createLinearGradient(0, popup.y - 20, 0, popup.y + 20);
        gradient.addColorStop(0, '#FFD700');
        gradient.addColorStop(0.5, '#FFA500');
        gradient.addColorStop(1, '#FF8C00');
        ctx.fillStyle = gradient;
        
        ctx.fillText(popup.text, popup.x, popup.y);
    }
    ctx.restore();
}

// Setup Mobile Controls
function setupMobileControls() {
    // Canvas touch/swipe controls
    setupCanvasTouchControls();
}

function setupCanvasTouchControls() {
    const canvas = document.getElementById('gameCanvas');
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let lastMoveX = 0;
    let isDragging = false;
    const swipeThreshold = 30; // Minimum distance for swipe
    const tapThreshold = 200; // Maximum time for tap (ms)
    const dragThreshold = 15; // Minimum distance to start dragging
    
    canvas.addEventListener('touchstart', (e) => {
        if (isPaused || !currentPiece) return;
        e.preventDefault();
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        lastMoveX = touch.clientX;
        touchStartTime = Date.now();
        isDragging = false;
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
        if (isPaused || !currentPiece) return;
        e.preventDefault();
        const touch = e.touches[0];
        const currentX = touch.clientX;
        const currentY = touch.clientY;
        
        const deltaX = currentX - touchStartX;
        const deltaY = currentY - touchStartY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        
        // Start dragging if moved enough horizontally
        if (!isDragging && absDeltaX > dragThreshold && absDeltaX > absDeltaY) {
            isDragging = true;
        }
        
        // Handle horizontal dragging
        if (isDragging) {
            const rect = canvas.getBoundingClientRect();
            const blockWidth = rect.width / COLS;
            const moveDistance = currentX - lastMoveX;
            
            // Move piece if dragged more than half a block width
            if (Math.abs(moveDistance) >= blockWidth) {
                const direction = moveDistance > 0 ? 1 : -1;
                move(direction);
                lastMoveX = currentX;
            }
        }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const touchEndX = touch.clientX;
        const touchEndY = touch.clientY;
        const touchEndTime = Date.now();
        
        if (isPaused || !currentPiece) return;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const deltaTime = touchEndTime - touchStartTime;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        
        // If was dragging, don't process as swipe/tap
        if (isDragging) {
            isDragging = false;
            return;
        }
        
        // Tap to rotate (quick touch without much movement)
        if (deltaTime < tapThreshold && absDeltaX < swipeThreshold && absDeltaY < swipeThreshold) {
            rotate();
        }
        // Hard drop based on gravity direction
        else if (absDeltaY > absDeltaX) {
            if (currentGravity === GRAVITY.DOWN && deltaY > swipeThreshold) {
                // Swipe down for hard drop when gravity is DOWN
                hardDrop();
            } else if (currentGravity === GRAVITY.UP && deltaY < -swipeThreshold) {
                // Swipe up for hard drop when gravity is UP
                hardDrop();
            }
        }
        // Swipe left - multi-column based on distance
        else if (absDeltaX > absDeltaY && deltaX < -swipeThreshold) {
            const rect = canvas.getBoundingClientRect();
            const blockWidth = rect.width / COLS;
            const columns = Math.max(1, Math.floor(absDeltaX / blockWidth));
            for (let i = 0; i < columns; i++) {
                move(-1);
            }
        }
        // Swipe right - multi-column based on distance
        else if (absDeltaX > absDeltaY && deltaX > swipeThreshold) {
            const rect = canvas.getBoundingClientRect();
            const blockWidth = rect.width / COLS;
            const columns = Math.max(1, Math.floor(absDeltaX / blockWidth));
            for (let i = 0; i < columns; i++) {
                move(1);
            }
        }
        
        isDragging = false;
    }, { passive: false });
}

// Desktop Mouse Controls
function setupMouseControls() {
    let mouseStartX = 0;
    let mouseStartY = 0;
    let lastMoveX = 0;
    let isDragging = false;
    let isMouseDown = false;
    const clickThreshold = 200; // Maximum time for click (ms)
    const dragThreshold = 10; // Minimum distance to start dragging
    let mouseDownTime = 0;
    
    canvas.addEventListener('mousedown', (e) => {
        if (isPaused || !currentPiece || isGameOver) return;
        e.preventDefault();
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        lastMoveX = e.clientX;
        mouseDownTime = Date.now();
        isDragging = false;
        isMouseDown = true;
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!isMouseDown || isPaused || !currentPiece || isGameOver) return;
        e.preventDefault();
        
        const currentX = e.clientX;
        const deltaX = currentX - mouseStartX;
        const absDeltaX = Math.abs(deltaX);
        
        // Start dragging if moved enough horizontally
        if (!isDragging && absDeltaX > dragThreshold) {
            isDragging = true;
        }
        
        // Handle horizontal dragging
        if (isDragging) {
            const rect = canvas.getBoundingClientRect();
            const blockWidth = rect.width / COLS;
            const moveDistance = currentX - lastMoveX;
            
            // Move piece if dragged more than half a block width
            if (Math.abs(moveDistance) >= blockWidth / 2) {
                const direction = moveDistance > 0 ? 1 : -1;
                move(direction);
                lastMoveX = currentX;
            }
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        if (!isMouseDown) return;
        e.preventDefault();
        
        const mouseEndTime = Date.now();
        const deltaTime = mouseEndTime - mouseDownTime;
        const deltaX = e.clientX - mouseStartX;
        const absDeltaX = Math.abs(deltaX);
        
        isMouseDown = false;
        
        if (isPaused || !currentPiece || isGameOver) {
            isDragging = false;
            return;
        }
        
        // If was dragging, don't process as click
        if (isDragging) {
            isDragging = false;
            return;
        }
        
        // Click to rotate (quick click without much movement)
        if (deltaTime < clickThreshold && absDeltaX < dragThreshold) {
            rotate();
        }
        
        isDragging = false;
    });
    
    // Handle mouse leaving canvas
    canvas.addEventListener('mouseleave', () => {
        isMouseDown = false;
        isDragging = false;
    });
    
    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

// Game Loop
function update(currentTime) {
    if (!isGameOver && !isPaused) {
        gameLoop = requestAnimationFrame(update);
        
        // Gravity shift warning (3 seconds before shift)
        if (currentTime - lastGravityShift > gravityShiftInterval - 3000 && !gravityWarning) {
            gravityWarning = true;
            gravityWarningTime = currentTime;
        }
        
        // Trigger gravity shift
        if (currentTime - lastGravityShift > gravityShiftInterval) {
            shiftGravity();
            lastGravityShift = currentTime;
            gravityWarning = false;
        }
        
        if (currentTime - lastDropTime > dropInterval) {
            drop();
            lastDropTime = currentTime;
        }
        
        draw();
        updateParticles();
        updateScorePopups();
    } else if (isPaused) {
        gameLoop = requestAnimationFrame(update);
    } else if (isGameOver) {
        // Keep game loop running during and after game over
        gameLoop = requestAnimationFrame(update);
        draw();
        updateParticles();
        updateScorePopups();
    }
}

// Draw Game
function draw() {
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    drawGrid();
    
    // Draw warning line
    drawWarningLine();
    
    // Draw ghost piece (where piece will land)
    if (currentPiece) {
        drawGhostPiece();
    }
    
    // Draw current piece
    if (currentPiece) {
        drawPiece(currentPiece, ctx);
    }
    
    // Draw particles
    drawParticles();
    
    // Draw score popups
    drawScorePopups();
    
    // Draw level up text animation
    drawLevelUpText();
    
    // Draw gravity warning and indicator
    drawGravityIndicator();
    
    // Draw game over animation
    drawGameOverAnimation();
}

function drawGameOverAnimation() {
    if (!gameOverAnimation.active) return;
    
    ctx.save();
    
    // Darken background gradually
    ctx.fillStyle = `rgba(0, 0, 0, ${gameOverAnimation.progress * 0.7})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.restore();
}

// Draw particles on main canvas
function drawParticles() {
    ctx.save();
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

// Draw Grid
function drawGrid() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (grid[row][col]) {
                const x = col * BLOCK_SIZE;
                const y = row * BLOCK_SIZE;
                const color = grid[row][col];
                
                // Apply game over fade wave effect
                let blockAlpha = 1;
                if (gameOverAnimation.active && gameOverAnimation.fadeWave > 0) {
                    // Fade from bottom to top
                    const fadeThreshold = (ROWS - row) / ROWS;
                    if (gameOverAnimation.fadeWave >= fadeThreshold) {
                        blockAlpha = Math.max(0, 1 - ((gameOverAnimation.fadeWave - fadeThreshold) * 5));
                    }
                }
                
                // Check if this block is in a flashing line
                const isFlashing = flashingLines.active && 
                    (flashingLines.rows.includes(row) || flashingLines.cols.includes(col));
                const flashOn = isFlashing && (flashingLines.flashCount % 2 === 0);
                
                ctx.save();
                ctx.globalAlpha = blockAlpha;
                
                if (flashOn) {
                    // Draw white flash
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(x, y, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                } else {
                    // Create gradient for 3D effect
                    const gradient = ctx.createLinearGradient(x, y, x + BLOCK_SIZE, y + BLOCK_SIZE);
                    gradient.addColorStop(0, color);
                    gradient.addColorStop(1, shadeColor(color, -30));
                    ctx.fillStyle = gradient;
                    ctx.fillRect(x, y, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                    
                    // Add top shine
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    ctx.fillRect(x, y, BLOCK_SIZE - 1, 4);
                    
                    // Add left shine
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.fillRect(x, y, 4, BLOCK_SIZE - 1);
                    
                    // Add bottom shadow
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                    ctx.fillRect(x, y + BLOCK_SIZE - 4, BLOCK_SIZE - 1, 3);
                    
                    // Add right shadow
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                    ctx.fillRect(x + BLOCK_SIZE - 4, y, 3, BLOCK_SIZE - 1);
                    
                    // Draw bomb indicator if this is a bomb block
                    if (blockTypes[row][col] === BLOCK_TYPES.BOMB) {
                        ctx.save();
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = '#FF0000';
                        ctx.fillStyle = '#FF0000';
                        ctx.font = 'bold 18px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('💣', x + BLOCK_SIZE / 2, y + BLOCK_SIZE / 2);
                        ctx.restore();
                    }
                }
                
                ctx.restore();
            }
        }
    }
    
    // Draw grid lines
    // Check if we should pulse grid lines red based on danger zone
    let shouldPulseGrid = false;
    
    if (currentGravity === GRAVITY.DOWN) {
        // Normal gravity: check top rows
        let highestBlock = ROWS;
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (grid[row][col]) {
                    highestBlock = Math.min(highestBlock, row);
                    break;
                }
            }
            if (highestBlock < ROWS) break;
        }
        shouldPulseGrid = highestBlock <= 5;
    } else {
        // UP gravity: check bottom rows
        let lowestBlock = -1;
        for (let row = ROWS - 1; row >= 0; row--) {
            for (let col = 0; col < COLS; col++) {
                if (grid[row][col]) {
                    lowestBlock = Math.max(lowestBlock, row);
                    break;
                }
            }
            if (lowestBlock >= 0) break;
        }
        shouldPulseGrid = lowestBlock >= ROWS - 6;
    }
    
    if (shouldPulseGrid) {
        const pulseIntensity = Math.sin(Date.now() / 150) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(255, 0, 0, ${pulseIntensity * 0.4})`;
        ctx.lineWidth = 1.5;
    } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
    }
    
    for (let row = 0; row <= ROWS; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * BLOCK_SIZE);
        ctx.lineTo(COLS * BLOCK_SIZE, row * BLOCK_SIZE);
        ctx.stroke();
    }
    for (let col = 0; col <= COLS; col++) {
        ctx.beginPath();
        ctx.moveTo(col * BLOCK_SIZE, 0);
        ctx.lineTo(col * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        ctx.stroke();
    }
}

// Draw Warning Line
function drawWarningLine() {
    // Warning line position changes based on gravity
    let warningRow, warningY;
    let highestBlock, lowestBlock;
    
    if (currentGravity === GRAVITY.DOWN) {
        // Normal gravity: warning line near top
        warningRow = 7; // 3 rows before danger zone (which starts at row 4)
        warningY = warningRow * BLOCK_SIZE;
        
        // Find highest block position
        highestBlock = ROWS;
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (grid[row][col]) {
                    highestBlock = Math.min(highestBlock, row);
                    break;
                }
            }
            if (highestBlock < ROWS) break;
        }
    } else {
        // UP gravity: warning line near bottom
        warningRow = ROWS - 8; // 3 rows before danger zone (which starts at row ROWS-4)
        warningY = warningRow * BLOCK_SIZE;
        
        // Find lowest block position
        lowestBlock = -1;
        for (let row = ROWS - 1; row >= 0; row--) {
            for (let col = 0; col < COLS; col++) {
                if (grid[row][col]) {
                    lowestBlock = Math.max(lowestBlock, row);
                    break;
                }
            }
            if (lowestBlock >= 0) break;
        }
    }
    
    // Determine line color and animation based on block height
    let lineColor, lineWidth, shouldPulse;
    
    if (currentGravity === GRAVITY.DOWN) {
        if (highestBlock <= 5) {
            // Red + pulsing (blocks at row 5 or higher - critical warning)
            const pulseIntensity = Math.sin(Date.now() / 150) * 0.3 + 0.7;
            lineColor = `rgba(255, 0, 0, ${pulseIntensity})`;
            lineWidth = 3 + Math.sin(Date.now() / 150) * 1;
            shouldPulse = true;
        } else if (highestBlock <= 6) {
            // Yellow (blocks at row 6 - caution)
            lineColor = 'rgba(255, 200, 0, 0.8)';
            lineWidth = 3;
            shouldPulse = false;
        } else {
            // Green (safe zone)
            lineColor = 'rgba(0, 255, 100, 0.6)';
            lineWidth = 2;
            shouldPulse = false;
        }
    } else {
        // UP gravity
        if (lowestBlock >= ROWS - 6) {
            // Red + pulsing (blocks at row ROWS-6 or lower - critical warning)
            const pulseIntensity = Math.sin(Date.now() / 150) * 0.3 + 0.7;
            lineColor = `rgba(255, 0, 0, ${pulseIntensity})`;
            lineWidth = 3 + Math.sin(Date.now() / 150) * 1;
            shouldPulse = true;
        } else if (lowestBlock >= ROWS - 7) {
            // Yellow (blocks at row ROWS-7 - caution)
            lineColor = 'rgba(255, 200, 0, 0.8)';
            lineWidth = 3;
            shouldPulse = false;
        } else {
            // Green (safe zone)
            lineColor = 'rgba(0, 255, 100, 0.6)';
            lineWidth = 2;
            shouldPulse = false;
        }
    }
    
    // Draw the warning line
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([5, 3]); // Dashed line
    ctx.beginPath();
    ctx.moveTo(0, warningY);
    ctx.lineTo(COLS * BLOCK_SIZE, warningY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset to solid line
    ctx.lineWidth = 1;
}

// Draw Ghost Piece (shows where piece will land)
function drawGhostPiece() {
    if (!currentPiece) return;
    
    // Calculate ghost position (where piece will land)
    let ghostY = currentPiece.y;
    while (!collision(currentPiece.x, ghostY + 1, currentPiece.shape)) {
        ghostY++;
    }
    
    // Only draw ghost if it's below the current piece
    if (ghostY > currentPiece.y) {
        const shape = currentPiece.shape;
        
        // Draw ghost piece with semi-transparent outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]); // Dashed outline
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const x = (currentPiece.x + col) * BLOCK_SIZE;
                    const y = (ghostY + row) * BLOCK_SIZE;
                    
                    // Draw dashed outline
                    ctx.strokeRect(x + 1, y + 1, BLOCK_SIZE - 3, BLOCK_SIZE - 3);
                }
            }
        }
        
        ctx.setLineDash([]); // Reset to solid line
        ctx.lineWidth = 1;
    }
}

// Draw Piece
function drawPiece(piece, context) {
    const shape = piece.shape;
    const color = piece.color;
    
    // Find center block for bomb indicator
    let centerRow = -1, centerCol = -1;
    if (piece.hasBomb) {
        let blockCount = 0;
        let totalRow = 0, totalCol = 0;
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    totalRow += row;
                    totalCol += col;
                    blockCount++;
                }
            }
        }
        if (blockCount > 0) {
            centerRow = Math.round(totalRow / blockCount);
            centerCol = Math.round(totalCol / blockCount);
        }
    }
    
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col]) {
                const x = (piece.x + col) * BLOCK_SIZE;
                const y = (piece.y + row) * BLOCK_SIZE;
                
                // Create gradient for 3D effect
                const gradient = context.createLinearGradient(x, y, x + BLOCK_SIZE, y + BLOCK_SIZE);
                gradient.addColorStop(0, color);
                gradient.addColorStop(1, shadeColor(color, -30));
                context.fillStyle = gradient;
                context.fillRect(x, y, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                
                // Add top shine
                context.fillStyle = 'rgba(255, 255, 255, 0.5)';
                context.fillRect(x, y, BLOCK_SIZE - 1, 4);
                
                // Add left shine
                context.fillStyle = 'rgba(255, 255, 255, 0.3)';
                context.fillRect(x, y, 4, BLOCK_SIZE - 1);
                
                // Add bottom shadow
                context.fillStyle = 'rgba(0, 0, 0, 0.4)';
                context.fillRect(x, y + BLOCK_SIZE - 4, BLOCK_SIZE - 1, 3);
                
                // Add right shadow
                context.fillStyle = 'rgba(0, 0, 0, 0.3)';
                context.fillRect(x + BLOCK_SIZE - 4, y, 3, BLOCK_SIZE - 1);
                
                // Draw bomb indicator on center block
                if (piece.hasBomb && row === centerRow && col === centerCol) {
                    context.save();
                    context.shadowBlur = 10;
                    context.shadowColor = '#FF0000';
                    context.fillStyle = '#FF0000';
                    context.font = 'bold 18px Arial';
                    context.textAlign = 'center';
                    context.textBaseline = 'middle';
                    context.fillText('💣', x + BLOCK_SIZE / 2, y + BLOCK_SIZE / 2);
                    context.restore();
                }
            }
        }
    }
}

// Helper function to darken/lighten colors
function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
}

// Game Over
function gameOver() {
    isGameOver = true;
    playSound('gameOver');
    stopBackgroundMusic();
    
    // Remove shake effect
    document.querySelector('.canvas-container').classList.remove('danger');
    
    // Start game over animation
    startGameOverAnimation();
}

function startGameOverAnimation() {
    gameOverAnimation.active = true;
    gameOverAnimation.progress = 0;
    gameOverAnimation.fadeWave = 0;
    gameOverAnimation.textY = canvas.height;
    gameOverAnimation.textAlpha = 0;
    gameOverAnimation.statsAlpha = 0;
    
    const duration = 1500; // Reduced to match fade wave completion time
    const startTime = Date.now();
    
    function animate() {
        if (!gameOverAnimation.active) return;
        
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        gameOverAnimation.progress = progress;
        
        // Wave fade from bottom to top (0 to 1 over first 60%)
        if (progress < 0.6) {
            gameOverAnimation.fadeWave = progress / 0.6;
        } else {
            gameOverAnimation.fadeWave = 1;
        }
        
        // Text rises from bottom (starts at 20%, ends at 60%)
        if (progress > 0.2 && progress < 0.6) {
            const textProgress = (progress - 0.2) / 0.4;
            gameOverAnimation.textY = canvas.height - (textProgress * canvas.height * 0.6);
            gameOverAnimation.textAlpha = textProgress;
        } else if (progress >= 0.6) {
            gameOverAnimation.textY = canvas.height * 0.4;
            gameOverAnimation.textAlpha = 1;
        }
        
        // Don't show stats on canvas, will use overlay instead
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Animation complete, show the overlay
            showGameOverScreen();
        }
    }
    
    animate();
}

function showGameOverScreen() {
    gameOverAnimation.active = false;
    
    // Update high score if beaten
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('lineBreakerHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
        document.getElementById('newHighScore').classList.remove('hidden');
    } else {
        document.getElementById('newHighScore').classList.add('hidden');
    }
    
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalLevel').textContent = level;
    document.getElementById('finalHighScore').textContent = highScore;
    document.getElementById('gameOver').classList.remove('hidden');
    
    // Stop the game loop after overlay is shown
    cancelAnimationFrame(gameLoop);
    document.getElementById('pauseBtn').classList.add('hidden');
}

// Initialize on page load
window.addEventListener('load', () => {
    // Lock screen orientation to portrait on mobile
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch(err => {
            console.log('Orientation lock not supported:', err);
        });
    }
    
    init();
});
