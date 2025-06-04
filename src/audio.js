import { HandDetector } from './fingers.js';

export class AudioEngine {
  // Add scales configuration
  static SCALES = {
    pentatonic: {
      name: 'Pentatonic',
      ratios: [1, 1.2, 1.3333, 1.5, 1.8], // A, C, D, E, G
    },
    major: {
      name: 'Major',
      ratios: [1, 1.125, 1.25, 1.3333, 1.5, 1.6667, 1.875], // C, D, E, F, G, A, B
    },
    minor: {
      name: 'Natural Minor',
      ratios: [1, 1.125, 1.2, 1.3333, 1.5, 1.6, 1.75], // C, D, Eb, F, G, Ab, Bb
    },
    harmonicMinor: {
      name: 'Harmonic Minor',
      ratios: [1, 1.125, 1.2, 1.3333, 1.5, 1.6, 1.875], // C, D, Eb, F, G, Ab, B
    },
    blues: {
      name: 'Blues',
      ratios: [1, 1.2, 1.25, 1.333, 1.5, 1.6], // C, Eb, E, F, G, A
    }
  };

  constructor() {
    // Initialize Web Audio API
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Resume audio context (needed for browsers)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Initialize scale
    this.currentScale = 'pentatonic';
    
    // Filter parameters
    this.filterCutoff = 2000; // Changed from 20000
    this.filterResonance = 0;
    
    // Sequencer state
    this.isPlaying = true;
    this.currentStep = 0;
    this.tempo = 222;
    this.stepInterval = (60 / this.tempo) * 1000 / 2;
    this.nextStepTime = this.audioContext.currentTime;
    this.activeNotes = new Set();
    this.scheduleAhead = 0.1;
    this.delayAmount = 0.3;
    
    // Envelope parameters
    this.attack = 0.002;
    this.release = 0.05;
    
    // Oscillator gain
    this.mainOscGain = 0.1; // Changed from 0.5 (10% volume)
    this.subOscGain = 0.2;
    
    // Oscillator types and octaves
    this.mainOscType = 'sine';
    this.subOscType = 'sine'; // Changed from triangle
    this.mainOscOctave = 0;
    this.subOscOctave = -2; // Changed from -1
    
    // Glide time
    this.glideTime = 0;
    
    // Add portamento state
    this.isPortamento = false;
    this.lastFrequency = null;
    
    // Pitch shift property
    this.pitchShift = 0;
    
    // Initialize audio components
    this.setupEffects();
    this.setupScales();
    this.setupOscillators();
    
    // Start master sequencer
    this.scheduler();
  }

  setupEffects() {
    // Create main gain node
    this.mainGainNode = this.audioContext.createGain();
    this.mainGainNode.gain.value = 0.1; // Changed from 0.5 to match 10% volume

    // Create filter
    this.filter = this.audioContext.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.filterCutoff; // Now 2.0kHz from constructor
    this.filter.Q.value = this.filterResonance;

    // Create ping pong delay components
    this.leftDelay = this.audioContext.createDelay();
    this.rightDelay = this.audioContext.createDelay();
    this.leftGain = this.audioContext.createGain();
    this.rightGain = this.audioContext.createGain();
    this.feedbackGainLeft = this.audioContext.createGain();
    this.feedbackGainRight = this.audioContext.createGain();
    this.feedbackGainLeft.gain.value = 0.75; // Changed from 0.4
    this.feedbackGainRight.gain.value = 0.75; // Changed from 0.4

    // Set initial delay times and gains
    this.leftDelay.delayTime.value = 0.3;
    this.rightDelay.delayTime.value = 0.4;
    this.leftGain.gain.value = 0.3; // 30% delay mix
    this.rightGain.gain.value = 0.3; // 30% delay mix
    
    // Create stereo panner for ping pong effect
    this.leftPanner = this.audioContext.createStereoPanner();
    this.rightPanner = this.audioContext.createStereoPanner();
    this.leftPanner.pan.value = -1;
    this.rightPanner.pan.value = 1;

    // Create reverb components
    this.reverbNode = this.audioContext.createConvolver();
    this.createReverb(2.5);
    this.dryGain = this.audioContext.createGain();
    this.wetGain = this.audioContext.createGain();
    this.dryGain.gain.value = Math.sqrt(0.7); // 70% dry for 30% wet
    this.wetGain.gain.value = Math.sqrt(0.3) * 5; // 30% wet with compensation

    // Create compressor for dynamic range control
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    // Connect nodes in the proper order:
    // 1. Filter stage
    this.filter.connect(this.dryGain);
    this.filter.connect(this.leftDelay);
    this.filter.connect(this.rightDelay);

    // 2. Delay stage with feedback
    this.leftDelay.connect(this.leftGain);
    this.rightDelay.connect(this.rightGain);
    this.leftGain.connect(this.leftPanner);
    this.rightGain.connect(this.rightPanner);
    
    // Set up cross-feedback for ping-pong effect
    this.leftPanner.connect(this.feedbackGainRight);
    this.rightPanner.connect(this.feedbackGainLeft);
    this.feedbackGainRight.connect(this.rightDelay);
    this.feedbackGainLeft.connect(this.leftDelay);
    
    // 3. Connect delay outputs to both dry and wet paths
    this.leftPanner.connect(this.dryGain);
    this.leftPanner.connect(this.reverbNode);
    this.rightPanner.connect(this.dryGain);
    this.rightPanner.connect(this.reverbNode);
    
    // 4. Final output stage
    this.dryGain.connect(this.mainGainNode);
    this.reverbNode.connect(this.wetGain);
    this.wetGain.connect(this.mainGainNode);
    this.mainGainNode.connect(this.compressor);
    this.compressor.connect(this.audioContext.destination);
}

