// Check for custom URL and redirect
chrome.storage.sync.get(['customUrl'], (result) => {
    const customUrl = result.customUrl ? result.customUrl.trim() : '';
    
    if (customUrl) {
        // Validate URL format
        const validPrefixes = ['https://', 'http://', 'file://', 'ftp://', 'urn:', 'chrome-extension://', 'chrome://'];
        const isValidUrl = validPrefixes.some(prefix => customUrl.startsWith(prefix));
        
        if (isValidUrl) {
            // Redirect to custom URL
            window.location.replace(customUrl);
        } else {
            // Invalid URL - show error
            document.getElementById('loading').innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <h2 style="margin-bottom: 20px;">Invalid URL</h2>
                    <p style="margin-bottom: 20px;">The custom URL you set is not valid.</p>
                    <p style="margin-bottom: 30px; font-family: 'Courier New', monospace; background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px;">${customUrl}</p>
                    <p style="margin-bottom: 20px;">URLs must start with: https://, http://, file://, chrome://, etc.</p>
                    <button onclick="chrome.runtime.openOptionsPage()" style="padding: 12px 24px; background: white; color: #667eea; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
                        Open Settings
                    </button>
                </div>
            `;
        }
    } else {
        // No custom URL - redirect to default Chrome new tab
        window.location.replace('chrome://newtab');
    }
});
