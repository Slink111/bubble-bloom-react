// Game Constants
const BUBBLE_RADIUS = 18;
const COLORS = ['purple', 'cyan', 'magenta', 'lime', 'orange'];
const ROWS = 12;
const COLS = 12;
const BUBBLE_SPACING = BUBBLE_RADIUS * 2;

// Game State
let bubbles = [];
let projectile = null;
let nextColor = 'purple';
let score = 0;
let gameOver = false;
let isDragging = false;
let aimAngle = 0;
let aimPower = 0;
let popAnimations = [];
let gameStarted = false;
let timeLeft = 180;
let dragStart = { x: 0, y: 0 };
let animationId = null;
let timerInterval = null;

// DOM Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const scoreValue = document.querySelector('.score-value');
const timerElement = document.getElementById('timer');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const gameControls = document.getElementById('gameControls');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const restartBtnSmall = document.getElementById('restartBtnSmall');
const gameOverTitle = document.getElementById('gameOverTitle');
const finalScore = document.getElementById('finalScore');
const timePlayed = document.getElementById('timePlayed');
const powerIndicator = document.getElementById('powerIndicator');

// Color Functions
function getColorData(color) {
    switch (color) {
        case 'purple':
            return {
                light: 'hsl(269, 91%, 77%)',
                main: 'hsl(269, 91%, 67%)',
                dark: 'hsl(269, 91%, 47%)',
                shadow: 'hsl(269, 91%, 67%)'
            };
        case 'cyan':
            return {
                light: 'hsl(186, 100%, 79%)',
                main: 'hsl(186, 100%, 69%)',
                dark: 'hsl(186, 100%, 49%)',
                shadow: 'hsl(186, 100%, 69%)'
            };
        case 'magenta':
            return {
                light: 'hsl(330, 81%, 70%)',
                main: 'hsl(330, 81%, 60%)',
                dark: 'hsl(330, 81%, 40%)',
                shadow: 'hsl(330, 81%, 60%)'
            };
        case 'lime':
            return {
                light: 'hsl(84, 81%, 64%)',
                main: 'hsl(84, 81%, 54%)',
                dark: 'hsl(84, 81%, 34%)',
                shadow: 'hsl(84, 81%, 54%)'
            };
        case 'orange':
            return {
                light: 'hsl(35, 85%, 70%)',
                main: 'hsl(35, 85%, 60%)',
                dark: 'hsl(35, 85%, 40%)',
                shadow: 'hsl(35, 85%, 60%)'
            };
    }
}

// Grid Functions
function getGridPosition(row, col) {
    const offsetX = row % 2 === 1 ? BUBBLE_SPACING / 2 : 0;
    return {
        x: 40 + offsetX + col * BUBBLE_SPACING,
        y: 60 + row * (BUBBLE_SPACING * 0.87)
    };
}

function initializeBubbles() {
    bubbles = [];
    for (let row = 0; row < 6; row++) {
        const maxCols = row % 2 === 1 ? COLS - 1 : COLS;
        for (let col = 0; col < Math.min(maxCols, 10); col++) {
            const pos = getGridPosition(row, col);
            if (pos.x < 440) {
                bubbles.push({
                    id: `${row}-${col}`,
                    x: pos.x,
                    y: pos.y,
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    radius: BUBBLE_RADIUS,
                    row,
                    col
                });
            }
        }
    }
}

function findNearestGridPosition(x, y) {
    let minDistance = Infinity;
    let bestPosition = { row: 0, col: 0, x: 0, y: 0 };

    for (let row = 0; row < ROWS; row++) {
        const maxCols = row % 2 === 1 ? COLS - 1 : COLS;
        for (let col = 0; col < maxCols; col++) {
            const pos = getGridPosition(row, col);
            if (pos.x >= 40 && pos.x <= 440) {
                const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    bestPosition = { row, col, x: pos.x, y: pos.y };
                }
            }
        }
    }

    return bestPosition;
}

// Game Logic
function findConnectedBubbles(targetBubble, bubbleList) {
    const visited = new Set();
    const stack = [targetBubble];
    const connected = [];

    while (stack.length > 0) {
        const current = stack.pop();
        if (visited.has(current.id) || current.color !== targetBubble.color) continue;

        visited.add(current.id);
        connected.push(current);

        const adjacent = bubbleList.filter(bubble => {
            if (visited.has(bubble.id) || bubble.color !== targetBubble.color) return false;
            const distance = Math.sqrt((bubble.x - current.x) ** 2 + (bubble.y - current.y) ** 2);
            return distance <= BUBBLE_SPACING * 1.1;
        });

        stack.push(...adjacent);
    }

    return connected;
}