  async createReverb(duration) {
    // Ensure minimum duration of 0.1 seconds
    const minDuration = 0.1;
    duration = Math.max(minDuration, duration);
    
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i / length;
        // Decay curve
        const amplitude = Math.pow(1 - n, 2) * Math.random() * 0.5;
        left[i] = amplitude * (Math.random() * 2 - 1);
        right[i] = amplitude * (Math.random() * 2 - 1);
    }

    this.reverbNode.buffer = impulse;
  }

  setupScales() {
    const baseFrequency = 220.00; // A3 as base frequency
    this.frequencies = [];
    const scale = AudioEngine.SCALES[this.currentScale];
    
    for (let y = 0; y < HandDetector.GRID_SIZE; y++) {
      for (let x = 0; x < HandDetector.GRID_SIZE; x++) {
        // More musical octave distribution
        const octave = Math.floor(y / 3); // 3 rows per octave for smoother progression
        const noteIndex = x % scale.ratios.length;
        
        // Remove detuning for cleaner sound
        const frequency = baseFrequency * 
                         scale.ratios[noteIndex] * 
                         Math.pow(2, octave);
        
        this.frequencies.push({ 
            x, 
            y: HandDetector.GRID_SIZE - 1 - y, 
            frequency 
        });
      }
    }
  }

  changeScale(scaleName) {
    if (AudioEngine.SCALES[scaleName]) {
        this.currentScale = scaleName;
        this.setupScales();
        // Update currently playing notes if any
        if (this.activeNotes.size > 0) {
            const activeNotes = Array.from(this.activeNotes);
            this.stopArpeggio();
            this.playArpeggio(activeNotes.map(note => {
                const [x, y] = note.split(',').map(Number);
                return { x, y };
            }));
        }
    }
  }

  setupOscillators() {
    this.oscillators = new Map();
  }
  playNote(x, y) {
        const key = `${x},${y}`;
        if (this.oscillators.has(key)) {
            return; // Note already playing
        }

        const noteData = this.frequencies.find(n => n.x === x && n.y === y);
        if (!noteData) return;

        const now = this.audioContext.currentTime;
        // Schedule note start with no release time for sustained playback
        this.scheduleNoteOn({ x, y }, now);
    }

    // Add a method to stop specific note
    stopNote(x, y) {
        const key = `${x},${y}`;
        const sound = this.oscillators.get(key);
        if (!sound) return;

        const now = this.audioContext.currentTime;
        
        // Smooth release
        sound.noteGain.gain.cancelScheduledValues(now);
        sound.noteGain.gain.setValueAtTime(sound.noteGain.gain.value, now);
        sound.noteGain.gain.exponentialRampToValueAtTime(0.001, now + this.release);

        // Clean up oscillators after release
        setTimeout(() => {
            this.cleanupOscillators(key);
        }, this.release * 1000 + 100);
    }

    // Add cleanup helper method
    cleanupOscillators(key) {
        const sound = this.oscillators.get(key);
        if (!sound) return;

        sound.oscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {
                // Ignore errors if oscillator is already stopped
            }
        });

        sound.gainNodes.forEach(gain => gain.disconnect());
        sound.noteGain.disconnect();
        
        if (sound.delaySend) {
            sound.delaySend.disconnect();
        }
        this.oscillators.delete(key);
    }

  scheduler() {
    // Look ahead and schedule notes
    while (this.nextStepTime < this.audioContext.currentTime + this.scheduleAhead) {
      if (this.activeNotes.size > 0) {
        this.scheduleNextNote(this.currentStep, this.nextStepTime);
      }
      this.nextStep();
    }
    
    // Call scheduler again
    requestAnimationFrame(() => this.scheduler());
  }

  scheduleNextNote(step, time) {
    const notes = Array.from(this.activeNotes);
    const noteToPlay = notes[step % notes.length];
    
    if (this.glideTime > 0) {
        if (!this.arpOscillators) {
            this.startArpOscillators(time);
        }
        
        if (noteToPlay) {
            const [x, y] = noteToPlay.split(',').map(Number);
            const noteData = this.frequencies.find(n => n.x === x && n.y === y);
            if (noteData) {
                // Apply pitch shift to base frequency calculations
                const pitchShiftMultiplier = Math.pow(2, this.pitchShift / 12);
                const mainFreq = noteData.frequency * Math.pow(2, this.mainOscOctave) * pitchShiftMultiplier;
                const subFreq = noteData.frequency * Math.pow(2, this.subOscOctave) * pitchShiftMultiplier;
                
                if (this.isPortamento) {
                    // Continuous slide for portamento
                    this.arpOscillators.mainOsc.frequency.exponentialRampToValueAtTime(
                        mainFreq,
                        time + this.glideTime
                    );
                    this.arpOscillators.subOsc.frequency.exponentialRampToValueAtTime(
                        subFreq,
                        time + this.glideTime
                    );
                } else {
                    // Two-step transition for glissando
                    this.arpOscillators.mainOsc.frequency.setValueAtTime(
                        this.arpOscillators.mainOsc.frequency.value,
                        time
                    );
                    this.arpOscillators.mainOsc.frequency.linearRampToValueAtTime(
                        mainFreq,
                        time + this.glideTime
                    );
                    
                    this.arpOscillators.subOsc.frequency.setValueAtTime(
                        this.arpOscillators.subOsc.frequency.value,
                        time
                    );
                    this.arpOscillators.subOsc.frequency.linearRampToValueAtTime(
                        subFreq,
                        time + this.glideTime
                    );
                }
            }
        }
    } else {
        // Normal arpeggiator behavior without glide
        if (this.lastNotePlayed) {
            const [prevX, prevY] = this.lastNotePlayed.split(',').map(Number);
            this.scheduleNoteOff({ x: prevX, y: prevY }, time);
        }

        if (noteToPlay) {
            const [x, y] = noteToPlay.split(',').map(Number);
            const noteDuration = (60 / this.tempo) * 0.9;
            this.scheduleNoteOn({ x, y }, time, time + noteDuration);
            this.lastNotePlayed = noteToPlay;
        }
    }
}

