import { HandDetector } from './fingers.js';
import { AudioEngine } from './audio.js';
import { drawGrid, clearOpacities } from './grid.js';

const CANVAS_SIZE = Math.min(640, 480);
const SCALES = ['pentatonic', 'major', 'minor', 'harmonicMinor', 'blues'];
const WAVE_TYPES = ['sine', 'square', 'sawtooth', 'triangle'];

// Mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
    gridSizeValue: document.getElementById('gridSizeValue'),
    presetSlider: document.getElementById('presetSlider'),
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
let isSystemActive = false;

// Mobile-specific functions
function addMobileEventListeners(element, handler) {
    if (isMobile) {
        element.addEventListener('touchstart', handler, { passive: false });
        element.addEventListener('touchend', handler, { passive: false });
    }
    element.addEventListener('click', handler);
}

function preventMobileScroll(e) {
    if (isMobile) {
        e.preventDefault();
    }
}

// Audio context mobile initialization
async function initializeAudioContext() {
    if (isMobile) {
        // Mobile browsers require user interaction to start audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const tempContext = new AudioContext();
            if (tempContext.state === 'suspended') {
                try {
                    await tempContext.resume();
                    await tempContext.close();
                } catch (e) {
                    console.warn('Audio context resume failed:', e);
                }
            }
        }
    }
}
// Add this to your main.js file - replace the current requestCameraPermission function

