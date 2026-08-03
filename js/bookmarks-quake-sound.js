/* ============================================================
   Advanced Bookmarks — quake sound module
   Keeps the WebAudio synth and unlock logic isolated from the
   bookmark UI behavior so the main script can focus on DOM work.
   ============================================================ */
(function (root) {
    'use strict';

    const QUAKE_SYNTH_ENABLED = true;
    const QUAKE_SYNTH_BUILD_START_HZ = 38;
    const QUAKE_SYNTH_BUILD_TARGET_HZ = 18500;
    const QUAKE_SYNTH_BUILD_FREQ_PROGRESS_EXP = 4.85;
    const QUAKE_SYNTH_BUILD_AMP_PROGRESS_EXP = 1.28;
    const QUAKE_SYNTH_MASTER_GAIN = 0.09;
    const QUAKE_SYNTH_BUILD_MAX_GAIN = 0.85;
    const QUAKE_SYNTH_GAIN_FLOOR = 0.00001;

    const QUAKE_SYNTH_WAVEFORMS = ['sine', 'sawtooth', 'triangle', 'square'];
    const QUAKE_SYNTH_WAVE_LEVELS = [0.19, 0.37, 0.26, 0.34];
    const QUAKE_SYNTH_DETUNE_SEMITONES = [-0.12, 0.08, 0.24, -0.31];
    const QUAKE_SYNTH_DETUNE_RANDOM_SEMITONES = 0.11;
    const QUAKE_SYNTH_WAVE_FREQ_MULTIPLIERS = [0.56, 1.0, 1.82, 2.94];
    const QUAKE_SYNTH_WAVE_MOTION_RATES = [1.2, 1.9, 2.8, 4.3];
    const QUAKE_SYNTH_WAVE_MOTION_DEPTHS = [0.018, 0.026, 0.034, 0.048];

    const QUAKE_SYNTH_COLOR_FILTER_START_HZ = 280;
    const QUAKE_SYNTH_COLOR_FILTER_END_HZ = 9800;
    const QUAKE_SYNTH_COLOR_FILTER_Q = 0.92;
    const QUAKE_SYNTH_COLOR_DRIVE = 1.85;
    const QUAKE_SYNTH_COLOR_POST_GAIN = 0.67;

    const QUAKE_SYNTH_DECAY_MS = 1300;
    const QUAKE_SYNTH_DECAY_FREQ_FLOOR_HZ = 26;
    const QUAKE_SYNTH_DECAY_EXP_FACTOR = 10;
    const QUAKE_SYNTH_STOP_PADDING_MS = 200;

    const QUAKE_SYNTH_IMPACT_ENABLED = true;
    const QUAKE_SYNTH_IMPACT_DURATION_MS = 2300;
    const QUAKE_SYNTH_IMPACT_BOOM_START_HZ = 200;
    const QUAKE_SYNTH_IMPACT_BOOM_END_HZ = 24;
    const QUAKE_SYNTH_IMPACT_BOOM_GAIN = 1.2;
    const QUAKE_SYNTH_IMPACT_DEBRIS_GAIN = 0.24;
    const QUAKE_SYNTH_IMPACT_DEBRIS_HPF_HZ = 2600;
    const QUAKE_SYNTH_IMPACT_DEBRIS_LPF_HZ = 14000;
    const QUAKE_SYNTH_IMPACT_AIR_GAIN = 0.1;
    const QUAKE_SYNTH_IMPACT_AIR_HPF_HZ = 60;
    const QUAKE_SYNTH_IMPACT_AIR_LPF_HZ = 360;
    const QUAKE_SYNTH_IMPACT_SUB_START_HZ = 240;
    const QUAKE_SYNTH_IMPACT_SUB_END_HZ = 16;
    const QUAKE_SYNTH_IMPACT_SUB_GAIN = 1.16;
    const QUAKE_SYNTH_IMPACT_RUMBLE_GAIN = 0.5;
    const QUAKE_SYNTH_IMPACT_RUMBLE_SECONDS = 4.2;
    const QUAKE_SYNTH_IMPACT_SHOCK_DELAY_MS = 90;
    const QUAKE_SYNTH_IMPACT_SHOCK_GAIN = 0.3;
    const QUAKE_SYNTH_ATTACK_CLICK_GAIN = 0.55;
    const QUAKE_SYNTH_ATTACK_CLICK_MS = 8;

    const QUAKE_SYNTH_PARAM_SMOOTH_SEC = 0.018;
    const QUAKE_SYNTH_PAN_SPREAD = 0.78;

    const QUAKE_SYNTH_CHORUS_ENABLED = true;
    const QUAKE_SYNTH_CHORUS_DELAYS_MS = [9, 15, 21];
    const QUAKE_SYNTH_CHORUS_RATES_HZ = [0.17, 0.24, 0.31];
    const QUAKE_SYNTH_CHORUS_DEPTH_MS = 3.6;
    const QUAKE_SYNTH_CHORUS_MIX = 0.4;

    const QUAKE_SYNTH_RISER_ENABLED = true;
    const QUAKE_SYNTH_RISER_START_HZ = 240;
    const QUAKE_SYNTH_RISER_END_HZ = 6400;
    const QUAKE_SYNTH_RISER_Q = 3.4;
    const QUAKE_SYNTH_RISER_MAX_GAIN = 0.46;
    const QUAKE_SYNTH_RISER_LOOP_SECONDS = 2.4;

    const QUAKE_SYNTH_TENSION_START_HZ = 1.05;
    const QUAKE_SYNTH_TENSION_END_HZ = 7.8;
    const QUAKE_SYNTH_TENSION_DEPTH = 0.38;

    const QUAKE_SYNTH_MASTER_COMP_THRESHOLD = -20;
    const QUAKE_SYNTH_MASTER_COMP_KNEE = 12;
    const QUAKE_SYNTH_MASTER_COMP_RATIO = 4.5;
    const QUAKE_SYNTH_MASTER_COMP_ATTACK = 0.004;
    const QUAKE_SYNTH_MASTER_COMP_RELEASE = 0.3;
    const QUAKE_SYNTH_STEREO_WIDTH_MS = 15;

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
    let quakeMasterCompressorNode = null;
    let quakeWidenerDelayNode = null;
    let quakeWidenerLeftPanner = null;
    let quakeWidenerRightPanner = null;
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

    function createSoftClipCurve(amount) {
        const drive = clampRange(amount, 1, 8);
        const samples = 2048;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / (samples - 1) - 1;
            curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
        }
        return curve;
    }

    function createImpactNoiseBuffer(ctx, seconds) {
        const duration = clampRange(seconds, 0.06, 2);
        const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            const t = i / length;
            const env = Math.pow(1 - t, 2.8);
            data[i] = (Math.random() * 2 - 1) * env;
        }
        return buffer;
    }

    function createLoopableNoiseBuffer(ctx, seconds) {
        const duration = clampRange(seconds, 0.3, 6);
        const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    function createImpactRumbleBuffer(ctx, seconds) {
        const duration = clampRange(seconds, 0.6, 8);
        const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < length; i++) {
            const t = i / length;
            const env = Math.pow(1 - t, 1.8);
            const white = (Math.random() * 2 - 1) * 0.22;
            last = (last * 0.985) + white;
            const slowPulse = Math.sin((i / ctx.sampleRate) * (24 + t * 9) * Math.PI * 2) * 0.22;
            data[i] = (last + slowPulse) * env;
        }
        return buffer;
    }

    function triggerImpactBoom(synth) {
        if (!QUAKE_SYNTH_IMPACT_ENABLED || !synth || !synth.ctx) return;

        const ctx = synth.ctx;
        const now = ctx.currentTime;
        const durationSec = clampRange(QUAKE_SYNTH_IMPACT_DURATION_MS, 220, 5200) / 1000;
        const currentFreq = clampRange(synth.currentFreq, 20, 22000);
        const baseStartHz = clampRange(QUAKE_SYNTH_IMPACT_BOOM_START_HZ, 25, 600);
        const boomStartHz = clampRange(Math.max(baseStartHz, currentFreq * 0.012), 42, 140);
        const boomEndHz = clampRange(QUAKE_SYNTH_IMPACT_BOOM_END_HZ, 20, boomStartHz - 1);
        const subStartHz = clampRange(QUAKE_SYNTH_IMPACT_SUB_START_HZ, 20, 120);
        const subEndHz = clampRange(QUAKE_SYNTH_IMPACT_SUB_END_HZ, 16, subStartHz - 0.5);
        const currentGain = clampRange(synth.currentGain, QUAKE_SYNTH_GAIN_FLOOR, 1.5);
        const boomLevel = clampRange(QUAKE_SYNTH_IMPACT_BOOM_GAIN * (0.7 + currentGain * 0.52), 0.16, 1.6);
        const subLevel = clampRange(QUAKE_SYNTH_IMPACT_SUB_GAIN * (0.66 + currentGain * 0.52), 0.16, 1.8);
        const debrisLevel = clampRange(QUAKE_SYNTH_IMPACT_DEBRIS_GAIN, 0, 2);
        const airLevel = clampRange(QUAKE_SYNTH_IMPACT_AIR_GAIN, 0, 1.5);
        const rumbleLevel = clampRange(QUAKE_SYNTH_IMPACT_RUMBLE_GAIN, 0, 2);

        const clickSource = ctx.createBufferSource();
        clickSource.buffer = createImpactNoiseBuffer(ctx, clampRange(QUAKE_SYNTH_ATTACK_CLICK_MS, 2, 40) / 1000);

        const clickHpf = ctx.createBiquadFilter();
        clickHpf.type = 'highpass';
        clickHpf.frequency.value = 500;
        clickHpf.Q.value = 0.2;

        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(clampRange(QUAKE_SYNTH_ATTACK_CLICK_GAIN, 0, 1.5), now);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

        clickSource.connect(clickHpf);
        clickHpf.connect(clickGain);
        clickGain.connect(quakeMasterGainNode);

        const impactGain = ctx.createGain();
        impactGain.gain.value = QUAKE_SYNTH_GAIN_FLOOR;

        const subGain = ctx.createGain();
        subGain.gain.value = QUAKE_SYNTH_GAIN_FLOOR;

        const rumbleGain = ctx.createGain();
        rumbleGain.gain.value = QUAKE_SYNTH_GAIN_FLOOR;

        const bodyDrive = ctx.createWaveShaper();
        bodyDrive.curve = createSoftClipCurve(2.8);
        bodyDrive.oversample = '4x';

        const bodyTone = ctx.createBiquadFilter();
        bodyTone.type = 'lowpass';
        bodyTone.frequency.value = 560;
        bodyTone.Q.value = 0.68;

        impactGain.connect(bodyDrive);
        bodyDrive.connect(bodyTone);
        bodyTone.connect(quakeMasterGainNode);
        subGain.connect(quakeMasterGainNode);
        rumbleGain.connect(quakeMasterGainNode);

        const boomOsc = ctx.createOscillator();
        const boomSubOsc = ctx.createOscillator();
        boomOsc.type = 'triangle';
        boomSubOsc.type = 'sine';

        boomOsc.frequency.setValueAtTime(boomStartHz, now);
        boomOsc.frequency.exponentialRampToValueAtTime(boomEndHz, now + durationSec * 0.78);
        boomSubOsc.frequency.setValueAtTime(Math.max(18, boomStartHz * 0.52), now);
        boomSubOsc.frequency.exponentialRampToValueAtTime(Math.max(16.5, boomEndHz * 0.72), now + durationSec * 1.04);

        const lfeOsc = ctx.createOscillator();
        lfeOsc.type = 'sine';
        lfeOsc.frequency.setValueAtTime(subStartHz, now);
        lfeOsc.frequency.exponentialRampToValueAtTime(subEndHz, now + durationSec * 1.52);

        const shockOsc = ctx.createOscillator();
        const shockGain = ctx.createGain();
        const shockStart = now + (clampRange(QUAKE_SYNTH_IMPACT_SHOCK_DELAY_MS, 0, 700) / 1000);
        const shockLevel = clampRange(QUAKE_SYNTH_IMPACT_SHOCK_GAIN, 0, 1.8);
        shockOsc.type = 'sine';
        shockOsc.frequency.setValueAtTime(52, shockStart);
        shockOsc.frequency.exponentialRampToValueAtTime(28, shockStart + 0.34);
        shockGain.gain.setValueAtTime(QUAKE_SYNTH_GAIN_FLOOR, shockStart);
        shockGain.gain.linearRampToValueAtTime(shockLevel, shockStart + 0.02);
        shockGain.gain.exponentialRampToValueAtTime(0.0001, shockStart + 0.4);

        impactGain.gain.setValueAtTime(QUAKE_SYNTH_GAIN_FLOOR, now);
        impactGain.gain.linearRampToValueAtTime(boomLevel, now + 0.012);
        impactGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec * 1.24);

        subGain.gain.setValueAtTime(QUAKE_SYNTH_GAIN_FLOOR, now);
        subGain.gain.linearRampToValueAtTime(subLevel, now + 0.024);
        subGain.gain.exponentialRampToValueAtTime(0.00008, now + durationSec * 1.64);

        const debrisSource = ctx.createBufferSource();
        debrisSource.buffer = createImpactNoiseBuffer(ctx, durationSec * 0.25);

        const debrisHpf = ctx.createBiquadFilter();
        debrisHpf.type = 'highpass';
        debrisHpf.frequency.value = clampRange(QUAKE_SYNTH_IMPACT_DEBRIS_HPF_HZ, 900, 16000);
        debrisHpf.Q.value = 0.46;

        const debrisLpf = ctx.createBiquadFilter();
        debrisLpf.type = 'lowpass';
        debrisLpf.frequency.value = clampRange(QUAKE_SYNTH_IMPACT_DEBRIS_LPF_HZ, 1500, 19000);
        debrisLpf.Q.value = 0.0001;

        const debrisGain = ctx.createGain();
        debrisGain.gain.setValueAtTime(debrisLevel, now);
        debrisGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

        const airSource = ctx.createBufferSource();
        airSource.buffer = createImpactNoiseBuffer(ctx, durationSec * 0.7);

        const airHpf = ctx.createBiquadFilter();
        airHpf.type = 'highpass';
        airHpf.frequency.value = clampRange(QUAKE_SYNTH_IMPACT_AIR_HPF_HZ, 20, 600);
        airHpf.Q.value = 0.22;

        const airLpf = ctx.createBiquadFilter();
        airLpf.type = 'lowpass';
        airLpf.frequency.value = clampRange(QUAKE_SYNTH_IMPACT_AIR_LPF_HZ, 140, 2000);
        airLpf.Q.value = 0.18;

        const airGain = ctx.createGain();
        airGain.gain.setValueAtTime(airLevel, now + 0.01);
        airGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec * 0.8);

        const rumbleSource = ctx.createBufferSource();
        rumbleSource.buffer = createImpactRumbleBuffer(ctx, QUAKE_SYNTH_IMPACT_RUMBLE_SECONDS);

        const rumbleLpf = ctx.createBiquadFilter();
        rumbleLpf.type = 'lowpass';
        rumbleLpf.frequency.setValueAtTime(116, now);
        rumbleLpf.frequency.exponentialRampToValueAtTime(56, now + clampRange(QUAKE_SYNTH_IMPACT_RUMBLE_SECONDS, 0.6, 8));
        rumbleLpf.Q.value = 0.0001;

        const rumbleHpf = ctx.createBiquadFilter();
        rumbleHpf.type = 'highpass';
        rumbleHpf.frequency.value = 18;
        rumbleHpf.Q.value = 0.0001;

        rumbleGain.gain.setValueAtTime(QUAKE_SYNTH_GAIN_FLOOR, now + 0.03);
        rumbleGain.gain.linearRampToValueAtTime(rumbleLevel, now + 0.16);
        rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + clampRange(QUAKE_SYNTH_IMPACT_RUMBLE_SECONDS, 0.6, 8));

        boomOsc.connect(impactGain);
        boomSubOsc.connect(impactGain);
        lfeOsc.connect(subGain);
        shockOsc.connect(shockGain);
        shockGain.connect(subGain);

        debrisSource.connect(debrisHpf);
        debrisHpf.connect(debrisLpf);
        debrisLpf.connect(debrisGain);
        debrisGain.connect(impactGain);

        airSource.connect(airHpf);
        airHpf.connect(airLpf);
        airLpf.connect(airGain);
        airGain.connect(quakeMasterGainNode);

        rumbleSource.connect(rumbleLpf);
        rumbleLpf.connect(rumbleHpf);
        rumbleHpf.connect(rumbleGain);

        try {
            boomOsc.start(now);
            boomSubOsc.start(now);
            lfeOsc.start(now);
            shockOsc.start(shockStart);
            debrisSource.start(now);
            airSource.start(now);
            rumbleSource.start(now + 0.04);
            clickSource.start(now);
        } catch {
            return;
        }

        const rumbleSec = clampRange(QUAKE_SYNTH_IMPACT_RUMBLE_SECONDS, 0.6, 8);
        const stopAt = now + durationSec * 1.75;
        try { boomOsc.stop(stopAt); } catch {}
        try { boomSubOsc.stop(stopAt); } catch {}
        try { lfeOsc.stop(stopAt + 0.14); } catch {}
        try { shockOsc.stop(shockStart + 0.45); } catch {}
        try { debrisSource.stop(now + durationSec * 0.28); } catch {}
        try { airSource.stop(now + durationSec * 0.86); } catch {}
        try { rumbleSource.stop(now + rumbleSec); } catch {}
        try { clickSource.stop(now + 0.07); } catch {}

        setTimeout(() => {
            try { boomOsc.disconnect(); } catch {}
            try { boomSubOsc.disconnect(); } catch {}
            try { lfeOsc.disconnect(); } catch {}
            try { shockOsc.disconnect(); } catch {}
            try { shockGain.disconnect(); } catch {}
            try { debrisSource.disconnect(); } catch {}
            try { debrisHpf.disconnect(); } catch {}
            try { debrisLpf.disconnect(); } catch {}
            try { debrisGain.disconnect(); } catch {}
            try { airSource.disconnect(); } catch {}
            try { airHpf.disconnect(); } catch {}
            try { airLpf.disconnect(); } catch {}
            try { airGain.disconnect(); } catch {}
            try { rumbleSource.disconnect(); } catch {}
            try { rumbleLpf.disconnect(); } catch {}
            try { rumbleHpf.disconnect(); } catch {}
            try { rumbleGain.disconnect(); } catch {}
            try { impactGain.disconnect(); } catch {}
            try { subGain.disconnect(); } catch {}
            try { bodyDrive.disconnect(); } catch {}
            try { bodyTone.disconnect(); } catch {}
            try { clickSource.disconnect(); } catch {}
            try { clickHpf.disconnect(); } catch {}
            try { clickGain.disconnect(); } catch {}
        }, Math.ceil((Math.max(durationSec * 1.75, rumbleSec) + 0.3) * 1000));
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

            quakeMasterCompressorNode = quakeAudioCtx.createDynamicsCompressor();
            quakeMasterCompressorNode.threshold.value = clampRange(QUAKE_SYNTH_MASTER_COMP_THRESHOLD, -60, 0);
            quakeMasterCompressorNode.knee.value = clampRange(QUAKE_SYNTH_MASTER_COMP_KNEE, 0, 40);
            quakeMasterCompressorNode.ratio.value = clampRange(QUAKE_SYNTH_MASTER_COMP_RATIO, 1, 20);
            quakeMasterCompressorNode.attack.value = clampRange(QUAKE_SYNTH_MASTER_COMP_ATTACK, 0, 1);
            quakeMasterCompressorNode.release.value = clampRange(QUAKE_SYNTH_MASTER_COMP_RELEASE, 0, 1);

            quakeWidenerDelayNode = quakeAudioCtx.createDelay(0.05);
            quakeWidenerDelayNode.delayTime.value = clampRange(QUAKE_SYNTH_STEREO_WIDTH_MS, 0, 45) / 1000;
            quakeWidenerLeftPanner = quakeAudioCtx.createStereoPanner();
            quakeWidenerRightPanner = quakeAudioCtx.createStereoPanner();
            quakeWidenerLeftPanner.pan.value = -1;
            quakeWidenerRightPanner.pan.value = 1;

            quakeDryGainNode.connect(quakeMasterCompressorNode);
            quakeWetGainNode.connect(quakeMasterCompressorNode);

            quakeMasterCompressorNode.connect(quakeWidenerLeftPanner);
            quakeMasterCompressorNode.connect(quakeWidenerDelayNode);
            quakeWidenerDelayNode.connect(quakeWidenerRightPanner);

            quakeWidenerLeftPanner.connect(quakeAudioCtx.destination);
            quakeWidenerRightPanner.connect(quakeAudioCtx.destination);
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
        const colorDriveInput = ctx.createGain();
        const colorDrive = ctx.createWaveShaper();
        const colorFilter = ctx.createBiquadFilter();
        const colorOutput = ctx.createGain();

        synthGain.gain.value = QUAKE_SYNTH_GAIN_FLOOR;
        colorDriveInput.gain.value = clampRange(QUAKE_SYNTH_COLOR_DRIVE, 1, 8);
        colorDrive.curve = createSoftClipCurve(QUAKE_SYNTH_COLOR_DRIVE);
        colorDrive.oversample = '2x';
        colorFilter.type = 'lowpass';
        colorFilter.frequency.value = clampRange(QUAKE_SYNTH_COLOR_FILTER_START_HZ, 120, 18000);
        colorFilter.Q.value = clampRange(QUAKE_SYNTH_COLOR_FILTER_Q, 0.0001, 12);
        colorOutput.gain.value = clampRange(QUAKE_SYNTH_COLOR_POST_GAIN, 0.05, 2);

        const tensionPulseGain = ctx.createGain();
        tensionPulseGain.gain.value = 1;

        synthGain.connect(tensionPulseGain);
        tensionPulseGain.connect(colorDriveInput);
        colorDriveInput.connect(colorDrive);
        colorDrive.connect(colorFilter);
        colorFilter.connect(colorOutput);

        const chorusNodes = [];
        if (QUAKE_SYNTH_CHORUS_ENABLED) {
            const chorusInputGain = ctx.createGain();
            const chorusDryGain = ctx.createGain();
            const chorusWetGain = ctx.createGain();
            const chorusMixGain = ctx.createGain();
            const wetMix = clampRange(QUAKE_SYNTH_CHORUS_MIX, 0, 1);
            chorusDryGain.gain.value = 1 - wetMix;
            chorusWetGain.gain.value = wetMix;

            colorOutput.connect(chorusInputGain);
            chorusInputGain.connect(chorusDryGain);
            chorusDryGain.connect(chorusMixGain);

            const delayMsList = Array.isArray(QUAKE_SYNTH_CHORUS_DELAYS_MS) && QUAKE_SYNTH_CHORUS_DELAYS_MS.length
                ? QUAKE_SYNTH_CHORUS_DELAYS_MS
                : [10, 16, 22];
            const rateList = Array.isArray(QUAKE_SYNTH_CHORUS_RATES_HZ) && QUAKE_SYNTH_CHORUS_RATES_HZ.length
                ? QUAKE_SYNTH_CHORUS_RATES_HZ
                : [0.2, 0.25, 0.3];
            const depthSec = clampRange(QUAKE_SYNTH_CHORUS_DEPTH_MS, 0, 20) / 1000;

            delayMsList.forEach((ms, vIdx) => {
                const baseSec = clampRange(ms, 1, 40) / 1000;
                const voiceDelay = ctx.createDelay(0.08);
                voiceDelay.delayTime.value = baseSec;

                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.type = 'sine';
                lfo.frequency.value = clampRange(Number(rateList[vIdx]) || 0.2, 0.02, 4);
                lfoGain.gain.value = depthSec;
                lfo.connect(lfoGain);
                lfoGain.connect(voiceDelay.delayTime);

                const voicePan = ctx.createStereoPanner();
                voicePan.pan.value = clampRange(((vIdx / Math.max(1, delayMsList.length - 1)) - 0.5) * 1.6, -1, 1);

                chorusInputGain.connect(voiceDelay);
                voiceDelay.connect(voicePan);
                voicePan.connect(chorusWetGain);

                try { lfo.start(); } catch {}

                chorusNodes.push(voiceDelay, lfo, lfoGain, voicePan);
            });

            chorusWetGain.connect(chorusMixGain);
            chorusMixGain.connect(quakeMasterGainNode);
            chorusNodes.push(chorusInputGain, chorusDryGain, chorusWetGain, chorusMixGain);
        } else {
            colorOutput.connect(quakeMasterGainNode);
        }

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

            const wavePan = ctx.createStereoPanner();
            const panSpread = clampRange(QUAKE_SYNTH_PAN_SPREAD, 0, 1);
            const panPos = waveTypes.length > 1
                ? ((idx / (waveTypes.length - 1)) - 0.5) * 2 * panSpread
                : 0;
            wavePan.pan.value = clampRange(panPos, -1, 1);

            osc.connect(waveGain);
            waveGain.connect(wavePan);
            wavePan.connect(synthGain);

            try {
                osc.start();
            } catch {
                // Ignore duplicate-start issues; synth will still cleanup safely.
            }

            waves.push({
                osc,
                waveGain,
                wavePan,
                baseGain: waveGain.gain.value,
                colorPhase: (seed * (idx + 5) * 0.00023) % (Math.PI * 2),
                freqRatio: clampRange(Number(QUAKE_SYNTH_WAVE_FREQ_MULTIPLIERS[idx]) || 1, 0.12, 6),
                motionRate: clampRange(Number(QUAKE_SYNTH_WAVE_MOTION_RATES[idx]) || 1, 0.2, 9),
                motionDepth: clampRange(Number(QUAKE_SYNTH_WAVE_MOTION_DEPTHS[idx]) || 0, 0, 0.2)
            });
        });

        let riserSource = null;
        let riserFilter = null;
        let riserGain = null;
        if (QUAKE_SYNTH_RISER_ENABLED) {
            riserSource = ctx.createBufferSource();
            riserSource.buffer = createLoopableNoiseBuffer(ctx, QUAKE_SYNTH_RISER_LOOP_SECONDS);
            riserSource.loop = true;

            riserFilter = ctx.createBiquadFilter();
            riserFilter.type = 'bandpass';
            riserFilter.frequency.value = clampRange(QUAKE_SYNTH_RISER_START_HZ, 60, 12000);
            riserFilter.Q.value = clampRange(QUAKE_SYNTH_RISER_Q, 0.2, 14);

            riserGain = ctx.createGain();
            riserGain.gain.value = QUAKE_SYNTH_GAIN_FLOOR;

            riserSource.connect(riserFilter);
            riserFilter.connect(riserGain);
            riserGain.connect(quakeMasterGainNode);

            try { riserSource.start(); } catch {}
        }

        return {
            ctx,
            synthGain,
            tensionPulseGain,
            colorDriveInput,
            colorDrive,
            colorFilter,
            colorOutput,
            chorusNodes,
            riserSource,
            riserFilter,
            riserGain,
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
        const smooth = clampRange(QUAKE_SYNTH_PARAM_SMOOTH_SEC, 0.002, 0.08);
        const nyquistSafe = Math.max(30, (synth.ctx.sampleRate * 0.5) - 250);
        const safeFreq = clampRange(targetFreq, 0.1, nyquistSafe);
        const safeGain = clampRange(targetGain, QUAKE_SYNTH_GAIN_FLOOR, 3);
        const colorStartHz = clampRange(QUAKE_SYNTH_COLOR_FILTER_START_HZ, 80, 18000);
        const colorEndHz = clampRange(QUAKE_SYNTH_COLOR_FILTER_END_HZ, colorStartHz + 1, 22000);
        const colorOpen = clamp01(Math.pow(p, 0.72));
        const colorHz = colorStartHz * Math.pow(colorEndHz / colorStartHz, colorOpen);
        const waveCount = Math.max(1, synth.waves.length);

        synth.currentFreq = safeFreq;
        synth.currentGain = safeGain;

        synth.synthGain.gain.setTargetAtTime(safeGain, now, smooth);
        if (synth.colorFilter) {
            synth.colorFilter.frequency.setTargetAtTime(colorHz, now, smooth);
            synth.colorFilter.Q.setTargetAtTime(clampRange(QUAKE_SYNTH_COLOR_FILTER_Q + p * 0.46, 0.0001, 18), now, smooth);
        }

        synth.waves.forEach((w, idx) => {
            const tilt = (idx / Math.max(1, waveCount - 1)) - 0.42;
            const movement = Math.sin((p * Math.PI * 8.5) + w.colorPhase) * 0.07;
            const emphasis = 1 + (tilt * (0.34 + p * 1.1)) + movement;
            const waveLevel = clampRange(w.baseGain * emphasis, 0.02, 1.1);
            const freqMotion = Math.sin((p * Math.PI * 2 * w.motionRate) + w.colorPhase * 1.7) * w.motionDepth;
            const waveFreq = clampRange(safeFreq * w.freqRatio * (1 + freqMotion), 0.1, nyquistSafe);
            w.waveGain.gain.setTargetAtTime(waveLevel, now, smooth);
            w.osc.frequency.setTargetAtTime(waveFreq, now, smooth);
        });

        if (synth.riserGain && synth.riserFilter) {
            const riserStartHz = clampRange(QUAKE_SYNTH_RISER_START_HZ, 60, 12000);
            const riserEndHz = clampRange(QUAKE_SYNTH_RISER_END_HZ, riserStartHz + 1, 18000);
            const riserProg = clamp01(Math.pow(p, 1.3));
            const riserHz = riserStartHz * Math.pow(riserEndHz / riserStartHz, riserProg);
            const riserMaxGain = clampRange(QUAKE_SYNTH_RISER_MAX_GAIN, 0, 2);
            const riserLevel = QUAKE_SYNTH_GAIN_FLOOR + (riserMaxGain - QUAKE_SYNTH_GAIN_FLOOR) * Math.pow(p, 2.1);
            synth.riserFilter.frequency.setTargetAtTime(clampRange(riserHz, 40, nyquistSafe), now, smooth);
            synth.riserGain.gain.setTargetAtTime(clampRange(riserLevel, QUAKE_SYNTH_GAIN_FLOOR, 2), now, smooth);
        }

        if (synth.tensionPulseGain) {
            const tensionStartHz = clampRange(QUAKE_SYNTH_TENSION_START_HZ, 0.1, 20);
            const tensionEndHz = clampRange(QUAKE_SYNTH_TENSION_END_HZ, tensionStartHz + 0.05, 24);
            const tensionRate = tensionStartHz * Math.pow(tensionEndHz / tensionStartHz, p);
            const depth = clampRange(QUAKE_SYNTH_TENSION_DEPTH, 0, 0.9) * p;
            const throb = 1 + Math.sin(now * Math.PI * 2 * tensionRate) * depth;
            synth.tensionPulseGain.gain.setTargetAtTime(clampRange(throb, 0.05, 1.8), now, smooth * 0.6);
        }
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

        triggerImpactBoom(synth);

        synth.synthGain.gain.cancelScheduledValues(now);
        synth.synthGain.gain.setValueAtTime(currentGain, now);
        synth.synthGain.gain.setTargetAtTime(QUAKE_SYNTH_GAIN_FLOOR, now, timeConst);

        if (synth.tensionPulseGain) {
            synth.tensionPulseGain.gain.cancelScheduledValues(now);
            synth.tensionPulseGain.gain.setTargetAtTime(1, now, 0.08);
        }

        if (synth.riserGain && synth.riserFilter) {
            synth.riserGain.gain.cancelScheduledValues(now);
            synth.riserGain.gain.setValueAtTime(synth.riserGain.gain.value, now);
            synth.riserGain.gain.setTargetAtTime(QUAKE_SYNTH_GAIN_FLOOR, now, 0.05);
        }

        if (synth.colorFilter) {
            synth.colorFilter.frequency.cancelScheduledValues(now);
            synth.colorFilter.frequency.setValueAtTime(clampRange(synth.colorFilter.frequency.value, 60, 20000), now);
            synth.colorFilter.frequency.exponentialRampToValueAtTime(110, now + 0.42);
            synth.colorFilter.Q.cancelScheduledValues(now);
            synth.colorFilter.Q.setValueAtTime(clampRange(synth.colorFilter.Q.value, 0.0001, 18), now);
            synth.colorFilter.Q.linearRampToValueAtTime(0.0001, now + 0.42);
        }

        synth.waves.forEach(w => {
            w.osc.frequency.cancelScheduledValues(now);
            w.osc.frequency.setValueAtTime(currentFreq, now);
            w.osc.frequency.setTargetAtTime(Math.max(18, floorFreq * w.freqRatio), now, timeConst);
        });

        const stopDelay = decayMs + clampRange(QUAKE_SYNTH_STOP_PADDING_MS, 20, 3000);
        synth.stopTimer = setTimeout(() => {
            synth.waves.forEach(w => {
                try { w.osc.stop(); } catch {}
                try { w.osc.disconnect(); } catch {}
                try { w.waveGain.disconnect(); } catch {}
                try { w.wavePan.disconnect(); } catch {}
            });
            try { synth.synthGain.disconnect(); } catch {}
            try { synth.tensionPulseGain.disconnect(); } catch {}
            try { synth.colorDriveInput.disconnect(); } catch {}
            try { synth.colorDrive.disconnect(); } catch {}
            try { synth.colorFilter.disconnect(); } catch {}
            try { synth.colorOutput.disconnect(); } catch {}
            (synth.chorusNodes || []).forEach(node => {
                try { node.stop && node.stop(); } catch {}
                try { node.disconnect(); } catch {}
            });
            if (synth.riserSource) {
                try { synth.riserSource.stop(); } catch {}
                try { synth.riserSource.disconnect(); } catch {}
            }
            try { synth.riserFilter && synth.riserFilter.disconnect(); } catch {}
            try { synth.riserGain && synth.riserGain.disconnect(); } catch {}
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
            synthWaveFreqMultipliers: QUAKE_SYNTH_WAVE_FREQ_MULTIPLIERS,
            synthWaveMotionRates: QUAKE_SYNTH_WAVE_MOTION_RATES,
            synthWaveMotionDepths: QUAKE_SYNTH_WAVE_MOTION_DEPTHS,
            synthColorFilterStartHz: QUAKE_SYNTH_COLOR_FILTER_START_HZ,
            synthColorFilterEndHz: QUAKE_SYNTH_COLOR_FILTER_END_HZ,
            synthColorFilterQ: QUAKE_SYNTH_COLOR_FILTER_Q,
            synthColorDrive: QUAKE_SYNTH_COLOR_DRIVE,
            synthColorPostGain: QUAKE_SYNTH_COLOR_POST_GAIN,
            synthDecayMs: QUAKE_SYNTH_DECAY_MS,
            synthDecayFreqFloorHz: QUAKE_SYNTH_DECAY_FREQ_FLOOR_HZ,
            synthDecayExpFactor: QUAKE_SYNTH_DECAY_EXP_FACTOR,
            synthStopPaddingMs: QUAKE_SYNTH_STOP_PADDING_MS,
            synthImpactEnabled: QUAKE_SYNTH_IMPACT_ENABLED,
            synthImpactDurationMs: QUAKE_SYNTH_IMPACT_DURATION_MS,
            synthImpactBoomStartHz: QUAKE_SYNTH_IMPACT_BOOM_START_HZ,
            synthImpactBoomEndHz: QUAKE_SYNTH_IMPACT_BOOM_END_HZ,
            synthImpactBoomGain: QUAKE_SYNTH_IMPACT_BOOM_GAIN,
            synthImpactDebrisGain: QUAKE_SYNTH_IMPACT_DEBRIS_GAIN,
            synthImpactDebrisHpfHz: QUAKE_SYNTH_IMPACT_DEBRIS_HPF_HZ,
            synthImpactDebrisLpfHz: QUAKE_SYNTH_IMPACT_DEBRIS_LPF_HZ,
            synthImpactAirGain: QUAKE_SYNTH_IMPACT_AIR_GAIN,
            synthImpactAirHpfHz: QUAKE_SYNTH_IMPACT_AIR_HPF_HZ,
            synthImpactAirLpfHz: QUAKE_SYNTH_IMPACT_AIR_LPF_HZ,
            synthImpactSubStartHz: QUAKE_SYNTH_IMPACT_SUB_START_HZ,
            synthImpactSubEndHz: QUAKE_SYNTH_IMPACT_SUB_END_HZ,
            synthImpactSubGain: QUAKE_SYNTH_IMPACT_SUB_GAIN,
            synthImpactRumbleGain: QUAKE_SYNTH_IMPACT_RUMBLE_GAIN,
            synthImpactRumbleSeconds: QUAKE_SYNTH_IMPACT_RUMBLE_SECONDS,
            synthImpactShockDelayMs: QUAKE_SYNTH_IMPACT_SHOCK_DELAY_MS,
            synthImpactShockGain: QUAKE_SYNTH_IMPACT_SHOCK_GAIN,
            synthAttackClickGain: QUAKE_SYNTH_ATTACK_CLICK_GAIN,
            synthAttackClickMs: QUAKE_SYNTH_ATTACK_CLICK_MS,
            synthParamSmoothSec: QUAKE_SYNTH_PARAM_SMOOTH_SEC,
            synthPanSpread: QUAKE_SYNTH_PAN_SPREAD,
            synthChorusEnabled: QUAKE_SYNTH_CHORUS_ENABLED,
            synthChorusDelaysMs: QUAKE_SYNTH_CHORUS_DELAYS_MS,
            synthChorusRatesHz: QUAKE_SYNTH_CHORUS_RATES_HZ,
            synthChorusDepthMs: QUAKE_SYNTH_CHORUS_DEPTH_MS,
            synthChorusMix: QUAKE_SYNTH_CHORUS_MIX,
            synthRiserEnabled: QUAKE_SYNTH_RISER_ENABLED,
            synthRiserStartHz: QUAKE_SYNTH_RISER_START_HZ,
            synthRiserEndHz: QUAKE_SYNTH_RISER_END_HZ,
            synthRiserQ: QUAKE_SYNTH_RISER_Q,
            synthRiserMaxGain: QUAKE_SYNTH_RISER_MAX_GAIN,
            synthRiserLoopSeconds: QUAKE_SYNTH_RISER_LOOP_SECONDS,
            synthTensionStartHz: QUAKE_SYNTH_TENSION_START_HZ,
            synthTensionEndHz: QUAKE_SYNTH_TENSION_END_HZ,
            synthTensionDepth: QUAKE_SYNTH_TENSION_DEPTH,
            synthMasterCompThreshold: QUAKE_SYNTH_MASTER_COMP_THRESHOLD,
            synthMasterCompKnee: QUAKE_SYNTH_MASTER_COMP_KNEE,
            synthMasterCompRatio: QUAKE_SYNTH_MASTER_COMP_RATIO,
            synthMasterCompAttack: QUAKE_SYNTH_MASTER_COMP_ATTACK,
            synthMasterCompRelease: QUAKE_SYNTH_MASTER_COMP_RELEASE,
            synthStereoWidthMs: QUAKE_SYNTH_STEREO_WIDTH_MS,
            synthReverbEnabled: QUAKE_SYNTH_REVERB_ENABLED,
            synthReverbMix: QUAKE_SYNTH_REVERB_MIX,
            synthReverbPreDelayMs: QUAKE_SYNTH_REVERB_PREDELAY_MS,
            synthReverbDecaySeconds: QUAKE_SYNTH_REVERB_DECAY_SECONDS,
            synthReverbIrSeconds: QUAKE_SYNTH_REVERB_IR_SECONDS,
            synthReverbToneHz: QUAKE_SYNTH_REVERB_TONE_HZ
        }
    };
})(window);
