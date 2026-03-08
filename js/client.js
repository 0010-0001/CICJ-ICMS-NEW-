document.addEventListener('DOMContentLoaded', () => {
    // --- MOBILE NAVIGATION TOGGLE ---
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking on a link
        document.querySelectorAll('.nav-menu a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
            });
        });
    }

    // --- SMOOTH SCROLLING ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // --- CLIENT INQUIRY FORM SUBMISSION ---
    const inquiryForm = document.getElementById('inquiry-form');
    const formMessage = document.getElementById('form-message');

    if (inquiryForm) {
        inquiryForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = {
                client_name: document.getElementById('client_name').value,
                client_email: document.getElementById('client_email').value,
                contact_number: document.getElementById('contact_number').value || null,
                message_body: document.getElementById('message_body').value
            };

            try {
                // For now, just show success message
                // In Week 6, this will connect to the backend API
                formMessage.textContent = 'Thank you for your inquiry! We will contact you shortly.';
                formMessage.className = 'success';
                formMessage.classList.remove('hidden');
                inquiryForm.reset();

                /* 
                WEEK 6: Backend Integration
                const response = await fetch('http://localhost:5000/api/inquiries', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (response.ok) {
                    formMessage.textContent = 'Thank you for your inquiry! We will contact you shortly.';
                    formMessage.className = 'success';
                    formMessage.classList.remove('hidden');
                    inquiryForm.reset();
                } else {
                    formMessage.textContent = 'Failed to submit inquiry. Please try again.';
                    formMessage.className = 'error';
                    formMessage.classList.remove('hidden');
                }
                */
            } catch (error) {
                console.error('Form submission error:', error);
                formMessage.textContent = 'Network error. Please try again later.';
                formMessage.className = 'error';
                formMessage.classList.remove('hidden');
            }

            // Hide message after 5 seconds
            setTimeout(() => {
                formMessage.classList.add('hidden');
            }, 5000);
        });
    }
});