async function requestCameraPermission() {
    console.log('Requesting camera permission...');
    
    // Enhanced HTTPS check with specific guidance
    const isSecure = location.protocol === 'https:' || 
                    location.hostname === 'localhost' || 
                    location.hostname === '127.0.0.1';
    
    if (!isSecure && isMobile) {
        const currentUrl = location.href;
        const httpsUrl = currentUrl.replace('http://', 'https://');
        
        const errorMsg = `
            <h3>HTTPS Required</h3>
            <p>Mobile browsers require HTTPS for camera access.</p>
            <p><strong>Current URL:</strong> ${currentUrl}</p>
            <p><strong>Solutions:</strong></p>
            <ol style="text-align: left; margin: 10px 0;">
                <li>Try accessing: <a href="${httpsUrl}" style="color: #fff; text-decoration: underline;">${httpsUrl}</a></li>
                <li>If deployed on GCP, enable HTTPS in your configuration</li>
                <li>For local development, use <code>https://localhost:3000</code></li>
            </ol>
            <button onclick="window.location.href='${httpsUrl}'" style="margin: 10px; padding: 15px 25px; font-size: 16px; background: #fff; color: #ff4444; border: none; border-radius: 5px;">
                Try HTTPS Version
            </button>
        `;
        
        if (window.showMobileError) {
            // Use the enhanced error display
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #ff4444;
                color: white;
                padding: 25px;
                border-radius: 10px;
                z-index: 10000;
                text-align: center;
                max-width: 90%;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                font-size: 16px;
                line-height: 1.4;
            `;
            errorDiv.innerHTML = errorMsg;
            document.body.appendChild(errorDiv);
        } else {
            alert('Camera requires HTTPS on mobile. Try accessing: ' + httpsUrl);
        }
        
        throw new Error('HTTPS required for camera access on mobile devices');
    }
    
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.');
    }
    
    try {
        // Rest of your existing camera permission logic...
        // (keep all the existing code from the current requestCameraPermission function)
        
        // First, check existing permissions
        if (navigator.permissions) {
            try {
                const permission = await navigator.permissions.query({ name: 'camera' });
                console.log('Camera permission status:', permission.state);
                
                if (permission.state === 'denied') {
                    throw new Error('Camera access was previously denied. Please enable camera access in your browser settings and refresh the page.');
                }
            } catch (permError) {
                console.warn('Permission query failed:', permError);
            }
        }
        
        // Try different constraint configurations for mobile compatibility
        const constraintSets = [
            { video: { facingMode: 'user' } },
            { video: { facingMode: 'user', width: 480, height: 480 } },
            { video: { facingMode: 'user', width: { ideal: 480, max: 640 }, height: { ideal: 480, max: 640 } } }
        ];
        
        let stream = null;
        let lastError = null;
        
        for (let i = 0; i < constraintSets.length; i++) {
            try {
                console.log(`Trying constraint set ${i + 1}:`, constraintSets[i]);
                stream = await navigator.mediaDevices.getUserMedia(constraintSets[i]);
                console.log('Camera access granted with constraint set', i + 1);
                break;
            } catch (error) {
                console.warn(`Constraint set ${i + 1} failed:`, error);
                lastError = error;
                
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    throw error;
                }
                continue;
            }
        }
        
        if (!stream) {
            throw lastError || new Error('Failed to access camera with any constraint set');
        }
        
        // Test that we actually got video
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length === 0) {
            stream.getTracks().forEach(track => track.stop());
            throw new Error('No video track found in camera stream');
        }
        
        console.log('Camera stream obtained successfully');
        
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
        
        return true;
        
    } catch (error) {
        console.error('Camera permission request failed:', error);
        
        // Provide specific error messages
        let userMessage = 'Camera access failed. ';
        
        switch (error.name) {
            case 'NotAllowedError':
            case 'PermissionDeniedError':
                userMessage += 'Please allow camera access when prompted. You may need to:\n\n1. Refresh the page and allow when prompted\n2. Check browser settings for camera permissions\n3. Ensure no other apps are using the camera';
                break;
            case 'NotFoundError':
                userMessage += 'No camera found on this device.';
                break;
            case 'NotSupportedError':
                userMessage += 'Camera access is not supported in this browser. Try Chrome or Safari.';
                break;
            case 'NotReadableError':
                userMessage += 'Camera is being used by another app. Please close other camera apps and try again.';
                break;
            case 'SecurityError':
                userMessage += 'Camera blocked due to security restrictions. Make sure you\'re using HTTPS.';
                break;
            default:
                userMessage += error.message || 'Unknown error occurred.';
        }
        
        if (window.showMobileError) {
            window.showMobileError(userMessage);
        } else {
            alert(userMessage);
        }
        
        return false;
    }
}

// All your existing handler functions remain the same
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
        
        const activeCells = handDetector ? handDetector.getActiveCells() : [];
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
                handDetector ? handDetector.getActiveCells() : [];

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
}

async function initializeApp() {
    try {
        // Initialize audio context first on mobile
        await initializeAudioContext();
        
        // Request camera permission
        const hasCamera = await requestCameraPermission();
        if (!hasCamera) {
            throw new Error('Camera access denied');
        }
        
        validateUIElements();

        UI.video.classList.remove('hidden');
        UI.controls.classList.remove('disabled');

        audioEngines.set(1, new AudioEngine());
        activeAudioEngine = audioEngines.get(1);
        
        handDetector = new HandDetector(UI.video, UI.canvas);
        
        // Initialize UI values
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

        UI.mainOscOctave.value = audioEngines.get(currentInstance).mainOscOctave;
        UI.mainOscOctaveValue.textContent = audioEngines.get(currentInstance).mainOscOctave;
        UI.subOscOctave.value = audioEngines.get(currentInstance).subOscOctave;
        UI.subOscOctaveValue.textContent = audioEngines.get(currentInstance).subOscOctave;

        UI.glideSlider.value = 0;
        UI.glideValue.textContent = '0ms';

        UI.pitchSlider.value = 0;
        UI.pitchValue.textContent = "0 st";

        // Add event listeners with mobile support
        setupEventListeners();
        
        await handDetector.start((results) => {
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
            
            // Handle note playing logic
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
        
        isSystemActive = true;
        
    } catch (error) {
        console.error('Error initializing app:', error);
        
        // Show mobile-friendly error
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff4444;
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 1000;
            text-align: center;
            max-width: 80%;
            font-size: ${isMobile ? '18px' : '14px'};
        `;
        errorDiv.innerHTML = `
            <h3>Initialization Failed</h3>
            <p>${error.message}</p>
            <p>Please check camera permissions and try again</p>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 15px 25px; font-size: 16px;">Refresh</button>
        `;
        document.body.appendChild(errorDiv);
        
        UI.masterSwitch.value = "0";
        UI.masterSwitchValue.textContent = 'Off';
        UI.masterSwitch.dataset.state = 'off';
        UI.controls.classList.add('disabled');
        UI.video.classList.add('hidden');
    }
}

function setupEventListeners() {
    // Use mobile-compatible event handlers for all interactive elements
    
    UI.bpmSlider.addEventListener('input', (e) => handleBPMChange(e.target.value));
    UI.bpmSlider.addEventListener('change', (e) => handleBPMChange(e.target.value));
    
    UI.delaySlider.addEventListener('input', (e) => handleDelayChange(e.target.value));
    UI.delaySlider.addEventListener('change', (e) => handleDelayChange(e.target.value));

    UI.delayFeedbackSlider.addEventListener('input', (e) => handleDelayFeedbackChange(e.target.value));
    
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
    
    UI.scaleSelect.addEventListener('change', (e) => {
        if (audioEngines.get(currentInstance)) {
            audioEngines.get(currentInstance).changeScale(e.target.value);
        }
    });
    
    UI.scaleSelect.addEventListener('input', e => handleScaleChange(e.target.value));
    UI.mainOscType.addEventListener('input', e => handleMainOscTypeChange(e.target.value));
    UI.subOscType.addEventListener('input', e => handleSubOscTypeChange(e.target.value));

    UI.filterCutoffSlider.addEventListener('input', (e) => handleFilterCutoffChange(e.target.value));
    UI.filterResonanceSlider.addEventListener('input', (e) => handleFilterResonanceChange(e.target.value));
    
    handleFilterCutoffChange(UI.filterCutoffSlider.value);
    handleFilterResonanceChange(UI.filterResonanceSlider.value);

    UI.gridSizeSlider.value = HandDetector.GRID_SIZE;
    UI.gridSizeValue.textContent = HandDetector.GRID_SIZE;
    
    UI.gridSizeSlider.addEventListener('input', (e) => handleGridSizeChange(e.target.value));
    
    UI.pitchSlider.addEventListener('input', (e) => handlePitchChange(e.target.value));
}

document.addEventListener('DOMContentLoaded', () => {
    // Mobile-specific setup
    if (isMobile) {
        document.body.style.touchAction = 'none';
        document.body.style.overflow = 'hidden';
        
        // Prevent zoom on double-tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function (event) {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // Improve text rendering on mobile
        const canvas = UI.canvas;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.style.width = CANVAS_SIZE + 'px';
        canvas.style.height = CANVAS_SIZE + 'px';
        canvas.width = CANVAS_SIZE * dpr;
        canvas.height = CANVAS_SIZE * dpr;
        ctx.scale(dpr, dpr);
    }
    
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

    // Master switch handler with mobile support
    addMobileEventListeners(UI.masterSwitch, async (e) => {
        e.preventDefault();
        preventMobileScroll(e);
        
        const button = e.currentTarget;
        const currentState = button.dataset.state;
        
        if (currentState === 'on') {
            // Turn off
            button.dataset.state = 'off';
            UI.masterSwitchValue.textContent = 'Off';
            shutdownSystem();
            
            if (UI.recordButton && UI.recordButton.getAttribute('data-state') === 'on') {
                UI.recordButton.click();
            }
        } else {
            // Turn on - requires user interaction for audio/camera
            button.dataset.state = 'on';
            UI.masterSwitchValue.textContent = 'On';
            
            // Show loading state
            const originalText = UI.masterSwitchValue.textContent;
            UI.masterSwitchValue.textContent = 'Loading...';
            
            try {
                await initializeApp();
            } catch (error) {
                button.dataset.state = 'off';
                UI.masterSwitchValue.textContent = 'Off';
                console.error('Failed to initialize:', error);
            }
        }
    });

    // Mode switches with mobile support
    addMobileEventListeners(UI.expandMode, (e) => {
        if (UI.masterSwitch.dataset.state !== 'on') return;
        e.preventDefault();
        preventMobileScroll(e);
        
        const button = e.currentTarget;
        const newState = button.dataset.state === 'on' ? 'off' : 'on';
        button.dataset.state = newState;
        UI.expandMode.value = newState === 'on' ? '1' : '0';
        handleExpandModeChange(newState === 'on' ? '1' : '0');
    });

    addMobileEventListeners(UI.arpMode, (e) => {
        if (UI.masterSwitch.dataset.state !== 'on') return;
        e.preventDefault();
        preventMobileScroll(e);
        
        const button = e.currentTarget;
        const newState = button.dataset.state === 'on' ? 'off' : 'on';
        button.dataset.state = newState;
        UI.arpMode.value = newState === 'on' ? '1' : '0';
        handleArpModeChange(newState === 'on' ? '1' : '0');
    });

    addMobileEventListeners(UI.holdMode, (e) => {
        if (UI.masterSwitch.dataset.state !== 'on') return;
        e.preventDefault();
        preventMobileScroll(e);
        
        const button = e.currentTarget;
        const newState = button.dataset.state === 'on' ? 'off' : 'on';
        button.dataset.state = newState;
        UI.holdMode.value = newState === 'on' ? '1' : '0';
        handleHoldModeChange(newState === 'on' ? '1' : '0');
    });

    // Preset and instance handlers
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
    
    // Record button with mobile support
    if (UI.recordButton) {
        const recordButtonValue = document.getElementById('recordButtonValue');
        if (recordButtonValue) {
            recordButtonValue.textContent = 'Off';
        }
        
        addMobileEventListeners(UI.recordButton, (e) => {
            e.preventDefault();
            preventMobileScroll(e);
            
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
});

// Additional mobile-specific handlers
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
        isSystemActive = false;
    } catch (error) {
        console.warn('Non-critical error during shutdown:', error);
    }
}

function drawInitialState(ctx) {
    // Clear canvas
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    // Mobile-optimized text rendering
    ctx.fillStyle = '#888';
    ctx.font = isMobile ? '20px Arial, sans-serif' : '16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = ['turn power on', 'and wave your', 'fingers around'];
    const lineHeight = isMobile ? 35 : 30;
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