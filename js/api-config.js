(function () {
    const localBase = 'http://localhost:5000';
    const isRailway = window.location.hostname.includes('railway.app');
    const inferredBase = isRailway ? window.location.origin : localBase;
    const apiBase = window.API_BASE || inferredBase;

    window.API_BASE = apiBase;

    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
        if (typeof input === 'string' && input.startsWith(localBase)) {
            input = apiBase + input.slice(localBase.length);
        }
        return originalFetch(input, init);
    };
})();
