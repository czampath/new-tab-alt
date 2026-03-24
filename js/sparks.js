// Performance-optimized spark particle system with two canvases
const canvas = document.getElementById('sparkCanvas');
const ctx = canvas.getContext('2d', { alpha: true });

const haywireCanvas = document.getElementById('haywireCanvas');
const haywireCtx = haywireCanvas.getContext('2d', { alpha: true });

// Audio context for continuous spark sound
let audioContext = null;
let sparkNoiseSource = null;
let sparkGainNode = null;
let sparkFilter = null;
let sparkPanner = null;
let haywireOscillator = null;
let haywireGainNode = null;
let haywireFilter = null;
let haywirePanner = null;
let isAudioInitialized = false;
let targetVolume = 0;
let currentVolume = 0;
let targetHaywireVolume = 0;
let currentHaywireVolume = 0;

// Initialize audio context and continuous noise source
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Resume if suspended
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    if (!isAudioInitialized) {
        // Create continuous white noise buffer (1 second loop)
        const bufferSize = audioContext.sampleRate;
        const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        
        // Generate sharper, more erratic noise bursts (like haywire style)
        for (let i = 0; i < bufferSize; i++) {
            const randomThreshold = Math.random();
            
            if (randomThreshold < 0.2) {
                // Sharp noise bursts
                const burstIntensity = Math.random() * 1.5;
                data[i] = (Math.random() * 2 - 1) * burstIntensity;
            } else {
                // Sparse, quiet background
                data[i] = (Math.random() * 2 - 1) * 0.08;
            }
        }
        
        // Create audio nodes
        sparkNoiseSource = audioContext.createBufferSource();
        sparkNoiseSource.buffer = noiseBuffer;
        sparkNoiseSource.loop = true;
        
        sparkFilter = audioContext.createBiquadFilter();
        sparkFilter.type = 'highpass'; // Same as haywire style
        sparkFilter.frequency.value = 3000;
        sparkFilter.Q.value = 0.8;
        
        sparkPanner = audioContext.createStereoPanner();
        sparkPanner.pan.value = 0; // Start centered
        
        sparkGainNode = audioContext.createGain();
        sparkGainNode.gain.value = 0; // Start silent
        
        // Connect: source -> filter -> panner -> gain -> destination
        sparkNoiseSource.connect(sparkFilter);
        sparkFilter.connect(sparkPanner);
        sparkPanner.connect(sparkGainNode);
        sparkGainNode.connect(audioContext.destination);
        
        sparkNoiseSource.start();
        
        // Create haywire spark sound - noisy, glitchy texture (not tonal)
        // Use noise buffer with different character than regular sparks
        const haywireBufferSize = audioContext.sampleRate;
        const haywireNoiseBuffer = audioContext.createBuffer(1, haywireBufferSize, audioContext.sampleRate);
        const haywireData = haywireNoiseBuffer.getChannelData(0);
        
        // Generate sharper, more erratic noise bursts
        for (let i = 0; i < haywireBufferSize; i++) {
            const randomThreshold = Math.random();
            
            if (randomThreshold < 0.2) {
                // Sharp noise bursts
                const burstIntensity = Math.random() * 1.5;
                haywireData[i] = (Math.random() * 2 - 1) * burstIntensity;
            } else {
                // Sparse, quiet background
                haywireData[i] = (Math.random() * 2 - 1) * 0.08;
            }
        }
        
        haywireOscillator = audioContext.createBufferSource();
        haywireOscillator.buffer = haywireNoiseBuffer;
        haywireOscillator.loop = true;
        
        haywireFilter = audioContext.createBiquadFilter();
        haywireFilter.type = 'highpass'; // Let through higher frequencies for crisp texture
        haywireFilter.frequency.value = 3000;
        haywireFilter.Q.value = 0.8;
        
        haywirePanner = audioContext.createStereoPanner();
        haywirePanner.pan.value = 0; // Start centered
        
        haywireGainNode = audioContext.createGain();
        haywireGainNode.gain.value = 0; // Start silent
        
        // Connect haywire chain: source -> filter -> panner -> gain -> destination
        haywireOscillator.connect(haywireFilter);
        haywireFilter.connect(haywirePanner);
        haywirePanner.connect(haywireGainNode);
        haywireGainNode.connect(audioContext.destination);
        
        haywireOscillator.start();
        
        isAudioInitialized = true;
    }
}

