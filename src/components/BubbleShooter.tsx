import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';

type BubbleColor = 'purple' | 'cyan' | 'magenta' | 'lime';

interface Bubble {
  id: string;
  x: number;
  y: number;
  color: BubbleColor;
  radius: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: BubbleColor;
  radius: number;
}

const BUBBLE_RADIUS = 20;
const COLORS: BubbleColor[] = ['purple', 'cyan', 'magenta', 'lime'];
const ROWS = 8;
const COLS = 10;

const BubbleShooter = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [projectile, setProjectile] = useState<Projectile | null>(null);
  const [nextColor, setNextColor] = useState<BubbleColor>('purple');
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [angle, setAngle] = useState(0);
  const animationRef = useRef<number>();

  const getColorClass = (color: BubbleColor) => {
    const colorMap = {
      purple: 'bg-game-purple',
      cyan: 'bg-game-cyan', 
      magenta: 'bg-game-magenta',
      lime: 'bg-game-lime'
    };
    return colorMap[color];
  };

  const initializeBubbles = useCallback(() => {
    const newBubbles: Bubble[] = [];
    for (let row = 0; row < 5; row++) {
      const bubblesInRow = COLS - (row % 2 === 1 ? 1 : 0);
      const startX = row % 2 === 1 ? BUBBLE_RADIUS * 2 : BUBBLE_RADIUS;
      
      for (let col = 0; col < bubblesInRow; col++) {
        newBubbles.push({
          id: `${row}-${col}`,
          x: startX + col * BUBBLE_RADIUS * 2,
          y: 50 + row * BUBBLE_RADIUS * 1.7,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          radius: BUBBLE_RADIUS
        });
      }
    }
    setBubbles(newBubbles);
  }, []);

  const findConnectedBubbles = (targetBubble: Bubble, color: BubbleColor, visited = new Set<string>()): Bubble[] => {
    if (visited.has(targetBubble.id) || targetBubble.color !== color) {
      return [];
    }
    
    visited.add(targetBubble.id);
    let connected = [targetBubble];
    
    bubbles.forEach(bubble => {
      if (!visited.has(bubble.id) && bubble.color === color) {
        const distance = Math.sqrt(
          Math.pow(bubble.x - targetBubble.x, 2) + Math.pow(bubble.y - targetBubble.y, 2)
        );
        if (distance <= BUBBLE_RADIUS * 2.2) {
          connected = connected.concat(findConnectedBubbles(bubble, color, visited));
        }
      }
    });
    
    return connected;
  };

  const checkCollision = (proj: Projectile, bubble: Bubble) => {
    const distance = Math.sqrt(
      Math.pow(proj.x - bubble.x, 2) + Math.pow(proj.y - bubble.y, 2)
    );
    return distance <= proj.radius + bubble.radius;
  };

  const shootBubble = (targetX: number, targetY: number) => {
    if (projectile || gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = targetX - rect.left;
    const canvasY = targetY - rect.top;
    
    const startX = canvas.width / 2;
    const startY = canvas.height - 40;
    
    const dx = canvasX - startX;
    const dy = canvasY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const speed = 8;
    const vx = (dx / distance) * speed;
    const vy = (dy / distance) * speed;

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
    }

    // Top boundary
    if (newProjectile.y <= BUBBLE_RADIUS) {
      setProjectile(null);
      return;
    }

    // Check collision with bubbles
    for (const bubble of bubbles) {
      if (checkCollision(newProjectile, bubble)) {
        // Find position for new bubble
        const newBubble: Bubble = {
          id: `proj-${Date.now()}`,
          x: bubble.x,
          y: bubble.y - BUBBLE_RADIUS * 2,
          color: projectile.color,
          radius: BUBBLE_RADIUS
        };

        const newBubbles = [...bubbles, newBubble];
        
        // Check for matches
        const connectedBubbles = findConnectedBubbles(newBubble, newBubble.color, new Set());
        
        if (connectedBubbles.length >= 3) {
          const remainingBubbles = newBubbles.filter(b => 
            !connectedBubbles.some(cb => cb.id === b.id)
          );
          setBubbles(remainingBubbles);
          setScore(prev => prev + connectedBubbles.length * 10);
        } else {
          setBubbles(newBubbles);
        }
        
        setProjectile(null);
        return;
      }
    }

    // Bottom boundary - game over
    if (newProjectile.y >= canvas.height - BUBBLE_RADIUS) {
      setGameOver(true);
      setProjectile(null);
      return;
    }

    setProjectile(newProjectile);
  }, [projectile, bubbles]);

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bubbles
    bubbles.forEach(bubble => {
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
      
      const gradient = ctx.createRadialGradient(
        bubble.x - 5, bubble.y - 5, 0,
        bubble.x, bubble.y, bubble.radius
      );
      
      switch (bubble.color) {
        case 'purple':
          gradient.addColorStop(0, 'hsl(269, 91%, 77%)');
          gradient.addColorStop(1, 'hsl(269, 91%, 57%)');
          break;
        case 'cyan':
          gradient.addColorStop(0, 'hsl(186, 100%, 79%)');
          gradient.addColorStop(1, 'hsl(186, 100%, 59%)');
          break;
        case 'magenta':
          gradient.addColorStop(0, 'hsl(330, 81%, 70%)');
          gradient.addColorStop(1, 'hsl(330, 81%, 50%)');
          break;
        case 'lime':
          gradient.addColorStop(0, 'hsl(84, 81%, 54%)');
          gradient.addColorStop(1, 'hsl(84, 81%, 34%)');
          break;
      }
      
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw projectile
    if (projectile) {
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
      
      const gradient = ctx.createRadialGradient(
        projectile.x - 5, projectile.y - 5, 0,
        projectile.x, projectile.y, projectile.radius
      );
      
      switch (projectile.color) {
        case 'purple':
          gradient.addColorStop(0, 'hsl(269, 91%, 77%)');
          gradient.addColorStop(1, 'hsl(269, 91%, 57%)');
          break;
        case 'cyan':
          gradient.addColorStop(0, 'hsl(186, 100%, 79%)');
          gradient.addColorStop(1, 'hsl(186, 100%, 59%)');
          break;
        case 'magenta':
          gradient.addColorStop(0, 'hsl(330, 81%, 70%)');
          gradient.addColorStop(1, 'hsl(330, 81%, 50%)');
          break;
        case 'lime':
          gradient.addColorStop(0, 'hsl(84, 81%, 54%)');
          gradient.addColorStop(1, 'hsl(84, 81%, 34%)');
          break;
      }
      
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw shooter
    const shooterX = canvas.width / 2;
    const shooterY = canvas.height - 40;
    
    ctx.beginPath();
    ctx.arc(shooterX, shooterY, BUBBLE_RADIUS, 0, Math.PI * 2);
    
    const shooterGradient = ctx.createRadialGradient(
      shooterX - 5, shooterY - 5, 0,
      shooterX, shooterY, BUBBLE_RADIUS
    );
    
    switch (nextColor) {
      case 'purple':
        shooterGradient.addColorStop(0, 'hsl(269, 91%, 77%)');
        shooterGradient.addColorStop(1, 'hsl(269, 91%, 57%)');
        break;
      case 'cyan':
        shooterGradient.addColorStop(0, 'hsl(186, 100%, 79%)');
        shooterGradient.addColorStop(1, 'hsl(186, 100%, 59%)');
        break;
      case 'magenta':
        shooterGradient.addColorStop(0, 'hsl(330, 81%, 70%)');
        shooterGradient.addColorStop(1, 'hsl(330, 81%, 50%)');
        break;
      case 'lime':
        shooterGradient.addColorStop(0, 'hsl(84, 81%, 54%)');
        shooterGradient.addColorStop(1, 'hsl(84, 81%, 34%)');
        break;
    }
    
    ctx.fillStyle = shooterGradient;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [bubbles, projectile, nextColor]);

  const gameLoop = useCallback(() => {
    updateGame();
    drawGame();
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [updateGame, drawGame]);

  useEffect(() => {
    initializeBubbles();
    setNextColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  }, [initializeBubbles]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameLoop]);

  const resetGame = () => {
    setGameOver(false);
    setScore(0);
    setProjectile(null);
    initializeBubbles();
    setNextColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    shootBubble(event.clientX, event.clientY);
  };

  const handleCanvasTouch = (event: React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const touch = event.touches[0];
    if (touch) {
      shootBubble(touch.clientX, touch.clientY);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-game-purple via-game-dark-purple to-background">
      <div className="bg-game-board-bg rounded-xl p-6 shadow-2xl border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-game-text">Bubble Shooter</h1>
          <div className="text-game-text font-semibold">Score: {score}</div>
        </div>
        
        <canvas
          ref={canvasRef}
          width={400}
          height={600}
          className="border border-white/20 rounded-lg bg-gradient-to-b from-game-dark-purple/50 to-background/50 cursor-crosshair touch-none"
          onClick={handleCanvasClick}
          onTouchStart={handleCanvasTouch}
        />
        
        {gameOver && (
          <div className="mt-4 text-center">
            <div className="text-game-text mb-4">
              <h2 className="text-xl font-bold">Game Over!</h2>
              <p>Final Score: {score}</p>
            </div>
            <Button 
              onClick={resetGame}
              className="bg-game-magenta hover:bg-game-magenta/80 text-white"
            >
              Play Again
            </Button>
          </div>
        )}
        
        <div className="mt-4 text-center text-sm text-game-text/70">
          {!gameOver && "Tap to shoot bubbles • Match 3+ to pop them"}
        </div>
      </div>
    </div>
  );
};

export default BubbleShooter;