document.addEventListener('DOMContentLoaded', () => {
    const inquiryForm = document.getElementById('contactForm');
    const subscribeForm = document.getElementById('pcl-footer-subscribe-form');
    const mobileMenuBtn = document.getElementById('pcl-mobile-menu-btn');
    const pclNav = document.getElementById('pcl-nav');
    const pclHeaderRight = document.getElementById('pcl-header-right');
    const topbar = document.querySelector('.navbar.pcl-header');
    const heroSection = document.querySelector('.hero');

    // --- HERO VIDEO: reliable autoplay recovery ---
    const heroVideo = document.querySelector('.hero-video');
    if (heroVideo) {
        const tryPlayVideo = () => {
            if (heroVideo.paused && !heroVideo.ended) {
                heroVideo.play().catch(() => {});
            }
        };
        // Resume when user returns to this browser tab
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) tryPlayVideo();
        });
        // Network stall or browser suspension
        heroVideo.addEventListener('stalled', () => setTimeout(tryPlayVideo, 400));
        heroVideo.addEventListener('suspend', () => setTimeout(tryPlayVideo, 400));
        // Trigger once data is available (covers slow first-load)
        heroVideo.addEventListener('loadeddata', tryPlayVideo);
        // If paused by anything other than the user (tab hide, power save…)
        heroVideo.addEventListener('pause', () => {
            if (!document.hidden) setTimeout(tryPlayVideo, 150);
        });
        // Best-effort initial attempt
        tryPlayVideo();
    }

    const syncTopbarState = () => {
        if (!topbar || !heroSection) return;
        const threshold = Math.max(heroSection.offsetHeight - topbar.offsetHeight, 0);
        const shouldSolid = window.scrollY > threshold;
        topbar.classList.toggle('is-solid', shouldSolid);
    };

    if (topbar && heroSection) {
        syncTopbarState();
        window.addEventListener('scroll', syncTopbarState, { passive: true });
        window.addEventListener('resize', syncTopbarState);
    }

    if (mobileMenuBtn && pclNav) {
        mobileMenuBtn.addEventListener('click', () => {
            pclNav.classList.toggle('is-open');
            if (pclHeaderRight) {
                pclHeaderRight.classList.toggle('is-open');
            }
        });

        const navLinks = pclNav.querySelectorAll('a');
        navLinks.forEach((link) => {
            link.addEventListener('click', () => {
                pclNav.classList.remove('is-open');
                if (pclHeaderRight) {
                    pclHeaderRight.classList.remove('is-open');
                }
            });
        });
    }

    // --- INQUIRY TYPE LABELS ---
    const INQUIRY_LABELS = {
        residential: 'Residential Project',
        commercial: 'Commercial Project',
        infrastructure: 'Infrastructure',
        renovation: 'Renovation/Restoration',
        other: 'Other'
    };

    // --- SUCCESS MODAL ---
    const successModal = document.getElementById('inquiry-success-modal');
    const modalSummary = document.getElementById('inq-modal-summary');
    const modalCloseBtn = document.getElementById('inq-modal-close-btn');

    function openSuccessModal(name, email, type) {
        if (!successModal) return;
        if (modalSummary) {
            modalSummary.innerHTML = `
                <div class="inq-modal-row"><span class="inq-modal-label">Name</span><span>${escapeHtmlClient(name)}</span></div>
                <div class="inq-modal-row"><span class="inq-modal-label">Email</span><span>${escapeHtmlClient(email)}</span></div>
                <div class="inq-modal-row"><span class="inq-modal-label">Inquiry Type</span><span>${escapeHtmlClient(INQUIRY_LABELS[type] || type)}</span></div>
            `;
        }
        successModal.classList.add('is-open');
        successModal.setAttribute('aria-hidden', 'false');
        if (modalCloseBtn) modalCloseBtn.focus();
    }

    function closeSuccessModal() {
        if (!successModal) return;
        successModal.classList.remove('is-open');
        successModal.setAttribute('aria-hidden', 'true');
    }

    function escapeHtmlClient(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeSuccessModal);
    }
    if (successModal) {
        successModal.addEventListener('click', (e) => {
            if (e.target === successModal) closeSuccessModal();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && successModal?.classList.contains('is-open')) closeSuccessModal();
    });


    // --- CONTACT FORM SUBMISSION ---
    let renderRecaptcha = () => {};
    if (inquiryForm) {
        const nameInput    = document.getElementById('cf-name');
        const emailInput   = document.getElementById('cf-email');
        const phoneInput   = document.getElementById('cf-phone');
        const typeSelect   = document.getElementById('cf-type');
        const messageInput = document.getElementById('cf-message');
        const errorDiv     = document.getElementById('cf-error');
        const submitBtn    = document.getElementById('cf-submit-btn');
        const btnText      = document.getElementById('cf-btn-text');
        const btnSpinner   = document.getElementById('cf-btn-spinner');
        const recaptchaWidget  = document.getElementById('cf-recaptcha');
        const recaptchaWrap    = document.getElementById('cf-recaptcha-wrap');
        let recaptchaRendered  = false;
        let pendingSubmitData  = null;

        function showFormError(msg) {
            if (!errorDiv) return;
            errorDiv.textContent = msg;
            errorDiv.hidden = false;
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function clearFormError() {
            if (errorDiv) errorDiv.hidden = true;
        }

        function setLoading(loading) {
            if (submitBtn) submitBtn.disabled = loading;
            if (btnText) btnText.hidden = loading;
            if (btnSpinner) btnSpinner.hidden = !loading;
        }

        function showCaptcha() {
            if (recaptchaWrap) recaptchaWrap.hidden = false;
            if (!recaptchaRendered && recaptchaWidget && window.grecaptcha && recaptchaWidget.dataset.sitekey) {
                window.grecaptcha.render(recaptchaWidget, {
                    sitekey: recaptchaWidget.dataset.sitekey,
                    callback: 'onInquiryCaptchaSuccess',
                    'expired-callback': 'onInquiryCaptchaExpired'
                });
                recaptchaRendered = true;
            }
            if (recaptchaWrap) recaptchaWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        async function doSubmit(data, token) {
            setLoading(true);
            try {
                const apiBase = typeof window.API_BASE === 'string' ? window.API_BASE.replace(/\/$/, '') : '';
                const inquiryUrl = apiBase ? `${apiBase}/api/inquiries/public` : '/api/inquiries/public';
                const res = await fetch(inquiryUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_name: data.name,
                        client_email: data.email,
                        phone_number: data.phone || undefined,
                        subject: data.type,
                        message: data.message,
                        recaptchaToken: token
                    })
                });

                const json = await res.json().catch(() => ({}));

                if (!res.ok) {
                    showFormError(json.error || 'Something went wrong. Please try again.');
                    return;
                }

                inquiryForm.reset();
                pendingSubmitData = null;
                if (recaptchaWrap) recaptchaWrap.hidden = true;
                openSuccessModal(data.name, data.email, data.type);
            } catch (err) {
                console.error('Inquiry submit error:', err);
                showFormError('Network error. Please check your connection and try again.');
            } finally {
                setLoading(false);
                if (window.grecaptcha) window.grecaptcha.reset();
            }
        }

        renderRecaptcha = () => {};

        window.onInquiryRecaptchaLoad = () => {};

        window.onInquiryCaptchaSuccess = (token) => {
            clearFormError();
            if (pendingSubmitData) {
                doSubmit(pendingSubmitData, token);
            }
        };

        window.onInquiryCaptchaExpired = () => {
            showFormError('Verification expired. Please complete the reCAPTCHA again.');
        };

        inquiryForm.addEventListener('submit', (event) => {
            event.preventDefault();
            clearFormError();

            const name    = String(nameInput?.value || '').trim();
            const email   = String(emailInput?.value || '').trim();
            const phone   = String(phoneInput?.value || '').trim();
            const type    = String(typeSelect?.value || '').trim();
            const message = String(messageInput?.value || '').trim();

            if (!name)    { showFormError('Please enter your name.'); nameInput?.focus(); return; }
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showFormError('Please enter a valid email address.'); emailInput?.focus(); return;
            }
            if (!type)    { showFormError('Please select an inquiry type.'); typeSelect?.focus(); return; }
            if (!message || message.length < 10) {
                showFormError('Please write a message (at least 10 characters).'); messageInput?.focus(); return;
            }

            const existingToken = String(document.querySelector('[name="g-recaptcha-response"]')?.value || '').trim();
            if (existingToken) {
                doSubmit({ name, email, phone, type, message }, existingToken);
                return;
            }

            pendingSubmitData = { name, email, phone, type, message };
            showCaptcha();
        });
    }

    if (subscribeForm) {
        subscribeForm.addEventListener('submit', (event) => {
            event.preventDefault();
            subscribeForm.reset();
        });
    }

    const contactProjectBtn = document.getElementById('contactProjectBtn');
    const contactFormCard = document.getElementById('contactFormCard');

    if (contactProjectBtn && contactFormCard) {
        contactProjectBtn.addEventListener('click', (event) => {
            event.preventDefault();

            if (contactFormCard.hidden) {
                contactFormCard.hidden = false;
                contactProjectBtn.setAttribute('aria-expanded', 'true');
            }

            renderRecaptcha();

            contactFormCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // CSP-safe bindings: replace inline onclick behavior with event listeners.
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((button) => {
        const inlineAction = String(button.getAttribute('onclick') || '');
        const match = inlineAction.match(/openTab\(event,\s*'([^']+)'\)/);
        const targetTabId = match?.[1] || '';
        if (!targetTabId) return;

        button.addEventListener('click', (event) => {
            window.openTab(event, targetTabId);
        });
    });

    const discoverBtn = document.querySelector('.hero .btn.btn-primary');
    if (discoverBtn) {
        discoverBtn.addEventListener('click', () => {
            window.scrollToTab('capabilities');
        });
    }

    const whatWeDoTabs = document.querySelectorAll('.what-we-do-tab');
    const whatWeDoFeature = document.querySelector('.what-we-do-feature');
    const whatWeDoImage = document.getElementById('what-we-do-image');
    const whatWeDoHeading = document.getElementById('what-we-do-heading');
    const whatWeDoDescription = document.getElementById('what-we-do-description');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let whatWeDoTransitionTimer = null;

    const sectorContent = {
        buildings: {
            heading: 'Stunning structures, sustainably built',
            description: "PCL's network of construction professionals rise to the challenges associated with a diverse buildings portfolio, adding added value to every educational, institutional, residential and commercial construction project. PCL offers substantial construction experience, competitive pricing, financial strength, integrity and a commitment to your project that is supported by a foundation of quality and workplace safety.",
            image: 'Images/buildings.jpg',
            alt: 'Modern buildings construction project'
        },
        'civil-infrastructure': {
            heading: 'Connecting and supplying our communities',
            description: 'The geographical diversity, project complexity, and public nature of civil work require exceptional technical expertise. From water treatment facilities to roads and bridge rehabilitation, CICJ teams deliver resilient infrastructure that supports daily life and long-term growth.',
            image: 'Images/civil_infrastructure.jpg',
            alt: 'Civil infrastructure pipeline installation project'
        },
        houses: {
            heading: 'Crafting homes built for lasting comfort',
            description: 'CICJ delivers thoughtfully planned houses that balance quality construction, practical layouts, and long-term durability. From foundation to finishes, our teams focus on safety, timeline control, and craftsmanship families can rely on every day.',
            image: 'Images/Christmas residence.jpg',
            alt: 'Residential housing development project'
        },
        'building-maintenance': {
            heading: 'Protecting assets through building maintenance',
            description: 'Our maintenance services keep facilities safe, efficient, and operating at peak condition. CICJ handles preventive maintenance, repairs, and system upgrades with responsive support that minimizes downtime and extends building life.',
            image: 'Images/building_maintenance.jpg',
            alt: 'Technician performing commercial building maintenance work'
        }
    };

    const applyWhatWeDoContent = (content, onDone) => {
        if (!content) { if (onDone) onDone(); return; }

        if (whatWeDoHeading) whatWeDoHeading.textContent = content.heading;
        if (whatWeDoDescription) whatWeDoDescription.textContent = content.description;

        if (whatWeDoImage) {
            whatWeDoImage.alt = content.alt;
            whatWeDoImage.src = content.image;

            if (onDone) {
                // Wait for the new image to decode so it's visible on fade-in
                if (typeof whatWeDoImage.decode === 'function') {
                    whatWeDoImage.decode().then(onDone, onDone);
                } else if (whatWeDoImage.complete && whatWeDoImage.naturalWidth > 0) {
                    onDone();
                } else {
                    const finish = () => {
                        whatWeDoImage.removeEventListener('load', finish);
                        whatWeDoImage.removeEventListener('error', finish);
                        onDone();
                    };
                    whatWeDoImage.addEventListener('load', finish);
                    whatWeDoImage.addEventListener('error', finish);
                }
            }
        } else {
            if (onDone) onDone();
        }
    };

    const updateWhatWeDo = (sectorKey, animate = true) => {
        const content = sectorContent[sectorKey];
        if (!content) return;

        const shouldAnimate = animate && !prefersReducedMotion && !!whatWeDoFeature;
        if (!shouldAnimate) {
            applyWhatWeDoContent(content);
            return;
        }

        if (whatWeDoTransitionTimer) {
            clearTimeout(whatWeDoTransitionTimer);
            whatWeDoTransitionTimer = null;
            // Rapid click: reset class so the CSS transition restarts cleanly
            whatWeDoFeature.classList.remove('is-switching');
            void whatWeDoFeature.offsetWidth; // force reflow
        }

        whatWeDoFeature.classList.add('is-switching');
        whatWeDoTransitionTimer = setTimeout(() => {
            whatWeDoTransitionTimer = null;
            applyWhatWeDoContent(content, () => {
                requestAnimationFrame(() => {
                    whatWeDoFeature.classList.remove('is-switching');
                });
            });
        }, 170);
    };

    if (whatWeDoTabs.length > 0) {
        whatWeDoTabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                if (tab.classList.contains('active')) return;

                const sectorKey = tab.getAttribute('data-sector') || '';
                whatWeDoTabs.forEach((button) => {
                    button.classList.remove('active');
                    button.removeAttribute('aria-current');
                });

                tab.classList.add('active');
                tab.setAttribute('aria-current', 'true');
                updateWhatWeDo(sectorKey);
            });
        });

        const activeTab = document.querySelector('.what-we-do-tab.active');
        if (activeTab) {
            updateWhatWeDo(activeTab.getAttribute('data-sector') || '', false);
        }
    }

    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach((button) => {
        const category = button.getAttribute('data-category') || '';
        if (!category) return;

        button.addEventListener('click', () => {
            window.filterPortfolio(category);
        });
    });

});