function checkCollision(proj, bubble) {
    const distance = Math.sqrt((proj.x - bubble.x) ** 2 + (proj.y - bubble.y) ** 2);
    return distance <= proj.radius + bubble.radius - 3;
}

function shootBubble() {
    if (projectile || gameOver || !gameStarted || aimPower < 0.1) return;

    const startX = canvas.width / 2;
    const startY = canvas.height - 80;
    
    const speed = Math.min(aimPower * 15, 12);
    const vx = Math.cos(aimAngle) * speed;
    const vy = Math.sin(aimAngle) * speed;

    projectile = {
        x: startX,
        y: startY,
        vx,
        vy,
        color: nextColor,
        radius: BUBBLE_RADIUS
    };
    
    nextColor = COLORS[Math.floor(Math.random() * COLORS.length)];
}

function updateGame() {
    if (!projectile) return;

    const newProjectile = {
        ...projectile,
        x: projectile.x + projectile.vx,
        y: projectile.y + projectile.vy
    };

    // Wall bouncing
    if (newProjectile.x <= BUBBLE_RADIUS || newProjectile.x >= canvas.width - BUBBLE_RADIUS) {
        newProjectile.vx = -newProjectile.vx;
        newProjectile.x = Math.max(BUBBLE_RADIUS, Math.min(canvas.width - BUBBLE_RADIUS, newProjectile.x));
    }

    // Top boundary
    if (newProjectile.y <= BUBBLE_RADIUS + 20) {
        const gridPos = findNearestGridPosition(newProjectile.x, 60);
        const existingBubble = bubbles.find(b => 
            Math.abs(b.x - gridPos.x) < 10 && Math.abs(b.y - gridPos.y) < 10
        );

        if (!existingBubble) {
            const newBubble = {
                id: `proj-${Date.now()}`,
                x: gridPos.x,
                y: gridPos.y,
                color: projectile.color,
                radius: BUBBLE_RADIUS,
                row: gridPos.row,
                col: gridPos.col
            };

            const newBubbles = [...bubbles, newBubble];
            const connectedBubbles = findConnectedBubbles(newBubble, newBubbles);
            
            if (connectedBubbles.length >= 3) {
                const newAnimations = connectedBubbles.map(bubble => ({
                    x: bubble.x,
                    y: bubble.y,
                    frame: 0,
                    color: bubble.color
                }));
                popAnimations.push(...newAnimations);

                bubbles = newBubbles.filter(b => 
                    !connectedBubbles.some(cb => cb.id === b.id)
                );
                
                const points = connectedBubbles.length * 10 + (connectedBubbles.length > 3 ? (connectedBubbles.length - 3) * 5 : 0);
                score += points;
                updateScore();

                if (bubbles.length === 0) {
                    gameOver = true;
                    showGameOver();
                }
            } else {
                bubbles = newBubbles;
            }
        }
        
        projectile = null;
        return;
    }

    // Collision with bubbles
    let collided = false;
    for (const bubble of bubbles) {
        if (checkCollision(newProjectile, bubble)) {
            const gridPos = findNearestGridPosition(newProjectile.x, newProjectile.y);
            const existingBubble = bubbles.find(b => 
                Math.abs(b.x - gridPos.x) < 10 && Math.abs(b.y - gridPos.y) < 10
            );

            if (!existingBubble) {
                const newBubble = {
                    id: `proj-${Date.now()}`,
                    x: gridPos.x,
                    y: gridPos.y,
                    color: projectile.color,
                    radius: BUBBLE_RADIUS,
                    row: gridPos.row,
                    col: gridPos.col
                };

                const newBubbles = [...bubbles, newBubble];
                const connectedBubbles = findConnectedBubbles(newBubble, newBubbles);
                
                if (connectedBubbles.length >= 3) {
                    const newAnimations = connectedBubbles.map(bubble => ({
                        x: bubble.x,
                        y: bubble.y,
                        frame: 0,
                        color: bubble.color
                    }));
                    popAnimations.push(...newAnimations);

                    bubbles = newBubbles.filter(b => 
                        !connectedBubbles.some(cb => cb.id === b.id)
                    );
                    
                    const points = connectedBubbles.length * 10 + (connectedBubbles.length > 3 ? (connectedBubbles.length - 3) * 5 : 0);
                    score += points;
                    updateScore();

                    if (bubbles.length === 0) {
                        gameOver = true;
                        showGameOver();
                    }
                } else {
                    bubbles = newBubbles;
                }
            }
            
            collided = true;
            break;
        }
    }

    if (collided) {
        projectile = null;
        return;
    }

    // Bottom boundary
    if (newProjectile.y >= canvas.height - BUBBLE_RADIUS - 20) {
        gameOver = true;
        showGameOver();
        projectile = null;
        return;
    }

    projectile = newProjectile;
}

