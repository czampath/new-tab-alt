// Toast notification function
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// Default bookmarks
const defaultBookmarks = [
    { title: 'Gmail', url: 'https://mail.google.com' },
    { title: 'GitHub', url: 'https://github.com' }
];

// Load bookmarks from localStorage or use defaults
let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || defaultBookmarks;

// One-time migration: cache icon hue+letter on any bookmark that doesn't have it yet
(function migrateBookmarkIcons() {
    let dirty = false;
    bookmarks.forEach(b => {
        if (b.iconHue === undefined) {
            const mp = getMainPart(b.url);
            b.iconHue = getLetterIconHue(mp);
            b.iconLetter = (mp.replace(/[^a-z]/gi, '')[0] || '?').toUpperCase();
            dirty = true;
        }
    });
    if (dirty) localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
})();

// Load settings from localStorage
let settings = JSON.parse(localStorage.getItem('settings')) || {
    background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    showTime: true,
    showBookmarks: true,
    showSearch: true,
    showWeather: true,
    showFavicons: false,
    weatherLat: '',
    weatherLon: '',
    weatherApiKey: ''
};

// Function to sanitize and validate URLs
function sanitizeUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            // Validate that hostname exists and is not empty
            if (!parsed.hostname || parsed.hostname.length === 0) {
                return 'about:blank';
            }
            // Validate that hostname has at least one dot (e.g., google.com) or is localhost
            if (parsed.hostname !== 'localhost' && !parsed.hostname.includes('.')) {
                return 'about:blank';
            }
            return url;
        } else if (parsed.protocol === 'file:') {
            // Allow local file paths
            return url;
        }
    } catch {
        return 'about:blank';
    }
    return 'about:blank';
}

// Function to escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Extract the "main part" of a URL's hostname
// e.g. www.google.com → google, www.test.mysite.com → mysite, www.role.casper.co.nz → casper
function getMainPart(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
        const parts = hostname.split('.');
        if (parts.length >= 3) {
            const last = parts[parts.length - 1];
            const secondLast = parts[parts.length - 2];
            const genericSLD = ['co', 'com', 'net', 'org', 'gov', 'edu', 'ac'];
            if (last.length === 2 && genericSLD.includes(secondLast)) {
                return parts[parts.length - 3] || parts[0];
            }
        }
        return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    } catch {
        return url[0] || '?';
    }
}

// Compute a hue (0-360) for a main-part string.
// First letter: a=0, z=255 on a 0-255 spectrum.
// Remaining letters shift within that letter's slot.
function getLetterIconHue(mainPart) {
    const s = mainPart.toLowerCase().replace(/[^a-z]/g, '');
    if (!s) return 200;
    const firstIdx = s.charCodeAt(0) - 97; // 0-25
    const baseValue = (firstIdx / 25) * 255;
    let shiftValue = 0;
    if (s.length > 1) {
        const rest = s.slice(1);
        let sum = 0;
        for (const c of rest) sum += c.charCodeAt(0) - 97;
        const normalized = sum / (rest.length * 25);
        shiftValue = normalized * (255 / 26);
    }
    const finalValue = (baseValue + shiftValue) % 256;
    return Math.round((finalValue / 255) * 360);
}

// Function to get favicon URL (only sends root domain, never the full URL)
function getFaviconUrl(url) {
    try {
        const hostname = new URL(url).hostname.replace(/^www\./, '');
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
        return '';
    }
}

// Weather functionality
const WEATHER_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

function getWeatherFromCache() {
    const cached = localStorage.getItem('weatherCache');
    if (!cached) return null;
    
    try {
        const data = JSON.parse(cached);
        const now = Date.now();
        if (now - data.timestamp < WEATHER_CACHE_DURATION) {
            return data.weather;
        }
    } catch {
        return null;
    }
    return null;
}

function cacheWeather(weatherData) {
    const cache = {
        weather: weatherData,
        timestamp: Date.now()
    };
    localStorage.setItem('weatherCache', JSON.stringify(cache));
}

