import { HandDetector } from './fingers.js';
import { AudioEngine } from './audio.js';
import { drawGrid, clearOpacities } from './grid.js';

const CANVAS_SIZE = Math.min(640, 480);
const SCALES = ['pentatonic', 'major', 'minor', 'harmonicMinor', 'blues'];
const WAVE_TYPES = ['sine', 'square', 'sawtooth', 'triangle'];

const UI = {
    video: document.getElementById('webcam'),
    canvas: document.getElementById('canvas'),
    controls: document.querySelector('.controls'),
    masterSwitch: document.getElementById('masterSwitch'),
    masterSwitchValue: document.getElementById('masterSwitchValue'),
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
    scaleValue: document.getElementById('scaleValue'),
    mainOscTypeValue: document.getElementById('mainOscTypeValue'),
    subOscTypeValue: document.getElementById('subOscTypeValue'),
    pitchSlider: document.getElementById('pitchSlider'),
    pitchValue: document.getElementById('pitchValue'),
    filterCutoffSlider: document.getElementById('filterCutoffSlider'),
    filterCutoffValue: document.getElementById('filterCutoffValue'),
    filterResonanceSlider: document.getElementById('filterResonanceSlider'),
    filterResonanceValue: document.getElementById('filterResonanceValue'),
    delayFeedbackSlider: document.getElementById('delayFeedbackSlider'),
    delayFeedbackValue: document.getElementById('delayFeedbackValue'),
    gridSizeSlider: document.getElementById('gridSizeSlider'),
    gridSizeValue: document.getElementById('gridSizeValue'),    presetSlider: document.getElementById('presetSlider'),
    presetValue: document.getElementById('presetValue'),
    instanceSlider: document.getElementById('instanceSlider'),
    instanceValue: document.getElementById('instanceValue'),
    recordButton: document.getElementById('recordButton'),
};

let lastActiveCells = new Set();
let audioEngines = new Map();
let activeAudioEngine = null;
let currentInstance = 1;
let handDetector = null;
let heldNotes = null;
const cellOpacities = new Map();

function handleBPMChange(value) {
    const bpm = Math.round(parseFloat(value));
    UI.bpmValue.textContent = bpm;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).tempo = bpm;
        audioEngines.get(currentInstance).stepInterval = (60 / bpm) * 1000 / 2;
    }
}

function handleDelayChange(value) {
    const delayAmount = parseInt(value) / 100;
    UI.delayValue.textContent = `${value}%`;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setDelayAmount(delayAmount);
    }
}

function handleDelayFeedbackChange(value) {
    const feedback = parseInt(value);
    UI.delayFeedbackValue.textContent = `${value}%`;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setDelayFeedback(feedback);
    }
}

function handleVolumeChange(value) {
    const volume = parseInt(value) / 1000;
    UI.volumeValue.textContent = `${value}%`;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setVolume(volume);
    }
}

function handleAttackChange(value) {
    const attack = parseInt(value) / 1000; 
    UI.attackValue.textContent = `${attack.toFixed(3)}s`;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setAttack(attack);
    }
}

function handleReleaseChange(value) {
    const release = parseInt(value) / 1000;
    UI.releaseValue.textContent = `${release.toFixed(3)}s`;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setRelease(release);
    }
}

function handleReverbChange(value) {
    const reverbAmount = parseInt(value);
    UI.reverbValue.textContent = `${value}%`;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setReverb(reverbAmount);
    }
}

function handleMainOscGainChange(value) {
    const gain = parseInt(value) / 100;
    UI.mainOscGainValue.textContent = `${value}%`;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setMainOscGain(gain);
        if (UI.arpMode.value === "0" && UI.holdMode.value === "1" && heldNotes) {
            heldNotes.forEach(cell => {
                audioEngines.get(currentInstance).stopNote(cell.x, cell.y);
            });
            heldNotes.forEach(cell => {
                audioEngines.get(currentInstance).playNote(cell.x, cell.y);
            });
        }
    }
}

