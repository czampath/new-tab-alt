/* ============================================================
   Advanced Bookmarks — quake sound module
   Keeps the WebAudio synth and unlock logic isolated from the
   bookmark UI behavior so the main script can focus on DOM work.
   ============================================================ */
(function (root) {
    'use strict';

    const QUAKE_SYNTH_ENABLED = true;
    const QUAKE_SYNTH_BUILD_START_HZ = 50;
    const QUAKE_SYNTH_BUILD_TARGET_HZ = 28000;
    const QUAKE_SYNTH_BUILD_FREQ_PROGRESS_EXP = 6.4;
    const QUAKE_SYNTH_BUILD_AMP_PROGRESS_EXP = 1.05;
    const QUAKE_SYNTH_MASTER_GAIN = 0.07;
    const QUAKE_SYNTH_BUILD_MAX_GAIN = 0.55;
    const QUAKE_SYNTH_GAIN_FLOOR = 0.00001;

    const QUAKE_SYNTH_WAVEFORMS = ['sine', 'sawtooth', 'triangle', 'square'];
    const QUAKE_SYNTH_WAVE_LEVELS = [0.32, 0.34, 0.25, 0.22];
    const QUAKE_SYNTH_DETUNE_SEMITONES = [-0.21, 60.13, 40.31, -20.34];
    const QUAKE_SYNTH_DETUNE_RANDOM_SEMITONES = 0.07;

    const QUAKE_SYNTH_DECAY_MS = 1300;
    const QUAKE_SYNTH_DECAY_FREQ_FLOOR_HZ = 26;
    const QUAKE_SYNTH_DECAY_EXP_FACTOR = 10;
    const QUAKE_SYNTH_STOP_PADDING_MS = 200;

    const QUAKE_SYNTH_REVERB_ENABLED = true;
    const QUAKE_SYNTH_REVERB_MIX = 0.22;
    const QUAKE_SYNTH_REVERB_PREDELAY_MS = 22;
    const QUAKE_SYNTH_REVERB_DECAY_SECONDS = 1.85;
    const QUAKE_SYNTH_REVERB_IR_SECONDS = 2.4;
    const QUAKE_SYNTH_REVERB_TONE_HZ = 3400;

    const QUAKE_TIMINGS = {
        holdMs: 5000,
        buildMs: 40000,
        explodeMs: 400,
        sectionGlitchDurationMs: 360,
        entryRampMs: 1600,
        corrosionRampMs: 10000,
        corrosionHintAtMs: 20000,
        corrosionHintSpanMs: 140
    };

    let quakeAudioCtx = null;
    let quakeMasterGainNode = null;
    let quakeDryGainNode = null;
    let quakeWetGainNode = null;
    let quakeReverbPreDelayNode = null;
    let quakeReverbConvolverNode = null;
    let quakeReverbToneNode = null;
    let quakeAudioUnlockHooked = false;

    function clampRange(value, min, max) {
        const n = Number(value);
        if (!Number.isFinite(n)) return min;
        return Math.min(max, Math.max(min, n));
    }

    function clamp01(value) {
        return Math.max(0, Math.min(1, value));
    }

    function semitoneToCents(semi) {
        return semi * 100;
    }

    function initAudioUnlockHooks() {
        if (quakeAudioUnlockHooked || !QUAKE_SYNTH_ENABLED) return;
        quakeAudioUnlockHooked = true;

        const unlock = () => {
            const ctx = ensureQuakeAudioContext();
            if (!ctx) return;
            if (ctx.state !== 'running') {
                ctx.resume().catch(() => {});
            }
        };

        document.addEventListener('pointerdown', unlock, { passive: true });
        document.addEventListener('keydown', unlock, { passive: true });
        document.addEventListener('touchstart', unlock, { passive: true });
    }

    function ensureQuakeAudioContext() {
        if (!QUAKE_SYNTH_ENABLED) return null;

        const Ctx = root.AudioContext || root.webkitAudioContext;
        if (!Ctx) return null;

        if (!quakeAudioCtx) {
            quakeAudioCtx = new Ctx();

            quakeMasterGainNode = quakeAudioCtx.createGain();
            quakeMasterGainNode.gain.value = clamp01(Math.max(0, QUAKE_SYNTH_MASTER_GAIN));

            quakeDryGainNode = quakeAudioCtx.createGain();
            quakeWetGainNode = quakeAudioCtx.createGain();

            const wetMix = clampRange(QUAKE_SYNTH_REVERB_MIX, 0, 1);
            const dryMix = 1 - wetMix;

            quakeDryGainNode.gain.value = dryMix;
            quakeWetGainNode.gain.value = wetMix;

            if (QUAKE_SYNTH_REVERB_ENABLED) {
                quakeReverbPreDelayNode = quakeAudioCtx.createDelay(2.5);
                quakeReverbConvolverNode = quakeAudioCtx.createConvolver();
                quakeReverbToneNode = quakeAudioCtx.createBiquadFilter();

                quakeReverbPreDelayNode.delayTime.value = clampRange(QUAKE_SYNTH_REVERB_PREDELAY_MS, 0, 2000) / 1000;
                quakeReverbConvolverNode.normalize = true;
                quakeReverbConvolverNode.buffer = createReverbImpulseBuffer(quakeAudioCtx);
                quakeReverbToneNode.type = 'lowpass';
                quakeReverbToneNode.frequency.value = clampRange(QUAKE_SYNTH_REVERB_TONE_HZ, 120, 20000);
                quakeReverbToneNode.Q.value = 0.0001;

                quakeMasterGainNode.connect(quakeDryGainNode);
                quakeMasterGainNode.connect(quakeReverbPreDelayNode);
                quakeReverbPreDelayNode.connect(quakeReverbConvolverNode);
                quakeReverbConvolverNode.connect(quakeReverbToneNode);
                quakeReverbToneNode.connect(quakeWetGainNode);
            } else {
                quakeMasterGainNode.connect(quakeDryGainNode);
            }

            quakeDryGainNode.connect(quakeAudioCtx.destination);
            quakeWetGainNode.connect(quakeAudioCtx.destination);
        }
        return quakeAudioCtx;
    }

    function createReverbImpulseBuffer(ctx) {
        const duration = clampRange(QUAKE_SYNTH_REVERB_IR_SECONDS, 0.08, 6);
        const decay = clampRange(QUAKE_SYNTH_REVERB_DECAY_SECONDS, 0.05, 8);
        const sampleRate = ctx.sampleRate;
        const length = Math.max(1, Math.floor(sampleRate * duration));
        const channels = 2;
        const impulse = ctx.createBuffer(channels, length, sampleRate);

        for (let channel = 0; channel < channels; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const t = i / length;
                const env = Math.pow(1 - t, decay);
                const polarity = (channel === 0) ? 1 : -1;
                const noise = (Math.random() * 2 - 1) * env;
                const shimmer = Math.sin((i / sampleRate) * (220 + channel * 15) * Math.PI * 2) * 0.045 * env;
                data[i] = (noise * 0.95 + shimmer) * polarity;
            }
        }

        return impulse;
    }

    function createQuakeSynth(seed) {
        const ctx = ensureQuakeAudioContext();
        if (!ctx || !quakeMasterGainNode) return null;
        if (ctx.state !== 'running') {
            ctx.resume().catch(() => {});
        }

        const synthGain = ctx.createGain();
        synthGain.gain.value = QUAKE_SYNTH_GAIN_FLOOR;
        synthGain.connect(quakeMasterGainNode);

        const waves = [];
        const waveTypes = Array.isArray(QUAKE_SYNTH_WAVEFORMS) && QUAKE_SYNTH_WAVEFORMS.length
            ? QUAKE_SYNTH_WAVEFORMS
            : ['sine', 'sawtooth', 'triangle', 'square'];

        const totalLevel = Math.max(0.0001, QUAKE_SYNTH_WAVE_LEVELS.reduce((sum, v) => sum + Math.max(0, Number(v) || 0), 0));
        const randomSemiSpan = clampRange(QUAKE_SYNTH_DETUNE_RANDOM_SEMITONES, 0, 12);
        const startHz = clampRange(QUAKE_SYNTH_BUILD_START_HZ, 0.1, 22000);

        waveTypes.forEach((type, idx) => {
            const osc = ctx.createOscillator();
            const waveGain = ctx.createGain();

            osc.type = (type === 'sine' || type === 'square' || type === 'sawtooth' || type === 'triangle')
                ? type
                : 'sine';

            const baseLevel = Math.max(0, Number(QUAKE_SYNTH_WAVE_LEVELS[idx]) || 0);
            waveGain.gain.value = baseLevel / totalLevel;

            const baseSemi = Number(QUAKE_SYNTH_DETUNE_SEMITONES[idx]) || 0;
            const randSemi = ((Math.sin(seed * (idx + 1) * 0.017) + Math.cos(seed * (idx + 3) * 0.011)) * 0.5) * randomSemiSpan;
            const cents = clampRange(semitoneToCents(baseSemi + randSemi), -2400, 2400);

            osc.detune.value = cents;
            osc.frequency.value = startHz;

            osc.connect(waveGain);
            waveGain.connect(synthGain);

            try {
                osc.start();
            } catch {
                // Ignore duplicate-start issues; synth will still cleanup safely.
            }

            waves.push({ osc, waveGain });
        });

        return {
            ctx,
            synthGain,
            waves,
            currentFreq: startHz,
            currentGain: QUAKE_SYNTH_GAIN_FLOOR,
            released: false,
            stopTimer: null
        };
    }

    function setSynthBuildFrame(synth, buildProgress) {
        if (!synth || synth.released) return;

        const p = clamp01(buildProgress);
        const freqStart = clampRange(QUAKE_SYNTH_BUILD_START_HZ, 0.1, 22000);
        const freqTarget = clampRange(QUAKE_SYNTH_BUILD_TARGET_HZ, freqStart + 0.001, 24000);
        const freqShape = clampRange(QUAKE_SYNTH_BUILD_FREQ_PROGRESS_EXP, 0.05, 12);
        const ampShape = clampRange(QUAKE_SYNTH_BUILD_AMP_PROGRESS_EXP, 0.05, 12);

        const progFreq = Math.pow(p, freqShape);
        const progGain = Math.pow(p, ampShape);

        const targetFreq = freqStart * Math.pow(freqTarget / freqStart, progFreq);
        const maxGain = clampRange(QUAKE_SYNTH_BUILD_MAX_GAIN, QUAKE_SYNTH_GAIN_FLOOR, 3);
        const targetGain = QUAKE_SYNTH_GAIN_FLOOR + (maxGain - QUAKE_SYNTH_GAIN_FLOOR) * progGain;

        const now = synth.ctx.currentTime;
        const nyquistSafe = Math.max(30, (synth.ctx.sampleRate * 0.5) - 250);
        const safeFreq = clampRange(targetFreq, 0.1, nyquistSafe);
        const safeGain = clampRange(targetGain, QUAKE_SYNTH_GAIN_FLOOR, 3);

        synth.currentFreq = safeFreq;
        synth.currentGain = safeGain;

        synth.synthGain.gain.setValueAtTime(safeGain, now);
        synth.waves.forEach(w => {
            w.osc.frequency.setValueAtTime(safeFreq, now);
        });
    }

    function releaseQuakeSynth(synth) {
        if (!synth || synth.released) return;
        synth.released = true;

        const now = synth.ctx.currentTime;
        const decayMs = clampRange(QUAKE_SYNTH_DECAY_MS, 30, 8000);
        const decaySec = decayMs / 1000;
        const expFactor = clampRange(QUAKE_SYNTH_DECAY_EXP_FACTOR, 0.1, 100);
        const timeConst = Math.max(0.0008, decaySec / expFactor);

        const floorFreq = clampRange(QUAKE_SYNTH_DECAY_FREQ_FLOOR_HZ, 0.1, 4000);
        const currentFreq = clampRange(synth.currentFreq, floorFreq, 30000);
        const currentGain = clampRange(synth.currentGain, QUAKE_SYNTH_GAIN_FLOOR, 10);

        synth.synthGain.gain.cancelScheduledValues(now);
        synth.synthGain.gain.setValueAtTime(currentGain, now);
        synth.synthGain.gain.setTargetAtTime(QUAKE_SYNTH_GAIN_FLOOR, now, timeConst);

        synth.waves.forEach(w => {
            w.osc.frequency.cancelScheduledValues(now);
            w.osc.frequency.setValueAtTime(currentFreq, now);
            w.osc.frequency.setTargetAtTime(floorFreq, now, timeConst);
        });

        const stopDelay = decayMs + clampRange(QUAKE_SYNTH_STOP_PADDING_MS, 20, 3000);
        synth.stopTimer = setTimeout(() => {
            synth.waves.forEach(w => {
                try { w.osc.stop(); } catch {}
                try { w.osc.disconnect(); } catch {}
                try { w.waveGain.disconnect(); } catch {}
            });
            try { synth.synthGain.disconnect(); } catch {}
        }, stopDelay);
    }

    root.bookmarksQuakeSound = {
        initAudioUnlockHooks,
        ensureQuakeAudioContext,
        createQuakeSynth,
        setSynthBuildFrame,
        releaseQuakeSynth,
        clampRange,
        clamp01,
        constants: {
            ...QUAKE_TIMINGS,
            synthEnabled: QUAKE_SYNTH_ENABLED,
            synthBuildStartHz: QUAKE_SYNTH_BUILD_START_HZ,
            synthBuildTargetHz: QUAKE_SYNTH_BUILD_TARGET_HZ,
            synthBuildFreqProgressExp: QUAKE_SYNTH_BUILD_FREQ_PROGRESS_EXP,
            synthBuildAmpProgressExp: QUAKE_SYNTH_BUILD_AMP_PROGRESS_EXP,
            synthMasterGain: QUAKE_SYNTH_MASTER_GAIN,
            synthBuildMaxGain: QUAKE_SYNTH_BUILD_MAX_GAIN,
            synthGainFloor: QUAKE_SYNTH_GAIN_FLOOR,
            synthWaveforms: QUAKE_SYNTH_WAVEFORMS,
            synthWaveLevels: QUAKE_SYNTH_WAVE_LEVELS,
            synthDetuneSemitones: QUAKE_SYNTH_DETUNE_SEMITONES,
            synthDetuneRandomSemitones: QUAKE_SYNTH_DETUNE_RANDOM_SEMITONES,
            synthDecayMs: QUAKE_SYNTH_DECAY_MS,
            synthDecayFreqFloorHz: QUAKE_SYNTH_DECAY_FREQ_FLOOR_HZ,
            synthDecayExpFactor: QUAKE_SYNTH_DECAY_EXP_FACTOR,
            synthStopPaddingMs: QUAKE_SYNTH_STOP_PADDING_MS,
            synthReverbEnabled: QUAKE_SYNTH_REVERB_ENABLED,
            synthReverbMix: QUAKE_SYNTH_REVERB_MIX,
            synthReverbPreDelayMs: QUAKE_SYNTH_REVERB_PREDELAY_MS,
            synthReverbDecaySeconds: QUAKE_SYNTH_REVERB_DECAY_SECONDS,
            synthReverbIrSeconds: QUAKE_SYNTH_REVERB_IR_SECONDS,
            synthReverbToneHz: QUAKE_SYNTH_REVERB_TONE_HZ
        }
    };
})(window);