async function fetchWeather(lat, lon) {
    if (!lat || !lon) return null;
    if (!settings.weatherApiKey) {
        console.warn('Weather API key not configured');
        return null;
    }
    
    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${settings.weatherApiKey}&units=metric`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather fetch failed');
        const data = await response.json();
        
        const weatherData = {
            temp: Math.round(data.main.temp),
            description: data.weather[0].description,
            icon: data.weather[0].icon,
            location: data.name
        };
        
        cacheWeather(weatherData);
        return weatherData;
    } catch (error) {
        console.error('Weather error:', error);
        return null;
    }
}

function getWeatherEmoji(icon) {
    const iconMap = {
        '01d': '☀️', '01n': '🌙',
        '02d': '⛅', '02n': '☁️',
        '03d': '☁️', '03n': '☁️',
        '04d': '☁️', '04n': '☁️',
        '09d': '🌧️', '09n': '🌧️',
        '10d': '🌦️', '10n': '🌧️',
        '11d': '⛈️', '11n': '⛈️',
        '13d': '❄️', '13n': '❄️',
        '50d': '🌫️', '50n': '🌫️'
    };
    return iconMap[icon] || '🌡️';
}

function updateWeatherDisplay(weatherData) {
    const weatherEl = document.getElementById('weather');
    if (!weatherData) {
        if (!settings.weatherApiKey) {
            weatherEl.innerHTML = '<span style="opacity: 0.7; font-size: 13px;">Configure API key in settings to show weather</span>';
        } else {
            weatherEl.innerHTML = '<span style="opacity: 0.7; font-size: 13px;">Set location in settings</span>';
        }
        return;
    }
    
    const emoji = getWeatherEmoji(weatherData.icon);
    const locationText = weatherData.location ? ` at ${weatherData.location}` : '';
    weatherEl.innerHTML = `
        <span class="weather-icon">${emoji}</span>
        <span class="weather-temp">${weatherData.temp}°C</span>
        <span>${weatherData.description}${locationText}</span>
    `;
}

async function loadWeather() {
    if (!settings.showWeather) return;
    
    const cached = getWeatherFromCache();
    if (cached) {
        updateWeatherDisplay(cached);
        return;
    }
    
    if (settings.weatherLat && settings.weatherLon) {
        const weatherData = await fetchWeather(settings.weatherLat, settings.weatherLon);
        updateWeatherDisplay(weatherData);
    } else {
        updateWeatherDisplay(null);
    }
}

// Time and Date
function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('time').textContent = `${hours}:${minutes}`;
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('date').textContent = now.toLocaleDateString('en-US', options);
}

updateTime();
setInterval(updateTime, 1000);

// Initialize weather
loadWeather();

// Render bookmarks (XSS-safe)
function renderBookmarks() {
    const grid = document.getElementById('bookmarksGrid');
    grid.innerHTML = '';
    
    bookmarks.forEach((bookmark, index) => {
        const bookmarkEl = document.createElement('a');
        bookmarkEl.className = 'bookmark';
        bookmarkEl.href = sanitizeUrl(bookmark.url);
        
        // Create icon with image
        const iconSpan = document.createElement('span');
        iconSpan.className = 'bookmark-icon';
        if (settings.showFavicons) {
            const img = document.createElement('img');
            img.src = getFaviconUrl(bookmark.url);
            img.alt = bookmark.title;
            img.onerror = function() {
                this.parentElement.textContent = '🌐';
            };
            iconSpan.appendChild(img);
        } else {
            iconSpan.classList.add('bookmark-letter-icon');
            iconSpan.style.background = `hsl(${bookmark.iconHue}, 60%, 42%)`;
            iconSpan.textContent = bookmark.iconLetter;
        }
        
        // Create title (using textContent to prevent XSS)
        const titleDiv = document.createElement('div');
        titleDiv.className = 'bookmark-title';
        titleDiv.textContent = bookmark.title;
        
        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '✎';
        editBtn.addEventListener('click', (event) => editBookmark(event, index));
        
        bookmarkEl.appendChild(iconSpan);
        bookmarkEl.appendChild(titleDiv);
        bookmarkEl.appendChild(editBtn);
        grid.appendChild(bookmarkEl);
    });
}

// Modal handling
let editingIndex = -1;
const modal = document.getElementById('bookmarkModal');
const modalTitle = modal.querySelector('h3');
const addBtn = document.getElementById('addBookmarkBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const deleteBtn = document.getElementById('deleteBtn');

function closeModal() {
    modal.classList.add('closing');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.remove('closing');
        clearForm();
    }, 200);
}

addBtn.addEventListener('click', () => {
    editingIndex = -1;
    modalTitle.textContent = 'Add New Site';
    deleteBtn.style.display = 'none';
    modal.classList.add('active');
    document.getElementById('bookmarkTitle').focus();
});

cancelBtn.addEventListener('click', () => {
    closeModal();
});

deleteBtn.addEventListener('click', () => {
    if (editingIndex >= 0) {
        bookmarks.splice(editingIndex, 1);
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        renderBookmarks();
        closeModal();
    }
});

let modalMouseDownTarget = null;
modal.addEventListener('mousedown', (e) => {
    if (e.target === modal) {
        modalMouseDownTarget = e.target;
    } else {
        modalMouseDownTarget = null;
    }
});

modal.addEventListener('mouseup', (e) => {
    if (modalMouseDownTarget === modal && e.target === modal) {
        closeModal();
    }
    modalMouseDownTarget = null;
});

saveBtn.addEventListener('click', () => {
    const title = document.getElementById('bookmarkTitle').value.trim();
    const url = document.getElementById('bookmarkUrl').value.trim();

    if (title && url) {
        // Format URL: if it starts with http/https/file, use as-is; otherwise add https://
        let formattedUrl;
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
            formattedUrl = url;
        } else {
            formattedUrl = `https://${url}`;
        }
        
        const sanitized = sanitizeUrl(formattedUrl);
        
        if (sanitized === 'about:blank') {
            showToast('Please enter a valid URL (e.g., google.com, http://example.com, or file:///path/to/file)');
            return;
        }
        
        const mainPart = getMainPart(sanitized);
        const iconHue = getLetterIconHue(mainPart);
        const iconLetter = (mainPart.replace(/[^a-z]/gi, '')[0] || '?').toUpperCase();
        if (editingIndex >= 0) {
            bookmarks[editingIndex] = { title, url: sanitized, iconHue, iconLetter };
            editingIndex = -1;
        } else {
            bookmarks.push({ title, url: sanitized, iconHue, iconLetter });
        }
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        renderBookmarks();
        closeModal();
    }
});