function handleSubOscGainChange(value) {
    const gain = parseInt(value) / 100;
    UI.subOscGainValue.textContent = `${value}%`;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setSubOscGain(gain);
        if (UI.arpMode.value === "0" && UI.holdMode.value === "1" && heldNotes) {
            heldNotes.forEach(cell => {
                audioEngines.get(currentInstance).stopNote(cell.x, cell.y);
            });
            heldNotes.forEach(cell => {
                audioEngines.get(currentInstance).playNote(cell.x, cell.y);
            });
        }
    }
}

function handleScaleChange(value) {
    const index = parseInt(value);
    const scaleName = SCALES[index];
    UI.scaleValue.textContent = scaleName.charAt(0).toUpperCase() + scaleName.slice(1);
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).changeScale(scaleName);
    }
}

function handleMainOscTypeChange(value) {
    const type = WAVE_TYPES[value];
    UI.mainOscTypeValue.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setMainOscType(type);
    }
}

function handleSubOscTypeChange(value) {
    const type = WAVE_TYPES[value];
    UI.subOscTypeValue.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setSubOscType(type);
    }
}

function handleGlideChange(value) {
    const glideTime = parseInt(value);
    UI.glideValue.textContent = `${value}ms`;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setGlideTime(glideTime);
    }
}

function handleMainOscOctaveChange(value) {
    const octave = parseInt(value);
    UI.mainOscOctaveValue.textContent = octave;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setMainOscOctave(octave);
    }
}

function handleSubOscOctaveChange(value) {
    const octave = parseInt(value);
    UI.subOscOctaveValue.textContent = octave;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setSubOscOctave(octave);
    }
}

function handleExpandModeChange(value) {
    const isEnabled = parseInt(value) === 1;
    UI.expandModeValue.textContent = isEnabled ? 'On' : 'Off';
    UI.expandMode.dataset.state = isEnabled ? 'on' : 'off';
    
    if (handDetector) {
        if (!isEnabled) {
            handDetector.expandedCells.clear();
            
            if (audioEngines.get(currentInstance)) {
                if (UI.holdMode.value === "1" && heldNotes) {
                    heldNotes = heldNotes.filter(cell => !handDetector.expandedCells.has(`${cell.x},${cell.y}`));
                }
                
                const activeCells = handDetector.getActiveCells();
                const activeCellKeys = new Set(activeCells.map(cell => `${cell.x},${cell.y}`));
                
                [...handDetector.expandedCells].forEach(cellKey => {
                    if (!activeCellKeys.has(cellKey)) {
                        const [x, y] = cellKey.split(',').map(Number);
                        audioEngines.get(currentInstance).stopNote(x, y);
                    }
                });
                
                if (UI.arpMode.value === "1") {
                    if (UI.holdMode.value === "1" && heldNotes) {
                        audioEngines.get(currentInstance).playArpeggio(heldNotes);
                    } else {
                        audioEngines.get(currentInstance).playArpeggio(activeCells);
                    }
                }
            }
        }
    }
}

function handleHoldModeChange(value) {
    const isEnabled = parseInt(value) === 1;
    UI.holdModeValue.textContent = isEnabled ? 'On' : 'Off';
    UI.holdMode.dataset.state = isEnabled ? 'on' : 'off';
    
    if (isEnabled && handDetector) {
        const activeCells = handDetector.getActiveCells();
        heldNotes = [...activeCells]; 
        
        if (audioEngines.get(currentInstance) && UI.arpMode.value === "1" && heldNotes.length > 0) {
            audioEngines.get(currentInstance).playArpeggio(heldNotes);
        }
    } else {
        if (audioEngines.get(currentInstance)) {
            if (UI.arpMode.value === "1") {
                audioEngines.get(currentInstance).stopArpeggio();
            } else {
                heldNotes?.forEach(cell => {
                    audioEngines.get(currentInstance).stopNote(cell.x, cell.y);
                });
            }
        }
        heldNotes = null;
        
        const activeCells = handDetector.getActiveCells();
        if (audioEngines.get(currentInstance) && activeCells.length > 0) {
            if (UI.arpMode.value === "1") {
                audioEngines.get(currentInstance).playArpeggio(activeCells);
            } else {
                activeCells.forEach(cell => {
                    audioEngines.get(currentInstance).playNote(cell.x, cell.y);
                });
            }
        }
    }
}

