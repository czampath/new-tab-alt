// Cat animation
const catContainer = document.getElementById('catAnimation');
let catAnimation = null;
let isAnimating = false;

// Cat dangling parameters (tweak these!)
const catDangleParams = {
    // Minimum time (ms) before cat can appear even with max dangling
    minAppearanceTime: 5000,
    // How much dangle intensity reduces the wait (0-1, where 1 = full reduction)
    dangleEffectiveness: 1,
    // Pixels of movement needed per "dangle unit"
    dangleSensitivity: 60,
    // How fast dangle intensity decays per second (0-1)
    dangleDecayRate: 0.01,
    // Maximum accumulated dangle intensity (caps the effect)
    maxDangleIntensity: 200,
    // Bottom portion of screen where dangling counts (0.5 = bottom half)
    activeZoneRatio: 0.4,
    // Click intensity boost (added to dangle intensity per click)
    clickIntensityBoost: 5,
    // How long cat stays visible (min-max in ms)
    stayDurationMin: 6000,
    stayDurationMax: 9000,
    // Max pixels per movement that count (prevents long sweeps from being too effective)
    maxDangleDistancePerMove: 20,
    // Radius of concentrated dangle zone (px) - fast movements within this are OK
    dangleZoneRadius: 80,
    // How many recent positions to track for zone calculation
    dangleHistorySize: 5
};

// Dangling state
let dangleIntensity = 0;
let lastCursorX = null;
let lastCursorY = null;
let cursorX = window.innerWidth / 2; // Track cursor X for cat positioning
let scheduledCatTimeout = null;
let currentScheduledTime = null;
let actualScheduledTime = null; // The actual time when cat will appear
let recentDanglePositions = []; // Track recent positions to detect concentrated vs spread dangles
let debugMeterVisible = false; // Track debug meter visibility
let isMousePressed = false; // Track if mouse button is pressed

// Toggle debug meter visibility with Ctrl+Shift+D
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        debugMeterVisible = !debugMeterVisible;
        document.getElementById('debugMeter').style.display = debugMeterVisible ? 'block' : 'none';
        e.preventDefault();
    }
});

// Track mouse button state
document.addEventListener('mousedown', () => {
    isMousePressed = true;
});

document.addEventListener('mouseup', () => {
    isMousePressed = false;
});

// Update debug meter
function updateDebugMeter() {
    if (!debugMeterVisible) return; // Skip updates when hidden
    document.getElementById('dangleValue').textContent = dangleIntensity.toFixed(1);
    document.getElementById('dangleBar').style.width = 
        `${(dangleIntensity / catDangleParams.maxDangleIntensity) * 100}%`;
    
    if (currentScheduledTime && actualScheduledTime !== null && !isAnimating) {
        const elapsed = Date.now() - currentScheduledTime.startedAt;
        const originalRemaining = Math.max(0, currentScheduledTime.originalTime - elapsed);
        const actualRemaining = Math.max(0, actualScheduledTime - elapsed);
        const timeSaved = Math.max(0, originalRemaining - actualRemaining);
        
        document.getElementById('originalTime').textContent = 
            `${(currentScheduledTime.originalTime / 1000).toFixed(1)}s`;
        document.getElementById('reducedTime').textContent = 
            `${(actualScheduledTime / 1000).toFixed(1)}s`;
        document.getElementById('timeSaved').textContent = 
            `${(timeSaved / 1000).toFixed(1)}s (${((timeSaved / currentScheduledTime.originalTime) * 100).toFixed(1)}%)`;
        document.getElementById('nextCatTime').textContent = 
            `${(actualRemaining / 1000).toFixed(1)}s`;
    } else if (isAnimating) {
        document.getElementById('nextCatTime').textContent = 'CAT IS HERE!';
    }
}

// Update meter every 100ms
setInterval(updateDebugMeter, 100);

// Cat sounds
const catSounds = [
    new Audio('cat-01.mp3'),
    new Audio('cat-02.mp3'),
    new Audio('cat-03.mp3'),
    new Audio('cat-06.mp3'),
    new Audio('cat-07.mp3'),
    new Audio('cat-08.mp3')
];
let lastPlayedSounds = [];