// Handle Enter key in bookmark modal inputs
document.getElementById('bookmarkTitle').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveBtn.click();
    }
});

document.getElementById('bookmarkUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveBtn.click();
    }
});

function clearForm() {
    document.getElementById('bookmarkTitle').value = '';
    document.getElementById('bookmarkUrl').value = '';
    editingIndex = -1;
}

// Edit bookmark
function editBookmark(event, index) {
    event.preventDefault();
    event.stopPropagation();
    editingIndex = index;
    modalTitle.textContent = 'Edit Site';
    deleteBtn.style.display = '';
    document.getElementById('bookmarkTitle').value = bookmarks[index].title;
    document.getElementById('bookmarkUrl').value = bookmarks[index].url;
    modal.classList.add('active');
    document.getElementById('bookmarkTitle').focus();
}

// Guide modal handling
const guideModal = document.getElementById('guideModal');
const guideBtn = document.getElementById('guideBtn');
const guideCloseBtn = document.getElementById('guideCloseBtn');

function closeGuideModal() {
    guideModal.classList.add('closing');
    guideModal.classList.remove('active');
    setTimeout(() => {
        guideModal.classList.remove('closing');
    }, 200);
}

guideBtn.addEventListener('click', () => {
    guideModal.classList.add('active');
});

guideCloseBtn.addEventListener('click', () => {
    closeGuideModal();
});

