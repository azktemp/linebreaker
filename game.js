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
    '#FF1744'  // Neon Red
];

// Tetromino Shapes
const SHAPES = [
    [[1, 1, 1, 1]], // I
    [[1, 1], [1, 1]], // O
    [[0, 1, 0], [1, 1, 1]], // T
    [[1, 1, 0], [0, 1, 1]], // S
    [[0, 1, 1], [1, 1, 0]], // Z
    [[1, 0, 0], [1, 1, 1]], // L
    [[0, 0, 1], [1, 1, 1]]  // J
];

// Game State
let canvas, ctx, nextCanvas, nextCtx;
let grid = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let highScore = 0;
let gameLoop = null;
let dropInterval = 1000;
let lastDropTime = 0;
let isGameOver = false;
let isPaused = false;

// Audio
let audioContext;
let soundEnabled = true;
let musicEnabled = true;
let bgMusicOscillator = null;
let bgMusicGain = null;
let bgMusicInterval = null;

// Particles
let particleCanvas, particleCtx;
let particles = [];

// Initialize Game
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    nextCanvas = document.getElementById('nextShapeCanvas');
    nextCtx = nextCanvas.getContext('2d');
    particleCanvas = document.getElementById('particleCanvas');
    particleCtx = particleCanvas.getContext('2d');
    
    // Load high score from localStorage
    highScore = parseInt(localStorage.getItem('lineBreakerHighScore')) || 0;
    document.getElementById('highScore').textContent = highScore;
    
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
    document.getElementById('startBtn').addEventListener('click', showTutorial);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('resumeBtn').addEventListener('click', togglePause);
    document.getElementById('closeTutorial').addEventListener('click', startGame);
    document.addEventListener('keydown', handleKeyPress);
    document.getElementById('soundToggle').addEventListener('click', toggleSound);
    document.getElementById('musicToggle').addEventListener('click', toggleMusic);
    
    // Mobile touch controls
    setupMobileControls();
    
    // Check if first time player
    if (!localStorage.getItem('lineBreakerPlayed')) {
        localStorage.setItem('lineBreakerPlayed', 'true');
    }
}

// Show Tutorial
function showTutorial() {
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('tutorial').classList.remove('hidden');
}

// Start Game
function startGame() {
    document.getElementById('tutorial').classList.add('hidden');
    resetGame();
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('pauseBtn').classList.remove('hidden');
    document.getElementById('gameOver').classList.add('hidden');
    nextPiece = createPiece();
    spawnPiece();
    if (musicEnabled) startBackgroundMusic();
    gameLoop = requestAnimationFrame(update);
}

// Reset Game
function resetGame() {
    grid = [];
    for (let row = 0; row < ROWS; row++) {
        grid[row] = [];
        for (let col = 0; col < COLS; col++) {
            grid[row][col] = 0;
        }
    }
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    isGameOver = false;
    updateScore();
}

// Toggle Pause
function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        document.getElementById('pauseScreen').classList.remove('hidden');
        document.getElementById('pauseBtn').textContent = '▶ Resume';
    } else {
        document.getElementById('pauseScreen').classList.add('hidden');
        document.getElementById('pauseBtn').textContent = '⏸ Pause';
        lastDropTime = Date.now();
    }
}

// Restart Game
function restartGame() {
    startGame();
}

// Create Random Piece
function createPiece() {
    const shapeIndex = Math.floor(Math.random() * SHAPES.length);
    return {
        shape: SHAPES[shapeIndex],
        color: COLORS[shapeIndex],
        x: Math.floor(COLS / 2) - 1,
        y: 0
    };
}

// Spawn New Piece
function spawnPiece() {
    currentPiece = nextPiece;
    nextPiece = createPiece();
    
    // Check if piece can be placed (game over check)
    if (collision(currentPiece.x, currentPiece.y, currentPiece.shape)) {
        gameOver();
    }
    
    drawNextPiece();
}

