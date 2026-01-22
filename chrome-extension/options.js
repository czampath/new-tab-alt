// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get(['customUrl', 'redirectRules'], (result) => {
        if (result.customUrl) {
            document.getElementById('customUrl').value = result.customUrl;
        }
        
        // Load redirect rules
        const redirectRules = result.redirectRules || [];
        renderRedirectList(redirectRules);
    });
});

// Render redirect rules list
function renderRedirectList(rules) {
    const container = document.getElementById('redirectList');
    container.innerHTML = '';
    
    rules.forEach((rule, index) => {
        const item = document.createElement('div');
        item.className = 'redirect-item';
        item.innerHTML = `
            <input type="text" placeholder="From URL (e.g., https://example.com)" value="${rule.from || ''}" data-index="${index}" data-field="from">
            <div class="arrow">→</div>
            <input type="text" placeholder="To URL (e.g., https://newsite.com)" value="${rule.to || ''}" data-index="${index}" data-field="to">
            <button data-index="${index}" class="remove-btn">Remove</button>
        `;
        container.appendChild(item);
    });
    
    // Attach event listeners
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            removeRedirectRule(index);
        });
    });
}

// Add new redirect rule
document.getElementById('addRedirectBtn').addEventListener('click', () => {
    chrome.storage.sync.get(['redirectRules'], (result) => {
        const rules = result.redirectRules || [];
        rules.push({ from: '', to: '' });
        chrome.storage.sync.set({ redirectRules: rules }, () => {
            renderRedirectList(rules);
        });
    });
});

// Remove redirect rule
function removeRedirectRule(index) {
    chrome.storage.sync.get(['redirectRules'], (result) => {
        const rules = result.redirectRules || [];
        rules.splice(index, 1);
        chrome.storage.sync.set({ redirectRules: rules }, () => {
            renderRedirectList(rules);
            showStatus('Redirect rule removed', 'success');
        });
    });
}

// Save settings
document.getElementById('saveBtn').addEventListener('click', () => {
    const customUrl = document.getElementById('customUrl').value.trim();
    
    // Collect redirect rules from inputs
    const redirectInputs = document.querySelectorAll('#redirectList input');
    const redirectRules = [];
    const ruleMap = {};
    
    redirectInputs.forEach(input => {
        const index = parseInt(input.dataset.index);
        const field = input.dataset.field;
        
        if (!ruleMap[index]) {
            ruleMap[index] = {};
        }
        ruleMap[index][field] = input.value.trim();
    });
    
    // Convert map to array, filter out empty rules
    Object.values(ruleMap).forEach(rule => {
        if (rule.from && rule.to) {
            redirectRules.push(rule);
        }
    });
    
    chrome.storage.sync.set({ customUrl, redirectRules }, () => {
        renderRedirectList(redirectRules);
        showStatus('Settings saved successfully!', 'success');
    });
});

// Reset to default
document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('customUrl').value = '';
    chrome.storage.sync.set({ customUrl: '', redirectRules: [] }, () => {
        renderRedirectList([]);
        showStatus('Reset to default settings', 'success');
    });
});

// Show status message
function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type} show`;
    
    setTimeout(() => {
        status.classList.remove('show');
    }, 3000);
}
