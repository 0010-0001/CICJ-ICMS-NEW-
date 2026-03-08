document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorBox = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('http://localhost:5000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = data.user.role === 'ADMIN' ? 'admin.html' : 'employee.html';
            } else {
                errorBox.textContent = data.error || data.message;
                errorBox.classList.remove('hidden');
            }
        } catch (error) {
            errorBox.textContent = "Network error. Is your Node.js backend running?";
            errorBox.classList.remove('hidden');
        }
    });
});