function handleArpModeChange(value) {
    const isArpMode = parseInt(value) === 1;
    UI.arpModeValue.textContent = isArpMode ? 'On' : 'Off';
    UI.arpMode.dataset.state = isArpMode ? 'on' : 'off';
    
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).stopArpeggio();
        
        if (audioEngines.get(currentInstance).oscillators.size > 0) {
            const currentlyActive = Array.from(audioEngines.get(currentInstance).oscillators.keys());
            currentlyActive.forEach(key => {
                const [x, y] = key.split(',').map(Number);
                audioEngines.get(currentInstance).stopNote(x, y);
            });
        }

        audioEngines.get(currentInstance).oscillators.clear();
        
        audioEngines.get(currentInstance).activeNotes.clear();
        audioEngines.get(currentInstance).lastNotePlayed = null;

        setTimeout(() => {
            const activeCells = UI.holdMode.value === "1" && heldNotes ? 
                heldNotes : 
                handDetector.getActiveCells();

            if (activeCells && activeCells.length > 0) {
                if (isArpMode) {
                    audioEngines.get(currentInstance).playArpeggio(activeCells);
                } else {
                    activeCells.forEach(cell => {
                        audioEngines.get(currentInstance).playNote(cell.x, cell.y);
                    });
                }
            }
        }, 100); 
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

function createInstance(instanceId) {
    if (!audioEngines.has(instanceId)) {
        const engine = new AudioEngine(instanceId);
        audioEngines.set(instanceId, engine);

        engine.applySettings({
            volume: 10,
            bpm: 222,
            scale: 0,
            mainOscGain: 50,
            mainOscType: 0,
            mainOscOctave: 0,
            subOscGain: 20,
            subOscType: 0,
            subOscOctave: -2,
            attack: 2,
            filterCutoff: 2000,
            filterResonance: 0,
            glide: 0,
            delay: 30,
            delayFeedback: 75,
            reverb: 30
        });
        return engine;
    }
    return audioEngines.get(instanceId);
}

function switchToInstance(instanceId) {
    currentInstance = instanceId;
    const previousEngine = activeAudioEngine;
    
    activeAudioEngine = createInstance(instanceId);
    
    if (UI.holdMode && UI.holdMode.dataset.state === 'off' && previousEngine) {
        previousEngine.stopAllNotes();
    }

    if (handDetector) {
        handDetector.onResults = (results) => {
            if (results.multiHandLandmarks) {
                results.multiHandLandmarks.forEach(landmarks => {
                    handDetector.drawFingerDots(landmarks);
                });
                
                const activeCells = handDetector.getActiveCells();
                drawGrid(ctx, CANVAS_SIZE, CANVAS_SIZE, handDetector.gridSize, activeCells, handDetector, activeAudioEngine);
                
                if (activeAudioEngine) {
                    const newCells = new Set(activeCells.map(cell => `${cell.x},${cell.y}`));
                    
                    activeCells.forEach(cell => {
                        const key = `${cell.x},${cell.y}`;
                        if (!lastActiveCells.has(key)) {
                            activeAudioEngine.playNote(cell.x, cell.y);
                        }
                    });
                    
                    Array.from(lastActiveCells).forEach(key => {
                        if (!newCells.has(key)) {
                            const [x, y] = key.split(',').map(Number);
                            activeAudioEngine.stopNote(x, y);
                        }
                    });
                    
                    lastActiveCells = newCells;
                }
            }
        };
    }
}

document.getElementById('instanceSlider').addEventListener('input', async function() {
    const newInstanceId = parseInt(this.value);
    document.getElementById('instanceValue').textContent = newInstanceId;

    if (!AudioEngine.initializedLayers.has(newInstanceId)) {
        const presets = await loadPresets();
        const preset1Settings = presets["1"];
        
        const newEngine = createInstance(newInstanceId);
        newEngine.applySettings(preset1Settings);
        
        const presetSlider = document.getElementById('presetSlider');
        presetSlider.value = "1";
        document.getElementById('presetValue').textContent = "1";
        
        AudioEngine.initializedLayers.add(newInstanceId);
        AudioEngine.layerSettings.set(newInstanceId, preset1Settings);
    } else {

        const savedSettings = AudioEngine.layerSettings.get(newInstanceId);
        if (savedSettings) {
            const engine = createInstance(newInstanceId);
            engine.applySettings(savedSettings);
            
            if (savedSettings.preset) {
                const presetSlider = document.getElementById('presetSlider');
                presetSlider.value = savedSettings.preset.toString();
                document.getElementById('presetValue').textContent = savedSettings.preset.toString();
            }
        }
    }

    switchToInstance(newInstanceId);
});

