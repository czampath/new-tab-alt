(async () => {
    const toolId = new URLSearchParams(location.search).get('tool');
    const modules = {
        'json-formatter': ['js/tools-code-editor.js', 'js/tools-formatters.js'],
        'markdown-viewer': ['js/tools-formatters.js'],
        'sql-formatter': ['js/tools-code-editor.js', 'js/tools-formatters.js'],
        'text-formatter': ['js/tools-formatters.js'],
        'regex-tester': ['js/tools-formatters.js'],
        'diff-viewer': ['js/tools-code-editor.js', 'js/yaml-parser.js', 'js/tools-diff.js'],
        'date-formatter': ['js/tools-utilities.js'],
        'epoch-converter': ['js/tools-utilities.js'],
        'color-picker': ['js/tools-utilities.js'],
        'password-generator': ['js/tools-utilities.js'],
        'uuid-hash': ['js/tools-utilities.js'],
        'notes': ['js/tools-personal.js'],
        'reminder': ['js/tools-personal.js'],
        'keep-awake': ['js/tools-personal.js'],
        'screensaver': ['js/tools-screensaver.js']
    };

    function showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    }

    function fail(error) {
        document.getElementById('toolBody').innerHTML = `<div style="padding:20px;color:#ff8f8f;font:14px sans-serif">Unable to load this tool: ${error.message}</div>`;
    }

    try {
        if (!modules[toolId]) throw new Error('Unknown tool');
        await loadScript('js/tools-core.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        for (const src of modules[toolId]) await loadScript(src);

        const coreClose = ToolManager.close.bind(ToolManager);
        ToolManager.close = () => {
            if (ToolManager.activeToolId) {
                const handler = ToolManager.registry[ToolManager.activeToolId];
                if (TabManager.isTabbed(ToolManager.activeToolId)) TabManager.saveActiveTab(ToolManager.activeToolId);
                else handler?.saveState?.();
                handler?.destroy?.();
            }
            parent.postMessage({ type: 'tool-runtime-close' }, location.origin);
        };

        window.disposeToolRuntime = () => {
            if (!ToolManager.activeToolId) return;
            const handler = ToolManager.registry[ToolManager.activeToolId];
            if (TabManager.isTabbed(ToolManager.activeToolId)) TabManager.saveActiveTab(ToolManager.activeToolId);
            else handler?.saveState?.();
            handler?.destroy?.();
            ToolManager.activeToolId = null;
        };

        ToolManager.open(toolId);
    } catch (error) {
        fail(error);
    }
})();