let guideModalMouseDownTarget = null;
guideModal.addEventListener('mousedown', (e) => {
    if (e.target === guideModal) {
        guideModalMouseDownTarget = e.target;
    } else {
        guideModalMouseDownTarget = null;
    }
});

guideModal.addEventListener('mouseup', (e) => {
    if (guideModalMouseDownTarget === guideModal && e.target === guideModal) {
        closeGuideModal();
    }
    guideModalMouseDownTarget = null;
});

// ESC key handler for modals and settings panel
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close bookmark modal if active
        if (modal.classList.contains('active')) {
            closeModal();
        }
        // Close guide modal if active
        if (guideModal.classList.contains('active')) {
            closeGuideModal();
        }
        // Close settings panel if active
        if (settingsPanel.classList.contains('active')) {
            settingsPanel.classList.remove('active');
        }
    }
});

// Search functionality
const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
            // Check if it's a URL
            if (query.includes('.') && !query.includes(' ')) {
                const url = query.startsWith('http') ? query : `https://${query}`;
                const sanitized = sanitizeUrl(url);
                if (sanitized !== 'about:blank') {
                    window.location.href = sanitized;
                }
            } else {
                // Search on Google
                window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            }
        }
    }
});

// Settings functionality
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const toggleTime = document.getElementById('toggleTime');
const toggleBookmarks = document.getElementById('toggleBookmarks');
const toggleSearch = document.getElementById('toggleSearch');
const timeDisplay = document.querySelector('.time-display');
const bookmarksSection = document.querySelector('.bookmarks-section');
const searchBox = document.querySelector('.search-box');

// Apply saved settings
function applySettings() {
    const lightBackgrounds = [
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
    ];
    
    document.body.style.background = settings.background;
    
    // Check if current background is light and apply theme
    const isLight = lightBackgrounds.includes(settings.background);
    if (isLight) {
        document.body.classList.add('light-theme');
        document.body.style.color = '#333';
    } else {
        document.body.classList.remove('light-theme');
        document.body.style.color = '#fff';
    }
    
    timeDisplay.style.display = settings.showTime ? 'block' : 'none';
    bookmarksSection.style.display = settings.showBookmarks ? 'block' : 'none';
    searchBox.style.display = settings.showSearch ? 'flex' : 'none';
    const weatherEl = document.getElementById('weather');
    weatherEl.style.display = settings.showWeather ? 'flex' : 'none';
    document.getElementById('weatherConfig').style.display = settings.showWeather ? 'block' : 'none';
    toggleTime.checked = settings.showTime;
    toggleBookmarks.checked = settings.showBookmarks;
    toggleSearch.checked = settings.showSearch;
    document.getElementById('toggleWeather').checked = settings.showWeather;
    document.getElementById('toggleFavicons').checked = !!settings.showFavicons;
    document.getElementById('weatherApiKey').value = settings.weatherApiKey || '';
    document.getElementById('weatherLat').value = settings.weatherLat || '';
    document.getElementById('weatherLon').value = settings.weatherLon || '';

    // Sync advanced bookmarks mode toggle (read from its own storage key)
    try {
        const advCfg = JSON.parse(localStorage.getItem('advancedBookmarksConfig') || '{}');
        const toggleAdv = document.getElementById('toggleAdvancedBookmarks');
        if (toggleAdv) toggleAdv.checked = !!advCfg.enabled;
        // Hide basic grid early if advanced mode is on (avoids first-paint flash)
        if (advCfg.enabled) {
            const grid = document.getElementById('bookmarksGrid');
            const advContainer = document.getElementById('advancedBookmarksContainer');
            const addBtn = document.getElementById('addBookmarkBtn');
            const editBtn = document.getElementById('bmEditToggleBtn');
            if (grid) grid.style.display = 'none';
            if (advContainer) advContainer.style.display = '';
            if (addBtn) addBtn.style.display = 'none';
            if (editBtn) editBtn.style.display = '';
            // manageGroupsBtn visibility is controlled by edit mode, not here
        }
    } catch (e) {}
}

applySettings();

settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('active');
});

