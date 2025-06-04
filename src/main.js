import { HandDetector } from './fingers.js';
import { AudioEngine } from './audio.js';

// Constants
const CANVAS_SIZE = Math.min(640, 480);

const SCALES = ['pentatonic', 'major', 'minor', 'harmonicMinor', 'blues'];
const WAVE_TYPES = ['sine', 'square', 'sawtooth', 'triangle'];

// DOM Elements
const UI = {
    video: document.getElementById('webcam'),
    canvas: document.getElementById('canvas'),
    startButton: document.getElementById('startButton'),
    controls: document.querySelector('.controls'),
    
    // Sliders and values
    volumeSlider: document.getElementById('volumeSlider'),
    volumeValue: document.getElementById('volumeValue'),
    bpmSlider: document.getElementById('bpmSlider'),
    bpmValue: document.getElementById('bpmValue'),
    delaySlider: document.getElementById('delaySlider'),
    delayValue: document.getElementById('delayValue'),
    attackSlider: document.getElementById('attackSlider'),
    attackValue: document.getElementById('attackValue'),
    reverbSlider: document.getElementById('reverbSlider'),
    reverbValue: document.getElementById('reverbValue'),
    mainOscGainSlider: document.getElementById('mainOscGainSlider'),
    mainOscGainValue: document.getElementById('mainOscGainValue'),
    subOscGainSlider: document.getElementById('subOscGainSlider'),
    subOscGainValue: document.getElementById('subOscGainValue'),
    glideSlider: document.getElementById('glideSlider'),
    glideValue: document.getElementById('glideValue'),
    glideModeSlider: document.getElementById('glideModeSlider'),
    glideModeValue: document.getElementById('glideModeValue'),
    
    // Dropdowns and sliders
    mainOscType: document.getElementById('mainOscType'),
    subOscType: document.getElementById('subOscType'),
    scaleSelect: document.getElementById('scaleSelect'),
    expandMode: document.getElementById('expandMode'),
    expandModeValue: document.getElementById('expandModeValue'),
    arpMode: document.getElementById('arpMode'),
    arpModeValue: document.getElementById('arpModeValue'),
    holdMode: document.getElementById('holdMode'),
    holdModeValue: document.getElementById('holdModeValue'),
    mainOscOctave: document.getElementById('mainOscOctave'),
    mainOscOctaveValue: document.getElementById('mainOscOctaveValue'),
    subOscOctave: document.getElementById('subOscOctave'),
    subOscOctaveValue: document.getElementById('subOscOctaveValue'),
    glideSlider: document.getElementById('glideSlider'),
    glideValue: document.getElementById('glideValue'),
    glideModeSlider: document.getElementById('glideModeSlider'),
    glideModeValue: document.getElementById('glideModeValue'),
    scaleValue: document.getElementById('scaleValue'),
    mainOscTypeValue: document.getElementById('mainOscTypeValue'),
    subOscTypeValue: document.getElementById('subOscTypeValue'),
    pitchSlider: document.getElementById('pitchSlider'),
    pitchValue: document.getElementById('pitchValue'),
    
    // New filter UI elements
    filterCutoffSlider: document.getElementById('filterCutoffSlider'),
    filterCutoffValue: document.getElementById('filterCutoffValue'),
    filterResonanceSlider: document.getElementById('filterResonanceSlider'),
    filterResonanceValue: document.getElementById('filterResonanceValue'),
};

// State
let lastActiveCells = new Set();
let audioEngine = null;
let handDetector = null;
let heldNotes = null;

function drawGrid(ctx, width, height, gridSize, activeCells) {
  const cellWidth = width / gridSize;
  const cellHeight = height / gridSize;
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;

  // Draw vertical and horizontal lines first
  for (let x = 0; x <= width; x += cellWidth) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += cellHeight) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Highlight active cells
  activeCells.forEach(cell => {
    // Check if this cell is an expanded cell
    const isExpanded = handDetector && handDetector.expandedCells.has(`${cell.x},${cell.y}`);
    ctx.fillStyle = isExpanded ? 
      'rgba(135, 206, 235, 0.3)' : // Light blue for expanded cells
      'rgba(0, 0, 255, 0.3)';      // Regular blue for normal cells
    
    ctx.fillRect(
      cell.x * cellWidth,
      cell.y * cellHeight,
      cellWidth,
      cellHeight
    );
  });
}

