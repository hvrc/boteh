import { HandDetector } from './fingers.js';
import { AudioEngine } from './audio.js';
import { drawGrid, clearOpacities } from './grid.js';

// Constants
const CANVAS_SIZE = Math.min(640, 480);

const SCALES = ['pentatonic', 'major', 'minor', 'harmonicMinor', 'blues'];
const WAVE_TYPES = ['sine', 'square', 'sawtooth', 'triangle'];

// DOM Elements
const UI = {
    video: document.getElementById('webcam'),
    canvas: document.getElementById('canvas'),
    controls: document.querySelector('.controls'),
    
    // Master switch elements
    masterSwitch: document.getElementById('masterSwitch'),
    masterSwitchValue: document.getElementById('masterSwitchValue'),
    
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
    // glideModeSlider: document.getElementById('glideModeSlider'),
    // glideModeValue: document.getElementById('glideModeValue'),
    
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
    // glideModeSlider: document.getElementById('glideModeSlider'),
    // glideModeValue: document.getElementById('glideModeValue'),
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
    delayFeedbackSlider: document.getElementById('delayFeedbackSlider'),
    delayFeedbackValue: document.getElementById('delayFeedbackValue'),

    // Add grid size controls
    gridSizeSlider: document.getElementById('gridSizeSlider'),
    gridSizeValue: document.getElementById('gridSizeValue'),
};

// State
let lastActiveCells = new Set();
let audioEngine = null;
let handDetector = null;
let heldNotes = null;
const cellOpacities = new Map(); // Add this line

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

function handleDelayFeedbackChange(value) {
    UI.delayFeedbackValue.textContent = `${value}%`;
    if (audioEngine) {
        audioEngine.setDelayFeedback(value);
    }
}

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
    // UI.glideModeSlider.disabled = !isEnabled;
    
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