// Update setPitchShift to affect both arpeggiator and normal notes
setPitchShift(semitones, smooth = false) {
    this.pitchShift = semitones;
    const now = this.audioContext.currentTime;
    const transitionTime = smooth ? 0.03 : 0;

    // Helper function to calculate pitched frequency
    const getPitchedFrequency = (baseFreq) => baseFreq * Math.pow(2, this.pitchShift / 12);

    // Update currently playing oscillators
    this.oscillators.forEach((sound, key) => {
        const [x, y] = key.split(',').map(Number);
        const noteData = this.frequencies.find(n => n.x === x && n.y === y);
        if (noteData) {
            // Calculate base frequencies with octave
            const mainBaseFreq = noteData.frequency * Math.pow(2, this.mainOscOctave);
            const subBaseFreq = noteData.frequency * Math.pow(2, this.subOscOctave);
            
            // Apply pitch shift
            const mainFreq = getPitchedFrequency(mainBaseFreq);
            const subFreq = getPitchedFrequency(subBaseFreq);
            
            // Smooth transition for all active oscillators
            sound.oscillators[0].frequency.exponentialRampToValueAtTime(mainFreq, now + transitionTime);
            sound.oscillators[1].frequency.exponentialRampToValueAtTime(subFreq, now + transitionTime);
        }
    });

    // Update arpeggiator oscillators if they exist
    if (this.arpOscillators && this.arpOscillators.mainOsc) {
        const activeNote = Array.from(this.activeNotes)[0];
        if (activeNote) {
            const [x, y] = activeNote.split(',').map(Number);
            const noteData = this.frequencies.find(n => n.x === x && n.y === y);
            if (noteData) {
                // Calculate base frequencies with octave and pitch shift
                const mainBaseFreq = noteData.frequency * Math.pow(2, this.mainOscOctave);
                const subBaseFreq = noteData.frequency * Math.pow(2, this.subOscOctave);
                const mainFreq = getPitchedFrequency(mainBaseFreq);
                const subFreq = getPitchedFrequency(subBaseFreq);
                
                // Smooth transition for arpeggiator oscillators
                this.arpOscillators.mainOsc.frequency.exponentialRampToValueAtTime(mainFreq, now + transitionTime);
                this.arpOscillators.subOsc.frequency.exponentialRampToValueAtTime(subFreq, now + transitionTime);
            }
        }
    }
}

  startArpOscillators(time) {
    // Create sustained oscillators for gliding arpeggiator
    this.arpOscillators = {
        mainOsc: this.audioContext.createOscillator(),
        subOsc: this.audioContext.createOscillator(),
        mainGain: this.audioContext.createGain(),
        subGain: this.audioContext.createGain(),
        noteGain: this.audioContext.createGain()
    };

    const { mainOsc, subOsc, mainGain, subGain, noteGain } = this.arpOscillators;

    // Set initial properties
    mainOsc.type = this.mainOscType;
    subOsc.type = this.subOscType;
    mainGain.gain.value = this.mainOscGain;
    subGain.gain.value = this.subOscGain;
    noteGain.gain.value = 0.7;

    // Connect oscillators through gain nodes
    mainOsc.connect(mainGain);
    subOsc.connect(subGain);
    mainGain.connect(noteGain);
    subGain.connect(noteGain);

    // Effects routing
    const dryGain = this.audioContext.createGain();
    const wetGain = this.audioContext.createGain();
    dryGain.gain.value = 0.7;
    wetGain.gain.value = 0.3;

    noteGain.connect(dryGain);
    noteGain.connect(wetGain);
    dryGain.connect(this.mainGainNode);
    wetGain.connect(this.reverbNode);

    // Add delay send
    const delaySend = this.audioContext.createGain();
    delaySend.gain.value = this.delayAmount;
    noteGain.connect(delaySend);
    delaySend.connect(this.leftDelay);
    delaySend.connect(this.rightDelay);

    // Start oscillators
    mainOsc.start(time);
    subOsc.start(time);
  }

  scheduleNoteOn(cell, time, releaseTime) {
    const key = `${cell.x},${cell.y}`;
    const noteData = this.frequencies.find(n => n.x === cell.x && n.y === cell.y);
    if (!noteData) return;

    // Create oscillators and initial gain nodes
    const mainOsc = this.audioContext.createOscillator();
    const subOsc = this.audioContext.createOscillator();
    const mainGain = this.audioContext.createGain();
    const subGain = this.audioContext.createGain();
    const noteGain = this.audioContext.createGain();

    const oscillators = [];
    const gainNodes = [];

    // Calculate frequencies with pitch shift
    const pitchShiftMultiplier = Math.pow(2, this.pitchShift / 12);
    const mainFreq = noteData.frequency * Math.pow(2, this.mainOscOctave) * pitchShiftMultiplier;
    const subFreq = noteData.frequency * Math.pow(2, this.subOscOctave) * pitchShiftMultiplier;

    // Set oscillator types
    mainOsc.type = this.mainOscType;
    subOsc.type = this.subOscType;

    // Apply glide if needed
    if (this.glideTime > 0 && this.oscillators.size > 0) {
        const glideEndTime = time + (this.glideTime / 1000); // Convert glideTime to seconds
        if (this.isPortamento) {
            mainOsc.frequency.exponentialRampToValueAtTime(mainFreq, glideEndTime);
            subOsc.frequency.exponentialRampToValueAtTime(subFreq, glideEndTime);
        } else {
            mainOsc.frequency.setValueAtTime(mainOsc.frequency.value || mainFreq, time);
            mainOsc.frequency.linearRampToValueAtTime(mainFreq, glideEndTime);
            subOsc.frequency.setValueAtTime(subOsc.frequency.value || subFreq, time);
            subOsc.frequency.linearRampToValueAtTime(subFreq, glideEndTime);
        }
    } else {
        mainOsc.frequency.value = mainFreq;
        subOsc.frequency.value = subFreq;
    }

    // Set gains
    mainGain.gain.value = this.mainOscGain;
    subGain.gain.value = this.subOscGain;

    // Connect oscillators to their respective gain nodes
    mainOsc.connect(mainGain);
    subOsc.connect(subGain);
    
    // Connect both oscillator gains to the note gain
    mainGain.connect(noteGain);
    subGain.connect(noteGain);

    // Connect note gain to filter
    noteGain.connect(this.filter);

    // Apply attack envelope
    noteGain.gain.setValueAtTime(0, time);
    noteGain.gain.linearRampToValueAtTime(0.7, time + this.attack);
    
    if (releaseTime) {
        noteGain.gain.setValueAtTime(0.7, releaseTime - this.release);
        noteGain.gain.exponentialRampToValueAtTime(0.001, releaseTime);
    }

    // Start oscillators at exact time
    oscillators.push(mainOsc, subOsc);
    oscillators.forEach(osc => osc.start(time));
    
    // If we have a release time, schedule the oscillator stops
    if (releaseTime) {
        oscillators.forEach(osc => osc.stop(releaseTime + 0.1));
    }

    // Store for cleanup
    this.oscillators.set(key, {
        oscillators,
        gainNodes: [mainGain, subGain],
        noteGain,
        startTime: time,
        releaseTime
    });
  }
  // Consolidated scheduleNoteOff() method with updated cleanup
