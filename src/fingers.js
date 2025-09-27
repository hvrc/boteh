// Mobile-compatible hand detection
export class HandDetector {
  static minDistance = 0.03;
  static maxDistance = 0.07;
  static GRID_SIZE = 15;
  
  constructor(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.canvasContext = canvasElement.getContext('2d');
    this.fingerStates = new Map();
    this.activeCells = new Set();
    this.fingerDirections = new Map();
    this.expandDirection = this.getRandomDirection();
    this.expandedCells = new Set();
    this.gridSize = HandDetector.GRID_SIZE;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.isInitialized = false;
    this.camera = null;
    this.hands = null;
  }

  async setupHandDetection() {
    try {
      // Mobile-specific MediaPipe configuration
      const handsConfig = {
        locateFile: (file) => {
          // Use specific CDN paths that work better on mobile
          const baseUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915';
          return `${baseUrl}/${file}`;
        }
      };
      
      // Check if MediaPipe is loaded properly
      if (typeof Hands === 'undefined') {
        throw new Error('MediaPipe Hands not loaded. Please check your internet connection.');
      }
      
      this.hands = new Hands(handsConfig);

      // Mobile-optimized settings
      this.hands.setOptions({
        maxNumHands: this.isMobile ? 1 : 2, // Limit to 1 hand on mobile for performance
        modelComplexity: this.isMobile ? 0 : 1, // Lower complexity on mobile
        minDetectionConfidence: 0.7, // Higher threshold for more stable detection
        minTrackingConfidence: 0.6,
        selfieMode: true // Mirror the camera view
      });

      await this.hands.initialize();
      this.isInitialized = true;
      
      console.log('Hand detection initialized successfully');
      
    } catch (error) {
      console.error('Failed to setup hand detection:', error);
      throw new Error(`Hand detection setup failed: ${error.message}`);
    }
  }