window.openTab = function(event, tabId) {
    const tabContents = document.querySelectorAll('.tab-content');
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabContents.forEach((content) => content.classList.remove('active'));
    tabButtons.forEach((button) => button.classList.remove('active'));

    const target = document.getElementById(tabId);
    if (target) {
        target.classList.add('active');
    }

    const button = event?.currentTarget;
    if (button) {
        button.classList.add('active');
    }
};

window.scrollToTab = function(tabId) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabButton = Array.from(tabButtons).find((btn) => {
        const action = String(btn.getAttribute('onclick') || '');
        return action.includes(`'${tabId}'`);
    });

    if (tabButton) {
        tabButton.click();
    } else {
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach((content) => content.classList.remove('active'));

        const target = document.getElementById(tabId);
        if (target) {
            target.classList.add('active');
        }
    }

    const section = document.getElementById(tabId) || document.querySelector('.tabs-container');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.filterPortfolio = function(category) {
    const items = document.querySelectorAll('.portfolio-item');
    const buttons = document.querySelectorAll('.filter-btn');

    items.forEach((item) => {
        const itemCategory = item.getAttribute('data-category');
        const shouldShow = category === 'all' || itemCategory === category;
        item.style.display = shouldShow ? '' : 'none';
    });

    buttons.forEach((button) => {
        const action = String(button.getAttribute('onclick') || '');
        const isActive = action.includes(`'${category}'`);
        button.classList.toggle('active', isActive);
    });

    };