scheduleNoteOff(cell, time) {
    const key = `${cell.x},${cell.y}`;
    const sound = this.oscillators.get(key);
    if (!sound) return;

    // Longer release to avoid abrupt cuts
    const releaseTime = 0.15;
    sound.noteGain.gain.cancelScheduledValues(time);
    sound.noteGain.gain.setValueAtTime(sound.noteGain.gain.value, time);
    sound.noteGain.gain.exponentialRampToValueAtTime(0.001, time + releaseTime);

    // Clean up after release - adjusted timing to match longer release
    setTimeout(() => {
        sound.oscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {
                // Ignore errors if oscillator is already stopped
            }
        });
        sound.gainNodes.forEach(gain => gain.disconnect());
        sound.noteGain.disconnect();
        if (sound.delaySend) {
            sound.delaySend.disconnect();
        }
        this.oscillators.delete(key);
    }, (time - this.audioContext.currentTime + releaseTime) * 1000 + 20);
}

  nextStep() {
    // Move to next step
    this.currentStep++;
    // Calculate precise time for next step
    this.nextStepTime += this.stepInterval / 1000; // Convert to seconds
  }
  playArpeggio(activeCells) {
    // Simply update the active notes, sequencer will play them
    this.activeNotes = new Set(activeCells.map(cell => `${cell.x},${cell.y}`));
  }
  stopArpeggio() {
    if (this.glideTime > 0 && this.arpOscillators) {
        // Fade out and clean up gliding oscillators
        const now = this.audioContext.currentTime;
        this.arpOscillators.noteGain.gain.linearRampToValueAtTime(0, now + 0.1);
        
        setTimeout(() => {
            if (this.arpOscillators) {
                this.arpOscillators.mainOsc.stop();
                this.arpOscillators.subOsc.stop();
                this.arpOscillators.mainOsc.disconnect();
                this.arpOscillators.subOsc.disconnect();
                this.arpOscillators.mainGain.disconnect();
                this.arpOscillators.subGain.disconnect();
                this.arpOscillators.noteGain.disconnect();
                this.arpOscillators = null;
            }
        }, 200);
    }
    
    this.activeNotes.clear();
    if (this.lastNotePlayed) {
        const [x, y] = this.lastNotePlayed.split(',').map(Number);
        this.scheduleNoteOff({ x, y }, this.audioContext.currentTime);
        this.lastNotePlayed = null;
    }
  }

  setDelayAmount(amount) {
    this.delayAmount = amount;
    this.leftGain.gain.value = amount;
    this.rightGain.gain.value = amount;
  }

  setVolume(volume) {
    this.mainGainNode.gain.value = volume;
  }

  setAttack(attack) {
    this.attack = attack;
  }

  setRelease(release) {
    this.release = release;
  }
  setReverb(wetAmount) {
    // Convert percentage to 0-1 range
    const wet = Math.min(Math.max(wetAmount / 100, 0), 1);
    const dry = Math.sqrt(1 - wet); // Square root for more natural power curve
    const wetGain = Math.sqrt(wet) * 5; // Boost wet signal by 50% to compensate for reverb loss

    // Update gains with smooth transition
    const now = this.audioContext.currentTime;
    this.dryGain.gain.linearRampToValueAtTime(dry, now + 0.1);
    this.wetGain.gain.linearRampToValueAtTime(wetGain, now + 0.1);
  }

  setMainOscType(type) {
    this.mainOscType = type;
    this.updateHeldNotes();
  }

  setSubOscType(type) {
    this.subOscType = type;
    this.updateHeldNotes();
  }

  setMainOscOctave(octave) {
    this.mainOscOctave = octave;
    this.updateHeldNotes();
  }

  setSubOscOctave(octave) {
    this.subOscOctave = octave;
    this.updateHeldNotes();
  }

  setMainOscGain(gain) {
    this.mainOscGain = gain;
    this.updateHeldNotes();
  }

  setSubOscGain(gain) {
    this.subOscGain = gain;
    this.updateHeldNotes();
  }

  setGlideTime(time) {
    // If turning off glide, clean up any gliding oscillators
    if (time === 0 && this.glideTime > 0 && this.arpOscillators) {
      const now = this.audioContext.currentTime;
      this.arpOscillators.noteGain.gain.linearRampToValueAtTime(0, now + 0.05);
      
      setTimeout(() => {
        if (this.arpOscillators) {
          this.arpOscillators.mainOsc.stop();
          this.arpOscillators.subOsc.stop();
          this.arpOscillators.mainOsc.disconnect();
          this.arpOscillators.subOsc.disconnect();
          this.arpOscillators.mainGain.disconnect();
          this.arpOscillators.subGain.disconnect();
          this.arpOscillators.noteGain.disconnect();
          this.arpOscillators = null;
        }
      }, 100);
    }
    this.glideTime = time;
  }

  setPortamentoMode(enabled) {
    this.isPortamento = enabled;
  }

  setFilterCutoff(frequency) {
    // Clamp frequency between 20Hz and 20kHz
    frequency = Math.max(20, Math.min(20000, frequency));
    this.filterCutoff = frequency;
    const now = this.audioContext.currentTime;
    // Use slightly longer fade time for smoother changes
    const fadeTime = 0.016; // About 1 frame at 60fps for smooth updates
    this.filter.frequency.exponentialRampToValueAtTime(frequency, now + fadeTime);
}

setFilterResonance(resonance) {
    // Clamp resonance between 0 and 20
    resonance = Math.max(0, Math.min(20, resonance));
    this.filterResonance = resonance;
    const now = this.audioContext.currentTime;
    // Use slightly longer fade time for smoother changes
    const fadeTime = 0.016; // About 1 frame at 60fps for smooth updates
    this.filter.Q.linearRampToValueAtTime(resonance, now + fadeTime);
}

  updateHeldNotes() {
        const currentlyHeld = Array.from(this.oscillators.keys()).map(key => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        });
        
        currentlyHeld.forEach(cell => {
            this.stopNote(cell.x, cell.y);
        });
        
        currentlyHeld.forEach(cell => {
            this.playNote(cell.x, cell.y);
        });
    }
    
    setDelayFeedback(amount) {
        const feedback = Math.min(Math.max(amount / 100, 0), 0.9); // Limit feedback to 90% to prevent runaway
        this.feedbackGainLeft.gain.setValueAtTime(feedback, this.audioContext.currentTime);
        this.feedbackGainRight.gain.setValueAtTime(feedback, this.audioContext.currentTime);
      }
}