// function handleGlideModeChange(value) {
//     const isPortamento = parseInt(value) === 1;
//     UI.glideModeValue.textContent = isPortamento ? 'Portamento' : 'Glissando';
//     if (audioEngine) {
//         audioEngine.setPortamentoMode(isPortamento);
//     }
// }

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
    UI.expandMode.dataset.state = isEnabled ? 'on' : 'off';
    
    if (handDetector) {
        if (!isEnabled) {
            handDetector.expandedCells.clear();
            
            // Stop any notes that were playing from spread cells
            if (audioEngine) {
                // In sustain mode, remove spread cells from held notes
                if (UI.holdMode.value === "1" && heldNotes) {
                    heldNotes = heldNotes.filter(cell => !handDetector.expandedCells.has(`${cell.x},${cell.y}`));
                }
                
                // Stop notes from spread cells that are no longer active
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

// Rename function from handleHoldModeChange to handleSustainModeChange but keep the id references the same
function handleHoldModeChange(value) {
    const isEnabled = parseInt(value) === 1;
    // Update display text to say "Sustain" instead of "Hold"
    UI.holdModeValue.textContent = isEnabled ? 'On' : 'Off';
    UI.holdMode.dataset.state = isEnabled ? 'on' : 'off';
    
    if (isEnabled && handDetector) {
        // When enabling sustain mode, store current active cells
        const activeCells = handDetector.getActiveCells();
        heldNotes = [...activeCells]; // Store a copy of currently active cells
        
        // If in arp mode, start arpeggiating sustained notes
        if (audioEngine && UI.arpMode.value === "1" && heldNotes.length > 0) {
            audioEngine.playArpeggio(heldNotes);
        }
    } else {
        // When disabling sustain mode
        if (audioEngine) {
            if (UI.arpMode.value === "1") {
                audioEngine.stopArpeggio();
            } else {
                heldNotes?.forEach(cell => {
                    audioEngine.stopNote(cell.x, cell.y);
                });
            }
        }
        // Clear sustained notes and return to normal operation
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

// Update handleArpModeChange function
function handleArpModeChange(value) {
    const isArpMode = parseInt(value) === 1;
    UI.arpModeValue.textContent = isArpMode ? 'On' : 'Off';
    UI.arpMode.dataset.state = isArpMode ? 'on' : 'off';
    
    if (audioEngine) {
        // First, stop everything immediately
        audioEngine.stopArpeggio();
        
        // Clear all active notes first
        if (audioEngine.oscillators.size > 0) {
            const currentlyActive = Array.from(audioEngine.oscillators.keys());
            currentlyActive.forEach(key => {
                const [x, y] = key.split(',').map(Number);
                audioEngine.stopNote(x, y);
            });
        }

        // Force clear all oscillators
        audioEngine.oscillators.clear();
        
        // Reset any arpeggiator state
        audioEngine.activeNotes.clear();
        audioEngine.lastNotePlayed = null;

        // Wait for cleanup before starting new mode
        setTimeout(() => {
            const activeCells = UI.holdMode.value === "1" && heldNotes ? 
                heldNotes : 
                handDetector.getActiveCells();

            if (activeCells && activeCells.length > 0) {
                if (isArpMode) {
                    audioEngine.playArpeggio(activeCells);
                } else {
                    activeCells.forEach(cell => {
                        audioEngine.playNote(cell.x, cell.y);
                    });
                }
            }
        }, 100); // Longer delay to ensure complete cleanup
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

        // Show video and enable controls
        UI.video.classList.remove('hidden');
        UI.controls.classList.remove('disabled');

        // Initialize audio engine first
        audioEngine = new AudioEngine();
        
        // Initialize hand detector
        handDetector = new HandDetector(UI.video, UI.canvas);
        
        // Remove this line
        // UI.startButton.classList.add('hidden');
        
        // Initialize BPM slider with current tempo
        UI.bpmSlider.value = audioEngine.tempo;
        UI.bpmValue.textContent = audioEngine.tempo;
        
        // Initialize delay slider
        UI.delaySlider.value = audioEngine.delayAmount * 100;
        UI.delayValue.textContent = `${UI.delaySlider.value}%`;
        
        // Initialize mode controls with proper visual states
        UI.expandMode.dataset.state = 'off';
        UI.expandMode.value = "0";
        UI.expandModeValue.textContent = 'Off';
        
        UI.arpMode.dataset.state = 'on';  // Change to 'on'
        UI.arpMode.value = "1";  // Change to "1"
        UI.arpModeValue.textContent = 'On'; // Change to 'On'
        
        UI.holdMode.dataset.state = 'off';
        UI.holdMode.value = "0";
        UI.holdModeValue.textContent = 'Off';

        // Initialize scale selector with pentatonic (index 0)
        UI.scaleSelect.value = "0"; // Force to pentatonic
        handleScaleChange("0");  // Update display and audio engine

        // Initialize mode controls
        UI.arpMode.value = "1";  // Change to "1"
        UI.arpMode.dataset.state = 'on';  // Change to 'on'
        UI.arpModeValue.textContent = 'On'; // Change to 'On'
        
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
        // UI.glideModeSlider.value = 0;
        // UI.glideModeValue.textContent = 'Glissando';
        // UI.glideModeSlider.disabled = true;

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

        UI.delayFeedbackSlider.addEventListener('input', (e) => handleDelayFeedbackChange(e.target.value));
        
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
        // UI.glideModeSlider.addEventListener('input', e => handleGlideModeChange(e.target.value));

        // Initialize display values
        handleScaleChange(UI.scaleSelect.value);
        handleMainOscTypeChange(UI.mainOscType.value);
        handleSubOscTypeChange(UI.subOscType.value);
        // handleGlideModeChange(UI.glideModeSlider.value);

        // Enable/disable glide mode slider when glide value changes
        // UI.glideSlider.addEventListener('input', e => {
        //     const isEnabled = parseInt(e.target.value) > 0;
        //     UI.glideModeSlider.disabled = !isEnabled;
        //     if (isEnabled && UI.glideModeSlider.value === "0") {
        //         handleGlideModeChange(0);
        //     }
        // });

        // Initialize filter sliders
        UI.filterCutoffSlider.addEventListener('input', (e) => handleFilterCutoffChange(e.target.value));
        UI.filterResonanceSlider.addEventListener('input', (e) => handleFilterResonanceChange(e.target.value));
        
        // Initialize filter values
        handleFilterCutoffChange(UI.filterCutoffSlider.value);
        handleFilterResonanceChange(UI.filterResonanceSlider.value);

        // Initialize grid size slider
        UI.gridSizeSlider.value = HandDetector.GRID_SIZE;
        UI.gridSizeValue.textContent = HandDetector.GRID_SIZE;
        
        // Add grid size change listener
        UI.gridSizeSlider.addEventListener('input', (e) => handleGridSizeChange(e.target.value));

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

            drawGrid(
                canvasCtx, 
                CANVAS_SIZE, 
                CANVAS_SIZE, 
                HandDetector.GRID_SIZE, 
                cellsToDraw, 
                handDetector,
                audioEngine  // Add this parameter
            );
            
            // Only update sequence if not in hold mode
            if (UI.holdMode.value === "0") {
                const currentActiveCellsSet = new Set(activeCells.map(cell => `${cell.x},${cell.y}`));
                
                if (JSON.stringify([...currentActiveCellsSet]) !== JSON.stringify([...lastActiveCells])) {
                    // Stop all notes if there are no active cells
                    if (currentActiveCellsSet.size === 0) {
                        if (audioEngine) {
                            // Force stop ALL notes and clear oscillators
                            audioEngine.stopArpeggio();
                            Array.from(audioEngine.oscillators.keys()).forEach(key => {
                                const [x, y] = key.split(',').map(Number);
                                audioEngine.stopNote(x, y);
                            });
                            
                            audioEngine.oscillators.clear(); // Force clear all oscillators
                        }
                    } else {
                        // Normal note handling for active cells
                        if (UI.arpMode.value === "0") {
                            // First stop any notes that are no longer active
                            [...lastActiveCells].forEach(cellKey => {
                                if (!currentActiveCellsSet.has(cellKey)) {
                                    const [x, y] = cellKey.split(',').map(Number);
                                    audioEngine.stopNote(x, y);
                                }
                            });

                            // Force clear any lingering notes
                            Array.from(audioEngine.oscillators.keys()).forEach(key => {
                                if (!currentActiveCellsSet.has(key)) {
                                    const [x, y] = key.split(',').map(Number);
                                    audioEngine.stopNote(x, y);
                                }
                            });

                            // Then play currently active notes
                            activeCells.forEach(cell => {
                                audioEngine.playNote(cell.x, cell.y);
                            });
                        } else if (UI.arpMode.value === "1") {
                            audioEngine.playArpeggio(activeCells);
                        }
                    }
                    
                    lastActiveCells = currentActiveCellsSet;
                }
            }
            
            canvasCtx.restore();
        });
    } catch (error) {
        console.error('Error initializing app:', error);
        alert('Error initializing the application. Please check camera permissions.');
        
        // Reset master switch
        UI.masterSwitch.value = "0";
        UI.masterSwitchValue.textContent = 'Off';
        UI.controls.classList.add('disabled');
        UI.video.classList.add('hidden');
    }
}

// Make sure the DOM is fully loaded before adding event listener
document.addEventListener('DOMContentLoaded', () => {
    // Initialize canvas size
    UI.canvas.width = UI.canvas.height = CANVAS_SIZE;
    
    // Draw initial state with instruction text
    const ctx = UI.canvas.getContext('2d');
    drawInitialState(ctx);
    
    // Set initial UI state
    UI.controls.classList.add('disabled');
    
    // Set initial button states
    UI.masterSwitch.dataset.state = 'off';
    UI.masterSwitchValue.textContent = 'Off';
    
    UI.expandMode.dataset.state = 'off';
    UI.expandModeValue.textContent = 'Off';
    
    UI.arpMode.dataset.state = 'on';  // Change to 'on'
    UI.arpModeValue.textContent = 'On'; // Change to 'On'
    UI.arpMode.value = "1";  // Change to "1"
    
    UI.holdMode.dataset.state = 'off';
    UI.holdModeValue.textContent = 'Off';

    // Add click handler for master switch
    UI.masterSwitch.addEventListener('click', (e) => {
        const button = e.currentTarget;
        const newState = button.dataset.state === 'on' ? 'off' : 'on';
        button.dataset.state = newState;
        UI.masterSwitchValue.textContent = newState === 'on' ? 'On' : 'Off';
        
        if (newState === 'on') {
            initializeApp();
        } else {
            shutdownSystem();
        }
    });

    // Remove the old event listeners for mode buttons
    // And add new ones that check power state first
    UI.expandMode.addEventListener('click', (e) => {
        if (UI.masterSwitch.dataset.state !== 'on') return;
        const button = e.currentTarget;
        const newState = button.dataset.state === 'on' ? 'off' : 'on';
        button.dataset.state = newState;
        UI.expandMode.value = newState === 'on' ? '1' : '0';
        handleExpandModeChange(newState === 'on' ? '1' : '0');
    });

    UI.arpMode.addEventListener('click', (e) => {
        if (UI.masterSwitch.dataset.state !== 'on') return;
        const button = e.currentTarget;
        const newState = button.dataset.state === 'on' ? 'off' : 'on';
        button.dataset.state = newState;
        UI.arpMode.value = newState === 'on' ? '1' : '0';
        handleArpModeChange(newState === 'on' ? '1' : '0');
    });

    UI.holdMode.addEventListener('click', (e) => {
        if (UI.masterSwitch.dataset.state !== 'on') return;
        const button = e.currentTarget;
        const newState = button.dataset.state === 'on' ? 'off' : 'on';
        button.dataset.state = newState;
        UI.holdMode.value = newState === 'on' ? '1' : '0';
        handleHoldModeChange(newState === 'on' ? '1' : '0');
    });
});

function handlePitchChange(value) {
    // Convert from cents to semitones (value/100)
    const cents = parseInt(value);
    const semitones = cents / 100;
    
    // Update display - show cents if less than a semitone
    const displayText = Math.abs(cents) < 100 ? 
        `${cents} cents` : 
        `${semitones.toFixed(2)} st`;
    
    UI.pitchValue.textContent = displayText;
    
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

async function shutdownSystem() {
    try {
        // Stop audio first
        if (audioEngine) {
            audioEngine.stopArpeggio();
            // Stop all currently playing notes
            if (heldNotes) {
                heldNotes?.forEach(cell => {
                    audioEngine.stopNote(cell.x, cell.y);
                });
            }
            if (handDetector) {
                handDetector.getActiveCells().forEach(cell => {
                    audioEngine.stopNote(cell.x, cell.y);
                });
            }
            audioEngine = null;
        }

        // Stop camera and hand detection
        if (handDetector) {
            await handDetector.stop();
            handDetector = null;
        }
        
        // Hide video immediately
        UI.video.classList.add('hidden');
        
        // Disable controls and reset UI
        UI.controls.classList.add('disabled');
        
        // Clear canvas and redraw initial state
        const ctx = UI.canvas.getContext('2d');
        clearOpacities();
        drawInitialState(ctx);
        
        // Reset state
        lastActiveCells = new Set();
        heldNotes = null;
    } catch (error) {
        console.warn('Non-critical error during shutdown:', error);
    }
}

function drawInitialState(ctx) {
    // Clear canvas and set white background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    // Set up text style
    ctx.fillStyle = '#888';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw multiline text
    const text = ['turn power on', 'and wave your', 'fingers around'];
    const lineHeight = 30;
    const startY = (CANVAS_SIZE / 2) - ((text.length - 1) * lineHeight / 2);
    
    text.forEach((line, i) => {
        ctx.fillText(
            line, 
            CANVAS_SIZE / 2, 
            startY + (i * lineHeight)
        );
    });
}

// Add this function with the other handlers
function handleGridSizeChange(value) {
    const size = parseInt(value);
    UI.gridSizeValue.textContent = size;
    
    // Update both static and instance grid size
    HandDetector.GRID_SIZE = size;  // Add this line
    
    // Update grid size in HandDetector
    if (handDetector) {
        handDetector.setGridSize(size);
        
        // Stop all currently playing notes
        if (audioEngine) {
            audioEngine.stopArpeggio();
            if (heldNotes) {
                heldNotes.forEach(cell => {
                    audioEngine.stopNote(cell.x, cell.y);
                });
            }
            handDetector.getActiveCells().forEach(cell => {
                audioEngine.stopNote(cell.x, cell.y);
            });
            
            // Reset held notes
            heldNotes = null;
            lastActiveCells = new Set();
            
            // Update audio engine scale mapping
            audioEngine.setupScales(size);
        }
    }
    
    // Redraw grid
    const ctx = UI.canvas.getContext('2d');
    ctx.clearRect(0, 0, UI.canvas.width, UI.canvas.height);
    drawGrid(ctx, CANVAS_SIZE, CANVAS_SIZE, size, []);
}

// New click handlers
function handleMasterSwitchClick(e) {
    const button = e.currentTarget;
    const newState = button.dataset.state === 'on' ? 'off' : 'on';
    button.dataset.state = newState;
    handleMasterSwitch({ target: { value: newState === 'on' ? '1' : '0' }});
}

function handleExpandModeClick(e) {
    const button = e.currentTarget;
    const newState = button.dataset.state === 'on' ? 'off' : 'on';
    button.dataset.state = newState;
    handleExpandModeChange(newState === 'on' ? '1' : '0');
}

function handleArpModeClick(e) {
    const button = e.currentTarget;
    const newState = button.dataset.state === 'on' ? 'off' : 'on';
    button.dataset.state = newState;
    handleArpModeChange(newState === 'on' ? '1' : '0');
}

function handleHoldModeClick(e) {
    const button = e.currentTarget;
    const newState = button.dataset.state === 'on' ? 'off' : 'on';
    button.dataset.state = newState;
    handleHoldModeChange(newState === 'on' ? '1' : '0');
}