// Close settings panel when clicking outside (only if mousedown was also outside)
let mouseDownTarget = null;
document.addEventListener('mousedown', (e) => {
    mouseDownTarget = e.target;
});

document.addEventListener('mouseup', (e) => {
    if (mouseDownTarget && 
        !settingsPanel.contains(mouseDownTarget) && 
        !settingsBtn.contains(mouseDownTarget) &&
        !settingsPanel.contains(e.target) && 
        !settingsBtn.contains(e.target)) {
        settingsPanel.classList.remove('active');
    }
});

// Color presets
const lightBackgrounds = [
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
];

document.querySelectorAll('.color-preset').forEach(preset => {
    preset.addEventListener('click', () => {
        const gradient = preset.dataset.gradient;
        const overlay = document.getElementById('gradient-overlay');
                        
        // Determine text color based on background brightness
        const isLight = lightBackgrounds.includes(gradient);
        const textColor = isLight ? '#333' : '#fff';
        document.body.style.color = textColor;
        
        // Toggle light theme class
        if (isLight) {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        
        // Set new gradient on overlay
        overlay.style.background = gradient;
        
        // Fade in overlay
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });
        
        // After fade completes, swap background and fade out overlay
        setTimeout(() => {
            document.body.style.background = gradient;
            overlay.style.opacity = '0';
        }, 900);
        
        settings.background = gradient;
        localStorage.setItem('settings', JSON.stringify(settings));
    });
});

// Toggle switches
toggleTime.addEventListener('change', () => {
    settings.showTime = toggleTime.checked;
    localStorage.setItem('settings', JSON.stringify(settings));
    timeDisplay.style.display = settings.showTime ? 'block' : 'none';
});

toggleBookmarks.addEventListener('change', () => {
    settings.showBookmarks = toggleBookmarks.checked;
    localStorage.setItem('settings', JSON.stringify(settings));
    bookmarksSection.style.display = settings.showBookmarks ? 'block' : 'none';
});

const toggleFavicons = document.getElementById('toggleFavicons');
toggleFavicons.addEventListener('change', () => {
    settings.showFavicons = toggleFavicons.checked;
    localStorage.setItem('settings', JSON.stringify(settings));
    renderBookmarks();
    if (window.advancedBookmarks) window.advancedBookmarks.render();
});

// Advanced bookmark mode toggle
document.getElementById('toggleAdvancedBookmarks').addEventListener('change', function () {
    if (!window.advancedBookmarks) return;
    const enabling = this.checked;
    // Only offer migration when there are no groups yet (first-time setup)
    if (enabling && window.advancedBookmarks.hasNoGroups()) {
        const basicBms = JSON.parse(localStorage.getItem('bookmarks') || '[]');
        if (basicBms.length > 0 && confirm('Migrate your existing bookmarks into a default group in advanced mode?')) {
            window.advancedBookmarks.migrate();
        }
    }
    window.advancedBookmarks.setMode(enabling);
});

// Manage Groups button
document.getElementById('manageGroupsBtn').addEventListener('click', () => {
    if (window.advancedBookmarks) window.advancedBookmarks.openGroupManager();
});

toggleSearch.addEventListener('change', () => {
    settings.showSearch = toggleSearch.checked;
    localStorage.setItem('settings', JSON.stringify(settings));
    searchBox.style.display = settings.showSearch ? 'flex' : 'none';
});

const toggleWeather = document.getElementById('toggleWeather');
toggleWeather.addEventListener('change', () => {
    settings.showWeather = toggleWeather.checked;
    localStorage.setItem('settings', JSON.stringify(settings));
    const weatherEl = document.getElementById('weather');
    weatherEl.style.display = settings.showWeather ? 'flex' : 'none';
    document.getElementById('weatherConfig').style.display = settings.showWeather ? 'block' : 'none';
    if (settings.showWeather) {
        loadWeather();
    }
});

