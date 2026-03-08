document.addEventListener('DOMContentLoaded', () => {
    // --- 1. AUTHENTICATION CHECK ---
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
        window.location.href = 'index.html';
        return;
    }

    const user = JSON.parse(userStr);

    // Security Check: Ensure user is an EMPLOYEE
    if (user.role !== 'EMPLOYEE') {
        window.location.href = 'admin.html';
        return;
    }

    // --- 2. POPULATE USER INFO ---
    document.getElementById('welcome-message').textContent = `Welcome, ${user.full_name}`;
    document.getElementById('profile-name').textContent = user.full_name;
    document.getElementById('profile-email').textContent = user.email || 'N/A';
    document.getElementById('profile-role').textContent = user.role;

    // --- 3. LOGOUT FUNCTIONALITY ---
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });

    // --- 4. TAB SWITCHING LOGIC ---
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

    // --- 5. CLOCK IN/OUT FUNCTIONALITY (Placeholder) ---
    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    const todayStatus = document.getElementById('today-status');
    const timeInDisplay = document.getElementById('time-in');
    const timeOutDisplay = document.getElementById('time-out');

    clockInBtn.addEventListener('click', async () => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        timeInDisplay.textContent = timeString;
        todayStatus.textContent = 'Clocked In';
        
        alert(`Clocked in at ${timeString}\n(Backend integration coming in Week 6)`);
        
        /* 
        WEEK 6: Backend Integration
        try {
            const response = await fetch('http://localhost:5000/api/attendance/clock-in', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    user_id: user.user_id,
                    gps_lat: 0, // Will use Geolocation API
                    gps_long: 0
                })
            });
            if (response.ok) {
                alert('Clocked in successfully!');
            }
        } catch (error) {
            console.error('Clock-in failed:', error);
        }
        */
    });

    clockOutBtn.addEventListener('click', async () => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        timeOutDisplay.textContent = timeString;
        todayStatus.textContent = 'Clocked Out';
        
        alert(`Clocked out at ${timeString}\n(Backend integration coming in Week 6)`);
    });
});
