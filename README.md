# New Tab - Customizable Browser Homepage

A sleek, lightweight, and highly customizable browser homepage designed for Chrome, Edge, or any modern browser. Features a beautiful gradient background, live clock, Google search, customizable bookmarks with favicons, and optional weather display.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **🎨 Customizable Themes** - Choose from 9 beautiful gradient backgrounds
- **⏰ Live Clock & Date** - Always-visible time display with elegant design
- **🔍 Smart Search** - Search Google or navigate directly to URLs
- **🔖 Quick Access Bookmarks** - Add unlimited sites with auto-fetched favicons
- **🌤️ Weather Display** - Optional weather with 1-hour caching (requires free API key)
- **⚙️ Settings Panel** - Toggle visibility of all components
- **💾 Persistent Storage** - All settings saved locally in your browser
- **🔒 Secure** - No hardcoded keys, XSS-safe, client-side only
- **📱 Responsive** - Works on desktop and mobile devices
- **⚡ Lightweight** - Pure HTML/CSS/JS, no frameworks, no dependencies

## 🚀 Quick Start

1. **Clone or Download**
   ```bash
   git clone <your-repo-url>
   ```

2. **Open the file**
   - Simply open `index.html` in your browser
   - Or set it as your browser homepage/new tab page

3. **Set as Homepage** (Chrome)
   - Go to Settings → Appearance
   - Enable "Show home button"
   - Set custom address to the file path: `file:///path/to/index.html`

4. **Set as New Tab** (Chrome Extension Required)
   - Use an extension like "New Tab Redirect"
   - Point it to your local file or hosted URL

## 📦 GitHub Pages Hosting

1. Fork or clone this repository
2. Go to Settings → Pages
3. Select source: `main` branch, `/html/new-tab-alt` folder
4. Access at: `https://yourusername.github.io/repo-name/`

## 🎨 Customization

Click the ⚙️ icon in the top-right to access settings:

### Background
- Choose from 9 pre-configured gradient themes
- Instant preview and switching

### Visibility Toggles
- Show/Hide Time & Date
- Show/Hide Bookmarks
- Show/Hide Search Bar
- Show/Hide Weather

### Bookmarks
- Click "+ Add Site" to add new bookmarks
- Favicons automatically fetched from each site
- Hover to delete bookmarks
- All changes saved instantly

### Weather (Optional)

1. **Get API Key** (Free)
   - Visit [OpenWeatherMap.org](https://openweathermap.org/api)
   - Sign up for a free account
   - Get your API key (1000 calls/day free)

2. **Configure in Settings**
   - Paste your API key in the settings panel
   - Enter your latitude and longitude
   - Click "Save Location"

3. **Find Your Coordinates**
   - Google: "my coordinates"
   - Visit: [latlong.net](https://www.latlong.net)

**Note**: Weather data is cached for 1 hour to minimize API calls.

## 🔒 Security Features

- ✅ No API keys in source code
- ✅ XSS protection using DOM methods
- ✅ URL sanitization and validation
- ✅ Password-masked API key input
- ✅ Client-side only (no server required)
- ✅ Safe for public repositories

## 💾 Data Storage

All data is stored locally in your browser's `localStorage`:
- Bookmarks
- Settings (theme, toggles)
- Weather API key (encrypted by browser)
- Weather cache (1-hour TTL)
- Coordinates

**Privacy**: Nothing is sent to external servers except:
- Favicon requests to Google's favicon service
- Weather data (if configured) to OpenWeatherMap API

## 🛠️ Technologies

- Pure HTML5
- CSS3 (Flexbox, Grid, Backdrop Filters)
- Vanilla JavaScript (ES6+)
- localStorage API
- Fetch API (for weather)

## 🌐 Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+

## 📝 Default Bookmarks

Includes 2 starter bookmarks:
- Gmail
- GitHub

Simply delete or add your own!

## 🎯 Use Cases

- Personal browser homepage
- Developer dashboard
- Minimalist start page
- Quick access portal
- Customizable new tab

## 📄 License

MIT License - feel free to use, modify, and distribute.

## 🤝 Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 🔮 Future Ideas

- [ ] Multiple bookmark groups/categories
- [ ] Keyboard shortcuts
- [ ] Notes/todo list widget
- [ ] RSS feed reader
- [ ] Pomodoro timer
- [ ] More weather providers

---

**Made with ❤️ for a lightweight new tab experience**

<div align="center">
    <img src="https://visitor-badge.laobi.icu/badge?page_id=czampath.new-tab-alt" />
</div>