document.getElementById('presetSlider').addEventListener('input', async function() {
    const preset = this.value;
    document.getElementById('presetValue').textContent = preset;

    const currentInstanceId = parseInt(document.getElementById('instanceSlider').value);
    const presets = await loadPresets();
    const presetSettings = presets[preset];

    presetSettings.preset = parseInt(preset);

    if (audioEngines.get(currentInstanceId)) {
        audioEngines.get(currentInstanceId).applySettings(presetSettings);
        AudioEngine.layerSettings.set(currentInstanceId, presetSettings);
    }
});


document.addEventListener('DOMContentLoaded', () => {
    //
    activeAudioEngine = createInstance(1);
});

async function initializeApp() {
    try {
        validateUIElements();

        UI.video.classList.remove('hidden');
        UI.controls.classList.remove('disabled');

        audioEngines.set(1, new AudioEngine());
        
        handDetector = new HandDetector(UI.video, UI.canvas);
        
        UI.bpmSlider.value = audioEngines.get(currentInstance).tempo;
        UI.bpmValue.textContent = audioEngines.get(currentInstance).tempo;
        
        UI.delaySlider.value = audioEngines.get(currentInstance).delayAmount * 100;
        UI.delayValue.textContent = `${UI.delaySlider.value}%`;
        
        UI.expandMode.dataset.state = 'off';
        UI.expandMode.value = "0";
        UI.expandModeValue.textContent = 'Off';
        
        UI.arpMode.dataset.state = 'on';  
        UI.arpMode.value = "1";  
        UI.arpModeValue.textContent = 'On'; 
        
        UI.holdMode.dataset.state = 'off';
        UI.holdMode.value = "0";
        UI.holdModeValue.textContent = 'Off';

        UI.scaleSelect.value = "0"; 
        handleScaleChange("0");  

        UI.arpMode.value = "1";  
        UI.arpMode.dataset.state = 'on';  
        UI.arpModeValue.textContent = 'On'; 
        
        UI.expandMode.value = "0";
        UI.expandModeValue.textContent = 'Off';
        UI.holdMode.value = "0";
        UI.holdModeValue.textContent = 'Off';

        UI.mainOscOctave.value = audioEngines.get(currentInstance).mainOscOctave;
        UI.mainOscOctaveValue.textContent = audioEngines.get(currentInstance).mainOscOctave;
        UI.subOscOctave.value = audioEngines.get(currentInstance).subOscOctave;
        UI.subOscOctaveValue.textContent = audioEngines.get(currentInstance).subOscOctave;

        UI.glideSlider.value = 0;
        UI.glideValue.textContent = '0ms';

        UI.pitchSlider.value = 0;
        UI.pitchValue.textContent = "0 st";
        UI.pitchSlider.addEventListener('input', (e) => handlePitchChange(e.target.value));

        UI.bpmSlider.addEventListener('input', (e) => handleBPMChange(e.target.value));
        UI.bpmSlider.addEventListener('change', (e) => handleBPMChange(e.target.value));
        
        UI.delaySlider.addEventListener('input', (e) => handleDelayChange(e.target.value));
        UI.delaySlider.addEventListener('change', (e) => handleDelayChange(e.target.value));

        UI.delayFeedbackSlider.addEventListener('input', (e) => handleDelayFeedbackChange(e.target.value));
        
        UI.expandMode.addEventListener('input', (e) => handleExpandModeChange(e.target.value));

        UI.holdMode.addEventListener('input', (e) => handleHoldModeChange(e.target.value));

        UI.arpMode.addEventListener('input', (e) => handleArpModeChange(e.target.value));

        UI.scaleSelect.addEventListener('change', (e) => {
            if (audioEngines.get(currentInstance)) {
                audioEngines.get(currentInstance).changeScale(e.target.value);
            }
        });

        UI.volumeSlider.addEventListener('input', (e) => handleVolumeChange(e.target.value));
        UI.attackSlider.addEventListener('input', (e) => handleAttackChange(e.target.value));
        UI.reverbSlider.addEventListener('input', (e) => handleReverbChange(e.target.value));
        UI.mainOscGainSlider.addEventListener('input', (e) => handleMainOscGainChange(e.target.value));
        UI.subOscGainSlider.addEventListener('input', (e) => handleSubOscGainChange(e.target.value));
        
        UI.mainOscType.addEventListener('change', (e) => handleMainOscTypeChange(e.target.value));
        UI.subOscType.addEventListener('change', (e) => handleSubOscTypeChange(e.target.value));
        
        UI.mainOscOctave.addEventListener('input', (e) => handleMainOscOctaveChange(e.target.value));
        UI.subOscOctave.addEventListener('input', (e) => handleSubOscOctaveChange(e.target.value));
        
        UI.glideSlider.addEventListener('input', (e) => handleGlideChange(e.target.value));
        
        UI.scaleSelect.addEventListener('input', e => handleScaleChange(e.target.value));
        UI.mainOscType.addEventListener('input', e => handleMainOscTypeChange(e.target.value));
        UI.subOscType.addEventListener('input', e => handleSubOscTypeChange(e.target.value));
        UI.expandMode.addEventListener('input', e => handleExpandModeChange(e.target.value));
        UI.arpMode.addEventListener('input', e => handleArpModeChange(e.target.value));
        UI.holdMode.addEventListener('input', e => handleHoldModeChange(e.target.value));

        handleScaleChange(UI.scaleSelect.value);
        handleMainOscTypeChange(UI.mainOscType.value);
        handleSubOscTypeChange(UI.subOscType.value);

        UI.filterCutoffSlider.addEventListener('input', (e) => handleFilterCutoffChange(e.target.value));
        UI.filterResonanceSlider.addEventListener('input', (e) => handleFilterResonanceChange(e.target.value));
        
        handleFilterCutoffChange(UI.filterCutoffSlider.value);
        handleFilterResonanceChange(UI.filterResonanceSlider.value);

        UI.gridSizeSlider.value = HandDetector.GRID_SIZE;
        UI.gridSizeValue.textContent = HandDetector.GRID_SIZE;
        
        UI.gridSizeSlider.addEventListener('input', (e) => handleGridSizeChange(e.target.value));

        handDetector.start((results) => {
            UI.canvas.width = UI.video.width = CANVAS_SIZE;
            UI.canvas.height = UI.video.height = CANVAS_SIZE;
            
            const canvasCtx = UI.canvas.getContext('2d');
            canvasCtx.save();
            
            canvasCtx.clearRect(0, 0, UI.canvas.width, UI.canvas.height);
            
            canvasCtx.scale(-1, 1);
            canvasCtx.translate(-UI.canvas.width, 0);
            
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
                                                                                                                                                                                                                        
            if (handDetector) {
                handDetector.activeCells.clear();
                
                if (results.multiHandLandmarks) {
                    results.multiHandLandmarks.forEach(landmarks => {
                        handDetector.drawFingerDots(landmarks);
                    });
                }
            }

            const activeCells = handDetector ? handDetector.getActiveCells() : [];
            
            let cellsToDraw = [];
            if (UI.holdMode.value === "1" && heldNotes) {
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
                audioEngines.get(currentInstance)  
            );
            
            if (UI.holdMode.value === "0") {
                const currentActiveCellsSet = new Set(activeCells.map(cell => `${cell.x},${cell.y}`));
                
                if (JSON.stringify([...currentActiveCellsSet]) !== JSON.stringify([...lastActiveCells])) {
                    if (currentActiveCellsSet.size === 0) {
                        if (audioEngines.get(currentInstance)) {
                            audioEngines.get(currentInstance).stopArpeggio();
                            Array.from(audioEngines.get(currentInstance).oscillators.keys()).forEach(key => {
                                const [x, y] = key.split(',').map(Number);
                                audioEngines.get(currentInstance).stopNote(x, y);
                            });
                            
                            audioEngines.get(currentInstance).oscillators.clear(); 
                        }
                    } else {
                        if (UI.arpMode.value === "0") {
                            [...lastActiveCells].forEach(cellKey => {
                                if (!currentActiveCellsSet.has(cellKey)) {
                                    const [x, y] = cellKey.split(',').map(Number);
                                    audioEngines.get(currentInstance).stopNote(x, y);
                                }
                            });

                            Array.from(audioEngines.get(currentInstance).oscillators.keys()).forEach(key => {
                                if (!currentActiveCellsSet.has(key)) {
                                    const [x, y] = key.split(',').map(Number);
                                    audioEngines.get(currentInstance).stopNote(x, y);
                                }
                            });

                            activeCells.forEach(cell => {
                                audioEngines.get(currentInstance).playNote(cell.x, cell.y);
                            });
                        } else if (UI.arpMode.value === "1") {
                            audioEngines.get(currentInstance).playArpeggio(activeCells);
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
        
        UI.masterSwitch.value = "0";
        UI.masterSwitchValue.textContent = 'Off';
        UI.controls.classList.add('disabled');
        UI.video.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    UI.canvas.width = UI.canvas.height = CANVAS_SIZE;
    
    const ctx = UI.canvas.getContext('2d');
    drawInitialState(ctx);
    
    UI.controls.classList.add('disabled');
    
    UI.masterSwitch.dataset.state = 'off';
    UI.masterSwitchValue.textContent = 'Off';
    
    UI.expandMode.dataset.state = 'off';
    UI.expandModeValue.textContent = 'Off';
    
    UI.arpMode.dataset.state = 'on';  
    UI.arpModeValue.textContent = 'On'; 
    UI.arpMode.value = "1";  
    
    UI.holdMode.dataset.state = 'off';
    UI.holdModeValue.textContent = 'Off';

    UI.masterSwitch.addEventListener('click', (e) => {
        const button = e.currentTarget;
        const newState = button.dataset.state === 'on' ? 'off' : 'on';
        button.dataset.state = newState;
        UI.masterSwitchValue.textContent = newState === 'on' ? 'On' : 'Off';
        
        if (newState === 'on') {
            initializeApp();        
        } else {
            shutdownSystem();
            
            if (UI.recordButton && UI.recordButton.getAttribute('data-state') === 'on') {
                UI.recordButton.click();
            }
        }
    });

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

    UI.presetSlider.addEventListener('input', async (e) => {
        const presetNumber = e.target.value;
        UI.presetValue.textContent = presetNumber;
        
        const presets = await loadPresets();
        if (presets && presets[presetNumber]) {
            applyPreset(presets[presetNumber]);
        }
    });

    UI.instanceSlider.addEventListener('input', (e) => {
        const instanceId = parseInt(e.target.value);
        UI.instanceValue.textContent = instanceId;
        switchToInstance(instanceId);
    });
});

if (UI.recordButton) {
    const recordButtonValue = document.getElementById('recordButtonValue');
    if (recordButtonValue) {
        recordButtonValue.textContent = 'Off';
    }
    
    UI.recordButton.addEventListener('click', () => {
        const isRecording = UI.recordButton.getAttribute('data-state') === 'on';
        const currentAudioEngine = audioEngines.get(currentInstance);
        
        if (!isRecording) {
            currentAudioEngine?.startRecording();
            UI.recordButton.setAttribute('data-state', 'on');
            if (recordButtonValue) {
                recordButtonValue.textContent = 'On';
            }
        } else {
            currentAudioEngine?.stopRecording();
            UI.recordButton.setAttribute('data-state', 'off');
            if (recordButtonValue) {
                recordButtonValue.textContent = 'Off';
            }
        }
    });
}

function handlePitchChange(value) {
    const cents = parseInt(value);
    const semitones = cents / 100;
    
    const displayText = Math.abs(cents) < 100 ? 
        `${cents} cents` : 
        `${semitones.toFixed(2)} st`;
    
    UI.pitchValue.textContent = displayText;
    
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setPitchShift(semitones);
    }
}

function handleFilterCutoffChange(value) {
    const frequency = Math.round(parseInt(value) / 50) * 50;
    const displayValue = frequency >= 1000 ? 
        `${(frequency/1000).toFixed(1)}kHz` : 
        `${frequency}Hz`;
    UI.filterCutoffValue.textContent = displayValue;
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setFilterCutoff(frequency);
    }
}

function handleFilterResonanceChange(value) {
    const resonance = parseInt(value);
    UI.filterResonanceValue.textContent = resonance.toFixed(1);
    if (audioEngines.get(currentInstance)) {
        audioEngines.get(currentInstance).setFilterResonance(resonance);
    }
}

async function loadPresets() {
    try {
        const response = await fetch('/src/presets.json');
        if (!response.ok) throw new Error('Failed to load presets');
        return await response.json();
    } catch (error) {
        console.error('Error loading presets:', error);
        return null;
    }
}

function applyPreset(preset) {
    if (!preset) return;

    const updateSlider = (slider, value) => {
        slider.value = value;
        const event = new Event('input');
        slider.dispatchEvent(event);
    };

    updateSlider(UI.volumeSlider, preset.volume);
    updateSlider(UI.bpmSlider, preset.bpm);
    updateSlider(UI.scaleSelect, preset.scale);
    updateSlider(UI.mainOscGainSlider, preset.mainOscGain);
    updateSlider(UI.mainOscType, preset.mainOscType);
    updateSlider(UI.mainOscOctave, preset.mainOscOctave);
    updateSlider(UI.subOscGainSlider, preset.subOscGain);
    updateSlider(UI.subOscType, preset.subOscType);
    updateSlider(UI.subOscOctave, preset.subOscOctave);
    updateSlider(UI.attackSlider, preset.attack);
    updateSlider(UI.filterCutoffSlider, preset.filterCutoff);
    updateSlider(UI.filterResonanceSlider, preset.filterResonance);
    updateSlider(UI.glideSlider, preset.glide);
    updateSlider(UI.pitchSlider, preset.pitch);
    updateSlider(UI.delaySlider, preset.delay);
    updateSlider(UI.delayFeedbackSlider, preset.delayFeedback);
    updateSlider(UI.reverbSlider, preset.reverb);
    updateSlider(UI.gridSizeSlider, preset.gridSize);
}

async function shutdownSystem() {
    try {
        if (audioEngines.get(currentInstance)) {
            audioEngines.get(currentInstance).stopArpeggio();
            if (heldNotes) {
                heldNotes?.forEach(cell => {
                    audioEngines.get(currentInstance).stopNote(cell.x, cell.y);
                });
            }
            if (handDetector) {
                handDetector.getActiveCells().forEach(cell => {
                    audioEngines.get(currentInstance).stopNote(cell.x, cell.y);
                });
            }
            audioEngines.get(currentInstance) = null;
        }

        if (handDetector) {
            await handDetector.stop();
            handDetector = null;
        }
        
        UI.video.classList.add('hidden');
        
        UI.controls.classList.add('disabled');
        
        const ctx = UI.canvas.getContext('2d');
        clearOpacities();
        drawInitialState(ctx);
        
        lastActiveCells = new Set();
        heldNotes = null;
    } catch (error) {
        console.warn('Non-critical error during shutdown:', error);
    }
}

function drawInitialState(ctx) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    ctx.fillStyle = '#888';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
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

function handleGridSizeChange(value) {
    const size = parseInt(value);
    UI.gridSizeValue.textContent = size;
    
    HandDetector.GRID_SIZE = size;  
    if (handDetector) {
        handDetector.setGridSize(size);
        
        if (audioEngines.get(currentInstance)) {
            audioEngines.get(currentInstance).stopArpeggio();
            if (heldNotes) {
                heldNotes.forEach(cell => {
                    audioEngines.get(currentInstance).stopNote(cell.x, cell.y);
                });
            }
            handDetector.getActiveCells().forEach(cell => {
                audioEngines.get(currentInstance).stopNote(cell.x, cell.y);
            });
            
            heldNotes = null;
            lastActiveCells = new Set();
            
            audioEngines.get(currentInstance).setupScales(size);
        }
    }
    
    const ctx = UI.canvas.getContext('2d');
    ctx.clearRect(0, 0, UI.canvas.width, UI.canvas.height);
    drawGrid(ctx, CANVAS_SIZE, CANVAS_SIZE, size, []);
}

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