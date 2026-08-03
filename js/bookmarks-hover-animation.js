/* ============================================================
   Advanced Bookmarks — hover animation module
   Keeps the hover-driven quake visuals and ripple/glitch effects
   isolated from the bookmark UI controller.
   ============================================================ */
(function (root) {
    'use strict';

    const quakeSound = root.bookmarksQuakeSound;
    const quakeConfig = (quakeSound && quakeSound.constants) || {};

    const quakeStates = new Map();
    let quakeRafId = 0;
    let corrosionFilterReady = false;

    function clamp01(value) {
        if (quakeSound && typeof quakeSound.clamp01 === 'function') {
            return quakeSound.clamp01(value);
        }
        return Math.max(0, Math.min(1, value));
    }

    function smoothStep(value) {
        const t = clamp01(value);
        return t * t * (3 - 2 * t);
    }

    function lerp(from, to, amount) {
        return from + ((to - from) * amount);
    }

    function resetIconQuakeStyle(icon) {
        if (!icon) return;
        icon.classList.remove('bm-quake-active', 'bm-quake-gone');
        icon.style.transform = '';
        icon.style.filter = '';
        icon.style.opacity = '';
        icon.style.boxShadow = '';
        icon.style.clipPath = '';
        icon.style.removeProperty('--bm-corrosion-opacity');
        icon.style.removeProperty('--bm-corrosion-shift-x');
        icon.style.removeProperty('--bm-corrosion-shift-y');
        icon.style.removeProperty('--bm-corrosion-rot');
        icon.style.removeProperty('--bm-corrosion-scale');
        icon.style.removeProperty('--bm-corrosion-bite-a');
        icon.style.removeProperty('--bm-corrosion-bite-b');
        icon.style.removeProperty('--bm-corrosion-bite-c');
        icon.style.removeProperty('--bm-corrosion-bite-d');
        icon.style.removeProperty('--bm-corrosion-bite-e');
        icon.style.removeProperty('--bm-corrosion-bite-f');
    }

    function ensureCorrosionFilter() {
        if (corrosionFilterReady) return;
        if (document.getElementById('bmQuakeFxDefs')) {
            corrosionFilterReady = true;
            return;
        }

        const svgNs = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNs, 'svg');
        svg.setAttribute('id', 'bmQuakeFxDefs');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.position = 'absolute';
        svg.style.width = '0';
        svg.style.height = '0';
        svg.style.overflow = 'hidden';

        const filter = document.createElementNS(svgNs, 'filter');
        filter.setAttribute('id', 'bmQuakeCorrosion');
        filter.setAttribute('x', '-30%');
        filter.setAttribute('y', '-30%');
        filter.setAttribute('width', '160%');
        filter.setAttribute('height', '160%');

        const noise = document.createElementNS(svgNs, 'feTurbulence');
        noise.setAttribute('type', 'fractalNoise');
        noise.setAttribute('baseFrequency', '0.95');
        noise.setAttribute('numOctaves', '2');
        noise.setAttribute('seed', '17');
        noise.setAttribute('result', 'noise');

        const warp = document.createElementNS(svgNs, 'feDisplacementMap');
        warp.setAttribute('in', 'SourceGraphic');
        warp.setAttribute('in2', 'noise');
        warp.setAttribute('scale', '8');
        warp.setAttribute('xChannelSelector', 'R');
        warp.setAttribute('yChannelSelector', 'G');

        filter.appendChild(noise);
        filter.appendChild(warp);
        svg.appendChild(filter);
        document.body.appendChild(svg);

        corrosionFilterReady = true;
    }

    function ensureQuakeLoop() {
        if (quakeRafId) return;
        quakeRafId = requestAnimationFrame(runQuakeFrame);
    }

    function createQuakeSynth(seed) {
        if (quakeSound && typeof quakeSound.createQuakeSynth === 'function') {
            return quakeSound.createQuakeSynth(seed);
        }
        return null;
    }

    function setSynthBuildFrame(synth, buildProgress) {
        if (quakeSound && typeof quakeSound.setSynthBuildFrame === 'function') {
            quakeSound.setSynthBuildFrame(synth, buildProgress);
        }
    }

    function releaseQuakeSynth(synth, explode) {
        if (quakeSound && typeof quakeSound.releaseQuakeSynth === 'function') {
            quakeSound.releaseQuakeSynth(synth, { explode: explode !== false });
        }
    }

    function startSlotQuake(slot) {
        const icon = slot ? slot.querySelector('.bm-slot-icon') : null;
        if (!icon) return;

        stopSlotQuake(slot);
        ensureCorrosionFilter();

        const now = performance.now();
        quakeStates.set(icon, {
            slot,
            startMs: now,
            seed: Math.random() * 10000,
            gone: false,
            rippleTriggered: false,
            synth: null
        });

        icon.classList.add('bm-quake-active');
        ensureQuakeLoop();
    }

    function stopSlotQuake(slot) {
        const icon = slot ? slot.querySelector('.bm-slot-icon') : null;
        if (!icon) return;
        const state = quakeStates.get(icon);
        if (!state) return;

        if (state.synth) {
            releaseQuakeSynth(state.synth, false);
            state.synth = null;
        }

        quakeStates.delete(icon);
        resetIconQuakeStyle(icon);

        if (!quakeStates.size && quakeRafId) {
            cancelAnimationFrame(quakeRafId);
            quakeRafId = 0;
        }
    }

    function clearAllSlotQuakes() {
        quakeStates.forEach((state, icon) => {
            if (state && state.synth) {
                releaseQuakeSynth(state.synth, false);
                state.synth = null;
            }
            resetIconQuakeStyle(icon);
        });
        quakeStates.clear();
        if (quakeRafId) {
            cancelAnimationFrame(quakeRafId);
            quakeRafId = 0;
        }
    }

    function getQuakeState(icon) {
        return icon ? quakeStates.get(icon) || null : null;
    }

    function runQuakeFrame(now) {
        if (!quakeStates.size) {
            quakeRafId = 0;
            return;
        }

        quakeStates.forEach((state, icon) => {
            if (!icon.isConnected || !state.slot.matches(':hover')) {
                if (state.synth) {
                    releaseQuakeSynth(state.synth, false);
                    state.synth = null;
                }
                quakeStates.delete(icon);
                resetIconQuakeStyle(icon);
                return;
            }

            const elapsed = now - state.startMs;

            if (elapsed < (quakeConfig.holdMs || 5000)) {
                icon.style.transform = '';
                icon.style.filter = '';
                icon.style.opacity = '';
                icon.style.boxShadow = '';
                return;
            }

            const tremorElapsed = elapsed - (quakeConfig.holdMs || 5000);
            if (tremorElapsed < (quakeConfig.buildMs || 40000)) {
                if (!state.synth) {
                    state.synth = createQuakeSynth(state.seed);
                }
                if (state.synth) {
                    setSynthBuildFrame(state.synth, tremorElapsed / (quakeConfig.buildMs || 40000));
                }
                applyQuakeBuild(icon, tremorElapsed, state.seed);
                return;
            }

            const explodeElapsed = tremorElapsed - (quakeConfig.buildMs || 40000);
            if (explodeElapsed < (quakeConfig.explodeMs || 400)) {
                if (!state.rippleTriggered) {
                    state.rippleTriggered = true;
                    spawnExplosionRipple(icon, state.seed);
                    if (state.synth) {
                        releaseQuakeSynth(state.synth, true);
                        state.synth = null;
                    }
                }
                applyQuakeExplosion(icon, explodeElapsed, state.seed);
                return;
            }

            if (!state.gone) {
                state.gone = true;
                icon.classList.add('bm-quake-gone');
                icon.style.transform = 'translate3d(0,0,0) rotate(0deg) scale(0.01)';
                icon.style.filter = 'saturate(2.1) contrast(1.5) brightness(1.35) blur(4px)';
                icon.style.opacity = '0';
                icon.style.boxShadow = 'none';
            }
        });

        if (!quakeStates.size) {
            quakeRafId = 0;
            return;
        }

        quakeRafId = requestAnimationFrame(runQuakeFrame);
    }

    function spawnExplosionRipple(icon, seed) {
        const rect = icon.getBoundingClientRect();
        const cx = rect.left + (rect.width / 2);
        const cy = rect.top + (rect.height / 2);

        const ripple = document.createElement('div');
        ripple.className = 'bm-explosion-ripple';
        ripple.style.left = cx.toFixed(2) + 'px';
        ripple.style.top = cy.toFixed(2) + 'px';
        ripple.style.setProperty('--bm-ripple-hue', String(Math.floor((seed % 80) + 180)));
        ripple.style.setProperty('--bm-ripple-size', Math.max(180, Math.min(window.innerWidth, window.innerHeight) * 0.55).toFixed(2) + 'px');

        document.body.appendChild(ripple);

        const remove = () => {
            if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
        };

        ripple.addEventListener('animationend', remove, { once: true });
        setTimeout(remove, 2800);
    }

    function spawnBookmarksSectionGlitch(sectionEl, seed) {
        if (!sectionEl || !sectionEl.isConnected) return;
        const sectionRect = sectionEl.getBoundingClientRect();
        if (sectionRect.width < 2 || sectionRect.height < 2) return;

        const layer = document.createElement('div');
        layer.className = 'bm-explosion-glitch-layer';

        const clones = [];
        const colorClasses = ['bm-explosion-glitch-red', 'bm-explosion-glitch-cyan', 'bm-explosion-glitch-raw'];

        for (let i = 0; i < 3; i++) {
            const clone = document.createElement('div');
            clone.className = 'bm-explosion-glitch-clone ' + colorClasses[i];
            const sectionClone = sectionEl.cloneNode(true);
            sectionClone.removeAttribute('id');
            sectionClone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

            clone.style.left = sectionRect.left.toFixed(2) + 'px';
            clone.style.top = sectionRect.top.toFixed(2) + 'px';
            clone.style.width = sectionRect.width.toFixed(2) + 'px';
            clone.style.height = sectionRect.height.toFixed(2) + 'px';
            clone.style.transform = 'translate(0,0)';

            sectionClone.style.margin = '0';
            sectionClone.style.width = sectionRect.width.toFixed(2) + 'px';
            sectionClone.style.maxWidth = 'none';
            sectionClone.style.minWidth = '0';

            clone.appendChild(sectionClone);
            layer.appendChild(clone);
            clones.push(clone);
        }

        document.body.appendChild(layer);

        const maxShift = Math.max(16, Math.min(52, Math.min(window.innerWidth, window.innerHeight) * 0.045));
        const interval = setInterval(() => {
            const now = performance.now() * 0.001;
            clones.forEach((clone, i) => {
                const clipTop = Math.random() * 88;
                const clipBottom = Math.max(0, 100 - (clipTop + (Math.random() * 26)));
                const dx = (Math.random() - 0.5) * maxShift;
                const dy = (Math.random() > 0.75) ? (Math.random() - 0.5) * 11 : 0;
                const skew = Math.sin((now * 35) + seed + i) * 4.8;

                clone.style.clipPath = 'inset(' + clipTop.toFixed(2) + '% 0 ' + clipBottom.toFixed(2) + '% 0)';
                clone.style.transform =
                    'translate(' + dx.toFixed(2) + 'px, ' + dy.toFixed(2) + 'px) skewX(' + skew.toFixed(2) + 'deg)';
            });
        }, 36);

        const cleanup = () => {
            clearInterval(interval);
            if (layer.parentNode) layer.parentNode.removeChild(layer);
        };

        setTimeout(cleanup, quakeConfig.sectionGlitchDurationMs || 360);
    }

    function applyQuakeBuild(icon, tremorElapsed, seed) {
        const t = Math.min(1, tremorElapsed / (quakeConfig.buildMs || 40000));
        const ts = tremorElapsed / 1000;
        const entry = smoothStep(tremorElapsed / (quakeConfig.entryRampMs || 1600));
        const ramp = Math.pow(t, 2.2);
        const ampPx = 0.08 + (0.45 * t) + (10.5 * ramp);
        const rotAmp = 0.03 + (0.2 * t) + (6.4 * ramp);
        const scale = 1.06 + (0.03 * t) + (0.2 * Math.pow(t, 2.7));

        const f1 = 17 + 48 * t;
        const f2 = 29 + 56 * t;
        const f3 = 43 + 70 * t;
        const drift = Math.sin((ts * 0.85) + seed * 0.0043) * (0.3 + 1.9 * t);

        const x = ampPx * (
            0.7 * Math.sin((ts * f1) + seed * 0.73) +
            0.45 * Math.sin((ts * f2 * 1.07) + seed * 1.31 + drift) +
            0.22 * Math.sin((ts * f3 * 0.93) + seed * 2.17)
        );

        const y = ampPx * (
            0.66 * Math.sin((ts * f1 * 1.11) + seed * 2.29 - drift * 0.6) +
            0.41 * Math.sin((ts * f2 * 0.89) + seed * 0.58) +
            0.24 * Math.sin((ts * f3 * 1.21) + seed * 1.67)
        );

        const rot = rotAmp * (
            0.65 * Math.sin((ts * f1 * 0.91) + seed * 1.1) +
            0.35 * Math.sin((ts * f2 * 1.13) + seed * 2.7)
        );

        const pulse = Math.pow(Math.max(0, Math.sin((ts * (2.1 + t * 4.6)) + seed * 0.013)), 6);
        const pulseBoost = 1 + pulse * (0.15 + t * 0.55);

        const hintDist = Math.abs(tremorElapsed - (quakeConfig.corrosionHintAtMs || 20000));
        const hintRaw = Math.max(0, 1 - (hintDist / (quakeConfig.corrosionHintSpanMs || 140)));
        const corrosionHint = Math.pow(hintRaw, 2.4);

        const corrosionStart = (quakeConfig.buildMs || 40000) - (quakeConfig.corrosionRampMs || 10000);
        const corrosionRamp = Math.max(0, Math.min(1, (tremorElapsed - corrosionStart) / (quakeConfig.corrosionRampMs || 10000)));
        const corrosionLevel = Math.max(corrosionHint, corrosionRamp);

        const buildX = x * pulseBoost;
        const buildY = y * pulseBoost;
        const buildRot = rot * pulseBoost;
        const buildScale = scale + pulse * 0.06 + corrosionLevel * 0.025;
        icon.style.transform =
            'translate3d(' + lerp(0, buildX, entry).toFixed(3) + 'px,' + lerp(0, buildY, entry).toFixed(3) + 'px,0) ' +
            'rotate(' + lerp(0, buildRot, entry).toFixed(3) + 'deg) ' +
            'scale(' + lerp(1.06, buildScale, entry).toFixed(4) + ')';

        icon.style.filter =
            'saturate(' + lerp(1, 1 + 0.18 * t + 0.28 * corrosionLevel, entry).toFixed(3) + ') ' +
            'contrast(' + lerp(1, 1 + 0.16 * t + 0.2 * corrosionLevel, entry).toFixed(3) + ') ' +
            'brightness(' + lerp(1, 1 + 0.1 * t - 0.06 * corrosionLevel, entry).toFixed(3) + ')';

        icon.style.opacity = lerp(1, 1 - (0.015 * Math.pow(t, 3)) - (0.025 * corrosionLevel), entry).toFixed(3);

        icon.style.setProperty('--bm-corrosion-opacity', lerp(0, Math.min(1, 0.03 + corrosionLevel * 1.12), entry).toFixed(3));
        icon.style.setProperty('--bm-corrosion-shift-x', lerp(0, Math.sin((ts * (7 + corrosionLevel * 22)) + seed * 0.021) * (0.5 + corrosionLevel * 7), entry).toFixed(3) + 'px');
        icon.style.setProperty('--bm-corrosion-shift-y', lerp(0, Math.cos((ts * (9 + corrosionLevel * 26)) + seed * 0.037) * (0.4 + corrosionLevel * 6), entry).toFixed(3) + 'px');
        icon.style.setProperty('--bm-corrosion-rot', lerp(0, Math.sin((ts * (8 + corrosionLevel * 21)) + seed * 0.013) * (0.4 + corrosionLevel * 5), entry).toFixed(3) + 'deg');
        icon.style.setProperty('--bm-corrosion-scale', lerp(0, corrosionLevel * 0.3 + pulse * 0.06, entry).toFixed(4));

        const edgeNoise = Math.sin((ts * (11 + corrosionLevel * 37)) + seed * 0.071) * 0.8 +
                  Math.sin((ts * (17 + corrosionLevel * 41)) + seed * 0.137) * 0.5 +
                  Math.sin((ts * (23 + corrosionLevel * 53)) + seed * 0.193) * 0.32;
        const biteA = Math.max(0, 1.2 + corrosionLevel * 44 + Math.abs(edgeNoise) * 6.8);
        const biteB = Math.max(0, 1.5 + corrosionLevel * 38 + Math.abs(Math.cos(edgeNoise * 1.2)) * 5.9);
        const biteC = Math.max(0, 0.9 + corrosionLevel * 41 + Math.abs(Math.sin(edgeNoise * 1.7)) * 6.4);
        const biteD = Math.max(0, 1.1 + corrosionLevel * 46 + Math.abs(Math.cos(edgeNoise * 1.3)) * 6.1);
        const biteE = Math.max(0, 2.2 + corrosionLevel * 27 + Math.abs(edgeNoise) * 4.8);
        const biteF = Math.max(20, 48 + Math.sin(ts * 13 + seed * 0.05) * (1.4 + corrosionLevel * 18));
        icon.style.setProperty('--bm-corrosion-bite-a', biteA.toFixed(2));
        icon.style.setProperty('--bm-corrosion-bite-b', biteB.toFixed(2));
        icon.style.setProperty('--bm-corrosion-bite-c', biteC.toFixed(2));
        icon.style.setProperty('--bm-corrosion-bite-d', biteD.toFixed(2));
        icon.style.setProperty('--bm-corrosion-bite-e', biteE.toFixed(2));
        icon.style.setProperty('--bm-corrosion-bite-f', biteF.toFixed(2));

        const glowA = lerp(0.21, 0.21 + 0.26 * t + 0.12 * corrosionLevel, entry).toFixed(3);
        const glowB = lerp(0.27, 0.27 + 0.25 * t + 0.2 * corrosionLevel, entry).toFixed(3);
        const spread = lerp(1, 1 + 3.2 * t + 2.4 * corrosionLevel, entry).toFixed(2);
        const blur = lerp(5, 5 + 13 * t + 10 * corrosionLevel, entry).toFixed(2);
        const baseShadow =
            '0 0 1px ' + spread + 'px rgba(255,255,255,' + glowA + '), ' +
            '0 0 ' + blur + 'px ' + lerp(2, 2 + 5.5 * t, entry).toFixed(2) + 'px rgba(0,0,0,' + glowB + ')';

        const extraBlend = smoothStep(entry * corrosionLevel);
        if (extraBlend > 0.001) {
            const rustBlur = lerp(0, 12 + corrosionLevel * 28, extraBlend).toFixed(2);
            const rustSpread = lerp(0, 4 + corrosionLevel * 10, extraBlend).toFixed(2);
            const rustAlpha = lerp(0, 0.1 + corrosionLevel * 0.7, extraBlend).toFixed(3);

            const darkBlur = lerp(0, 16 + corrosionLevel * 26, extraBlend).toFixed(2);
            const darkSpread = lerp(0, 7 + corrosionLevel * 12, extraBlend).toFixed(2);
            const darkAlpha = lerp(0, 0.16 + corrosionLevel * 0.62, extraBlend).toFixed(3);

            icon.style.boxShadow =
                baseShadow + ', ' +
                '0 0 ' + rustBlur + 'px ' + rustSpread + 'px rgba(92,48,22,' + rustAlpha + '), ' +
                '0 0 ' + darkBlur + 'px ' + darkSpread + 'px rgba(31,19,12,' + darkAlpha + ')';
        } else {
            icon.style.boxShadow = baseShadow;
        }
    }

    function applyQuakeExplosion(icon, explodeElapsed, seed) {
        const t = Math.min(1, explodeElapsed / (quakeConfig.explodeMs || 400));
        const ts = explodeElapsed / 1000;
        const inv = 1 - t;

        const blastAmp = (14 + 26 * t) * inv;
        const x = blastAmp * Math.sin((ts * 85) + seed * 1.37);
        const y = blastAmp * Math.sin((ts * 97) + seed * 2.11 + Math.PI / 3);
        const rot = (13 + 30 * t) * inv * Math.sin((ts * 73) + seed * 0.91);
        const scale = 1.26 + 1.35 * t - 2.45 * t * t;

        icon.style.transform =
            'translate3d(' + x.toFixed(3) + 'px,' + y.toFixed(3) + 'px,0) ' +
            'rotate(' + rot.toFixed(3) + 'deg) ' +
            'scale(' + Math.max(0.01, scale).toFixed(4) + ')';

        icon.style.filter =
            'saturate(' + (1.35 + 0.95 * t).toFixed(3) + ') ' +
            'contrast(' + (1.2 + 0.42 * t).toFixed(3) + ') ' +
            'brightness(' + (1.1 + 0.34 * t).toFixed(3) + ') ' +
            'sepia(' + (0.35 + 0.45 * t).toFixed(3) + ') ' +
            'blur(' + (0.4 + 4.2 * t).toFixed(3) + 'px)';

        icon.style.opacity = Math.max(0, 1 - Math.pow(t, 1.35)).toFixed(3);
        icon.style.boxShadow =
            '0 0 ' + (8 + 24 * t).toFixed(2) + 'px ' + (4 + 11 * t).toFixed(2) + 'px rgba(255,255,255,' + (0.5 - 0.48 * t).toFixed(3) + '), ' +
            '0 0 ' + (20 + 35 * t).toFixed(2) + 'px ' + (9 + 14 * t).toFixed(2) + 'px rgba(0,0,0,' + (0.52 - 0.5 * t).toFixed(3) + ')';
    }

    root.bookmarksHoverAnimation = {
        startSlotQuake,
        stopSlotQuake,
        clearAllSlotQuakes,
        getQuakeState,
        resetIconQuakeStyle,
        ensureCorrosionFilter,
        spawnExplosionRipple,
        spawnBookmarksSectionGlitch,
        applyQuakeBuild,
        applyQuakeExplosion
    };
})(window);