function updateAnimations() {
    popAnimations = popAnimations.map(anim => ({ ...anim, frame: anim.frame + 1 }))
                                  .filter(anim => anim.frame < 20);
}

function drawGame() {
    // Clear with gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, 'hsl(277, 66%, 20%)');
    bgGradient.addColorStop(0.5, 'hsl(277, 66%, 15%)');
    bgGradient.addColorStop(1, 'hsl(277, 66%, 8%)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw laser sight
    if (isDragging && gameStarted && !projectile && !gameOver) {
        const shooterX = canvas.width / 2;
        const shooterY = canvas.height - 80;
        
        const laserLength = 300;
        const endX = shooterX + Math.cos(aimAngle) * laserLength;
        const endY = shooterY + Math.sin(aimAngle) * laserLength;
        
        ctx.shadowColor = 'hsl(0, 100%, 60%)';
        ctx.shadowBlur = 15;
        
        ctx.strokeStyle = `hsla(0, 100%, ${60 + aimPower * 20}%, ${0.7 + aimPower * 0.3})`;
        ctx.lineWidth = 3 + aimPower * 2;
        ctx.beginPath();
        ctx.moveTo(shooterX, shooterY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        ctx.shadowBlur = 8;
        for (let i = 0; i < 10; i++) {
            const t = i / 10;
            const dotX = shooterX + (endX - shooterX) * t;
            const dotY = shooterY + (endY - shooterY) * t;
            
            ctx.fillStyle = `hsla(0, 100%, 70%, ${0.8 - t * 0.5})`;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 2 + aimPower, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.shadowBlur = 0;
    }

    // Draw bubbles
    bubbles.forEach(bubble => {
        const colors = getColorData(bubble.color);
        
        ctx.shadowColor = colors.shadow;
        ctx.shadowBlur = 12;
        
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        
        const gradient = ctx.createRadialGradient(
            bubble.x - 6, bubble.y - 6, 0,
            bubble.x, bubble.y, bubble.radius
        );
        gradient.addColorStop(0, colors.light);
        gradient.addColorStop(0.7, colors.main);
        gradient.addColorStop(1, colors.dark);
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(bubble.x - 5, bubble.y - 5, bubble.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw projectile
    if (projectile) {
        const colors = getColorData(projectile.color);
        
        ctx.shadowColor = colors.shadow;
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
        
        const gradient = ctx.createRadialGradient(
            projectile.x - 6, projectile.y - 6, 0,
            projectile.x, projectile.y, projectile.radius
        );
        gradient.addColorStop(0, colors.light);
        gradient.addColorStop(0.7, colors.main);
        gradient.addColorStop(1, colors.dark);
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(projectile.x - 5, projectile.y - 5, projectile.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw pop animations
    popAnimations.forEach(anim => {
        const progress = anim.frame / 20;
        const radius = BUBBLE_RADIUS * (1 + progress * 1.5);
        const alpha = 1 - progress;
        const colors = getColorData(anim.color);
        
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = colors.light;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(anim.x, anim.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = colors.main;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(anim.x, anim.y, radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.globalAlpha = 1;
    });

    // Draw shooter
    const shooterX = canvas.width / 2;
    const shooterY = canvas.height - 80;
    const colors = getColorData(nextColor);
    
    if (isDragging && aimPower > 0) {
        ctx.strokeStyle = `hsla(0, 100%, 60%, ${aimPower})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(shooterX, shooterY, BUBBLE_RADIUS + 8 + aimPower * 10, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    ctx.shadowColor = colors.shadow;
    ctx.shadowBlur = 15;
    
    ctx.beginPath();
    ctx.arc(shooterX, shooterY, BUBBLE_RADIUS + 2, 0, Math.PI * 2);
    
    const shooterGradient = ctx.createRadialGradient(
        shooterX - 6, shooterY - 6, 0,
        shooterX, shooterY, BUBBLE_RADIUS + 2
    );
    shooterGradient.addColorStop(0, colors.light);
    shooterGradient.addColorStop(0.7, colors.main);
    shooterGradient.addColorStop(1, colors.dark);
    
    ctx.fillStyle = shooterGradient;
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(shooterX - 5, shooterY - 5, (BUBBLE_RADIUS + 2) * 0.35, 0, Math.PI * 2);
    ctx.fill();
}

function gameLoop() {
    updateGame();
    updateAnimations();
    drawGame();
    animationId = requestAnimationFrame(gameLoop);
}

// UI Functions
function updateScore() {
    scoreValue.textContent = score;
    scoreElement.classList.add('animate');
    setTimeout(() => scoreElement.classList.remove('animate'), 300);
}

function updateTimer() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerElement.textContent = `Time: ${mins}:${secs.toString().padStart(2, '0')}`;
    
    if (timeLeft <= 30) {
        timerElement.classList.add('warning');
    } else {
        timerElement.classList.remove('warning');
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function startGame() {
    gameStarted = true;
    timeLeft = 180;
    
    startScreen.style.display = 'none';
    gameControls.style.display = 'block';
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) {
            gameOver = true;
            showGameOver();
        }
    }, 1000);
    
    updateTimer();
}

function showGameOver() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    gameControls.style.display = 'none';
    gameOverScreen.style.display = 'block';
    
    if (bubbles.length === 0) {
        gameOverTitle.textContent = '🎉 You Won!';
    } else if (timeLeft === 0) {
        gameOverTitle.textContent = '⏰ Time\'s Up!';
    } else {
        gameOverTitle.textContent = '💥 Game Over!';
    }
    
    finalScore.textContent = score;
    timePlayed.textContent = formatTime(180 - timeLeft);
}

function resetGame() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    gameOver = false;
    gameStarted = false;
    score = 0;
    projectile = null;
    popAnimations = [];
    isDragging = false;
    aimPower = 0;
    timeLeft = 180;
    
    updateScore();
    updateTimer();
    
    initializeBubbles();
    nextColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    
    gameOverScreen.style.display = 'none';
    gameControls.style.display = 'none';
    startScreen.style.display = 'block';
}

// Input Handlers
function handleDragStart(clientX, clientY) {
    if (projectile || gameOver || !gameStarted) return;
    
    isDragging = true;
    dragStart = { x: clientX, y: clientY };
    canvas.classList.add('dragging');
}

function handleDragMove(clientX, clientY) {
    if (!isDragging || !gameStarted) return;
    
    const rect = canvas.getBoundingClientRect();
    const shooterX = canvas.width / 2;
    const shooterY = canvas.height - 80;
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    
    const dx = canvasX - shooterX;
    const dy = canvasY - shooterY;
    
    if (dy < 0) {
        const angle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);
        const power = Math.min(distance / 100, 1);
        
        aimAngle = angle;
        aimPower = power;
        
        powerIndicator.textContent = `Power: ${Math.round(aimPower * 100)}%`;
    }
}

function handleDragEnd() {
    if (isDragging && gameStarted) {
        shootBubble();
    }
    isDragging = false;
    aimPower = 0;
    canvas.classList.remove('dragging');
    powerIndicator.textContent = 'Drag to aim and release to shoot';
}

// Event Listeners
canvas.addEventListener('mousedown', (e) => handleDragStart(e.clientX, e.clientY));
canvas.addEventListener('mousemove', (e) => handleDragMove(e.clientX, e.clientY));
canvas.addEventListener('mouseup', handleDragEnd);

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) handleDragStart(touch.clientX, touch.clientY);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) handleDragMove(touch.clientX, touch.clientY);
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleDragEnd();
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);
restartBtnSmall.addEventListener('click', resetGame);

// Initialize Game
initializeBubbles();
nextColor = COLORS[Math.floor(Math.random() * COLORS.length)];
updateScore();
updateTimer();
gameLoop();