// Update spark sound based on active particle count
function updateSparkSound() {
    if (!isAudioInitialized || !sparkGainNode) return;
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // Count normal and haywire sparks separately
    let normalCount = 0;
    let haywireCount = 0;
    let normalPanSum = 0;
    let haywirePanSum = 0;
    
    for (let i = 0; i < particles.length; i++) {
        // Calculate pan position based on particle X position (-1 left, +1 right)
        // Reduced to 50% panning range (-0.5 to +0.5)
        const panPosition = ((particles[i].x / canvas.width) * 2 - 1) * 0.5;
        
        if (particles[i].isHaywire) {
            haywireCount++;
            haywirePanSum += panPosition;
        } else {
            normalCount++;
            normalPanSum += panPosition;
        }
    }
    
    // Update normal spark sound
    const normalizedCount = Math.min(normalCount / 100, 1);
    
    // Only play sound if there are at least 3 particles
    if (normalCount < 1) {
        targetVolume = 0;
    } else {
        // Scale more gradually - need more particles to reach max volume
        const adjustedCount = Math.min(normalCount / 200, 1); // Double the threshold
        targetVolume = adjustedCount * 0.03; // Normal volume (5% max)
    }
    
    // Faster fade out to match visual particle count more closely
    const smoothing = normalCount > 0 ? 0.08 : 0.4; // Faster fade out
    currentVolume += (targetVolume - currentVolume) * smoothing;
    
    // Apply volume with randomness for organic texture
    const randomVariation = 0.6 + Math.random() * 0.8; // 60-140% variation
    sparkGainNode.gain.value = currentVolume * randomVariation;
    
    // Vary filter frequency randomly for tonal variation
    if (sparkFilter && normalCount > 0) {
        // Random frequency variation
        const filterVariation = 2500 + Math.random() * 2000;
        sparkFilter.frequency.setValueAtTime(
            filterVariation, 
            audioContext.currentTime
        );
        
        // Randomly vary Q factor too
        sparkFilter.Q.value = 0.6 + Math.random() * 0.8;
        
        // Update stereo pan based on average particle position
        if (sparkPanner) {
            const averagePan = normalPanSum / normalCount;
            sparkPanner.pan.setValueAtTime(averagePan, audioContext.currentTime);
        }
    }
    
    // Update haywire spark sound - noisy texture with slight variation
    if (haywireOscillator && haywireGainNode && haywireFilter) {
        // Only play sound if there are at least 2 haywire particles
        if (haywireCount < 2) {
            targetHaywireVolume = 0;
        } else {
            const normalizedHaywire = Math.min(haywireCount / 40, 1); // Double the threshold
            targetHaywireVolume = normalizedHaywire * 0.018; // Slightly raised since it's noise-based (1.8% max)
        }
        
        const haywireSmoothing = haywireCount > 0 ? 0.12 : 0.4; // Faster fade out
        currentHaywireVolume += (targetHaywireVolume - currentHaywireVolume) * haywireSmoothing;
        currentHaywireVolume += (targetHaywireVolume - currentHaywireVolume) * haywireSmoothing;
        
        if (haywireCount > 0) {
            // Vary filter for tonal texture without pitch
            const filterVariation = 2500 + Math.random() * 2000;
            haywireFilter.frequency.setValueAtTime(filterVariation, audioContext.currentTime);
            
            // Subtle volume variation
            const glitchVolume = currentHaywireVolume * (0.7 + Math.random() * 0.5);
            haywireGainNode.gain.value = glitchVolume;
            
            // Update stereo pan based on average haywire particle position
            if (haywirePanner) {
                const averagePan = haywirePanSum / haywireCount;
                haywirePanner.pan.setValueAtTime(averagePan, audioContext.currentTime);
            }
        } else {
            haywireGainNode.gain.value = 0;
        }
    }
}

// Set canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    haywireCanvas.width = window.innerWidth;
    haywireCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Handle tab visibility changes to stop audio
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Immediately mute audio and clear particles when tab is hidden
        if (sparkGainNode) sparkGainNode.gain.value = 0;
        if (haywireGainNode) haywireGainNode.gain.value = 0;
        
        particles.length = 0;
        currentVolume = 0;
        currentHaywireVolume = 0;
        targetVolume = 0;
        targetHaywireVolume = 0;
    }
});

