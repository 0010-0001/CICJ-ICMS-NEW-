const API_BASE = window.API_BASE || API_BASE + '';
// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Equipment Scan] Equipment Scanner - Initializing...');
    
    // Authentication check
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('[Equipment Scan] ERROR: No token found, redirecting to login');
        window.location.href = 'index.html';
        return;
    }

    let html5QrCode = null;
    let currentEquipment = null;
    let currentAction = null; // 'checkout' or 'return'
    let userLocation = null;

    // DOM Elements
    const backBtn = document.getElementById('back-btn');
    const toggleCameraBtn = document.getElementById('toggle-camera-btn');
    const cameraContainer = document.getElementById('camera-container');
    const cameraPlaceholder = document.getElementById('camera-placeholder');
    const qrNumberInput = document.getElementById('qr-number-input');
    const lookupBtn = document.getElementById('lookup-btn');
    const equipmentCard = document.getElementById('equipment-card');
    const checkoutBtn = document.getElementById('checkout-btn');
    const returnBtn = document.getElementById('return-btn');
    const notesModal = document.getElementById('notes-modal');
    const modalTitle = document.getElementById('modal-title');
    const notesInput = document.getElementById('notes-input');
    const confirmActionBtn = document.getElementById('confirm-action-btn');
    const modalCloseXBtn = document.getElementById('modal-close-x-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const gpsStatus = document.getElementById('gps-status');

    // Verify all elements exist
    console.log('[Equipment Scan] DOM Elements:', {
        backBtn: !!backBtn,
        toggleCameraBtn: !!toggleCameraBtn,
        cameraContainer: !!cameraContainer,
        cameraPlaceholder: !!cameraPlaceholder,
        qrNumberInput: !!qrNumberInput,
        lookupBtn: !!lookupBtn
    });

    if (!toggleCameraBtn) {
        console.error('[Equipment Scan] ERROR: Toggle camera button not found!');
        return;
    }

    // Back Button
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            console.log('[Equipment Scan] Back button clicked');
            window.location.href = 'employee.html';
        });
    }

    // Toggle Camera
    toggleCameraBtn.addEventListener('click', async () => {
        console.log('[Equipment Scan] Camera button clicked');
        if (cameraContainer.classList.contains('hidden')) {
            await startScanner();
        } else {
            stopScanner();
        }
    });

    // Start QR Scanner
    async function startScanner() {
        console.log('[Equipment Scan] Starting scanner...');
        try {
            if (!html5QrCode) {
                console.log('Creating new Html5Qrcode instance');
                html5QrCode = new Html5Qrcode("qr-reader");
            }
            
            const config = { 
                fps: 10, 
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };
            
            console.log('Requesting camera access...');
            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                onScanSuccess,
                onScanFailure
            );
            
            console.log('[Equipment Scan] Camera started successfully');
            cameraPlaceholder.classList.add('hidden');
            cameraContainer.classList.remove('hidden');
            toggleCameraBtn.innerHTML = '<i class="bi bi-stop-fill"></i> Stop Camera';
            toggleCameraBtn.classList.add('active');
        } catch (err) {
            console.error("[Equipment Scan] ERROR: Camera Error:", err);
            showAlert('ERROR: Failed to start camera.\n\nPlease allow camera permissions and try again.');
        }
    }

    // Stop QR Scanner
    function stopScanner() {
        console.log('[Equipment Scan] Stopping scanner...');
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                console.log('[Equipment Scan] Scanner stopped');
                cameraContainer.classList.add('hidden');
                cameraPlaceholder.classList.remove('hidden');
                toggleCameraBtn.innerHTML = '<i class="bi bi-play-fill"></i> Start Camera';
                toggleCameraBtn.classList.remove('active');
            }).catch(err => {
                console.error("Stop Scanner Error:", err);
            });
        }
    }

    // QR Scan Success
    function onScanSuccess(decodedText, decodedResult) {
        console.log(`[Equipment Scan] QR Code detected: ${decodedText}`);
        stopScanner();
        lookupEquipment(decodedText.toUpperCase());
    }

    // QR Scan Failure (not an error, just no QR detected)
    function onScanFailure(error) {
        // Ignore - this fires continuously when no QR is in view
    }

    // Manual Lookup
    lookupBtn.addEventListener('click', () => {
        const qrNumber = qrNumberInput.value.trim().toUpperCase();
        if (!qrNumber) {
            showAlert('Please enter an equipment number');
            return;
        }
        lookupEquipment(qrNumber);
    });

    // Handle Enter key in input
    qrNumberInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            lookupBtn.click();
        }
    });

    // Auto-format QR number input
    qrNumberInput.addEventListener('input', (e) => {
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

    // Lookup Equipment
    async function lookupEquipment(qrNumber) {
        try {
            const response = await fetch(`${API_BASE}/api/equipment/qr/${qrNumber}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                const data = await response.json();
                showAlert(`ERROR: ${data.error || 'Equipment not found'}`);
                return;
            }
            
            const data = await response.json();
            currentEquipment = data.equipment;
            displayEquipment(data.equipment);
            
            // Clear input
            qrNumberInput.value = '';
            
        } catch (error) {
            console.error('Lookup Error:', error);
            showAlert('ERROR: Failed to lookup equipment. Please try again.');
        }
    }

    // Display Equipment Details
    function displayEquipment(equipment) {
        document.getElementById('equipment-name').textContent = equipment.name;
        document.getElementById('equipment-qr').textContent = equipment.qr_number;
        document.getElementById('equipment-condition').textContent = equipment.condition;
        document.getElementById('equipment-status-text').textContent = equipment.status;
        
        const statusBadge = document.getElementById('equipment-status');
        statusBadge.textContent = equipment.status;
        
        // Remove all status classes
        statusBadge.className = 'status-badge';
        
        // Add appropriate status class
        if (equipment.status === 'Available') {
            statusBadge.classList.add('status-available');
            checkoutBtn.classList.remove('hidden');
            returnBtn.classList.add('hidden');
            document.getElementById('assigned-row').style.display = 'none';
        } else if (equipment.status === 'Checked Out') {
            statusBadge.classList.add('status-checked-out');
            
            // Check if current user has this equipment checked out
            const currentCheckout = equipment.checkouts && equipment.checkouts[0];
            if (currentCheckout) {
                document.getElementById('assigned-row').style.display = 'flex';
                document.getElementById('equipment-assigned').textContent = currentCheckout.user.full_name;
                
                // Show return button only if user is the one who checked it out
                const currentUserId = JSON.parse(localStorage.getItem('user')).user_id;
                if (currentCheckout.user_id === currentUserId) {
                    checkoutBtn.classList.add('hidden');
                    returnBtn.classList.remove('hidden');
                } else {
                    checkoutBtn.classList.add('hidden');
                    returnBtn.classList.add('hidden');
                }
            } else {
                document.getElementById('assigned-row').style.display = 'none';
            }
        } else if (equipment.status === 'In Maintenance') {
            statusBadge.classList.add('status-maintenance');
            checkoutBtn.classList.add('hidden');
            returnBtn.classList.add('hidden');
            document.getElementById('assigned-row').style.display = 'none';
        } else if (equipment.status === 'Out of Service') {
            statusBadge.classList.add('status-out-of-service');
            checkoutBtn.classList.add('hidden');
            returnBtn.classList.add('hidden');
            document.getElementById('assigned-row').style.display = 'none';
        }
        
        if (equipment.current_location) {
            document.getElementById('location-row').style.display = 'flex';
            document.getElementById('equipment-location').textContent = equipment.current_location;
        } else {
            document.getElementById('location-row').style.display = 'none';
        }
        
        equipmentCard.classList.remove('hidden');
        equipmentCard.scrollIntoView({ behavior: 'smooth' });
    }

    // Checkout Button
    checkoutBtn.addEventListener('click', () => {
        currentAction = 'checkout';
        modalTitle.textContent = 'Checkout Equipment';
        notesInput.value = '';
        notesModal.classList.remove('hidden');
        getLocation();
    });

    // Return Button
    returnBtn.addEventListener('click', () => {
        currentAction = 'return';
        modalTitle.textContent = 'Return Equipment';
        notesInput.value = '';
        notesModal.classList.remove('hidden');
        getLocation();
    });

    // Get User Location
    function getLocation() {
        gpsStatus.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Getting your location...';
        
        if (!navigator.geolocation) {
            gpsStatus.innerHTML = '<i class="bi bi-geo-alt-fill" style="color: #f59e0b;"></i> GPS not available';
            userLocation = null;
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                gpsStatus.innerHTML = `<i class="bi bi-geo-alt-fill" style="color: #2dad50;"></i> Location acquired (Â±${Math.round(position.coords.accuracy)}m)`;
            },
            (error) => {
                console.warn('GPS Error:', error);
                gpsStatus.innerHTML = '<i class="bi bi-geo-alt-fill" style="color: #f59e0b;"></i> GPS unavailable (optional)';
                userLocation = null;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    // Confirm Action
    confirmActionBtn.addEventListener('click', async () => {
        const notes = notesInput.value.trim();
        
        if (currentAction === 'checkout') {
            await checkoutEquipment(notes);
        } else if (currentAction === 'return') {
            await returnEquipment(notes);
        }
    });

    // Checkout Equipment
    async function checkoutEquipment(notes) {
        try {
            confirmActionBtn.disabled = true;
            confirmActionBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';
            
            const response = await fetch(API_BASE + '/api/equipment/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    qr_number: currentEquipment.qr_number,
                    location_lat: userLocation?.lat,
                    location_lng: userLocation?.lng,
                    notes: notes || null
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showAlert(`SUCCESS: ${data.message}\n\nEquipment: ${currentEquipment.name}\nChecked out successfully!`);
                closeNotesModal();
                // Refresh equipment details
                lookupEquipment(currentEquipment.qr_number);
            } else {
                showAlert(`ERROR: ${data.error || 'Failed to checkout equipment'}`);
            }
            
        } catch (error) {
            console.error('Checkout Error:', error);
            showAlert('ERROR: Failed to checkout equipment. Please try again.');
        } finally {
            confirmActionBtn.disabled = false;
            confirmActionBtn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Confirm';
        }
    }

    // Return Equipment
    async function returnEquipment(notes) {
        try {
            confirmActionBtn.disabled = true;
            confirmActionBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';
            
            const response = await fetch(API_BASE + '/api/equipment/return', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    qr_number: currentEquipment.qr_number,
                    location_lat: userLocation?.lat,
                    location_lng: userLocation?.lng,
                    notes: notes || null
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showAlert(`SUCCESS: ${data.message}\n\nEquipment: ${currentEquipment.name}\nReturned successfully!`);
                closeNotesModal();
                // Refresh equipment details
                lookupEquipment(currentEquipment.qr_number);
            } else {
                showAlert(`ERROR: ${data.error || 'Failed to return equipment'}`);
            }
            
        } catch (error) {
            console.error('Return Error:', error);
            showAlert('ERROR: Failed to return equipment. Please try again.');
        } finally {
            confirmActionBtn.disabled = false;
            confirmActionBtn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Confirm';
        }
    }

    // Close Notes Modal
    function closeNotesModal() {
        notesModal.classList.add('hidden');
        notesInput.value = '';
        currentAction = null;
        userLocation = null;
    }

    // Modal close button (X)
    if (modalCloseXBtn) {
        modalCloseXBtn.addEventListener('click', closeNotesModal);
    }

    // Modal cancel button
    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', closeNotesModal);
    }

    // Close modal when clicking outside
    notesModal.addEventListener('click', (e) => {
        if (e.target === notesModal) {
            closeNotesModal();
        }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop();
        }
    });

    console.log('[Equipment Scan] Equipment Scanner - Ready!');
});



