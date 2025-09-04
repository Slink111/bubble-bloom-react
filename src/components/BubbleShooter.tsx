import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';

type BubbleColor = 'purple' | 'cyan' | 'magenta' | 'lime' | 'orange';

interface Bubble {
  id: string;
  x: number;
  y: number;
  color: BubbleColor;
  radius: number;
  row: number;
  col: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: BubbleColor;
  radius: number;
}

interface PopAnimation {
  x: number;
  y: number;
  frame: number;
  color: BubbleColor;
}

const BUBBLE_RADIUS = 18;
const COLORS: BubbleColor[] = ['purple', 'cyan', 'magenta', 'lime', 'orange'];
const ROWS = 12;
const COLS = 12;
const BUBBLE_SPACING = BUBBLE_RADIUS * 2;

const BubbleShooter = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [projectile, setProjectile] = useState<Projectile | null>(null);
  const [nextColor, setNextColor] = useState<BubbleColor>('purple');
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [aimAngle, setAimAngle] = useState(0);
  const [aimPower, setAimPower] = useState(0);
  const [popAnimations, setPopAnimations] = useState<PopAnimation[]>([]);
  const [scoreAnimation, setScoreAnimation] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const animationRef = useRef<number>();
  const timerRef = useRef<number>();

  const getColorData = (color: BubbleColor) => {
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
  };

  const getGridPosition = (row: number, col: number) => {
    const offsetX = row % 2 === 1 ? BUBBLE_SPACING / 2 : 0;
    return {
      x: 40 + offsetX + col * BUBBLE_SPACING,
      y: 60 + row * (BUBBLE_SPACING * 0.87)
    };
  };

  const initializeBubbles = useCallback(() => {
    const newBubbles: Bubble[] = [];
    for (let row = 0; row < 6; row++) {
      const maxCols = row % 2 === 1 ? COLS - 1 : COLS;
      for (let col = 0; col < Math.min(maxCols, 10); col++) {
        const pos = getGridPosition(row, col);
        if (pos.x < 440) { // Keep within canvas bounds
          newBubbles.push({
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
    setBubbles(newBubbles);
  }, []);

  const findNearestGridPosition = (x: number, y: number) => {
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
  };

  const findConnectedBubbles = (targetBubble: Bubble, bubbleList: Bubble[]): Bubble[] => {
    const visited = new Set<string>();
    const stack = [targetBubble];
    const connected: Bubble[] = [];

    while (stack.length > 0) {
      const current = stack.pop()!;
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
  };

  const checkCollision = (proj: Projectile, bubble: Bubble) => {
    const distance = Math.sqrt((proj.x - bubble.x) ** 2 + (proj.y - bubble.y) ** 2);
    return distance <= proj.radius + bubble.radius - 3;
  };

  const shootBubble = () => {
    if (projectile || gameOver || !gameStarted || aimPower < 0.1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const startX = canvas.width / 2;
    const startY = canvas.height - 80;
    
    const speed = Math.min(aimPower * 15, 12);
    const vx = Math.cos(aimAngle) * speed;
    const vy = Math.sin(aimAngle) * speed;

    setProjectile({
      x: startX,
      y: startY,
      vx,
      vy,
      color: nextColor,
      radius: BUBBLE_RADIUS
    });
    
    setNextColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  };

  const updateGame = useCallback(() => {
    if (!projectile) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

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
        const newBubble: Bubble = {
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
          setPopAnimations(prev => [...prev, ...newAnimations]);

          const remainingBubbles = newBubbles.filter(b => 
            !connectedBubbles.some(cb => cb.id === b.id)
          );
          setBubbles(remainingBubbles);
          
          const points = connectedBubbles.length * 10 + (connectedBubbles.length > 3 ? (connectedBubbles.length - 3) * 5 : 0);
          setScore(prev => {
            setScoreAnimation(true);
            setTimeout(() => setScoreAnimation(false), 300);
            return prev + points;
          });

          // Check win condition
          if (remainingBubbles.length === 0) {
            setGameOver(true);
          }
        } else {
          setBubbles(newBubbles);
        }
      }
      
      setProjectile(null);
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
          const newBubble: Bubble = {
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
            setPopAnimations(prev => [...prev, ...newAnimations]);

            const remainingBubbles = newBubbles.filter(b => 
              !connectedBubbles.some(cb => cb.id === b.id)
            );
            setBubbles(remainingBubbles);
            
            const points = connectedBubbles.length * 10 + (connectedBubbles.length > 3 ? (connectedBubbles.length - 3) * 5 : 0);
            setScore(prev => {
              setScoreAnimation(true);
              setTimeout(() => setScoreAnimation(false), 300);
              return prev + points;
            });

            if (remainingBubbles.length === 0) {
              setGameOver(true);
            }
          } else {
            setBubbles(newBubbles);
          }
        }
        
        collided = true;
        break;
      }
    }

    if (collided) {
      setProjectile(null);
      return;
    }

    // Bottom boundary
    if (newProjectile.y >= canvas.height - BUBBLE_RADIUS - 20) {
      setGameOver(true);
      setProjectile(null);
      return;
    }

    setProjectile(newProjectile);
  }, [projectile, bubbles]);

  const updateAnimations = useCallback(() => {
    setPopAnimations(prev => {
      const updated = prev.map(anim => ({ ...anim, frame: anim.frame + 1 }));
      return updated.filter(anim => anim.frame < 20);
    });
  }, []);

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear with gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, 'hsl(277, 66%, 20%)');
    bgGradient.addColorStop(0.5, 'hsl(277, 66%, 15%)');
    bgGradient.addColorStop(1, 'hsl(277, 66%, 8%)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw laser sight (enhanced)
    if (isDragging && gameStarted && !projectile && !gameOver) {
      const shooterX = canvas.width / 2;
      const shooterY = canvas.height - 80;
      
      // Calculate laser end point
      const laserLength = 300;
      const endX = shooterX + Math.cos(aimAngle) * laserLength;
      const endY = shooterY + Math.sin(aimAngle) * laserLength;
      
      // Draw laser beam with glow
      ctx.shadowColor = 'hsl(0, 100%, 60%)';
      ctx.shadowBlur = 15;
      
      // Main laser line
      ctx.strokeStyle = `hsla(0, 100%, ${60 + aimPower * 20}%, ${0.7 + aimPower * 0.3})`;
      ctx.lineWidth = 3 + aimPower * 2;
      ctx.beginPath();
      ctx.moveTo(shooterX, shooterY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      
      // Laser dots along the path
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
      
      // Enhanced glow effect
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
      
      // Highlight
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
      
      // Inner ring
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
    
    // Power indicator
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
  }, [bubbles, projectile, nextColor, isDragging, aimAngle, aimPower, popAnimations, gameStarted]);

  const gameLoop = useCallback(() => {
    updateGame();
    updateAnimations();
    drawGame();
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [updateGame, updateAnimations, drawGame]);

  const startGame = () => {
    setGameStarted(true);
    setTimeLeft(180);
    
    // Start timer
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setGameOver(false);
    setGameStarted(false);
    setScore(0);
    setProjectile(null);
    setPopAnimations([]);
    setIsDragging(false);
    setAimPower(0);
    setTimeLeft(180);
    initializeBubbles();
    setNextColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  };

  const handleDragStart = (clientX: number, clientY: number) => {
    if (projectile || gameOver || !gameStarted) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    setIsDragging(true);
    setDragStart({ 
      x: (clientX - rect.left) * scaleX, 
      y: (clientY - rect.top) * scaleY 
    });
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging || !gameStarted) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const shooterX = canvas.width / 2;
    const shooterY = canvas.height - 80;
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    
    const dx = canvasX - shooterX;
    const dy = canvasY - shooterY;
    
    // Only allow upward shooting with mobile-friendly constraints
    if (dy < 0) {
      const angle = Math.atan2(dy, dx);
      const clampedAngle = Math.max(-Math.PI * 0.9, Math.min(-Math.PI * 0.1, angle));
      const distance = Math.sqrt(dx * dx + dy * dy);
      const power = Math.min(distance / 120, 1);
      
      setAimAngle(clampedAngle);
      setAimPower(power);
    }
  };

  const handleDragEnd = () => {
    if (isDragging && gameStarted) {
      shootBubble();
    }
    setIsDragging(false);
    setAimPower(0);
  };

  useEffect(() => {
    initializeBubbles();
    setNextColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [initializeBubbles]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameLoop]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-2 sm:p-4 bg-gradient-to-br from-game-purple via-game-dark-purple to-game-ultra-dark">
      <div className="bg-game-board-bg/95 backdrop-blur-sm rounded-3xl p-3 sm:p-6 shadow-2xl border border-white/10 w-full max-w-lg">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
          <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-game-cyan via-game-magenta to-game-lime bg-clip-text text-transparent">
            Bubble Shooter
          </h1>
          <div className="flex gap-2 sm:gap-4 text-game-text font-bold text-sm sm:text-base">
            <div className={`${scoreAnimation ? 'animate-score-pop' : ''}`}>
              Score: <span className="text-game-accent">{score}</span>
            </div>
            <div className={`${timeLeft <= 30 ? 'text-red-400 animate-pulse' : 'text-game-text-muted'}`}>
              Time: {formatTime(timeLeft)}
            </div>
          </div>
        </div>
        
        {/* Game Canvas */}
        <canvas
          ref={canvasRef}
          width={480}
          height={640}
          className="w-full max-w-[480px] h-auto aspect-[3/4] rounded-2xl bg-gradient-to-b from-game-dark-purple/30 to-game-ultra-dark/50 shadow-inner touch-none"
          style={{ 
            touchAction: 'none',
            maxHeight: 'calc(100vh - 200px)'
          }}
          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
          onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
          onMouseUp={handleDragEnd}
          onTouchStart={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) handleDragStart(touch.clientX, touch.clientY);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) handleDragMove(touch.clientX, touch.clientY);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleDragEnd();
          }}
        />
        
        {/* Game Controls */}
        <div className="mt-6 text-center">
          {!gameStarted && !gameOver && (
            <div className="space-y-4">
              <Button 
                onClick={startGame}
                className="bg-gradient-to-r from-game-cyan to-game-magenta hover:from-game-cyan-dark hover:to-game-magenta-dark text-white font-bold px-8 py-4 rounded-xl shadow-lg transform transition hover:scale-105"
              >
                Start Game
              </Button>
              <p className="text-game-text-muted text-sm">
                Drag to aim • Release to shoot • Match 3+ bubbles to pop them
              </p>
            </div>
          )}
          
          {gameOver && (
            <div className="space-y-4">
              <div className="text-game-text mb-4">
                <h2 className="text-2xl font-bold mb-2">
                  {bubbles.length === 0 ? '🎉 You Won!' : timeLeft === 0 ? '⏰ Time\'s Up!' : '💥 Game Over!'}
                </h2>
                <p className="text-lg">Final Score: <span className="text-game-accent font-bold">{score}</span></p>
                <p className="text-sm text-game-text-muted">Time: {formatTime(180 - timeLeft)}</p>
              </div>
              <Button 
                onClick={resetGame}
                className="bg-gradient-to-r from-game-orange to-game-magenta hover:from-game-orange-dark hover:to-game-magenta-dark text-white font-bold px-8 py-3 rounded-xl shadow-lg transform transition hover:scale-105"
              >
                Play Again
              </Button>
            </div>
          )}
          
          {gameStarted && !gameOver && (
            <div className="space-y-2">
              <p className="text-game-text-muted text-sm">
                {isDragging ? `Power: ${Math.round(aimPower * 100)}%` : 'Drag to aim and release to shoot'}
              </p>
              <Button 
                onClick={resetGame}
                variant="outline"
                className="text-game-text-muted border-game-text-muted/30 hover:bg-game-text-muted/10"
              >
                Restart
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BubbleShooter;