/**
 * ==========================================
 * GEO-FENCING MIDDLEWARE
 * ==========================================
 * GPS coordinate validation for attendance system
 * Implements Haversine formula for distance calculation
 */

// Math helpers for attendance location checks.

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lon1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lon2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in meters
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const EARTH_RADIUS_METERS = 6371000; // Earth's radius in meters

    // Convert degrees to radians
    const toRadians = (degrees) => degrees * (Math.PI / 180);

    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);

    // Haversine formula
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = EARTH_RADIUS_METERS * c; // Distance in meters

    return distance;
};

/**
 * Check if a coordinate is within a geo-fence radius
 * @param {number} userLat - User's latitude
 * @param {number} userLon - User's longitude
 * @param {number} siteLat - Site center latitude
 * @param {number} siteLon - Site center longitude
 * @param {number} radiusMeters - Geo-fence radius in meters
 * @returns {object} { isWithinFence: boolean, distance: number }
 */
const isWithinGeoFence = (userLat, userLon, siteLat, siteLon, radiusMeters) => {
    // Main yes/no check used by clock-in and clock-out route validation.
    const distance = calculateDistance(userLat, userLon, siteLat, siteLon);
    const isWithinFence = distance <= radiusMeters;

    return {
        isWithinFence,
        distance: Math.round(distance), // Round to nearest meter
        radiusMeters
    };
};

/**
 * Validate GPS coordinates format
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} True if valid
 */
const isValidCoordinates = (lat, lon) => {
    return (
        typeof lat === 'number' &&
        typeof lon === 'number' &&
        lat >= -90 && lat <= 90 &&
        lon >= -180 && lon <= 180 &&
        !isNaN(lat) && !isNaN(lon)
    );
};

/**
 * Find nearest construction site to given coordinates
 * @param {number} userLat - User's latitude
 * @param {number} userLon - User's longitude
 * @param {Array} sites - Array of construction sites
 * @returns {object|null} Nearest site with distance
 */
const findNearestSite = (userLat, userLon, sites) => {
    if (!sites || sites.length === 0) {
        return null;
    }

    let nearestSite = null;
    let minDistance = Infinity;

    for (const site of sites) {
        const distance = calculateDistance(
            userLat,
            userLon,
            parseFloat(site.center_lat),
            parseFloat(site.center_lng)
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearestSite = {
                ...site,
                distance: Math.round(distance)
            };
        }
    }

    return nearestSite;
};

module.exports = {
    calculateDistance,
    isWithinGeoFence,
    isValidCoordinates,
    findNearestSite
};
