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

    // --- 4. ADD NEW HIRE MODAL & PERMISSIONS MATRIX ---
    const userModal = document.getElementById('add-user-modal');
    const openUserModalBtn = document.getElementById('open-add-user-modal-btn');
    const closeUserModalBtns = document.querySelectorAll('#close-user-modal-btn, #cancel-user-modal-btn');

    openUserModalBtn.addEventListener('click', () => userModal.classList.remove('hidden'));
    closeUserModalBtns.forEach(btn => btn.addEventListener('click', () => userModal.classList.add('hidden')));

    // Permission Preset Buttons (Predefined Permission Templates)
    const PERMISSION_PRESETS = {
        'field-worker': {
            description: 'Field Worker (Minimal Access)',
            permissions: ['can_view_own_attendance', 'can_view_equipment', 'can_view_files', 'can_download_files', 'can_add_inquiries']
        },
        'supervisor': {
            description: 'Field Supervisor (Team Management)',
            permissions: ['can_view_own_attendance', 'can_view_all_attendance', 'can_export_attendance', 'can_view_equipment', 'can_assign_equipment', 'can_view_files', 'can_upload_files', 'can_download_files', 'can_add_inquiries']
        },
        'hr-admin': {
            description: 'HR Admin (People Operations)',
            permissions: ['can_view_users', 'can_add_users', 'can_edit_users', 'can_activate_users', 'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance', 'can_export_attendance', 'can_view_equipment', 'can_view_files', 'can_download_files']
        },
        'sales-manager': {
            description: 'Sales Manager (Customer Relations)',
            permissions: ['can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries', 'can_assign_inquiries', 'can_view_files', 'can_upload_files', 'can_download_files']
        },
        'super-admin': {
            description: 'Super Admin (Full Access)',
            permissions: [
                'can_view_users', 'can_add_users', 'can_edit_users', 'can_delete_users', 'can_activate_users',
                'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance', 'can_delete_attendance', 'can_export_attendance',
                'can_view_equipment', 'can_add_equipment', 'can_edit_equipment', 'can_delete_equipment', 'can_assign_equipment',
                'can_view_files', 'can_upload_files', 'can_edit_files', 'can_delete_files', 'can_download_files',
                'can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries', 'can_delete_inquiries', 'can_assign_inquiries',
                'can_view_health_logs', 'can_export_health_logs', 'can_manage_permissions', 'can_view_audit_trail', 'can_backup_database'
            ]
        }
    };

    // Apply Permission Presets
    function applyPermissionPreset(presetKey) {
        const checkboxes = document.querySelectorAll('input[name="permission"]');
        const preset = PERMISSION_PRESETS[presetKey];
        
        if (!preset) return;

        // Clear all checkboxes first
        checkboxes.forEach(cb => cb.checked = false);

        // Check only the preset permissions
        preset.permissions.forEach(perm => {
            const checkbox = document.querySelector(`input[value="${perm}"]`);
            if (checkbox) checkbox.checked = true;
        });

        console.log(`Applied preset: ${preset.description}`);
        alert(`Preset applied: ${preset.description}\nCheck the permission matrix!`);
    }

    // Preset Button Event Listeners
    document.getElementById('preset-field-worker').addEventListener('click', () => applyPermissionPreset('field-worker'));
    document.getElementById('preset-supervisor').addEventListener('click', () => applyPermissionPreset('supervisor'));
    document.getElementById('preset-hr-admin').addEventListener('click', () => applyPermissionPreset('hr-admin'));
    document.getElementById('preset-sales-manager').addEventListener('click', () => applyPermissionPreset('sales-manager'));
    document.getElementById('preset-super-admin').addEventListener('click', () => applyPermissionPreset('super-admin'));
    
    document.getElementById('preset-clear-all').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('input[name="permission"]');
        checkboxes.forEach(cb => cb.checked = false);
        console.log('All permissions cleared');
    });

    // Add User Form Submission with Permissions Matrix
    const addUserForm = document.getElementById('add-user-form');
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Form Validation
        const password = document.getElementById('user-password').value;
        const passwordConfirm = document.getElementById('user-password-confirm').value;

        if (password !== passwordConfirm) {
            alert('Passwords do not match!');
            return;
        }

        if (password.length < 8) {
            alert('Password must be at least 8 characters long.');
            return;
        }

        // Capture Basic User Data
        const userData = {
            full_name: document.getElementById('user-fullname').value,
            email: document.getElementById('user-email').value,
            contact_number: document.getElementById('user-contact').value || null,
            role: document.getElementById('user-role').value,
            password: password,
            is_active: document.getElementById('user-active').checked
        };

        // Capture ALL Selected Permissions
        const selectedPermissions = {};
        const allPermissionCheckboxes = document.querySelectorAll('input[name="permission"]');
        
        allPermissionCheckboxes.forEach(checkbox => {
            selectedPermissions[checkbox.value] = checkbox.checked;
        });

        // Merge permissions into userData
        const completeUserData = {
            ...userData,
            ...selectedPermissions
        };

        console.log('Complete User Data with Permissions:', completeUserData);
        console.log('Total Permissions Set:', Object.keys(selectedPermissions).filter(k => selectedPermissions[k]).length);

        // ===== BACKEND INTEGRATION ACTIVE =====
        try {
            // Get JWT token from localStorage (set during login)
            const token = localStorage.getItem('token');
            
            if (!token) {
                alert('Authentication required. Please login as admin first.');
                window.location.href = 'index.html';
                return;
            }

            const response = await fetch('http://localhost:5000/register', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(completeUserData)
            });
            
            if (response.ok) {
                const result = await response.json();
                alert(`✅ User Created Successfully!\n\nName: ${userData.full_name}\nEmail: ${userData.email}\nPermissions Granted: ${result.user.permissions_granted} / 30\n\nThe new user can now login with their credentials.`);
                userModal.classList.add('hidden');
                addUserForm.reset();
                
                // Reload user table if on User Management tab
                loadUsers(); // Will implement this function
            } else {
                const error = await response.json();
                alert(`❌ Failed to create user:\n\n${error.error}\n\n${error.hint || ''}`);
            }
        } catch (error) {
            console.error('Network error:', error);
            alert('❌ Network error. Please ensure:\n\n1. Backend server is running (http://localhost:5000)\n2. You are logged in as admin\n3. Database is connected');
        }
    });

    // --- 5. LOAD USERS FUNCTION (Fetch and Display) ---
    async function loadUsers() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch('http://localhost:5000/api/users', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}` 
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const userTableBody = document.querySelector('#user-table tbody');
                
                if (!userTableBody) return;
                
                userTableBody.innerHTML = ''; // Clear existing rows
                
                data.users.forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="px-4 py-3">${user.user_id}</td>
                        <td class="px-4 py-3">${user.full_name}</td>
                        <td class="px-4 py-3">${user.email}</td>
                        <td class="px-4 py-3">${user.contact_number || 'N/A'}</td>
                        <td class="px-4 py-3">
                            <span class="badge ${user.role === 'ADMIN' ? 'badge-admin' : 'badge-employee'}">${user.role}</span>
                        </td>
                        <td class="px-4 py-3">
                            <span class="badge ${user.is_active ? 'success' : 'warning'}">
                                ${user.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td class="px-4 py-3">View/Edit</td>
                        <td class="px-4 py-3">
                            <button class="btn-sm btn-danger" onclick="deleteUser(${user.user_id})">Delete</button>
                        </td>
                    `;
                    userTableBody.appendChild(row);
                });
                
                console.log(`✅ Loaded ${data.users.length} users`);
            } else {
                console.error('Failed to load users');
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    // Load users on page load
    loadUsers();

    // --- 6. SYSTEM HEALTH MONITORING BUTTONS ---
    const triggerBackupBtn = document.getElementById('trigger-backup-btn');
    const exportLogsBtn = document.getElementById('export-logs-btn');

    if (triggerBackupBtn) {
        triggerBackupBtn.addEventListener('click', () => {
            console.log('Manual database backup triggered');
            alert('Database backup initiated...\n\nThis will create a backup on LOCAL_FTP storage.\n(Backend integration pending)');
            
            /* WEEK 6: Backend Connection
            fetch('http://localhost:5000/api/system/backup', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.json())
              .then(data => alert('Backup completed: ' + data.filename));
            */
        });
    }

    if (exportLogsBtn) {
        exportLogsBtn.addEventListener('click', () => {
            console.log('Exporting system health logs to CSV');
            alert('Exporting network IP logs for SAM compliance audit...\n\n(CSV download will start when backend is connected)');
            
            /* WEEK 6: Backend Connection
            window.location.href = `http://localhost:5000/api/system/export-logs?token=${token}`;
            */
        });
    }
});
