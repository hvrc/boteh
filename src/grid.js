// Add a Map to track opacity states and lifespans for each cell
const cellOpacities = new Map();
const CIRCLE_LIFESPAN = 2000; // 2 seconds lifespan
const FADE_IN_SPEED = 0.05;   // Fast fade in
const FADE_OUT_SPEED = 0.05; // Slow fade out
const TARGET_OPACITY = 0.5;   // Maximum opacity for active circles

export function drawGrid(ctx, width, height, gridSize, activeCells, handDetector = null, audioEngine = null) {
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;
    const now = performance.now();
    
    // Convert active cells to Set for faster lookup
    const activeCellSet = new Set(activeCells.map(cell => `${cell.x},${cell.y}`));
    
    // Get currently playing notes from audio engine
    const playingNotes = audioEngine ? audioEngine.oscillators : new Map();
    
    // Update opacities for all cells
    for (const [key, state] of cellOpacities.entries()) {
        const isActive = activeCellSet.has(key);
        
        if (isActive) {
            // Fade in
            state.opacity = Math.min(TARGET_OPACITY, state.opacity + FADE_IN_SPEED);
            state.lastActiveTime = now;
            state.fadeStarted = false;
        } else if (!state.fadeStarted && now - state.lastActiveTime > CIRCLE_LIFESPAN) {
            // Start fade out after lifespan
            state.fadeStarted = true;
        }
        
        if (state.fadeStarted) {
            // Fade out
            state.opacity = Math.max(0, state.opacity - FADE_OUT_SPEED);
            if (state.opacity <= 0) {
                cellOpacities.delete(key);
                continue;
            }
        }
    }
    
    // Add new active cells
    activeCells.forEach(cell => {
        const key = `${cell.x},${cell.y}`;
        if (!cellOpacities.has(key)) {
            cellOpacities.set(key, {
                opacity: 0, // Start completely transparent
                lastActiveTime: now,
                fadeStarted: false
            });
        }
    });
    
    // Draw all cells that have opacity > 0
    for (const [key, state] of cellOpacities.entries()) {
        if (state.opacity > 0) {
            const [x, y] = key.split(',').map(Number);
            const isExpanded = handDetector && handDetector.expandedCells.has(key);
            const isPlaying = playingNotes.has(key);
            
            // Choose color based on state
            let color;
            if (isPlaying) {
                color = isExpanded ? 
                    `rgba(255, 165, 0, ${state.opacity})` : // Orange for playing expanded
                    `rgba(255, 140, 0, ${state.opacity})`; // Darker orange for playing normal
            } else {
                color = isExpanded ? 
                    `rgba(218, 112, 214, ${state.opacity})` : // Original expanded color
                    `rgba(149, 53, 83, ${state.opacity})`; // Original normal color
            }
            
            ctx.fillStyle = color;
            
            // Calculate circle center and radius
            const centerX = (x + 0.5) * cellWidth;
            const centerY = (y + 0.5) * cellHeight;
            const radius = Math.min(cellWidth, cellHeight) * 0.4;
            
            // Draw circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

export function clearOpacities() {
    cellOpacities.clear();
}