function handleBPMChange(value) {
    UI.bpmValue.textContent = value;
    if (audioEngine) {
        const newTempo = parseInt(value);
        audioEngine.tempo = newTempo;
        audioEngine.stepInterval = (60 / newTempo) * 1000 / 2;
    }
}

// Add the delay handler function
function handleDelayChange(value) {
    const delayAmount = parseInt(value) / 100;
    UI.delayValue.textContent = `${value}%`;
    if (audioEngine) {
        audioEngine.setDelayAmount(delayAmount);
    }
}

// (removed duplicate UI declaration)

// Add these handler functions
function handleVolumeChange(value) {
    const volume = parseInt(value) / 100;
    UI.volumeValue.textContent = `${value}%`;
    if (audioEngine) {
        audioEngine.setVolume(volume);
    }
}

function handleAttackChange(value) {
    const attack = parseInt(value) / 1000; // Now max value will be 0.04s
    UI.attackValue.textContent = `${attack.toFixed(3)}s`;
    if (audioEngine) {
        audioEngine.setAttack(attack);
    }
}

function handleReleaseChange(value) {
    const release = parseInt(value) / 1000;
    UI.releaseValue.textContent = `${release.toFixed(3)}s`;
    if (audioEngine) {
        audioEngine.setRelease(release);
    }
}

function handleReverbChange(value) {
    UI.reverbValue.textContent = `${value}%`;
    if (audioEngine) {
        audioEngine.setReverb(parseInt(value));
    }
}

function handleMainOscGainChange(value) {
    const gain = parseInt(value) / 100;
    UI.mainOscGainValue.textContent = `${value}%`;
    if (audioEngine) {
        audioEngine.setMainOscGain(gain);
        if (UI.arpMode.value === "0" && UI.holdMode.value === "1" && heldNotes) {
            heldNotes.forEach(cell => {
                audioEngine.stopNote(cell.x, cell.y);
            });
            heldNotes.forEach(cell => {
                audioEngine.playNote(cell.x, cell.y);
            });
        }
    }
}

function handleSubOscGainChange(value) {
    const gain = parseInt(value) / 100;
    UI.subOscGainValue.textContent = `${value}%`;
    if (audioEngine) {
        audioEngine.setSubOscGain(gain);
        if (UI.arpMode.value === "0" && UI.holdMode.value === "1" && heldNotes) {
            heldNotes.forEach(cell => {
                audioEngine.stopNote(cell.x, cell.y);
            });
            heldNotes.forEach(cell => {
                audioEngine.playNote(cell.x, cell.y);
            });
        }
    }
}

function handleScaleChange(value) {
    const index = parseInt(value);
    const scaleName = SCALES[index];
    UI.scaleValue.textContent = scaleName.charAt(0).toUpperCase() + scaleName.slice(1);
    if (audioEngine) {
        audioEngine.changeScale(scaleName);
    }
}

function handleMainOscTypeChange(value) {
    const type = WAVE_TYPES[value];
    UI.mainOscTypeValue.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    if (audioEngine) {
        audioEngine.setMainOscType(type);
    }
}

function handleSubOscTypeChange(value) {
    const type = WAVE_TYPES[value];
    UI.subOscTypeValue.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    if (audioEngine) {
        audioEngine.setSubOscType(type);
    }
}

function handleGlideChange(value) {
    const glideTime = parseInt(value) / 1000;
    UI.glideValue.textContent = `${value}ms`;
    
    // Enable/disable glide mode slider based on glide value
    const isEnabled = parseInt(value) > 0;
    UI.glideModeSlider.disabled = !isEnabled;
    
    if (audioEngine) {
        audioEngine.setGlideTime(glideTime);
        // Update held notes in normal mode
        if (UI.arpMode.value === "0" && UI.holdMode.value === "1" && heldNotes) {
            heldNotes.forEach(cell => {
                audioEngine.stopNote(cell.x, cell.y);
            });
            heldNotes.forEach(cell => {
                audioEngine.playNote(cell.x, cell.y);
            });
        }
    }
}