function playRandomCatSound() {
    // Filter out the last two sounds
    const availableSounds = catSounds.map((sound, index) => index)
        .filter(index => !lastPlayedSounds.includes(index));
    
    // Pick random from available
    const randomIndex = availableSounds[Math.floor(Math.random() * availableSounds.length)];
    const sound = catSounds[randomIndex];
    
    // Play sound
    sound.currentTime = 0;
    sound.play().catch(e => console.log('Audio play failed:', e));
    
    // Update history - keep only last 2
    lastPlayedSounds.push(randomIndex);
    if (lastPlayedSounds.length > 2) {
        lastPlayedSounds.shift();
    }
}

// Click summoning detection
document.addEventListener('click', (e) => {
    // Skip if any modal or settings panel is open
    if (isModalOrPanelOpen()) return;
    
    // Skip if cursor is over UI elements
    if (isOverUIFlag) return;
    
    const cursorY = e.clientY;
    const viewportHeight = window.innerHeight;
    
    // Only count clicks in bottom portion of screen
    if (cursorY > viewportHeight * (1 - catDangleParams.activeZoneRatio)) {
        const previousIntensity = dangleIntensity;
        dangleIntensity = Math.min(
            catDangleParams.maxDangleIntensity,
            dangleIntensity + catDangleParams.clickIntensityBoost
        );
        const intensityGain = dangleIntensity - previousIntensity;
        
        // Create sparks only in bottom 1/5 of screen and for significant intensity increases
        if (cursorY > viewportHeight * 0.8 && intensityGain > 3.0 && window.createDangleSparks) {
            window.createDangleSparks(e.clientX, cursorY, intensityGain);
        }
        
        maybeRescheduleCat();
        updateDebugMeter();
    }
});

// Cursor dangling detection
document.addEventListener('mousemove', (e) => {
    cursorX = e.clientX;
    const cursorY = e.clientY;
    const viewportHeight = window.innerHeight;
    
    // Skip if any modal or settings panel is open
    if (isModalOrPanelOpen()) {
        lastCursorX = cursorX;
        lastCursorY = cursorY;
        return;
    }
    
    // Only count movement in bottom portion of screen
    // Skip if cursor is over UI elements
    if (cursorY > viewportHeight * (1 - catDangleParams.activeZoneRatio) && !isOverUIFlag) {
        if (lastCursorX !== null && lastCursorY !== null) {
            // Calculate movement distance
            const dx = cursorX - lastCursorX;
            const dy = cursorY - lastCursorY;
            const rawDistance = Math.sqrt(dx * dx + dy * dy);
            
            // Track recent positions for zone detection
            recentDanglePositions.push({ x: cursorX, y: cursorY });
            if (recentDanglePositions.length > catDangleParams.dangleHistorySize) {
                recentDanglePositions.shift();
            }
            
            // Calculate horizontal and vertical spread to detect horizontal sweeps
            let horizontalSpread = 0;
            let verticalSpread = 0;
            if (recentDanglePositions.length >= 2) {
                let minX = recentDanglePositions[0].x;
                let maxX = recentDanglePositions[0].x;
                let minY = recentDanglePositions[0].y;
                let maxY = recentDanglePositions[0].y;
                
                for (let i = 1; i < recentDanglePositions.length; i++) {
                    minX = Math.min(minX, recentDanglePositions[i].x);
                    maxX = Math.max(maxX, recentDanglePositions[i].x);
                    minY = Math.min(minY, recentDanglePositions[i].y);
                    maxY = Math.max(maxY, recentDanglePositions[i].y);
                }
                
                horizontalSpread = maxX - minX;
                verticalSpread = maxY - minY;
            }
            
            // Ignore horizontal sweeps (where horizontal movement dominates vertical)
            // Only count vertical dangles or concentrated wiggling
            let distance = 0;
            if (horizontalSpread > verticalSpread * 2) {
                // Horizontal sweep detected - ignore completely
                distance = 0;
            } else if (horizontalSpread + verticalSpread <= catDangleParams.dangleZoneRadius) {
                // Concentrated dangle - allow full distance
                distance = rawDistance;
            } else {
                // Spread out vertical dangle - cap the distance
                distance = Math.min(rawDistance, catDangleParams.maxDangleDistancePerMove);
            }
            
            // Add to dangle intensity based on movement
            const previousIntensity = dangleIntensity;
            const dangleUnits = distance / catDangleParams.dangleSensitivity;
            dangleIntensity = Math.min(
                catDangleParams.maxDangleIntensity,
                dangleIntensity + dangleUnits
            );
            const intensityGain = dangleIntensity - previousIntensity;
            
            // Create sparks based on movement
            // Skip if cursor is over UI elements
            if (!isOverUIFlag && window.createDangleSparks) {
                if (isMousePressed) {
                    // When mouse pressed: create sparks on every movement with fixed small amount
                    if (intensityGain > 0.01) { // Very low threshold
                        window.createDangleSparks(cursorX, cursorY, 0.3, isMousePressed); // Fixed small intensity
                    }
                } else {
                    // Normal: create sparks for movement (lowered threshold for more sparks)
                    if (intensityGain > 0.12) {
                        window.createDangleSparks(cursorX, cursorY, intensityGain, isMousePressed);
                    }
                }
            }
            
            // Check if we should reschedule cat appearance
            maybeRescheduleCat();
        }
    }
    
    lastCursorX = cursorX;
    lastCursorY = cursorY;
});

