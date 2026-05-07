const API_BASE = window.API_BASE || API_BASE + '';
// Equipment Scanner Modal
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Scanner Modal] Initializing...');

    function getAuthToken() {
        return localStorage.getItem('token');
    }

    let html5QrCode = null;
    let isScanning = false;

    // DOM Elements
    const scannerModal = document.getElementById('scanner-modal');
    const closeScannerBtn = document.getElementById('close-scanner-modal');
    const startCameraBtn = document.getElementById('start-camera-btn');
    const scannerCameraContainer = document.getElementById('scanner-camera-container');
    const scannerPlaceholder = document.getElementById('scanner-placeholder');
    const manualInput = document.getElementById('scanner-manual-input');
    const manualLookupBtn = document.getElementById('manual-lookup-btn');
    const scannerLoading = document.getElementById('scanner-loading');

    // Verify elements exist
    if (!scannerModal || !closeScannerBtn || !startCameraBtn) {
        console.error('[Scanner Modal] ERROR: Scanner modal elements not found');
        return;
    }

    console.log('[Scanner Modal] Elements loaded');

    // Open Modal Function (called from employee.js)
    window.openScannerModal = function() {
        if (!getAuthToken()) {
            showAlert('Your session has expired. Please sign in again.');
            window.location.href = 'index.html';
            return;
        }
        console.log('[Scanner Modal] Opening scanner modal');
        scannerModal.classList.remove('hidden');
        resetScanner();
    };

    // Secondary binding: keep scanner opening functional even if dashboard script fails before wiring.
    const scanEquipmentBtn = document.getElementById('scan-equipment-btn');
    if (scanEquipmentBtn) {
        scanEquipmentBtn.addEventListener('click', () => {
            window.openScannerModal();
        });
    }

    // Close Modal
    function closeModal() {
        console.log('[Scanner Modal] Closing scanner modal');
        stopScanner();
        scannerModal.classList.add('hidden');
        resetScanner();
    }

    closeScannerBtn.addEventListener('click', closeModal);

    // Close on overlay click
    scannerModal.addEventListener('click', (e) => {
        if (e.target === scannerModal) {
            closeModal();
        }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !scannerModal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // Start/Stop Camera
    startCameraBtn.addEventListener('click', async () => {
        if (isScanning) {
            stopScanner();
        } else {
            await startScanner();
        }
    });

    // Start Scanner
    async function startScanner() {
        console.log('[Scanner Modal] Starting scanner...');
        try {
            if (!html5QrCode) {
                console.log('Creating new Html5Qrcode instance for modal');
                html5QrCode = new Html5Qrcode("scanner-qr-reader");
            }

            const config = {
                fps: 10,
                qrbox: 250,
                aspectRatio: 1.777778  // 16:9
            };

            console.log('Requesting camera access...');
            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                onScanSuccess,
                onScanFailure
            );

            console.log('[Scanner Modal] Camera started successfully');
            isScanning = true;
            scannerPlaceholder.classList.add('hidden');
            scannerCameraContainer.classList.remove('hidden');
            startCameraBtn.innerHTML = '<i class="bi bi-stop-fill"></i> Stop Camera';
            startCameraBtn.classList.add('active');

        } catch (err) {
            console.error("[Scanner Modal] ERROR: Camera Error:", err);
            showAlert('Failed to start camera.\n\nPlease allow camera permissions and try again.');
            isScanning = false;
        }
    }

    // Stop Scanner
    function stopScanner() {
        console.log('[Scanner Modal] Stopping scanner...');
        if (html5QrCode && isScanning) {
            html5QrCode.stop().then(() => {
                console.log('[Scanner Modal] Scanner stopped');
                isScanning = false;
                scannerCameraContainer.classList.add('hidden');
                scannerPlaceholder.classList.remove('hidden');
                startCameraBtn.innerHTML = '<i class="bi bi-play-fill"></i> Start Camera';
                startCameraBtn.classList.remove('active');
            }).catch(err => {
                console.error("Stop Scanner Error:", err);
                isScanning = false;
            });
        }
    }

    // QR Scan Success - Auto Checkout
    async function onScanSuccess(decodedText, decodedResult) {
        console.log(`[Scanner Modal] QR Code detected: ${decodedText}`);
        stopScanner();
        
        // Auto-checkout the equipment
        await autoCheckoutEquipment(decodedText.toUpperCase());
    }

    // QR Scan Failure (not an error, just no QR detected)
    function onScanFailure(error) {
        // Ignore - this fires continuously when no QR is in view
    }

    // Auto Checkout or Return Equipment
    async function autoCheckoutEquipment(qrNumber) {
        console.log(`[Scanner Modal] Processing equipment: ${qrNumber}`);
        
        try {
            // Show loading
            scannerLoading.classList.remove('hidden');
            scannerLoading.querySelector('p').textContent = 'Checking equipment status...';

            // First, lookup the equipment to check its status
            const lookupResponse = await fetch(`${API_BASE}/api/equipment/qr/${qrNumber}`, {
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });

            if (!lookupResponse.ok) {
                const data = await lookupResponse.json();
                scannerLoading.classList.add('hidden');
                showAlert(`ERROR: ${data.error || 'Equipment not found'}`);
                resetScanner();
                return;
            }

            const lookupData = await lookupResponse.json();
            const equipment = lookupData.equipment;
            const currentUserId = JSON.parse(localStorage.getItem('user')).user_id;

            // Check if current user has this equipment checked out
            const userCheckout = equipment.checkouts?.find(c => c.user_id === currentUserId && c.status === 'Checked Out');

            if (userCheckout) {
                // User already has it - RETURN it
                console.log('[Scanner Modal] Equipment already checked out by you - returning it');
                scannerLoading.querySelector('p').textContent = 'Returning equipment...';
                await returnEquipment(qrNumber);
            } else if (equipment.status === 'Checked Out') {
                // Someone else has it
                scannerLoading.classList.add('hidden');
                const otherUser = equipment.checkouts?.[0]?.user?.full_name || 'another user';
                showAlert(`ERROR: Equipment is already checked out by ${otherUser}`);
                resetScanner();
            } else if (equipment.status === 'Available') {
                // Available - CHECK IT OUT
                console.log('[Scanner Modal] Equipment available - checking out');
                scannerLoading.querySelector('p').textContent = 'Checking out equipment...';
                await checkoutEquipment(qrNumber);
            } else {
                // Not available (maintenance, etc.)
                scannerLoading.classList.add('hidden');
                showAlert(`ERROR: Equipment is not available\nStatus: ${equipment.status}`);
                resetScanner();
            }

        } catch (error) {
            console.error('[Scanner Modal] ERROR: Auto-process error:', error);
            scannerLoading.classList.add('hidden');
            showAlert('ERROR: Failed to process equipment. Please try again.\n\nError: ' + error.message);
            resetScanner();
        }
    }

    // Checkout Equipment
    async function checkoutEquipment(qrNumber) {
        try {
            // Get user location
            const location = await getUserLocation();
            
            const requestBody = {
                qr_number: qrNumber,
                location_lat: location?.lat,
                location_lng: location?.lng,
                notes: 'Auto-checked out via QR scanner'
            };
            
            console.log('[Scanner Modal] Sending checkout request:', requestBody);

            // Perform checkout
            const response = await fetch(API_BASE + '/api/equipment/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            console.log('[Scanner Modal] Response status:', response.status);
            console.log('[Scanner Modal] Response data:', data);
            
            scannerLoading.classList.add('hidden');

            if (response.ok) {
                console.log('[Scanner Modal] Checkout successful:', data);
                
                // Show success message
                const equipmentName = data.checkout?.equipment?.name || qrNumber;
                showSuccessMessage('Checked Out', equipmentName);
                
                // Close modal after 2 seconds
                setTimeout(() => {
                    closeModal();
                    if (window.loadEquipmentData) {
                        window.loadEquipmentData();
                    }
                }, 2000);
            } else {
                console.error('[Scanner Modal] ERROR: Checkout failed:', data);
                showAlert(`ERROR: ${data.error || 'Failed to checkout equipment'}\n\nQR Code: ${qrNumber}\nStatus: ${response.status}`);
                resetScanner();
            }

        } catch (error) {
            console.error('[Scanner Modal] ERROR: Checkout error:', error);
            scannerLoading.classList.add('hidden');
            showAlert('ERROR: Failed to checkout equipment. Please try again.\n\nError: ' + error.message);
            resetScanner();
        }
    }

    // Return Equipment
    async function returnEquipment(qrNumber) {
        try {
            // Get user location
            const location = await getUserLocation();
            
            const requestBody = {
                qr_number: qrNumber,
                location_lat: location?.lat,
                location_lng: location?.lng,
                notes: 'Auto-returned via QR scanner'
            };
            
            console.log('[Scanner Modal] Sending return request:', requestBody);

            // Perform return
            const response = await fetch(API_BASE + '/api/equipment/return', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            console.log('[Scanner Modal] Response status:', response.status);
            console.log('[Scanner Modal] Response data:', data);
            
            scannerLoading.classList.add('hidden');

            if (response.ok) {
                console.log('[Scanner Modal] Return successful:', data);
                
                // Show success message
                const equipmentName = data.equipment?.name || qrNumber;
                showSuccessMessage('Returned', equipmentName);
                
                // Close modal after 2 seconds
                setTimeout(() => {
                    closeModal();
                    if (window.loadEquipmentData) {
                        window.loadEquipmentData();
                    }
                }, 2000);
            } else {
                console.error('[Scanner Modal] ERROR: Return failed:', data);
                showAlert(`ERROR: ${data.error || 'Failed to return equipment'}\n\nQR Code: ${qrNumber}\nStatus: ${response.status}`);
                resetScanner();
            }

        } catch (error) {
            console.error('[Scanner Modal] ERROR: Return error:', error);
            scannerLoading.classList.add('hidden');
            showAlert('ERROR: Failed to return equipment. Please try again.\n\nError: ' + error.message);
            resetScanner();
        }
    }

    // Get User Location
    function getUserLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.warn('GPS not available');
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('[Scanner Modal] Location acquired');
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.warn('GPS Error:', error);
                    resolve(null);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        });
    }

    // Show Success Message
    function showSuccessMessage(title, equipmentName) {
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #2dad50 0%, #258a3f 100%);
            color: white;
            padding: 24px 32px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(45, 173, 80, 0.3);
            z-index: 10000;
            text-align: center;
            min-width: 300px;
            animation: slideUp 0.3s ease;
        `;

        successDiv.innerHTML = `
            <i class="bi bi-check-circle-fill" style="font-size: 48px; display: block; margin-bottom: 12px;"></i>
            <h3 style="margin: 0 0 8px 0; font-size: 18px;">${title}</h3>
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">${equipmentName}</p>
        `;

        document.body.appendChild(successDiv);

        setTimeout(() => {
            successDiv.remove();
        }, 2000);
    }

    // Manual Lookup
    manualLookupBtn.addEventListener('click', async () => {
        const qrNumber = manualInput.value.trim().toUpperCase();
        if (!qrNumber) {
            showAlert('Please enter an equipment number');
            return;
        }
        await autoCheckoutEquipment(qrNumber);
    });

    // Handle Enter key in manual input
    manualInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            manualLookupBtn.click();
        }
    });

    // Auto-format manual input
    manualInput.addEventListener('input', (e) => {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');

        // Auto-add "EQ-" prefix
        if (value && !value.startsWith('EQ-')) {
            if (value.startsWith('EQ')) {
                value = 'EQ-' + value.substring(2);
            } else {
                value = 'EQ-' + value;
            }
        }

        // Limit to EQ-XXXXX format
        if (value.length > 8) {
            value = value.substring(0, 8);
        }

        e.target.value = value;
    });

    // Reset Scanner
    function resetScanner() {
        scannerLoading.classList.add('hidden');
        manualInput.value = '';
        if (isScanning) {
            stopScanner();
        }
    }

    console.log('[Scanner Modal] Ready');
});