function handleGlideModeChange(value) {
    const isPortamento = parseInt(value) === 1;
    UI.glideModeValue.textContent = isPortamento ? 'Portamento' : 'Glissando';
    if (audioEngine) {
        audioEngine.setPortamentoMode(isPortamento);
    }
}

function handleMainOscOctaveChange(value) {
    const octave = parseInt(value);
    UI.mainOscOctaveValue.textContent = octave;
    if (audioEngine) {
        audioEngine.setMainOscOctave(octave);
    }
}

function handleSubOscOctaveChange(value) {
    const octave = parseInt(value);
    UI.subOscOctaveValue.textContent = octave;
    if (audioEngine) {
        audioEngine.setSubOscOctave(octave);
    }
}

function handleExpandModeChange(value) {
    const isEnabled = parseInt(value) === 1;
    UI.expandModeValue.textContent = isEnabled ? 'On' : 'Off';
    if (handDetector) {
        if (!isEnabled) {
            // Only clear expanded cells when turning off expand mode
            handDetector.expandedCells.clear();
            
            // Stop any notes that were playing from expanded cells
            if (audioEngine) {
                // In hold mode, remove expanded cells from held notes
                if (UI.holdMode.value === "1" && heldNotes) {
                    heldNotes = heldNotes.filter(cell => !handDetector.expandedCells.has(`${cell.x},${cell.y}`));
                }
                
                // Stop notes from expanded cells that are no longer active
                const activeCells = handDetector.getActiveCells();
                const activeCellKeys = new Set(activeCells.map(cell => `${cell.x},${cell.y}`));
                
                [...handDetector.expandedCells].forEach(cellKey => {
                    if (!activeCellKeys.has(cellKey)) {
                        const [x, y] = cellKey.split(',').map(Number);
                        audioEngine.stopNote(x, y);
                    }
                });
                
                // Update arpeggiator if needed
                if (UI.arpMode.value === "1") {
                    if (UI.holdMode.value === "1" && heldNotes) {
                        audioEngine.playArpeggio(heldNotes);
                    } else {
                        audioEngine.playArpeggio(activeCells);
                    }
                }
            }
        }
    }
}

function handleHoldModeChange(value) {
    const isEnabled = parseInt(value) === 1;
    UI.holdModeValue.textContent = isEnabled ? 'On' : 'Off';
    
    if (isEnabled) {
        // When enabling hold mode, store current active cells
        const activeCells = handDetector.getActiveCells();
        heldNotes = [...activeCells]; // Store a copy of currently active cells
        
        // If in arp mode, start arpeggiating held notes
        if (audioEngine && UI.arpMode.value === "1" && heldNotes.length > 0) {
            audioEngine.playArpeggio(heldNotes);
        }
    } else {
        // When disabling hold mode
        if (audioEngine) {
            if (UI.arpMode.value === "1") {
                audioEngine.stopArpeggio();
            } else {
                heldNotes?.forEach(cell => {
                    audioEngine.stopNote(cell.x, cell.y);
                });
            }
        }
        // Clear held notes and return to normal operation
        heldNotes = null;
        
        // Update with current active cells
        const activeCells = handDetector.getActiveCells();
        if (audioEngine && activeCells.length > 0) {
            if (UI.arpMode.value === "1") {
                audioEngine.playArpeggio(activeCells);
            } else {
                activeCells.forEach(cell => {
                    audioEngine.playNote(cell.x, cell.y);
                });
            }
        }
    }
}

