document.addEventListener('DOMContentLoaded', () => {
    // --- 1. AUTHENTICATION CHECK ---
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) { window.location.href = 'index.html'; return; }
    const user = JSON.parse(userStr);
    if (user.role !== 'ADMIN') { window.location.href = 'employee.html'; return; }
    
    document.getElementById('welcome-message').textContent = `Welcome, ${user.full_name}`;
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });

    // --- 2. TAB SWITCHING LOGIC ---
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const tabSections = document.querySelectorAll('.tab-section');
    const pageTitle = document.getElementById('page-title');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            tabSections.forEach(tab => tab.classList.add('hidden'));

            link.classList.add('active');
            const targetId = link.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            pageTitle.textContent = link.textContent;
        });
    });

    // --- 3. MODAL LOGIC & FORM CAPTURE (Add Equipment) ---
    const modal = document.getElementById('equipment-modal');
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtns = document.querySelectorAll('#close-modal-btn, #cancel-modal-btn');

    openModalBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    closeModalBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));

    // Form Capture Logic
    const addEquipmentForm = document.getElementById('add-equipment-form');
    addEquipmentForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // CRITICAL: Stops the page from reloading!

        // Capture the data using the DOM IDs
        const equipmentName = document.getElementById('equip-name').value;
        const equipmentQty = parseInt(document.getElementById('equip-qty').value, 10);

        // Package the data into a JSON object
        const newEquipmentData = {
            name: equipmentName,
            quantity: equipmentQty,
            condition: "Good",       // Default system assumption for new items
            status: "Available"      // Default system assumption
        };

        // Log it to the console to prove we captured it successfully
        console.log("Data captured and ready for backend:", newEquipmentData);
        alert(`Successfully captured: ${newEquipmentData.quantity}x ${newEquipmentData.name}\n(Check your browser console to see the JSON object!)`);

        /* 
        ===========================================================
        WEEK 6: BACKEND CONNECTION READY
        Uncomment this block when we are ready to hit the database
        ===========================================================
        try {
            const response = await fetch('http://localhost:5000/api/equipment', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // Send the JWT for security!
                },
                body: JSON.stringify(newEquipmentData)
            });
            
            if (response.ok) {
                // Success! Reload the table data here
            } else {
                alert("Failed to save equipment to database.");
            }
        } catch (error) {
            console.error("Network error:", error);
        }
        */

        // Cleanup: Close the modal and wipe the input fields
        modal.classList.add('hidden');
        addEquipmentForm.reset(); 
    });
});
