# Override New Tab - Chrome Extension

A Chrome extension that allows you to override the new tab page with any custom URL, bypassing organization policies.

## Features

- ✅ Set custom URL for new tab pages
- ✅ Support for multiple URL types:
  - `https://` - Web URLs
  - `http://` - Local servers
  - `file://` - Local HTML files
  - `chrome://` - Chrome internal pages
  - `chrome-extension://` - Other extension pages
  - `ftp://` and `urn:` protocols
- ✅ Leave empty to use default Chrome new tab
- ✅ Simple and clean options page
- ✅ Works around organization-enforced new tab policies

## Installation

### From Source (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension is now installed!

### Configure Your New Tab

1. Right-click the extension icon and select "Options"
   - Or go to `chrome://extensions/` and click "Details" → "Extension options"
2. Enter your desired URL in the text field
3. Click "Save Settings"
4. Open a new tab to see your custom page!

## Examples

### Use Your Custom HTML Page
```
file:///D:/Cosmos/CodeSpace/HTML/new-tab-alt/index.html
```

### Use a Local Development Server
```
http://localhost:3000
```

### Use Another Website
```
https://www.google.com
```

### Reset to Chrome Default
Leave the URL field empty and click "Save Settings"

## How It Works

The extension uses Chrome's `chrome_url_overrides` API to replace the default new tab page. When you open a new tab, it checks your saved settings and redirects to your custom URL. This bypasses any organization-level policies that enforce a specific new tab page.

## Generating Icons

If you need to regenerate the extension icons:

1. Open `generate-icons.html` in a browser
2. The icons will automatically download
3. Replace the existing `icon16.png`, `icon48.png`, and `icon128.png` files

## Files Structure

```
chrome-extension/
├── manifest.json          # Extension configuration
├── newtab.html           # New tab override page
├── newtab.js             # Redirect logic
├── options.html          # Settings page UI
├── options.js            # Settings page logic
├── generate-icons.html   # Icon generator tool
├── icon16.png           # Extension icon (16x16)
├── icon48.png           # Extension icon (48x48)
├── icon128.png          # Extension icon (128x128)
└── README.md            # This file
```

## Permissions

- `storage` - To save your custom URL preference
- `tabs` - To override the new tab page

## Privacy

This extension does not collect, store, or transmit any of your data. All settings are saved locally in Chrome's sync storage.

## License

Free to use and modify.