  async start(onResults) {
    try {
      if (!this.isInitialized) {
        await this.setupHandDetection();
      }

      // Clean up existing instances
      if (this.camera) {
        await this.stop();
      }

      // Mobile-specific camera constraints
      const constraints = {
        video: {
          width: this.isMobile ? { ideal: 480 } : { ideal: 640 },
          height: this.isMobile ? { ideal: 480 } : { ideal: 480 },
          facingMode: 'user', // Front-facing camera
          frameRate: this.isMobile ? { ideal: 15 } : { ideal: 30 } // Lower framerate on mobile
        }
      };

      // Request camera access with error handling
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (cameraError) {
        console.error('Camera access failed:', cameraError);
        throw new Error('Camera access denied. Please allow camera permissions and refresh the page.');
      }

      // Set up video element
      this.videoElement.srcObject = stream;
      this.videoElement.playsInline = true; // Required for iOS
      this.videoElement.muted = true;
      this.videoElement.autoplay = true;

      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play().then(resolve).catch(reject);
        };
        this.videoElement.onerror = reject;
        
        // Timeout fallback
        setTimeout(() => reject(new Error('Video loading timeout')), 10000);
      });

      // Set up MediaPipe results handler
      this.hands.onResults(onResults);

      // Create camera utility with mobile optimizations
      const Camera = window.Camera;
      if (!Camera) {
        throw new Error('MediaPipe Camera utility not found');
      }

      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          if (this.hands && this.isInitialized) {
            try {
              await this.hands.send({ image: this.videoElement });
            } catch (processError) {
              console.warn('Frame processing error:', processError);
              // Continue running despite occasional frame processing errors
            }
          }
        },
        width: this.isMobile ? 480 : 640,
        height: this.isMobile ? 480 : 480
      });

      await this.camera.start();
      
      console.log('Camera started successfully');
      
    } catch (error) {
      console.error('Error starting HandDetector:', error);
      
      // Clean up on error
      await this.stop();
      
      // Throw a user-friendly error
      if (error.message.includes('Camera access denied')) {
        throw error;
      } else if (error.message.includes('MediaPipe')) {
        throw new Error('Hand detection failed to load. Please check your internet connection and refresh the page.');
      } else {
        throw new Error(`Hand detection startup failed: ${error.message}`);
      }
    }
  }

  async stop() {
    try {
      console.log('Stopping hand detection...');
      
      // Stop camera
      if (this.camera) {
        try {
          this.camera.stop();
        } catch (e) {
          console.warn('Camera stop error:', e);
        }
        this.camera = null;
      }

      // Stop video stream
      if (this.videoElement && this.videoElement.srcObject) {
        const stream = this.videoElement.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.warn('Track stop error:', e);
          }
        });
        this.videoElement.srcObject = null;
      }

      // Clear MediaPipe
      if (this.hands) {
        try {
          this.hands.onResults(() => {});
          if (this.hands.close) {
            this.hands.close();
          }
        } catch (e) {
          console.warn('Hands cleanup error:', e);
        }
        this.hands = null;
      }
      
      // Clear data
      this.activeCells.clear();
      this.expandedCells.clear();
      this.fingerStates.clear();
      this.fingerDirections.clear();
      this.isInitialized = false;

      console.log('Hand detection stopped');

    } catch (error) {
      console.warn('Error during HandDetector cleanup:', error);
    } finally {
      // Ensure cleanup
      this.hands = null;
      this.camera = null;
    }
  }

  smoothTransition(currentValue, targetValue, smoothFactor = 0.2) {
    return currentValue + (targetValue - currentValue) * smoothFactor;
  }

  setGridSize(size) {
    this.gridSize = size;
    HandDetector.GRID_SIZE = size;
    this.activeCells.clear();
    this.expandedCells.clear();
  }

  getGridCell(x, y) {
    const cellX = Math.floor(x * this.gridSize);
    const cellY = Math.floor(y * this.gridSize);
    return { x: cellX, y: cellY };
  }
  
  drawFingerDots(landmarks) {
    // Finger tip indices: Thumb, Index, Middle, Ring, Pinky
    const fingerTipIndices = [4, 8, 12, 16, 20];
    const expandMode = document.getElementById('expandMode').value === "1";
    
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

        // Mobile-optimized distance thresholds
        const MIN_DISTANCE = this.isMobile ? 0.03 : 0.02;
        const MAX_DISTANCE = this.isMobile ? 0.10 : 0.08;

        let targetNormalized = Math.min(
            Math.max(
                (minDistance - MIN_DISTANCE) / 
                (MAX_DISTANCE - MIN_DISTANCE), 
                0
            ), 
            1
        );

        const now = performance.now();
        const HYSTERESIS_TIME = this.isMobile ? 150 : 100; // More stable on mobile
        
        if (targetNormalized > 0.8 && now - state.lastActiveTime > HYSTERESIS_TIME) {
            targetNormalized = 1;
            state.lastActiveTime = now;
        }

        state.normalizedDistance = this.smoothTransition(
            state.normalizedDistance, 
            targetNormalized,
            this.isMobile ? 0.25 : 0.3 // Slightly smoother on mobile
        );

        state.currentRed = this.smoothTransition(state.currentRed, 255 * (1 - state.normalizedDistance));
        state.currentGreen = this.smoothTransition(state.currentGreen, 255 * state.normalizedDistance);
        state.currentAlpha = this.smoothTransition(state.currentAlpha, state.normalizedDistance);

        // Trigger threshold - slightly higher on mobile for stability
        const triggerThreshold = this.isMobile ? 220 : 200;
        const alphaThreshold = this.isMobile ? 0.85 : 0.8;

        if (state.currentGreen > triggerThreshold && state.currentAlpha > alphaThreshold) {
            const cell = this.getGridCell(tipPosition.x, tipPosition.y);
            const cellKey = `${cell.x},${cell.y}`;
            this.activeCells.add(cellKey);

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

  // Mobile-specific diagnostics
  getDiagnostics() {
    return {
      isMobile: this.isMobile,
      isInitialized: this.isInitialized,
      hasCamera: !!this.camera,
      hasHands: !!this.hands,
      activeCellsCount: this.activeCells.size,
      expandedCellsCount: this.expandedCells.size,
      fingerStatesCount: this.fingerStates.size
    };
  }
}