// Collision Detection
function collision(x, y, shape) {
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col]) {
                const newX = x + col;
                const newY = y + row;
                
                // Check boundaries
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }
                
                // Check if position is already occupied
                if (newY >= 0 && grid[newY][newX]) {
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
    
    const newY = currentPiece.y + 1;
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
    
    while (!collision(currentPiece.x, currentPiece.y + 1, currentPiece.shape)) {
        currentPiece.y++;
        score += 2; // Bonus points for hard drop
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
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col]) {
                const gridY = currentPiece.y + row;
                const gridX = currentPiece.x + col;
                if (gridY >= 0) {
                    grid[gridY][gridX] = currentPiece.color;
                }
            }
        }
    }
}

// Clear Completed Lines
function clearLines() {
    let linesCleared = 0;
    
    // Check rows
    for (let row = ROWS - 1; row >= 0; row--) {
        if (grid[row].every(cell => cell !== 0)) {
            // Create particles for cleared line
            for (let col = 0; col < COLS; col++) {
                createParticles(col, row, 3, grid[row][col]);
            }
            grid.splice(row, 1);
            grid.unshift(new Array(COLS).fill(0));
            linesCleared++;
            row++; // Check same row again
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
            // Create particles for cleared column
            for (let row = 0; row < ROWS; row++) {
                createParticles(col, row, 3, grid[row][col]);
                grid[row][col] = 0;
            }
            // Drop blocks above
            dropColumn(col);
            linesCleared++;
        }
    }
    
    if (linesCleared > 0) {
        playSound('lineClear');
        lines += linesCleared;
        
        // Level progression: every 10 lines = new level
        const newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) {
            level = newLevel;
            // Speed increases with each level
            dropInterval = Math.max(100, 1000 - (level * 80));
            // Visual feedback for level up
            createLevelUpEffect();
        }
        
        // Score calculation: more points for multiple lines and higher levels
        const baseScore = linesCleared === 1 ? 100 : 
                         linesCleared === 2 ? 300 :
                         linesCleared === 3 ? 500 : 800;
        score += baseScore * level;
        
        updateScore();
    }
}

// Drop Column After Vertical Line Clear
function dropColumn(col) {
    for (let row = ROWS - 1; row >= 0; row--) {
        if (grid[row][col] === 0) {
            // Find next non-empty cell above
            for (let r = row - 1; r >= 0; r--) {
                if (grid[r][col] !== 0) {
                    grid[row][col] = grid[r][col];
                    grid[r][col] = 0;
                    break;
                }
            }
        }
    }
}

// Level Up Effect
function createLevelUpEffect() {
    // Create particles across the screen
    for (let i = 0; i < 30; i++) {
        const randomX = Math.floor(Math.random() * COLS);
        const randomY = Math.floor(Math.random() * ROWS);
        createParticles(randomX, randomY, 2, '#FFD700');
    }
    
    // Play celebratory sound
    if (soundEnabled && audioContext) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        const now = audioContext.currentTime;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523, now);
        oscillator.frequency.setValueAtTime(659, now + 0.1);
        oscillator.frequency.setValueAtTime(784, now + 0.2);
        oscillator.frequency.setValueAtTime(1047, now + 0.3);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
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
    if (isGameOver) return;
    
    // Pause with P or Escape key
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause();
        return;
    }
    
    if (isPaused) return;
    
    switch(e.key) {
        case 'ArrowLeft':
            move(-1);
            break;
        case 'ArrowRight':
            move(1);
            break;
        case 'ArrowDown':
            drop();
            break;
        case 'ArrowUp':
            rotate();
            break;
        case ' ':
            e.preventDefault();
            hardDrop();
            break;
    }
}

// Sound Functions
function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('soundToggle');
    btn.textContent = soundEnabled ? '🔊' : '🔇';
    btn.classList.toggle('muted', !soundEnabled);
}

