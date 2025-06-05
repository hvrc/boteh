const cellOpacities = new Map();
const CIRCLE_LIFESPAN = 2000;
const FADE_IN_SPEED = 0.05;
const FADE_OUT_SPEED = 0.05;
const TARGET_OPACITY = 0.5;

export function drawGrid(ctx, width, height, gridSize, activeCells, handDetector = null, audioEngine = null) {
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;
    const now = performance.now();
    
    const activeCellSet = new Set(activeCells.map(cell => `${cell.x},${cell.y}`));
    const playingNotes = audioEngine ? audioEngine.oscillators : new Map();
    
    for (const [key, state] of cellOpacities.entries()) {
        const isActive = activeCellSet.has(key);
        
        if (isActive) {
            state.opacity = Math.min(TARGET_OPACITY, state.opacity + FADE_IN_SPEED);
            state.lastActiveTime = now;
            state.fadeStarted = false;
        } else if (!state.fadeStarted && now - state.lastActiveTime > CIRCLE_LIFESPAN) {
            state.fadeStarted = true;
        }
        
        if (state.fadeStarted) {
            state.opacity = Math.max(0, state.opacity - FADE_OUT_SPEED);
            if (state.opacity <= 0) {
                cellOpacities.delete(key);
                continue;
            }
        }
    }
    
    activeCells.forEach(cell => {
        const key = `${cell.x},${cell.y}`;
        if (!cellOpacities.has(key)) {
            cellOpacities.set(key, {
                opacity: 0,
                lastActiveTime: now,
                fadeStarted: false
            });
        }
    });
    
    for (const [key, state] of cellOpacities.entries()) {
        if (state.opacity > 0) {
            const [x, y] = key.split(',').map(Number);
            const isExpanded = handDetector && handDetector.expandedCells.has(key);
            const isPlaying = playingNotes.has(key);
            
            let color;
            if (isPlaying) {
                color = isExpanded ? 
                    `rgba(255, 165, 0, ${state.opacity})` :
                    `rgba(255, 140, 0, ${state.opacity})`;
            } else {
                color = isExpanded ? 
                    `rgba(218, 112, 214, ${state.opacity})` :
                    `rgba(149, 53, 83, ${state.opacity})`;
            }
            
            ctx.fillStyle = color;
            
            const centerX = (x + 0.5) * cellWidth;
            const centerY = (y + 0.5) * cellHeight;
            const radius = Math.min(cellWidth, cellHeight) * 0.4;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

export function clearOpacities() {
    cellOpacities.clear();
}