// Update existing arp mode handler to work with slider
function handleArpModeChange(value) {
    const isArpMode = parseInt(value) === 1;
    UI.arpModeValue.textContent = isArpMode ? 'On' : 'Off';
    
    if (audioEngine) {
        // Stop any currently playing notes when switching modes
        if (!isArpMode) {
            audioEngine.stopArpeggio();
        }
        
        if (UI.holdMode.value === "1" && heldNotes) {
            // Replay held notes in new mode
            if (isArpMode) {
                audioEngine.playArpeggio(heldNotes);
            } else {
                heldNotes.forEach(cell => {
                    audioEngine.playNote(cell.x, cell.y);
                });
            }
        } else {
            // Handle currently active cells
            const activeCells = handDetector.getActiveCells();
            if (activeCells.length > 0) {
                if (isArpMode) {
                    audioEngine.playArpeggio(activeCells);
                } else {
                    activeCells.forEach(cell => {
                        audioEngine.playNote(cell.x, cell.y);
                    });
                }
            }
        }
    }
}

function validateUIElements() {
    const missingElements = [];
    for (const [key, value] of Object.entries(UI)) {
        if (!value) {
            missingElements.push(key);
        }
    }
    if (missingElements.length > 0) {
        throw new Error(`Missing UI elements: ${missingElements.join(', ')}`);
    }
}

