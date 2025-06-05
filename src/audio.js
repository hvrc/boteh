import { HandDetector } from './fingers.js';

export class AudioEngine {
  static SCALES = {
    pentatonic: {
      name: 'Pentatonic',
      ratios: [1, 1.2, 1.3333, 1.5, 1.8],
    },
    major: {
      name: 'Major',
      ratios: [1, 1.125, 1.25, 1.3333, 1.5, 1.6667, 1.875],
    },
    minor: {
      name: 'Natural Minor',
      ratios: [1, 1.125, 1.2, 1.3333, 1.5, 1.6, 1.75],
    },
    harmonicMinor: {
      name: 'Harmonic Minor',
      ratios: [1, 1.125, 1.2, 1.3333, 1.5, 1.6, 1.875],
    },
    blues: {
      name: 'Blues',
      ratios: [1, 1.2, 1.25, 1.333, 1.5, 1.6],
    }
  };

  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    this.currentScale = 'pentatonic';
    
    this.filterCutoff = 2000;
    this.filterResonance = 0;
    
    this.isPlaying = true;
    this.currentStep = 0;
    this.tempo = 222;
    this.stepInterval = (60 / this.tempo) * 1000 / 2;
    this.nextStepTime = this.audioContext.currentTime;
    this.activeNotes = new Set();
    this.scheduleAhead = 0.1;
    this.delayAmount = 0.3;
    
    this.attack = 0.002;
    this.release = 0.05;
    
    this.mainOscGain = 0.1;
    this.subOscGain = 0.2;
    
    this.mainOscType = 'sine';
    this.subOscType = 'sine';
    this.mainOscOctave = 0;
    this.subOscOctave = -2;
    
    this.glideTime = 0;
    
    this.isPortamento = false;
    this.lastFrequency = null;
    
    this.pitchShift = 0;
    
    this.setupEffects();
    this.setupScales();
    this.setupOscillators();
    