function toggleMusic() {
    musicEnabled = !musicEnabled;
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
        if (!musicEnabled) return;
        
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
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(300, now);
            oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.5);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            oscillator.start(now);
            oscillator.stop(now + 0.5);
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
    }
}

// Particle System
function createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x * BLOCK_SIZE + BLOCK_SIZE / 2,
            y: y * BLOCK_SIZE + BLOCK_SIZE / 2,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5 - 2,
            life: 1,
            color: color || '#FFD700'
        });
    }
}

function updateParticles() {
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life -= 0.02;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        particleCtx.globalAlpha = p.life;
        particleCtx.fillStyle = p.color;
        particleCtx.fillRect(p.x, p.y, 4, 4);
    }
    
    particleCtx.globalAlpha = 1;
}

// Setup Mobile Controls
function setupMobileControls() {
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const downBtn = document.getElementById('downBtn');
    const rotateBtn = document.getElementById('rotateBtn');
    const hardDropBtn = document.getElementById('hardDropBtn');
    
    if (leftBtn) leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); move(-1); });
    if (rightBtn) rightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); move(1); });
    if (downBtn) downBtn.addEventListener('touchstart', (e) => { e.preventDefault(); drop(); });
    if (rotateBtn) rotateBtn.addEventListener('touchstart', (e) => { e.preventDefault(); rotate(); });
    if (hardDropBtn) hardDropBtn.addEventListener('touchstart', (e) => { e.preventDefault(); hardDrop(); });
    
    // Also support click for desktop testing
    if (leftBtn) leftBtn.addEventListener('click', () => move(-1));
    if (rightBtn) rightBtn.addEventListener('click', () => move(1));
    if (downBtn) downBtn.addEventListener('click', () => drop());
    if (rotateBtn) rotateBtn.addEventListener('click', () => rotate());
    if (hardDropBtn) hardDropBtn.addEventListener('click', () => hardDrop());
}

// Game Loop
function update(currentTime) {
    if (!isGameOver && !isPaused) {
        gameLoop = requestAnimationFrame(update);
        
        if (currentTime - lastDropTime > dropInterval) {
            drop();
            lastDropTime = currentTime;
        }
        
        draw();
        updateParticles();
    } else if (isPaused) {
        gameLoop = requestAnimationFrame(update);
    }
}

// Draw Game
function draw() {
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    drawGrid();
    
    // Draw current piece
    if (currentPiece) {
        drawPiece(currentPiece, ctx);
    }
}

// Draw Grid
function drawGrid() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (grid[row][col]) {
                ctx.fillStyle = grid[row][col];
                ctx.fillRect(col * BLOCK_SIZE, row * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                
                // Add shine effect
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(col * BLOCK_SIZE, row * BLOCK_SIZE, BLOCK_SIZE - 1, 3);
            }
        }
    }
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
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

// Draw Piece
function drawPiece(piece, context) {
    const shape = piece.shape;
    context.fillStyle = piece.color;
    
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col]) {
                const x = (piece.x + col) * BLOCK_SIZE;
                const y = (piece.y + row) * BLOCK_SIZE;
                context.fillRect(x, y, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                
                // Add shine effect
                context.fillStyle = 'rgba(255, 255, 255, 0.3)';
                context.fillRect(x, y, BLOCK_SIZE - 1, 3);
                context.fillStyle = piece.color;
            }
        }
    }
}

// Draw Next Piece
function drawNextPiece() {
    nextCtx.fillStyle = '#1a1a2e';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (nextPiece) {
        const tempPiece = {
            shape: nextPiece.shape,
            color: nextPiece.color,
            x: 1,
            y: 1
        };
        drawPiece(tempPiece, nextCtx);
    }
}

// Game Over
function gameOver() {
    isGameOver = true;
    playSound('gameOver');
    stopBackgroundMusic();
    cancelAnimationFrame(gameLoop);
    
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
    document.getElementById('pauseBtn').classList.add('hidden');
    document.getElementById('startBtn').style.display = 'block';
}

// Initialize on page load
window.addEventListener('load', init);