// Decay dangle intensity over time
setInterval(() => {
    if (dangleIntensity > 0) {
        dangleIntensity = Math.max(0, dangleIntensity - catDangleParams.dangleDecayRate * catDangleParams.maxDangleIntensity);
    }
}, 1000);

// Calculate new wait time based on dangle intensity
function calculateReducedTime(originalTime) {
    const intensityRatio = dangleIntensity / catDangleParams.maxDangleIntensity;
    const reduction = originalTime * intensityRatio * catDangleParams.dangleEffectiveness;
    return Math.max(catDangleParams.minAppearanceTime, originalTime - reduction);
}

// Check if dangling warrants rescheduling the cat
function maybeRescheduleCat() {
    if (!scheduledCatTimeout || !currentScheduledTime || isAnimating || isModalOrPanelOpen()) return;
    
    const newTime = calculateReducedTime(currentScheduledTime.originalTime);
    const elapsed = Date.now() - currentScheduledTime.startedAt;
    const remainingCurrent = actualScheduledTime - elapsed;
    const remainingNew = newTime - elapsed;
    
    // Only reschedule if new time is shorter (even slightly)
    if (remainingNew < remainingCurrent - 100) {
        clearTimeout(scheduledCatTimeout);
        actualScheduledTime = newTime; // Update actual scheduled time
        
        if (remainingNew <= 0) {
            // Time already passed - trigger cat immediately!
            playCatAnimation();
            scheduleCatAnimation();
        } else {
            scheduledCatTimeout = setTimeout(() => {
                playCatAnimation();
                scheduleCatAnimation();
            }, remainingNew);
        }
    }
}