    this.scheduler();
  }

  setupEffects() {
    this.mainGainNode = this.audioContext.createGain();
    this.mainGainNode.gain.value = 0.1;

    this.filter = this.audioContext.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.filterCutoff;
    this.filter.Q.value = this.filterResonance;

    this.leftDelay = this.audioContext.createDelay();
    this.rightDelay = this.audioContext.createDelay();
    this.leftGain = this.audioContext.createGain();
    this.rightGain = this.audioContext.createGain();
    this.feedbackGainLeft = this.audioContext.createGain();
    this.feedbackGainRight = this.audioContext.createGain();
    this.feedbackGainLeft = this.audioContext.createGain();
    this.feedbackGainRight = this.audioContext.createGain();

    this.feedbackGainLeft.gain.value = 0.75;
    this.feedbackGainRight.gain.value = 0.75;
    this.leftDelay.delayTime.value = 0.3;
    this.rightDelay.delayTime.value = 0.4;
    this.leftGain.gain.value = 0.3;
    this.rightGain.gain.value = 0.3;
    
    this.leftPanner = this.audioContext.createStereoPanner();
    this.rightPanner = this.audioContext.createStereoPanner();
    this.leftPanner.pan.value = -1;
    this.rightPanner.pan.value = 1;

    this.reverbNode = this.audioContext.createConvolver();
    this.createReverb(2.5);
    this.dryGain = this.audioContext.createGain();
    this.wetGain = this.audioContext.createGain();
    this.dryGain.gain.value = Math.sqrt(0.7);
    this.wetGain.gain.value = Math.sqrt(0.3) * 5;

    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.filter.connect(this.dryGain);
    this.filter.connect(this.leftDelay);
    this.filter.connect(this.rightDelay);

    this.leftDelay.connect(this.leftGain);
    this.rightDelay.connect(this.rightGain);
    this.leftGain.connect(this.leftPanner);
    this.rightGain.connect(this.rightPanner);
    
    this.leftPanner.connect(this.feedbackGainRight);
    this.rightPanner.connect(this.feedbackGainLeft);
    this.feedbackGainRight.connect(this.rightDelay);
    this.feedbackGainLeft.connect(this.leftDelay);
    
    this.leftPanner.connect(this.dryGain);
    this.leftPanner.connect(this.reverbNode);
    this.rightPanner.connect(this.dryGain);
    this.rightPanner.connect(this.reverbNode);
    
    this.dryGain.connect(this.mainGainNode);
    this.reverbNode.connect(this.wetGain);
    this.wetGain.connect(this.mainGainNode);
    this.mainGainNode.connect(this.compressor);
    this.compressor.connect(this.audioContext.destination);
}

  async createReverb(duration) {
    const minDuration = 0.1;
    duration = Math.max(minDuration, duration);
    
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i / length;
        const amplitude = Math.pow(1 - n, 2) * Math.random() * 0.5;
        left[i] = amplitude * (Math.random() * 2 - 1);
        right[i] = amplitude * (Math.random() * 2 - 1);
    }

    this.reverbNode.buffer = impulse;
  }

  setupScales(gridSize = HandDetector.GRID_SIZE) {
    const baseFrequency = 220.00;
    this.frequencies = [];
    const scale = AudioEngine.SCALES[this.currentScale];
    
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const octave = Math.floor(y / 3);
            const noteIndex = (gridSize - 1 - x) % scale.ratios.length;
            
            const frequency = baseFrequency * 
                            scale.ratios[noteIndex] * 
                            Math.pow(2, octave);
            
            this.frequencies.push({ 
                x, 
                y: gridSize - 1 - y, 
                frequency 
            });
        }
    }
}

  changeScale(scaleName) {
    if (AudioEngine.SCALES[scaleName]) {
        this.currentScale = scaleName;
        this.setupScales();
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
            return;
        }

        const noteData = this.frequencies.find(n => n.x === x && n.y === y);
        if (!noteData) return;

        const now = this.audioContext.currentTime;
        this.scheduleNoteOn({ x, y }, now);
    }

    stopNote(x, y) {
        const key = `${x},${y}`;
        const sound = this.oscillators.get(key);
        if (!sound) return;

        const now = this.audioContext.currentTime;
        
        sound.noteGain.gain.cancelScheduledValues(now);
        sound.noteGain.gain.setValueAtTime(sound.noteGain.gain.value, now);
        sound.noteGain.gain.exponentialRampToValueAtTime(0.001, now + this.release);

        setTimeout(() => {
            this.cleanupOscillators(key);
        }, this.release * 1000 + 100);
    }

    cleanupOscillators(key) {
        const sound = this.oscillators.get(key);
        if (!sound) return;

        sound.oscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {
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
    while (this.nextStepTime < this.audioContext.currentTime + this.scheduleAhead) {
      if (this.activeNotes.size > 0) {
        this.scheduleNextNote(this.currentStep, this.nextStepTime);
      }
      this.nextStep();
    }
    
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
                const pitchShiftMultiplier = Math.pow(2, this.pitchShift / 12);
                const mainFreq = noteData.frequency * Math.pow(2, this.mainOscOctave) * pitchShiftMultiplier;
                const subFreq = noteData.frequency * Math.pow(2, this.subOscOctave) * pitchShiftMultiplier;
                
                if (this.isPortamento) {
                    this.arpOscillators.mainOsc.frequency.exponentialRampToValueAtTime(
                        mainFreq,
                        time + this.glideTime
                    );
                    this.arpOscillators.subOsc.frequency.exponentialRampToValueAtTime(
                        subFreq,
                        time + this.glideTime
                    );
                } else {
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

setPitchShift(semitones, smooth = false) {
    this.pitchShift = semitones;
    const now = this.audioContext.currentTime;
    const transitionTime = smooth ? 0.03 : 0;

    const getPitchedFrequency = (baseFreq) => baseFreq * Math.pow(2, this.pitchShift / 12);

    this.oscillators.forEach((sound, key) => {
        const [x, y] = key.split(',').map(Number);
        const noteData = this.frequencies.find(n => n.x === x && n.y === y);
        if (noteData) {
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
    this.arpOscillators = {
        mainOsc: this.audioContext.createOscillator(),
        subOsc: this.audioContext.createOscillator(),
        mainGain: this.audioContext.createGain(),
        subGain: this.audioContext.createGain(),
        noteGain: this.audioContext.createGain()
    };

    const { mainOsc, subOsc, mainGain, subGain, noteGain } = this.arpOscillators;

    mainOsc.type = this.mainOscType;
    subOsc.type = this.subOscType;
    mainGain.gain.value = this.mainOscGain;
    subGain.gain.value = this.subOscGain;
    noteGain.gain.value = 0.7;

    mainOsc.connect(mainGain);
    subOsc.connect(subGain);
    mainGain.connect(noteGain);
    subGain.connect(noteGain);

    const dryGain = this.audioContext.createGain();
    const wetGain = this.audioContext.createGain();
    dryGain.gain.value = 0.7;
    wetGain.gain.value = 0.3;

    noteGain.connect(dryGain);
    noteGain.connect(wetGain);
    dryGain.connect(this.mainGainNode);
    wetGain.connect(this.reverbNode);

    const delaySend = this.audioContext.createGain();
    delaySend.gain.value = this.delayAmount;
    noteGain.connect(delaySend);
    delaySend.connect(this.leftDelay);
    delaySend.connect(this.rightDelay);

    mainOsc.start(time);
    subOsc.start(time);
  }

  scheduleNoteOn(cell, time, releaseTime) {
    const key = `${cell.x},${cell.y}`;
    const noteData = this.frequencies.find(n => n.x === cell.x && n.y === cell.y);
    if (!noteData) return;

    const mainOsc = this.audioContext.createOscillator();
    const subOsc = this.audioContext.createOscillator();
    const mainGain = this.audioContext.createGain();
    const subGain = this.audioContext.createGain();
    const noteGain = this.audioContext.createGain();

    const oscillators = [];
    const gainNodes = [];

    const pitchShiftMultiplier = Math.pow(2, this.pitchShift / 12);
    const mainFreq = noteData.frequency * Math.pow(2, this.mainOscOctave) * pitchShiftMultiplier;
    const subFreq = noteData.frequency * Math.pow(2, this.subOscOctave) * pitchShiftMultiplier;

    mainOsc.type = this.mainOscType;
    subOsc.type = this.subOscType;

    if (this.glideTime > 0 && this.oscillators.size > 0) {
        const glideEndTime = time + (this.glideTime / 1000);
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

    mainGain.gain.value = this.mainOscGain;
    subGain.gain.value = this.subOscGain;

    mainOsc.connect(mainGain);
    subOsc.connect(subGain);
    
    mainGain.connect(noteGain);
    subGain.connect(noteGain);

    noteGain.connect(this.filter);

    noteGain.gain.setValueAtTime(0, time);
    noteGain.gain.linearRampToValueAtTime(0.7, time + this.attack);
    
    if (releaseTime) {
        noteGain.gain.setValueAtTime(0.7, releaseTime - this.release);
        noteGain.gain.exponentialRampToValueAtTime(0.001, releaseTime);
    }

    oscillators.push(mainOsc, subOsc);
    oscillators.forEach(osc => osc.start(time));
    
    if (releaseTime) {
        oscillators.forEach(osc => osc.stop(releaseTime + 0.1));
    }

    this.oscillators.set(key, {
        oscillators,
        gainNodes: [mainGain, subGain],
        noteGain,
        startTime: time,
        releaseTime
    });
  }
  scheduleNoteOff(cell, time) {
    const key = `${cell.x},${cell.y}`;
    const sound = this.oscillators.get(key);
    if (!sound) return;

    const releaseTime = 0.15;
    sound.noteGain.gain.cancelScheduledValues(time);
    sound.noteGain.gain.setValueAtTime(sound.noteGain.gain.value, time);
    sound.noteGain.gain.exponentialRampToValueAtTime(0.001, time + releaseTime);

    setTimeout(() => {
        sound.oscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {
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
    this.currentStep++;
    this.nextStepTime += this.stepInterval / 1000;
  }
  playArpeggio(activeCells) {
    this.activeNotes = new Set(activeCells.map(cell => `${cell.x},${cell.y}`));
  }
  stopArpeggio() {
    if (this.glideTime > 0 && this.arpOscillators) {
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
    const wet = wetAmount / 100;
    
    const dryGain = Math.cos(wet * 0.5 * Math.PI);
    const wetGain = Math.sin(wet * 0.5 * Math.PI);

    const now = this.audioContext.currentTime;
    const transitionTime = 0.016;
    
    this.dryGain.gain.cancelScheduledValues(now);
    this.wetGain.gain.cancelScheduledValues(now);
    
    this.dryGain.gain.setTargetAtTime(dryGain, now, transitionTime);
    this.wetGain.gain.setTargetAtTime(wetGain * 10, now, transitionTime);
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
    frequency = Math.max(20, Math.min(20000, frequency));
    this.filterCutoff = frequency;
    const now = this.audioContext.currentTime;
    const fadeTime = 0.016;
    this.filter.frequency.exponentialRampToValueAtTime(frequency, now + fadeTime);
}

setFilterResonance(resonance) {
    resonance = Math.max(0, Math.min(20, resonance));
    this.filterResonance = resonance;
    const now = this.audioContext.currentTime;
    const fadeTime = 0.016;
    this.filter.Q.linearRampToValueAtTime(resonance, now + fadeTime);
}
  updateHeldNotes() {
        const now = this.audioContext.currentTime;
        const transitionTime = 0.016;
        
        this.oscillators.forEach((sound, key) => {
            const [x, y] = key.split(',').map(Number);
            const noteData = this.frequencies.find(n => n.x === x && n.y === y);
            if (!noteData) return;

            const pitchShiftMultiplier = Math.pow(2, this.pitchShift / 12);
            const mainFreq = noteData.frequency * Math.pow(2, this.mainOscOctave) * pitchShiftMultiplier;
            const subFreq = noteData.frequency * Math.pow(2, this.subOscOctave) * pitchShiftMultiplier;
            
            const [mainOsc, subOsc] = sound.oscillators;
            if (mainOsc.type !== this.mainOscType) {
                const tempOsc = this.audioContext.createOscillator();
                const tempGain = this.audioContext.createGain();
                tempOsc.type = this.mainOscType;
                tempOsc.frequency.value = mainFreq;
                tempOsc.connect(tempGain);
                tempGain.connect(sound.noteGain);
                
                tempGain.gain.setValueAtTime(0, now);
                sound.gainNodes[0].gain.setValueAtTime(this.mainOscGain, now);
                tempGain.gain.linearRampToValueAtTime(this.mainOscGain, now + transitionTime);
                sound.gainNodes[0].gain.linearRampToValueAtTime(0, now + transitionTime);
                
                tempOsc.start(now);
                setTimeout(() => {
                    mainOsc.stop();
                    mainOsc.disconnect();
                    sound.oscillators[0] = tempOsc;
                    sound.gainNodes[0] = tempGain;
                }, transitionTime * 1000);
            }
            
            if (subOsc.type !== this.subOscType) {
                const tempOsc = this.audioContext.createOscillator();
                const tempGain = this.audioContext.createGain();
                tempOsc.type = this.subOscType;
                tempOsc.frequency.value = subFreq;
                tempOsc.connect(tempGain);
                tempGain.connect(sound.noteGain);
                
                tempGain.gain.setValueAtTime(0, now);
                sound.gainNodes[1].gain.setValueAtTime(this.subOscGain, now);
                tempGain.gain.linearRampToValueAtTime(this.subOscGain, now + transitionTime);
                sound.gainNodes[1].gain.linearRampToValueAtTime(0, now + transitionTime);
                
                tempOsc.start(now);
                setTimeout(() => {
                    subOsc.stop();
                    subOsc.disconnect();
                    sound.oscillators[1] = tempOsc;
                    sound.gainNodes[1] = tempGain;
                }, transitionTime * 1000);
            }
            
            if (mainOsc.frequency.value !== mainFreq) {
                mainOsc.frequency.exponentialRampToValueAtTime(mainFreq, now + transitionTime);
            }
            if (subOsc.frequency.value !== subFreq) {
                subOsc.frequency.exponentialRampToValueAtTime(subFreq, now + transitionTime);
            }
            
            sound.gainNodes[0].gain.linearRampToValueAtTime(this.mainOscGain, now + transitionTime);
            sound.gainNodes[1].gain.linearRampToValueAtTime(this.subOscGain, now + transitionTime);
        });
        
        if (this.arpOscillators) {
            const activeNote = Array.from(this.activeNotes)[0];
            if (activeNote) {
                const [x, y] = activeNote.split(',').map(Number);
                const noteData = this.frequencies.find(n => n.x === x && n.y === y);
                if (noteData) {
                    const pitchShiftMultiplier = Math.pow(2, this.pitchShift / 12);
                    const mainFreq = noteData.frequency * Math.pow(2, this.mainOscOctave) * pitchShiftMultiplier;
                    const subFreq = noteData.frequency * Math.pow(2, this.subOscOctave) * pitchShiftMultiplier;
                    
                    if (this.arpOscillators.mainOsc.type !== this.mainOscType) {
                        const { mainOsc, mainGain } = this.createArpOscillator(mainFreq, this.mainOscType, this.mainOscGain);
                        this.crossfadeArpOscillator('main', mainOsc, mainGain);
                    }
                    
                    if (this.arpOscillators.subOsc.type !== this.subOscType) {
                        const { subOsc, subGain } = this.createArpOscillator(subFreq, this.subOscType, this.subOscGain);
                        this.crossfadeArpOscillator('sub', subOsc, subGain);
                    }
                    
                    this.arpOscillators.mainOsc.frequency.exponentialRampToValueAtTime(mainFreq, now + transitionTime);
                    this.arpOscillators.subOsc.frequency.exponentialRampToValueAtTime(subFreq, now + transitionTime);
                    this.arpOscillators.mainGain.gain.linearRampToValueAtTime(this.mainOscGain, now + transitionTime);
                    this.arpOscillators.subGain.gain.linearRampToValueAtTime(this.subOscGain, now + transitionTime);
                }
            }
        }
    }
    
    setDelayFeedback(amount) {
        const feedback = Math.min(Math.max(amount / 100, 0), 0.9);
        this.feedbackGainLeft.gain.setValueAtTime(feedback, this.audioContext.currentTime);
        this.feedbackGainRight.gain.setValueAtTime(feedback, this.audioContext.currentTime);
      }

      createArpOscillator(freq, type, gain) {
        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gainNode.gain.value = 0;
        osc.connect(gainNode);
        gainNode.connect(this.arpOscillators.noteGain);
        osc.start(this.audioContext.currentTime);
        return { osc, gainNode };
      }

      crossfadeArpOscillator(type, newOsc, newGain) {
        const now = this.audioContext.currentTime;
        const transitionTime = 0.016;
        const oldOsc = type === 'main' ? this.arpOscillators.mainOsc : this.arpOscillators.subOsc;
        const oldGain = type === 'main' ? this.arpOscillators.mainGain : this.arpOscillators.subGain;
        
        oldGain.gain.linearRampToValueAtTime(0, now + transitionTime);
        newGain.gain.linearRampToValueAtTime(
          type === 'main' ? this.mainOscGain : this.subOscGain, 
          now + transitionTime
        );
        
        setTimeout(() => {
          oldOsc.stop();
          oldOsc.disconnect();
          oldGain.disconnect();
          if (type === 'main') {
            this.arpOscillators.mainOsc = newOsc;
            this.arpOscillators.mainGain = newGain;
          } else {
            this.arpOscillators.subOsc = newOsc;
            this.arpOscillators.subGain = newGain;
          }
        }, transitionTime * 1000);
      }
}
