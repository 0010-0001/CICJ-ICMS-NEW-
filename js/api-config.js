(function () {
    const localBase = 'http://localhost:5000';
    const hostname = window.location.hostname;
    const isLocalhost = (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0');
    // In production the backend serves the frontend from the same origin,
    // so window.location.origin is always the correct API base.
    const inferredBase = isLocalhost ? localBase : window.location.origin;
    const apiBase = window.API_BASE || inferredBase;

    window.API_BASE = apiBase;

    // Patch fetch so any hardcoded http://localhost:5000 calls are rewritten
    // to the correct base in production.
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
        if (typeof input === 'string' && input.startsWith(localBase)) {
            input = apiBase + input.slice(localBase.length);
        }
        return originalFetch(input, init);
    };
})();
