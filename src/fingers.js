import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export class HandDetector {
  static minDistance = 0.03;
  static maxDistance = 0.07;
  static GRID_SIZE = 15; // Default grid size
  
  constructor(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.canvasContext = canvasElement.getContext('2d');
    this.fingerStates = new Map(); // Track state for each finger
    this.activeCells = new Set(); // Track cells with green circles
    this.fingerDirections = new Map(); // Track expand direction for each finger
    this.expandDirection = this.getRandomDirection();
    this.expandedCells = new Set(); // Track expanded cells separately
    this.gridSize = HandDetector.GRID_SIZE;
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

  async start(onResults) {
    try {
      // Ensure complete cleanup before starting
      if (this.hands) {
        await this.stop();
      }

      // Reinitialize MediaPipe Hands
      this.hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      // Set up camera with proper initialization sequence
      const size = Math.min(640, 480);
      await this.hands.initialize();
      
      // Set callback first
      await this.hands.onResults(onResults);
      
      // Then initialize and start camera
      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          if (this.hands) {
            await this.hands.send({ image: this.videoElement });
          }
        },
        width: size,
        height: size
      });

      await this.camera.start();
    } catch (error) {
      console.error('Error starting HandDetector:', error);
      throw error;
    }
  }

  stop() {
    try {
        // First, stop the camera feed
        if (this.camera) {
            this.camera.stop();
        }
        
        // Remove callback and wait for camera to fully stop
        if (this.hands) {
            this.hands.onResults(() => {}); // Set empty callback
        }
        
        // Clear states
        this.activeCells.clear();
        this.expandedCells.clear();
        this.fingerStates.clear();
        this.fingerDirections.clear();

        // Clean up MediaPipe resources
        return new Promise((resolve) => {
            setTimeout(() => {
                if (this.hands) {
                    try {
                        this.hands.close();
                    } catch (e) {
                        console.warn('Error closing hands:', e);
                    }
                }
                this.hands = null;
                this.camera = null;
                resolve();
            }, 300); // Give more time for cleanup
        });
    } catch (error) {
        console.warn('Error during HandDetector cleanup:', error);
        this.hands = null;
        this.camera = null;
    }
  }

  smoothTransition(currentValue, targetValue, smoothFactor = 0.2) {
    return currentValue + (targetValue - currentValue) * smoothFactor;
  }
  setGridSize(size) {
    this.gridSize = size;
    HandDetector.GRID_SIZE = size; // Add this line to keep static and instance in sync
    this.activeCells.clear();
    this.expandedCells.clear();
  }
  getGridCell(x, y) {
    const cellX = Math.floor(x * this.gridSize);
    const cellY = Math.floor(y * this.gridSize);
    return { x: cellX, y: cellY };
  }
  
  drawFingerDots(landmarks) {
    const fingerTipIndices = [4, 8, 12, 16, 20]; // Thumb, Index, Middle, Ring, Pinky
    const expandMode = document.getElementById('expandMode').value === "1";
    
    fingerTipIndices.forEach((tipIndex) => {
        const tipPosition = landmarks[tipIndex];
        
        // Calculate minimum distance to other finger tips on the SAME hand
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
                currentAlpha: 0,
                lastActiveTime: 0
            });
        }
        const state = this.fingerStates.get(tipIndex);

        // Adjust distance thresholds for better recognition
        const MIN_DISTANCE = 0.02;  // Reduced from 0.03
        const MAX_DISTANCE = 0.08;  // Increased from 0.07

        // Calculate target values with adjusted thresholds
        let targetNormalized = Math.min(
            Math.max(
                (minDistance - MIN_DISTANCE) / 
                (MAX_DISTANCE - MIN_DISTANCE), 
                0
            ), 
            1
        );

        // Add hysteresis to prevent flickering
        const now = performance.now();
        const HYSTERESIS_TIME = 100; // ms
        if (targetNormalized > 0.8 && now - state.lastActiveTime > HYSTERESIS_TIME) {
            targetNormalized = 1;
            state.lastActiveTime = now;
        }

        // Smoother transitions
        state.normalizedDistance = this.smoothTransition(
            state.normalizedDistance, 
            targetNormalized,
            0.3  // Increased smoothing factor
        );

        // Calculate color with smoother transitions
        state.currentRed = this.smoothTransition(state.currentRed, 255 * (1 - state.normalizedDistance));
        state.currentGreen = this.smoothTransition(state.currentGreen, 255 * state.normalizedDistance);
        state.currentAlpha = this.smoothTransition(state.currentAlpha, state.normalizedDistance);

        // Comment out circle drawing but keep for reference
        /*
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
        */

        // Activate cell if finger is green enough
        if (state.currentGreen > 200 && state.currentAlpha > 0.8) {
            const cell = this.getGridCell(tipPosition.x, tipPosition.y);
            const cellKey = `${cell.x},${cell.y}`;
            this.activeCells.add(cellKey);

            // Handle expand mode
            if (expandMode) {
                if (!this.fingerDirections.has(tipIndex)) {
                    this.fingerDirections.set(tipIndex, this.getRandomDirection());
                }
                const direction = this.fingerDirections.get(tipIndex);
                const newX = cell.x + direction.x;
                const newY = cell.y + direction.y;
                
                if (newX >= 0 && newX < HandDetector.GRID_SIZE && 
                    newY >= 0 && newY < HandDetector.GRID_SIZE) {
                    const expandedCellKey = `${newX},${newY}`;
                    if (!this.activeCells.has(expandedCellKey)) {
                        this.expandedCells.add(expandedCellKey);
                        this.activeCells.add(expandedCellKey);
                    }
                }
            }
        } else {
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