async function initializeApp() {
    try {
        // Validate UI elements first
        validateUIElements();

        // Initialize audio engine first
        audioEngine = new AudioEngine();
        
        // Initialize hand detector
        handDetector = new HandDetector(UI.video, UI.canvas);
        
        // Start tracking and hide the button
        UI.startButton.classList.add('hidden');
        UI.controls.classList.remove('hidden');
        
        // Initialize BPM slider with current tempo
        UI.bpmSlider.value = audioEngine.tempo;
        UI.bpmValue.textContent = audioEngine.tempo;
        
        // Initialize delay slider
        UI.delaySlider.value = audioEngine.delayAmount * 100;
        UI.delayValue.textContent = `${UI.delaySlider.value}%`;
        
        // Initialize mode controls with sliders
        UI.expandMode.value = 0;
        UI.expandModeValue.textContent = 'Off';
        
        UI.holdMode.value = 0;
        UI.holdModeValue.textContent = 'Off';
        
        // Initialize scale selector with pentatonic (index 0)
        UI.scaleSelect.value = "0"; // Force to pentatonic
        handleScaleChange("0");  // Update display and audio engine

        // Initialize mode controls
        UI.arpMode.value = "1";
        UI.arpModeValue.textContent = 'On';
        UI.expandMode.value = "0";
        UI.expandModeValue.textContent = 'Off';
        UI.holdMode.value = "0";
        UI.holdModeValue.textContent = 'Off';

        // Initialize octave controls
        UI.mainOscOctave.value = audioEngine.mainOscOctave;
        UI.mainOscOctaveValue.textContent = audioEngine.mainOscOctave;
        UI.subOscOctave.value = audioEngine.subOscOctave;
        UI.subOscOctaveValue.textContent = audioEngine.subOscOctave;

        // Initialize glide controls
        UI.glideSlider.value = 0;
        UI.glideValue.textContent = '0ms';
        UI.glideModeSlider.value = 0;
        UI.glideModeValue.textContent = 'Glissando';
        UI.glideModeSlider.disabled = true;

        // Initialize pitch slider
        UI.pitchSlider.value = 0;
        UI.pitchValue.textContent = "0 st";
        UI.pitchSlider.addEventListener('input', (e) => handlePitchChange(e.target.value));

        // Add input and change events for immediate feedback
        UI.bpmSlider.addEventListener('input', (e) => handleBPMChange(e.target.value));
        UI.bpmSlider.addEventListener('change', (e) => handleBPMChange(e.target.value));
        
        // Add delay slider event listeners
        UI.delaySlider.addEventListener('input', (e) => handleDelayChange(e.target.value));
        UI.delaySlider.addEventListener('change', (e) => handleDelayChange(e.target.value));
        
        UI.expandMode.addEventListener('input', (e) => handleExpandModeChange(e.target.value));

        // Add hold mode change listener
        UI.holdMode.addEventListener('input', (e) => handleHoldModeChange(e.target.value));

        // Add arp mode change listener
        UI.arpMode.addEventListener('input', (e) => handleArpModeChange(e.target.value));

        // Add scale change handler
        UI.scaleSelect.addEventListener('change', (e) => {
            if (audioEngine) {
                audioEngine.changeScale(e.target.value);
            }
        });

        // Initialize audio parameter sliders (remove releaseSlider)
        UI.volumeSlider.addEventListener('input', (e) => handleVolumeChange(e.target.value));
        UI.attackSlider.addEventListener('input', (e) => handleAttackChange(e.target.value));
        UI.reverbSlider.addEventListener('input', (e) => handleReverbChange(e.target.value));
        UI.mainOscGainSlider.addEventListener('input', (e) => handleMainOscGainChange(e.target.value));
        UI.subOscGainSlider.addEventListener('input', (e) => handleSubOscGainChange(e.target.value));
        
        // Initialize oscillator controls
        UI.mainOscType.addEventListener('change', (e) => handleMainOscTypeChange(e.target.value));
        UI.subOscType.addEventListener('change', (e) => handleSubOscTypeChange(e.target.value));
        
        // Add octave change listeners
        UI.mainOscOctave.addEventListener('input', (e) => handleMainOscOctaveChange(e.target.value));
        UI.subOscOctave.addEventListener('input', (e) => handleSubOscOctaveChange(e.target.value));
        
        // Glide control
        UI.glideSlider.addEventListener('input', (e) => handleGlideChange(e.target.value));
        
        // Add event listeners for mode controls
        UI.scaleSelect.addEventListener('input', e => handleScaleChange(e.target.value));
        UI.mainOscType.addEventListener('input', e => handleMainOscTypeChange(e.target.value));
        UI.subOscType.addEventListener('input', e => handleSubOscTypeChange(e.target.value));
        UI.expandMode.addEventListener('input', e => handleExpandModeChange(e.target.value));
        UI.arpMode.addEventListener('input', e => handleArpModeChange(e.target.value));
        UI.holdMode.addEventListener('input', e => handleHoldModeChange(e.target.value));

        // Initialize glide mode control
        UI.glideModeSlider.addEventListener('input', e => handleGlideModeChange(e.target.value));

        // Initialize display values
        handleScaleChange(UI.scaleSelect.value);
        handleMainOscTypeChange(UI.mainOscType.value);
        handleSubOscTypeChange(UI.subOscType.value);
        handleGlideModeChange(UI.glideModeSlider.value);

        // Enable/disable glide mode slider when glide value changes
        UI.glideSlider.addEventListener('input', e => {
            const isEnabled = parseInt(e.target.value) > 0;
            UI.glideModeSlider.disabled = !isEnabled;
            if (isEnabled && UI.glideModeSlider.value === "0") {
                handleGlideModeChange(0);
            }
        });

        // Initialize filter sliders
        UI.filterCutoffSlider.addEventListener('input', (e) => handleFilterCutoffChange(e.target.value));
        UI.filterResonanceSlider.addEventListener('input', (e) => handleFilterResonanceChange(e.target.value));
        
        // Initialize filter values
        handleFilterCutoffChange(UI.filterCutoffSlider.value);
        handleFilterResonanceChange(UI.filterResonanceSlider.value);

        // Main render loop
        handDetector.start((results) => {
            UI.canvas.width = UI.video.width = CANVAS_SIZE;
            UI.canvas.height = UI.video.height = CANVAS_SIZE;
            
            const canvasCtx = UI.canvas.getContext('2d');
            canvasCtx.save();
            
            // Clear previous frame
            canvasCtx.clearRect(0, 0, UI.canvas.width, UI.canvas.height);
            
            // Draw mirrored camera feed
            canvasCtx.scale(-1, 1);
            canvasCtx.translate(-UI.canvas.width, 0);
            
            // Square crop the video
            let sx = 0, sy = 0, sWidth = results.image.width, sHeight = results.image.height;
            const videoAspect = results.image.width / results.image.height;
            
            if (videoAspect > 1) {
                sWidth = sHeight;
                sx = (results.image.width - sWidth) / 2;
            } else if (videoAspect < 1) {
                sHeight = sWidth;
                sy = (results.image.height - sHeight) / 2;
            }
            
            canvasCtx.drawImage(
                results.image,
                sx, sy, sWidth, sHeight,
                0, 0, UI.canvas.width, UI.canvas.height
            );
                                                                                                                                                                                                                        
            // Only proceed if handDetector is initialized
            if (handDetector) {
                // Clear active cells before processing any hands
                handDetector.activeCells.clear();
                
                // Draw hands and track fingers
                if (results.multiHandLandmarks) {
                    results.multiHandLandmarks.forEach(landmarks => {
                        handDetector.drawFingerDots(landmarks);
                    });
                }
            }

            // Get active cells and draw grid only if handDetector is initialized
            const activeCells = handDetector ? handDetector.getActiveCells() : [];
            
            // Draw grid with proper held notes handling
            let cellsToDraw = [];
            if (UI.holdMode.value === "1" && heldNotes) {
                // Include both held notes and any new active cells
                const heldNoteKeys = new Set(heldNotes.map(cell => `${cell.x},${cell.y}`));
                const newActiveCells = activeCells.filter(cell => 
                    !heldNoteKeys.has(`${cell.x},${cell.y}`)
                );
                cellsToDraw = [...heldNotes, ...newActiveCells];
            } else {
                cellsToDraw = activeCells;
            }

            drawGrid(canvasCtx, CANVAS_SIZE, CANVAS_SIZE, HandDetector.GRID_SIZE, cellsToDraw);
            
            // Only update sequence if not in hold mode
            if (UI.holdMode.value === "0") {
                const currentActiveCellsSet = new Set(activeCells.map(cell => `${cell.x},${cell.y}`));
                
                if (JSON.stringify([...currentActiveCellsSet]) !== JSON.stringify([...lastActiveCells])) {
                    // Only handle note stopping if not in arp mode
                    if (UI.arpMode.value === "0") {
                        [...lastActiveCells].forEach(cellKey => {
                            if (!currentActiveCellsSet.has(cellKey)) {
                                const [x, y] = cellKey.split(',').map(Number);
                                audioEngine.stopNote(x, y);
                            }
                        });
                    }

                    if (audioEngine) {
                        if (currentActiveCellsSet.size > 0) {
                            if (UI.arpMode.value === "1") {
                                audioEngine.playArpeggio(activeCells);
                            } else {
                                // In normal mode, play all active cells sustained
                                activeCells.forEach(cell => {
                                    audioEngine.playNote(cell.x, cell.y);
                                });
                            }
                        } else {
                            if (UI.arpMode.value === "1") {
                                audioEngine.stopArpeggio();
                            }
                        }
                    }
                    
                    lastActiveCells = currentActiveCellsSet;
                }
            }
            
            canvasCtx.restore();
        });
    } catch (error) {
        console.error('Error initializing app:', error);
        alert('Error initializing the application. Please check if all UI elements exist.');
        if (UI.controls) {
            UI.controls.classList.add('hidden');
        }
    }
}

// Make sure the DOM is fully loaded before adding event listener
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.addEventListener('click', initializeApp);
    } else {
        console.error('Start button not found');
    }
});

function handlePitchChange(value) {
    const semitones = parseInt(value);
    UI.pitchValue.textContent = `${semitones} st`;
    if (audioEngine) {
        audioEngine.setPitchShift(semitones);
    }
}

function handleFilterCutoffChange(value) {
    const frequency = parseInt(value);
    // Format display value
    const displayValue = frequency >= 1000 ? 
        `${(frequency/1000).toFixed(1)}kHz` : 
        `${frequency}Hz`;
    UI.filterCutoffValue.textContent = displayValue;
    if (audioEngine) {
        audioEngine.setFilterCutoff(frequency);
    }
}

function handleFilterResonanceChange(value) {
    const resonance = parseFloat(value);
    UI.filterResonanceValue.textContent = resonance.toFixed(1);
    if (audioEngine) {
        audioEngine.setFilterResonance(resonance);
    }
}