// Cursor velocity tracking
let cursorVelocity = { x: 0, y: 0 };
let lastCursorPos = { x: 0, y: 0 };
let lastCursorTime = Date.now();

// Track cursor movement for velocity calculation
window.addEventListener('mousemove', (e) => {
    const currentTime = Date.now();
    const dt = Math.max(currentTime - lastCursorTime, 1) / 16; // Normalize to ~60fps
    
    // Calculate velocity
    const dx = e.clientX - lastCursorPos.x;
    const dy = e.clientY - lastCursorPos.y;
    
    // Smooth velocity with damping
    cursorVelocity.x = (dx / dt) * 0.3 + cursorVelocity.x * 0.7;
    cursorVelocity.y = (dy / dt) * 0.3 + cursorVelocity.y * 0.7;
    
    lastCursorPos = { x: e.clientX, y: e.clientY };
    lastCursorTime = currentTime;
});

// Particle class with realistic physics
class Spark {
    constructor(x, y, vx, vy, isHaywire = false, cursorVel = { x: 0, y: 0 }) {
        this.x = x;
        this.y = y;
        
        // Apply cursor velocity influence to non-haywire sparks
        if (!isHaywire) {
            const velocityInfluence = 0.05; // How much cursor velocity affects sparks
            this.vx = vx + cursorVel.x * velocityInfluence;
            this.vy = vy + cursorVel.y * velocityInfluence;
        } else {
            this.vx = vx;
            this.vy = vy;
        }
        
        this.life = 1.0;
        // Haywire sparks live twice as long (half the decay rate)
        this.decay = isHaywire 
            ? (Math.random() * 0.0015 + 0.001) 
            : (Math.random() * 0.003 + 0.002);
        // Haywire sparks are much smaller and thinner
        this.size = isHaywire ? (Math.random() * 0.25 + 0.15) : (Math.random() * 0.8 + 0.3);
        // Gravity proportional to size - smaller sparks fall slower
        this.gravity = this.size * 0.02;
        this.friction = 0.98;
        this.isHaywire = isHaywire;
        this.directionChangeCounter = 0;
        
        // Color variations for realistic sparks (more prominent yellowish)
        const colorChoice = Math.random();
        if (colorChoice < 0.3) {
            this.color = { r: 255, g: 220 + Math.random() * 35, b: 50 + Math.random() * 30 }; // Bright yellow-orange
        } else if (colorChoice < 0.85) {
            this.color = { r: 255, g: 200 + Math.random() * 5, b: 80 + Math.random() * 50 }; // Vivid yellow
        } else {
            this.color = { r: 255, g: 255, b: 200 + Math.random() * 30 }; // Bright yellow-white
        }
    }

    update() {
        if (this.isHaywire) {
            // Haywire sparks change direction randomly
            this.directionChangeCounter++;
            if (this.directionChangeCounter > 3) { // Change direction every few frames
                this.directionChangeCounter = 0;
                const randomAngle = Math.random() * Math.PI * 2;
                const randomForce = Math.random() * 0.5;
                this.vx += Math.cos(randomAngle) * randomForce;
                this.vy += Math.sin(randomAngle) * randomForce;
            }
            // Haywire sparks have less gravity
            this.vy += this.gravity * 0.3;
        } else {
            // Normal sparks fall normally
            this.vy += this.gravity;
        }
        
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        this.x += this.vx;
        this.y += this.vy;
        
        // Fade out - accelerate decay when close to max particle limit
        const particleRatio = particles.length / MAX_PARTICLES;
        const decayMultiplier = particleRatio > 0.7 ? (1 + (particleRatio - 0.7) * 3) : 1;
        this.life -= this.decay * decayMultiplier;
        
        return this.life > 0;
    }

