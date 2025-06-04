import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export class HandDetector {
  static minDistance = 0.03;
  static maxDistance = 0.07;
  static GRID_SIZE = 15; // Define grid size once here
  
  constructor(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.canvasContext = canvasElement.getContext('2d');
    this.fingerStates = new Map(); // Track state for each finger
    this.activeCells = new Set(); // Track cells with green circles
    this.fingerDirections = new Map(); // Track expand direction for each finger
    this.expandDirection = this.getRandomDirection();
    this.expandedCells = new Set(); // Track expanded cells separately
    this.setupHandDetection();
  }

  setupHandDetection() {
    // Initialize MediaPipe Hands
    this.hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // Start webcam with 1:1 aspect ratio
    const size = Math.min(640, 480);
    this.camera = new Camera(this.videoElement, {
      onFrame: async () => {
        await this.hands.send({ image: this.videoElement });
      },
      width: size,
      height: size
    });
  }

  start(onResults) {
    this.hands.onResults(onResults);
    this.camera.start();
  }

  smoothTransition(currentValue, targetValue, smoothFactor = 0.2) {
    return currentValue + (targetValue - currentValue) * smoothFactor;
  }
  getGridCell(x, y) {
    const cellX = Math.floor(x * HandDetector.GRID_SIZE);
    const cellY = Math.floor(y * HandDetector.GRID_SIZE);
    return { x: cellX, y: cellY };
  }
  
  drawFingerDots(landmarks) {
    const fingerTipIndices = [4, 8, 12, 16, 20];
    // Update this line to check slider value instead of checked property
    const expandMode = document.getElementById('expandMode').value === "1";
    
    // Clear both sets at the start of each frame
    this.activeCells.clear();
    this.expandedCells.clear();
    
    fingerTipIndices.forEach((tipIndex) => {
      const tipPosition = landmarks[tipIndex];
      
      let minDistance = 1;
      fingerTipIndices.forEach((otherTipIndex) => {
        if (otherTipIndex !== tipIndex) {
          const otherTipPosition = landmarks[otherTipIndex];
          const distance = Math.hypot(
            tipPosition.x - otherTipPosition.x,
            tipPosition.y - otherTipPosition.y
          );
          minDistance = Math.min(minDistance, distance);
        }
      });

      // Get or initialize finger state
      if (!this.fingerStates.has(tipIndex)) {
        this.fingerStates.set(tipIndex, {
          normalizedDistance: 0,
          currentRed: 255,
          currentGreen: 0,
          currentAlpha: 0
        });
      }
      const state = this.fingerStates.get(tipIndex);

      // Calculate target values
      let targetNormalized = Math.min(
        Math.max(
          (minDistance - HandDetector.minDistance) / 
          (HandDetector.maxDistance - HandDetector.minDistance), 
          0
        ), 
        1
      );
      
      // Apply exponential curve with hysteresis
      targetNormalized = Math.pow(targetNormalized, 2.5);

      // Smooth transitions
      state.normalizedDistance = this.smoothTransition(
        state.normalizedDistance, 
        targetNormalized,
        0.15 // Adjust this value to control transition speed (lower = smoother but slower)
      );

      // Calculate color components with smooth transitions
      const targetRed = Math.round(255 * (1 - state.normalizedDistance));
      const targetGreen = Math.round(255 * state.normalizedDistance);
      const targetAlpha = state.normalizedDistance;

      state.currentRed = this.smoothTransition(state.currentRed, targetRed);
      state.currentGreen = this.smoothTransition(state.currentGreen, targetGreen);
      state.currentAlpha = this.smoothTransition(state.currentAlpha, targetAlpha);

      // Draw with smoothed values
      this.canvasContext.beginPath();
      this.canvasContext.arc(
        tipPosition.x * this.canvasElement.width, 
        tipPosition.y * this.canvasElement.height, 
        10, 
        0, 
        2 * Math.PI
      );

      this.canvasContext.fillStyle = `rgba(${state.currentRed}, ${state.currentGreen}, 0, ${state.currentAlpha})`;
      this.canvasContext.fill();

      // After drawing the circle, check if it's fully green
      if (state.currentGreen > 240 && state.currentAlpha > 0.9) {
        const cell = this.getGridCell(tipPosition.x, tipPosition.y);
        const cellKey = `${cell.x},${cell.y}`;
        this.activeCells.add(cellKey);

        // If expand mode is on, handle expanded cells
        if (expandMode) {
          // Get or create direction for this specific finger
          if (!this.fingerDirections.has(tipIndex)) {
            this.fingerDirections.set(tipIndex, this.getRandomDirection());
          }
          
          const direction = this.fingerDirections.get(tipIndex);
          const newX = cell.x + direction.x;
          const newY = cell.y + direction.y;
          
          // Check if new position is within grid bounds
          if (newX >= 0 && newX < HandDetector.GRID_SIZE && 
              newY >= 0 && newY < HandDetector.GRID_SIZE) {
            const expandedCellKey = `${newX},${newY}`;
            // Only add to expanded cells if not already an active cell
            if (!this.activeCells.has(expandedCellKey)) {
              this.expandedCells.add(expandedCellKey);
              this.activeCells.add(expandedCellKey);
            }
          }
        }
      } else {
        // If finger is not active, remove its direction to allow new random direction
        this.fingerDirections.delete(tipIndex);
      }
    });
  }

  getActiveCells() {
    return Array.from(this.activeCells).map(cellStr => {
      const [x, y] = cellStr.split(',').map(Number);
      return { x, y };
    });
  }

  getExpandedCells() {
    return Array.from(this.expandedCells).map(cellStr => {
      const [x, y] = cellStr.split(',').map(Number);
      return { x, y };
    });
  }

  getRandomDirection() {
    const directions = [
      { x: -2, y: -2 }, // top left
      { x: 2, y: -2 },  // top right
      { x: -2, y: 2 },  // bottom left
      { x: 2, y: 2 }    // bottom right
    ];
    return directions[Math.floor(Math.random() * directions.length)];
  }
}