let apiKeyTimeout;
document.getElementById('weatherApiKey').addEventListener('input', () => {
    const apiKey = document.getElementById('weatherApiKey').value.trim();
    
    clearTimeout(apiKeyTimeout);
    
    if (apiKey.length >= 32) {
        settings.weatherApiKey = apiKey;
        localStorage.setItem('settings', JSON.stringify(settings));
        showToast('API key saved! Note: It may take a couple of minutes for the key to be activated.', 5000);
        
        if (settings.weatherLat && settings.weatherLon) {
            localStorage.removeItem('weatherCache');
            loadWeather();
        }
    } else if (apiKey.length > 0) {
        apiKeyTimeout = setTimeout(() => {
            settings.weatherApiKey = apiKey;
            localStorage.setItem('settings', JSON.stringify(settings));
        }, 500);
    }
});

document.getElementById('saveWeatherLocation').addEventListener('click', () => {
    const lat = document.getElementById('weatherLat').value.trim();
    const lon = document.getElementById('weatherLon').value.trim();
    
    if (lat && lon) {
        settings.weatherLat = lat;
        settings.weatherLon = lon;
        localStorage.setItem('settings', JSON.stringify(settings));
        localStorage.removeItem('weatherCache'); // Clear cache to force refresh
        loadWeather();
        showToast('Location saved! Weather will update.');
    } else {
        showToast('Please enter both latitude and longitude.');
    }
});

// Initial render
renderBookmarks();

// UI hover detection flag (optimized with event delegation)
let isOverUIFlag = false;

// Event delegation for UI hover detection (prevents memory leaks)
// Using mouseover/mouseout instead of mouseenter/mouseleave because they bubble
document.body.addEventListener('mouseover', (e) => {
    const uiSelectors = [
        '.time-display',
        '.search-box',
        '.bookmarks-section',
        '.settings-btn',
        '.settings-panel',
        '.tool-strip',
        '.bm-mgmt-overlay',
        '.bm-editor-overlay',
        '#advancedBookmarkModal',
        'input',
        'button'
    ];

    // Check if event target matches any UI selector
    for (const selector of uiSelectors) {
        if (e.target.matches(selector) || e.target.closest(selector)) {
            isOverUIFlag = true;
            return;
        }
    }
});

document.body.addEventListener('mouseout', (e) => {
    const uiSelectors = [
        '.time-display',
        '.search-box',
        '.bookmarks-section',
        '.settings-btn',
        '.settings-panel',
        '.tool-strip',
        '.bm-mgmt-overlay',
        '.bm-editor-overlay',
        '#advancedBookmarkModal',
        'input',
        'button'
    ];

    // Check if we're leaving a UI element
    for (const selector of uiSelectors) {
        if (e.target.matches(selector) || e.target.closest(selector)) {
            // Only set flag to false if relatedTarget is not also a UI element
            let isRelatedUI = false;
            if (e.relatedTarget) {
                for (const sel of uiSelectors) {
                    if (e.relatedTarget.matches && (e.relatedTarget.matches(sel) || e.relatedTarget.closest(sel))) {
                        isRelatedUI = true;
                        break;
                    }
                }
            }
            if (!isRelatedUI) {
                isOverUIFlag = false;
            }
            return;
        }
    }
});

// Helper function to check if any modal, settings panel, or tool viewport is open
function isModalOrPanelOpen() {
    const modal = document.getElementById('bookmarkModal');
    const guideModal = document.getElementById('guideModal');
    const settingsPanel = document.getElementById('settingsPanel');
    const toolViewport = document.getElementById('toolViewport');
    const advBmModal = document.getElementById('advancedBookmarkModal');
    const bmMgmt = document.getElementById('bmMgmtOverlay');
    const bmEditor = document.getElementById('bmEditorOverlay');

    return (modal && modal.classList.contains('active')) ||
           (guideModal && guideModal.classList.contains('active')) ||
           (settingsPanel && settingsPanel.classList.contains('active')) ||
           (toolViewport && toolViewport.classList.contains('active')) ||
           (advBmModal && advBmModal.classList.contains('active')) ||
           (bmMgmt && bmMgmt.classList.contains('active')) ||
           (bmEditor && bmEditor.classList.contains('active'));
}