    draw() {
        const alpha = Math.pow(this.life, 0.5); // Smoother fade
        
        // Choose the correct context based on particle type
        const drawCtx = this.isHaywire ? haywireCtx : ctx;
        
        // Haywire sparks are much lighter to prevent bold trails
        const opacityMultiplier = this.isHaywire ? 0.4 : 1.0;
        const glowSize = this.isHaywire ? 2 : 4; // Smaller glow for haywire
        
        // Draw glow
        drawCtx.save();
        drawCtx.globalCompositeOperation = 'lighter';
        
        // Outer glow
        const gradient = drawCtx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * glowSize);
        gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${alpha * 0.8 * opacityMultiplier})`);
        gradient.addColorStop(0.4, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${alpha * 0.3 * opacityMultiplier})`);
        gradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);
        
        drawCtx.fillStyle = gradient;
        drawCtx.fillRect(this.x - this.size * glowSize, this.y - this.size * glowSize, this.size * glowSize * 2, this.size * glowSize * 2);
        
        // Core particle
        drawCtx.fillStyle = `rgba(255, 255, 255, ${alpha * opacityMultiplier})`;
        drawCtx.beginPath();
        drawCtx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2);
        drawCtx.fill();
        
        drawCtx.restore();
    }
}

// Particle pool
const particles = [];
const MAX_PARTICLES = 600; // Limit for performance (increased for mouse-pressed mode)

// Frame counter for periodic canvas clearing
let frameCount = 0;

// Function to create sparks at cursor position (called from dangle detection)
window.createDangleSparks = function(x, y, intensity, mousePressed = false) {
    // Initialize audio on first interaction
    initAudioContext();
    
    // Scale spark size based on intensity
    // For small dangle intensities (0.18-2), use larger base
    // For large click intensities (3+), use smaller multiplier
    let baseSize, velocityMultiplier;
    if (intensity < 2) {
        // Dangle sparks - larger size range and more spread
        baseSize = 0.5 + (intensity * 0.8); // Size range: 0.5 to ~2.1
        velocityMultiplier = (Math.random() * 3 + 2) * (intensity * 0.8); // High spread
    } else {
        // Click sparks - smaller size range and moderate spread
        baseSize = 0.4 + (Math.min(intensity / 8, 1) * 0.6); // Size range: 0.4 to 1.0
        velocityMultiplier = (Math.random() * 2 + 1.2) * (intensity * 0.4); // Moderate spread
    }
    
    let sparkCount = Math.min(Math.floor(intensity * 3) + 1, 8); // Scale with intensity
    
    // Multiply by 2 when mouse pressed (we control via fixed intensity now)
    if (mousePressed && intensity < 2) {
        sparkCount = sparkCount * 2;
    }
    
    for (let i = 0; i < sparkCount; i++) {
        if (particles.length < MAX_PARTICLES) {
            // Random direction for spark spread
            const angle = Math.random() * Math.PI * 2;
            
            const vx = Math.cos(angle) * velocityMultiplier;
            const vy = Math.sin(angle) * velocityMultiplier - Math.random() * 1; // Slight upward bias
            
            // Add some randomness to spawn position
            const offsetX = (Math.random() - 0.5) * 10;
            const offsetY = (Math.random() - 0.5) * 10;
            
            // 5% chance of haywire spark
            const isHaywire = Math.random() < 0.05;
            
            const spark = new Spark(
                x + offsetX,
                y + offsetY,
                vx,
                vy,
                isHaywire,
                cursorVelocity
            );
            // Override size based on intensity
            spark.size = baseSize * (Math.random() * 0.4 + 0.8); // Add slight variation
            
            // 2% of sparks when mouse pressed are blue
            if (mousePressed && Math.random() < 0.005) {
                spark.color = { r: 100 + Math.random() * 50, g: 100 + Math.random() * 50, b: 255 };
            }
            
            particles.push(spark);
        }
    }
};

// Animation loop with performance optimization
function animate(currentTime) {
    frameCount++;
    
    // Update continuous spark sound based on active particles
    updateSparkSound();
    
    // Clear main canvas completely (transparent)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Periodically fully clear haywire canvas to prevent pixel accumulation
    if (frameCount % 90 === 0) {
        haywireCtx.clearRect(0, 0, haywireCanvas.width, haywireCanvas.height);
    } else {
        // Apply motion blur effect to haywire canvas by fading existing pixels
        haywireCtx.globalCompositeOperation = 'destination-out';
        haywireCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        haywireCtx.fillRect(0, 0, haywireCanvas.width, haywireCanvas.height);
        haywireCtx.globalCompositeOperation = 'source-over'; // Reset to normal drawing
    }
    
    // Update and draw particles (reverse loop for safe removal)
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        
        if (!particle.update()) {
            particles.splice(i, 1);
        } else {
            particle.draw();
        }
    }
    
    requestAnimationFrame(animate);
}

// Start animation
requestAnimationFrame(animate);