const catAnimationData = {"nm":"Main Scene","ddd":0,"h":873.860252004582,"w":1217.1363115693014,"meta":{"g":"@lottiefiles/creator 1.66.2"},"layers":[{"ty":3,"nm":"Nul 1","sr":1,"st":11,"op":386,"ip":11,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[0,0,0],"ix":1},"s":{"a":0,"k":[183,183,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[454.8384879725087,1579.860252004582],"t":11},{"s":[454.8384879725087,869.8602520045825],"t":24}],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":0,"ix":11}},"ind":1},{"ty":4,"nm":"ojo der Silhouettes","sr":1,"st":0,"op":375,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[48.045,48.044,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[172.758,-68.586,0],"t":30},{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[166.201,-82.794,0],"t":35},{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[194.616,-83.887,0],"t":62},{"s":[172.758,-68.586,0],"t":67}],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Groupe 1","ix":1,"cix":2,"np":2,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"TracÃÂ© 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[0,-26.397],[-26.396,0],[0,26.396],[26.396,0]],"o":[[0,26.396],[26.396,-0.001],[0,-26.396],[-26.396,0]],"v":[[-47.794,0],[-0.001,47.794],[47.794,-0.001],[-0.001,-47.794]]},"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fond 1","c":{"a":0,"k":[0,0,0],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[48.045,48.045],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":2,"parent":1},{"ty":4,"nm":"ojo izq Silhouettes","sr":1,"st":0,"op":375,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[48.044,48.045,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[-26.17,-70.771,0],"t":30},{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[-49.121,-84.978,0],"t":35},{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[-22.891,-84.978,0],"t":62},{"s":[-26.17,-70.771,0],"t":67}],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Groupe 1","ix":1,"cix":2,"np":2,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"TracÃÂ© 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[0,-26.397],[-26.396,0],[0,26.396],[26.396,0]],"o":[[0,26.396],[26.396,-0.001],[0,-26.396],[-26.397,0]],"v":[[-47.794,0],[-0.001,47.794],[47.794,-0.001],[0,-47.794]]},"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fond 1","c":{"a":0,"k":[0,0,0],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[48.044,48.045],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":3,"parent":1},{"ty":4,"nm":"Calque 1 Silhouettes","sr":1,"st":0,"op":375,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[335.986,508.493,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":0,"k":[-0.076,109.585,0],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Groupe 1","ix":1,"cix":2,"np":2,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"TracÃÂ© 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[-6.088,0],[0,-6.092],[-10.139,0],[0,10.136],[-0.003,0.101],[0,0.101],[0,0],[0,6.128],[-15.059,0],[0,-8.292],[9.56,-4.428],[0,0],[0.003,-0.1],[0,-0.101],[-10.139,0],[0,10.136],[-6.088,0],[0,-6.093],[22.296,0],[7.381,7.842],[11.591,0],[0,22.3]],"o":[[6.09,0],[0,10.137],[10.14,0],[0,-0.101],[-0.003,-0.1],[0,0],[-9.56,-4.429],[0,-8.291],[15.06,0],[0,6.128],[0,0],[0,0.101],[0.003,0.101],[0,10.136],[10.14,0],[0,-6.093],[6.089,0],[0,22.3],[-11.59,0.001],[-7.381,7.842],[-22.296,0],[0,-6.093]],"v":[[-58.824,-3.369],[-47.795,7.659],[-29.412,26.043],[-11.029,7.659],[-10.999,7.363],[-11.029,7.068],[-11.029,-13.26],[-27.266,-33.089],[0,-48.102],[27.268,-33.089],[11.03,-13.26],[11.03,7.068],[10.999,7.363],[11.03,7.659],[29.412,26.042],[47.794,7.659],[58.824,-3.37],[69.853,7.659],[29.412,48.101],[0,35.329],[-29.412,48.102],[-69.853,7.66]]},"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fond 1","c":{"a":0,"k":[0.749,0.3922,0.149],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[407.717,410.813],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]},{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Groupe 2","ix":2,"cix":2,"np":2,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"TracÃÂ© 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[0,-37.008],[-37.009,0.001],[0,37.008],[37.008,0]],"o":[[0,37.008],[37.007,0],[0,-37.008],[-37.008,0]],"v":[[-67.008,0],[0,67.008],[67.008,-0.001],[0,-67.009]]},"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fond 1","c":{"a":0,"k":[1,1,1],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[299.261,329.23],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]},{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Groupe 3","ix":3,"cix":2,"np":2,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"TracÃÂ© 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[0,-37.008],[-37.008,0.001],[0,37.008],[37.008,0]],"o":[[0,37.008],[37.008,0],[0,-37.008],[-37.008,0]],"v":[[-67.009,0],[0,67.008],[67.009,-0.001],[0,-67.009]]},"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fond 1","c":{"a":0,"k":[1,1,1],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[516.174,329.229],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]},{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Groupe 4","ix":4,"cix":2,"np":2,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"TracÃÂ© 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[0,0],[25.902,-23.233],[0,0],[0,0],[0,0],[0.05,-34.794],[0,0],[0.392,62.222],[31.775,0.045],[0.153,-0.002],[-0.203,-31.985],[-65.704,-8.654],[-2.494,-0.004],[-1.219,0.076],[0,0],[-22.658,50.5],[0,41.875],[0,0],[0,0],[0,0]],"o":[[0.05,-34.794],[0,0],[0,0],[0,0],[-25.836,-23.307],[0,0],[-19.955,-21.872],[-0.202,-31.831],[-0.155,0],[-31.984,0.202],[1.205,190.77],[2.539,0.336],[1.233,0.002],[0,0],[58.93,0.084],[13.454,-23.624],[0,0],[0,0],[0,0],[0,0]],"v":[[335.687,-454.416],[268.651,-484.394],[156.972,-384.219],[-1.722,-384.443],[-113.113,-484.937],[-180.235,-455.147],[-181.228,361.501],[-219.71,240.436],[-277.529,182.891],[-277.988,182.891],[-335.533,241.171],[-144.049,507.373],[-136.498,507.877],[-132.831,507.714],[181.211,508.159],[313.547,422.599],[334.642,325.355],[334.996,26.531],[334.974,26.531],[335,26.531]]},"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fond 1","c":{"a":0,"k":[0.9373,0.5569,0.2706],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[335.986,508.494],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":4,"parent":1}],"v":"5.7.0","fr":25,"op":77,"ip":0,"assets":[]};

function initCatAnimation() {
    if (catAnimation) return;
    
    catAnimation = lottie.loadAnimation({
        container: catContainer,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData: catAnimationData
    });
}

function playCatAnimation() {
    if (isAnimating || isModalOrPanelOpen()) return;
    isAnimating = true;

    // Position cat under cursor (clamped to 5-80% range)
    // If dangling summoned the cat, use cursor position; otherwise random
    let position;
    if (dangleIntensity > 5) {
        // Convert cursor X to percentage, clamp to safe range
        position = Math.max(5, Math.min(80, (cursorX / window.innerWidth) * 100));
    } else {
        // Fallback to random if no significant dangling
        position = Math.random() * 75 + 5;
    }
    catContainer.style.left = `${position}%`;
    catContainer.style.right = 'auto';
    catContainer.style.pointerEvents = 'auto';
    
    // Reset dangle intensity after cat appears
    dangleIntensity = 0;

    // Random duration cat stays visible
    const stayDuration = Math.random() * 
        (catDangleParams.stayDurationMax - catDangleParams.stayDurationMin) + 
        catDangleParams.stayDurationMin;
    let hideTimeout;

    // Function to hide cat
    const hideCat = (fast = false) => {
        catContainer.style.transition = fast ? 'transform 0.1s ease-in' : 'transform 2s ease-out';
        catContainer.style.transform = 'translateY(100%)';
        catContainer.style.pointerEvents = 'none';
        
        clearTimeout(hideTimeout);
        catContainer.removeEventListener('click', quickHide);
        
        setTimeout(() => {
            isAnimating = false;
        }, fast ? 100 : 2000);
    };

    // Quick hide on click
    const quickHide = () => {
        playRandomCatSound();
        hideCat(true);
    };
    catContainer.addEventListener('click', quickHide);

    // Slide cat up (peek in)
    catContainer.style.transition = 'transform 1s ease-out';
    catContainer.style.transform = 'translateY(0)';
    
    // Play lottie animation
    catAnimation.goToAndStop(0, true);
    catAnimation.play();

    // Wait for random duration, then hide
    hideTimeout = setTimeout(() => {
        hideCat(false);
    }, stayDuration);
}

function scheduleCatAnimation() {
    // Random interval between 40-100 seconds
    const minTime = 40 * 1000;
    const maxTime = 100 * 1000;
    const randomTime = Math.random() * (maxTime - minTime) + minTime;
    
    // Track scheduling for dangle-based rescheduling
    currentScheduledTime = {
        originalTime: randomTime,
        startedAt: Date.now()
    };
    actualScheduledTime = randomTime; // Initialize actual scheduled time
    
    scheduledCatTimeout = setTimeout(() => {
        playCatAnimation();
        scheduleCatAnimation();
    }, randomTime);
}

// Initialize and start (wait 3 minutes before first appearance)
initCatAnimation();
setTimeout(() => {
    scheduleCatAnimation();
},  1 * 1000);