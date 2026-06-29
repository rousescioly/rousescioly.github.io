(function() {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = '/assets/favicon.png';
    document.head.appendChild(link);
})();

(function() {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1';
    document.head.appendChild(meta);
})();

const SCIOLY_API_URL = 'https://sandeepshenoy.dev/rso/scioly.json';

const PAGE_PATHS = {
    home: ['/', '/index.html'],
    upcomingEvents: ['/upcoming-events', '/upcoming-events/', '/upcoming-events/index.html'],
    blog: ['/blog', '/blog/', '/blog/index.html'],
    resources: ['/resources', '/resources/', '/resources/index.html'],
    results: ['/results', '/results/', '/results/index.html']
};

function isPath(path, names) {
    const pathname = getPathname(path);
    return names.some(name => PAGE_PATHS[name].includes(pathname));
}

function clearElement(el) {
    if (!el) return;
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}

function setStatusMessage(container, className, text) {
    if (!container) return;
    clearElement(container);
    const message = document.createElement('div');
    message.className = className;
    message.textContent = text;
    container.appendChild(message);
}

function setButtonExpanded(button, expanded) {
    if (!button) return;
    button.classList.toggle('open', expanded);
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function closeNav(nav, menuToggle) {
    if (nav) nav.classList.remove('open');
    const overlay = document.querySelector('.nav-overlay');
    if (overlay) overlay.remove();
    setButtonExpanded(menuToggle || (nav ? nav.querySelector('.menu-toggle') : null), false);
}

function imageUrl(folder, fileName, fallbackFile) {
    if (!fileName || fileName === fallbackFile) {
        return `/assets/${folder}/${fallbackFile}`;
    }
    if (fileName.startsWith('http://') || fileName.startsWith('https://')) {
        return fileName;
    }
    return `/assets/${folder}/${fileName}`;
}

function getHeaderImageUrl(img) {
    return imageUrl('headers', img, 'fallback.jpg');
}

function getIconUrl(icon) {
    if (!icon) return '';
    if (icon.startsWith('http://') || icon.startsWith('https://')) return icon;
    return `/assets/icons/${icon}`;
}

function normalizeFetchPath(href) {
    try {
        const u = new URL(href, window.location.origin);
        return u.pathname || '/';
    } catch (e) {
        if (href === '') return '/';
        return href;
    }
}

function getLinks() {
    return Array.from(document.querySelectorAll('.links a'));
}

function ensureUnderline() {
    const links = document.querySelector('.links');
    if (!links) return null;
    let u = links.querySelector('.underline');
    if (!u) {
        u = document.createElement('div');
        u.className = 'underline';
        links.appendChild(u);
    }
    return u;
}

function moveUnderlineTo(el, animate = true) {
    const links = document.querySelector('.links');
    if (!links || !el) return;
    const u = ensureUnderline();
    if (!u) return;
    if (!animate) u.style.transition = 'none';
    const rectLinks = links.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const left = rect.left - rectLinks.left + links.scrollLeft;
    u.style.left = left + 'px';
    u.style.width = rect.width + 'px';
    if (!animate) {
        void u.offsetWidth;
        u.style.transition = '';
    }
}

function setActiveLink(targetLink, animate = true) {
    getLinks().forEach(a => a.classList.toggle('active', a === targetLink));
    if (targetLink) moveUnderlineTo(targetLink, animate);
}

function isHomePath(path) {
    return isPath(path, ['home']);
}

function getPathname(path) {
    try {
        return new URL(path, window.location.origin).pathname;
    } catch (e) {
        return path;
    }
}

let titleAnimationToken = 0;
let titleAnimationTimer = null;
const emptyTitlePlaceholder = '\u200B';

function animateDocumentTitle(nextTitle) {
    if (!nextTitle || document.title === nextTitle) return;
    
    titleAnimationToken += 1;
    const token = titleAnimationToken;
    const targetChars = Array.from(nextTitle);
    const deleteDelay = 14;
    const typeDelay = 24;
    const typeStartDelay = 70;
    
    if (titleAnimationTimer) {
        clearTimeout(titleAnimationTimer);
        titleAnimationTimer = null;
    }
    
    function schedule(fn, delay) {
        titleAnimationTimer = setTimeout(() => {
            if (token === titleAnimationToken) fn();
        }, delay);
    }
    
    function erase() {
        const currentTitle = document.title === emptyTitlePlaceholder ? '' : document.title;
        const currentChars = Array.from(currentTitle);
        
        if (currentChars.length > 0) {
            document.title = currentChars.slice(0, -1).join('') || emptyTitlePlaceholder;
            schedule(erase, deleteDelay);
            return;
        }
        
        schedule(() => type(0), typeStartDelay);
    }
    
    function type(index) {
        document.title = targetChars.slice(0, index).join('') || emptyTitlePlaceholder;
        
        if (index < targetChars.length) {
            schedule(() => type(index + 1), typeDelay);
            return;
        }
        
        titleAnimationTimer = null;
    }
    
    erase();
}

async function fetchPageContent(path) {
    const fetchPath = normalizeFetchPath(path);
    const res = await fetch(fetchPath, {cache: 'no-store'});
    if (!res.ok) throw new Error('Failed to load');
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const card = doc.querySelector('.card');
    const title = doc.querySelector('title') ? doc.querySelector('title').innerText : null;
    
    const contentElements = [];
    if (card) {
        Array.from(card.children).forEach(child => {
            if (!child.classList.contains('nav')) {
                contentElements.push(child.cloneNode(true));
            }
        });
    }
    
    const bodyExtras = [];
    Array.from(doc.body.children).forEach(child => {
        if (child.tagName !== 'SCRIPT' && !child.classList.contains('card')) {
            const cloned = child.cloneNode(true);
            cloned.setAttribute('data-page-extra', 'true');
            bodyExtras.push(cloned);
        }
    });
    
    const pageStyles = [];
    doc.head.querySelectorAll('style').forEach(style => {
        pageStyles.push(style.textContent);
    });
    
    return {contentElements, title, bodyExtras, pageStyles};
}

async function navigateTo(href, addHistory = true) {
    try {
        const data = await fetchPageContent(href);
        if (data.title) animateDocumentTitle(data.title);
        
        const card = document.querySelector('.card');
        const nav = card ? card.querySelector('.nav') : null;
        
        document.querySelectorAll('[data-page-extra]').forEach(el => el.remove());
        document.querySelectorAll('[data-page-style]').forEach(el => el.remove());
        document.body.style.overflow = '';
        
        if (data.pageStyles && data.pageStyles.length > 0) {
            data.pageStyles.forEach(styleContent => {
                const style = document.createElement('style');
                style.setAttribute('data-page-style', 'true');
                style.textContent = styleContent;
                document.head.appendChild(style);
            });
        }
        
        if (card) {
            Array.from(card.children).forEach(child => {
                if (!child.classList.contains('nav')) {
                    child.remove();
                }
            });
            
            data.contentElements.forEach(el => {
                card.appendChild(el);
            });
        }
        
        if (data.bodyExtras && data.bodyExtras.length > 0) {
            data.bodyExtras.forEach(el => {
                document.body.appendChild(el);
            });
        }
        
        createFooter(href);
        closeNav(nav);
        
        const links = getLinks();
        const targetLink = links.find(a => a.getAttribute('href') === href || a.href.endsWith(href));
        if (targetLink) setActiveLink(targetLink, true);
        
        if (addHistory) history.pushState({path: href}, '', href);
        
        const isHome = isHomePath(href);
        if (isHome) {
            initSVGAnimation();
        }
        initWaveCanvas();
        
        initPageScripts(href);
    } catch (e) {
        console.error(e);
    }
}

function createNav() {
    const navLinks = [
        {href: '/', label: 'Home'},
        {href: '/upcoming-events/', label: 'Upcoming Events'},
        {href: '/blog/', label: 'Blog'},
        {href: '/results/', label: 'Results'},
        {href: '/resources/', label: 'Resources'}
    ];
    const card = document.querySelector('.card');
    if (!card) return;
    
    if (card.querySelector('.nav')) return;
    
    const nav = document.createElement('div');
    nav.className = 'nav';
    const logoWrap = document.createElement('div');
    logoWrap.className = 'logo';
    const logoImg = document.createElement('img');
    logoImg.src = '/assets/logo.svg';
    logoImg.alt = 'Rouse SciOly';
    logoWrap.appendChild(logoImg);
    const linksWrap = document.createElement('div');
    linksWrap.className = 'links';
    navLinks.forEach(l => {
        const a = document.createElement('a');
        a.href = l.href;
        a.innerText = l.label;
            a.addEventListener('click', (e) => {
            const href = a.getAttribute('href');
            if (!href || (href.startsWith('http') && !href.startsWith(window.location.origin))) return;
            e.preventDefault();
            navigateTo(href, true);
            closeNav(nav, menuToggle);
        });
        linksWrap.appendChild(a);
    });
        const menuToggle = document.createElement('button');
        menuToggle.className = 'menu-toggle';
        menuToggle.type = 'button';
        menuToggle.setAttribute('aria-label', 'Toggle menu');
        menuToggle.setAttribute('aria-expanded', 'false');
        const hamburgerIcon = document.createElement('img');
        hamburgerIcon.src = '/assets/hamburger.svg';
        hamburgerIcon.alt = 'Menu';
        hamburgerIcon.className = 'hamburger-icon';
        menuToggle.appendChild(hamburgerIcon);
        menuToggle.addEventListener('click', () => {
            const opening = !nav.classList.contains('open');
            nav.classList.toggle('open');
            if (opening) {
                const overlay = document.createElement('div');
                overlay.className = 'nav-overlay';
                overlay.addEventListener('click', () => {
                    closeNav(nav, menuToggle);
                });
                document.body.appendChild(overlay);
                setButtonExpanded(menuToggle, true);
            } else {
                closeNav(nav, menuToggle);
            }
        });
    nav.appendChild(logoWrap);
    nav.appendChild(linksWrap);
    nav.appendChild(menuToggle);
    card.insertBefore(nav, card.firstChild);
}

function createFooter(path = window.location.pathname) {
    const section = document.querySelector('.about-section');
    if (!section) return;
    
    document.querySelectorAll('.site-footer').forEach(footer => footer.remove());
    
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    if (!isHomePath(path)) footer.classList.add('special');
    
    const left = document.createElement('div');
    left.className = 'footer-left';
    left.append('Made with ');
    
    const heart = document.createElement('img');
    heart.src = '/assets/heart.svg';
    heart.alt = 'heart';
    heart.className = 'heart-beat';
    left.appendChild(heart);
    left.append(' by ');
    
    const credit = document.createElement('a');
    credit.href = 'https://sandeepshenoy.dev';
    credit.target = '_blank';
    credit.rel = 'noopener';
    credit.textContent = 'sandeepshenoy.dev';
    left.appendChild(credit);
    
    const separator = document.createElement('span');
    separator.className = 'footer-separator';
    separator.textContent = ' \u2022 ';
    left.appendChild(separator);
    
    const maintained = document.createElement('span');
    maintained.className = 'footer-maintained';
    maintained.textContent = 'Maintained by Rouse SciOly Officers';
    left.appendChild(maintained);
    
    const right = document.createElement('div');
    right.className = 'footer-right';
    
    const socialLinks = [
        {
            href: 'https://github.com/rousescioly/rousescioly.github.io',
            label: 'GitHub',
            icon: '/assets/github.svg'
        },
        {
            href: 'https://www.instagram.com/rousescioly/',
            label: 'Instagram',
            icon: '/assets/insta.svg'
        }
    ];
    
    socialLinks.forEach(link => {
        const anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.target = '_blank';
        anchor.rel = 'noopener';
        anchor.setAttribute('aria-label', link.label);
        
        const icon = document.createElement('img');
        icon.src = link.icon;
        icon.alt = link.label;
        anchor.appendChild(icon);
        right.appendChild(anchor);
    });
    
    footer.appendChild(left);
    footer.appendChild(right);
    section.appendChild(footer);
}

let upcomingEventsLoadToken = 0;
function getEventDate(timestamp) {
    const value = Number(timestamp);
    if (!Number.isFinite(value)) return null;
    
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatEventDate(timestamp) {
    const date = getEventDate(timestamp);
    if (!date) return 'Date will be revealed soon!';
    
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatEventTime(timestamp) {
    const date = getEventDate(timestamp);
    if (!date) return '';
    
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function formatEventCardDate(timestamp) {
    const date = getEventDate(timestamp);
    if (!date) return { label: 'TBD', isKnown: false };
    
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return { month, day, isKnown: true };
}

function getEventImageUrl(img) {
    return getHeaderImageUrl(img);
}

function openEventModal(event) {
    const overlay = document.getElementById('event-modal-overlay');
    if (!overlay) return;
    
    document.getElementById('event-modal-header').style.backgroundImage = `url('${getEventImageUrl(event.img)}')`;
    document.getElementById('event-modal-title').textContent = event.title;
    document.getElementById('event-modal-date').textContent = formatEventDate(event.datetime);
    
    const time = document.getElementById('event-modal-time');
    const timeRow = time.closest('.event-modal-detail');
    const hasKnownDate = Boolean(getEventDate(event.datetime));
    time.textContent = hasKnownDate ? formatEventTime(event.datetime) : '';
    if (timeRow) timeRow.style.display = hasKnownDate ? '' : 'none';
    
    document.getElementById('event-modal-location').textContent = event.location;
    document.getElementById('event-modal-description').textContent = event.description;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeEventModal() {
    const overlay = document.getElementById('event-modal-overlay');
    if (!overlay) return;
    
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function createEventCard(event) {
    const dateLabel = formatEventCardDate(event.datetime);
    const card = document.createElement('div');
    card.className = 'event-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const image = document.createElement('div');
    image.className = 'event-card-image';
    image.style.backgroundImage = `url('${getEventImageUrl(event.img)}')`;

    const date = document.createElement('div');
    date.className = `event-card-date${dateLabel.isKnown ? '' : ' unknown'}`;
    if (dateLabel.isKnown) {
        const month = document.createElement('span');
        month.className = 'event-card-month';
        month.textContent = dateLabel.month;
        const day = document.createElement('span');
        day.className = 'event-card-day';
        day.textContent = dateLabel.day;
        date.append(month, day);
    } else {
        const tbd = document.createElement('span');
        tbd.className = 'event-card-tbd';
        tbd.textContent = dateLabel.label;
        date.appendChild(tbd);
    }
    image.appendChild(date);

    const content = document.createElement('div');
    content.className = 'event-card-content';
    const title = document.createElement('h3');
    title.className = 'event-card-title';
    title.textContent = event.title || 'Untitled event';
    const location = document.createElement('p');
    location.className = 'event-card-location';
    location.textContent = event.location || 'Location TBD';
    content.append(title, location);

    card.append(image, content);
    card.addEventListener('click', () => openEventModal(event));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openEventModal(event);
        }
    });
    return card;
}

async function loadUpcomingEvents() {
    const grid = document.getElementById('events-grid');
    if (!grid || !document.getElementById('event-modal-overlay')) return;
    
    const loadToken = ++upcomingEventsLoadToken;
    
    try {
        const response = await fetch(SCIOLY_API_URL, {cache: 'no-store'});
        const data = await response.json();
        const events = data.events || [];
        
        if (loadToken !== upcomingEventsLoadToken || !document.body.contains(grid)) return;
        
        if (events.length > 0) {
            clearElement(grid);
            events.forEach(event => {
                grid.appendChild(createEventCard(event));
            });
        } else {
            setStatusMessage(grid, 'events-empty', 'No upcoming events at the moment.');
        }
    } catch (error) {
        console.error('Failed to load events:', error);
        if (loadToken !== upcomingEventsLoadToken || !document.body.contains(grid)) return;
        setStatusMessage(grid, 'events-error', 'Failed to load events. Please try again later. Note: sandeepshenoy.dev must be unblocked to view items.');
    }
}

function initUpcomingEventsPage() {
    const overlay = document.getElementById('event-modal-overlay');
    const closeButton = document.getElementById('event-modal-close');
    if (!overlay || !closeButton) return;
    
    if (!overlay.dataset.eventsBound) {
        closeButton.addEventListener('click', closeEventModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeEventModal();
        });
        overlay.dataset.eventsBound = 'true';
    }
    
    loadUpcomingEvents();
}

function initHomePage() {
    const typingText = document.getElementById('typing-text');
    if (!typingText || typingText.dataset.typingInit === '1') return;

    const words = [
        'Create.',
        'Design.',
        'Compete.',
        'Win.',
        'Est. 2022'
    ];

    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;
    const typeSpeed = 50;
    const deleteSpeed = 25;
    const pauseTime = 600;

    typingText.dataset.typingInit = '1';

    function animateText() {
        if (!document.body.contains(typingText)) return;

        const current = words[wordIndex];

        if (!deleting) {
            typingText.textContent = current.substring(0, charIndex + 1);
            charIndex++;

            if (charIndex === current.length) {
                if (wordIndex === words.length - 1) {
                    typingText.textContent = 'Est. 2022';
                    typingText.classList.add('finished');
                    typingText.setAttribute('data-restored', 'true');
                    sessionStorage.setItem('homeTyped', '1');
                    return;
                }

                deleting = true;
                setTimeout(animateText, pauseTime);
                return;
            }

            setTimeout(animateText, typeSpeed);
            return;
        }

        typingText.textContent = current.substring(0, charIndex - 1);
        charIndex--;

        if (charIndex === 0) {
            deleting = false;
            wordIndex++;
        }

        setTimeout(animateText, deleteSpeed);
    }

    animateText();
}

let blogLoadToken = 0;
let resourcesLoadToken = 0;

function formatShortDate(timestamp) {
    const date = getEventDate(timestamp) || new Date();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return { month, day };
}

function parseMarkdown(text) {
    const fragment = document.createDocumentFragment();
    const lines = String(text || '').split('\n');

    lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) fragment.appendChild(document.createElement('br'));

        const parts = line.split(/(\*\*.+?\*\*|\*.+?\*)/g);
        parts.forEach(part => {
            if (!part) return;
            if (part.startsWith('**') && part.endsWith('**')) {
                const strong = document.createElement('strong');
                strong.textContent = part.slice(2, -2).replace(/\\!/g, '!');
                fragment.appendChild(strong);
                return;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                const em = document.createElement('em');
                em.textContent = part.slice(1, -1).replace(/\\!/g, '!');
                fragment.appendChild(em);
                return;
            }
            fragment.appendChild(document.createTextNode(part.replace(/\\!/g, '!')));
        });
    });

    return fragment;
}

function openBlogModal(post) {
    const overlay = document.getElementById('blog-modal-overlay');
    if (!overlay) return;

    document.getElementById('blog-modal-header').style.backgroundImage = "url('/assets/headers/blog.png')";
    document.getElementById('blog-modal-title').textContent = post.title || 'Untitled post';
    document.getElementById('blog-modal-date').textContent = formatEventDate(post.datetime);
    document.getElementById('blog-modal-author').textContent = `By ${post.author || 'Rouse SciOly'}`;

    const description = document.getElementById('blog-modal-description');
    clearElement(description);
    description.appendChild(parseMarkdown(post.content));

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeBlogModal() {
    const overlay = document.getElementById('blog-modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function createBlogCard(post) {
    const dateLabel = formatShortDate(post.datetime);
    const card = document.createElement('div');
    card.className = 'event-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const image = document.createElement('div');
    image.className = 'event-card-image';
    image.style.backgroundImage = "url('/assets/headers/blog.png')";

    const date = document.createElement('div');
    date.className = 'event-card-date';
    const month = document.createElement('span');
    month.className = 'event-card-month';
    month.textContent = dateLabel.month;
    const day = document.createElement('span');
    day.className = 'event-card-day';
    day.textContent = dateLabel.day;
    date.append(month, day);
    image.appendChild(date);

    const content = document.createElement('div');
    content.className = 'event-card-content';
    const title = document.createElement('h3');
    title.className = 'event-card-title';
    title.textContent = post.title || 'Untitled post';
    const author = document.createElement('p');
    author.className = 'blog-card-author';
    author.textContent = `By ${post.author || 'Rouse SciOly'}`;
    content.append(title, author);

    card.append(image, content);
    card.addEventListener('click', () => openBlogModal(post));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openBlogModal(post);
        }
    });
    return card;
}

async function loadBlogPosts() {
    const grid = document.getElementById('events-grid');
    if (!grid || !document.getElementById('blog-modal-overlay')) return;

    const loadToken = ++blogLoadToken;

    try {
        const response = await fetch(SCIOLY_API_URL, {cache: 'no-store'});
        const data = await response.json();
        const now = Date.now();
        const posts = (data.blog || []).filter(post => {
            const timestamp = Number(post.datetime);
            return !Number.isFinite(timestamp) || timestamp * 1000 <= now;
        });

        if (loadToken !== blogLoadToken || !document.body.contains(grid)) return;

        if (posts.length > 0) {
            clearElement(grid);
            posts.forEach(post => grid.appendChild(createBlogCard(post)));
        } else {
            setStatusMessage(grid, 'events-empty', 'No blog posts at the moment.');
        }
    } catch (error) {
        console.error('Failed to load blog posts:', error);
        if (loadToken !== blogLoadToken || !document.body.contains(grid)) return;
        setStatusMessage(grid, 'events-error', 'Failed to load blog posts. Please try again later. Note: sandeepshenoy.dev must be unblocked to view items.');
    }
}

function initBlogPage() {
    const overlay = document.getElementById('blog-modal-overlay');
    const closeButton = document.getElementById('blog-modal-close');
    if (!overlay || !closeButton) return;

    if (!overlay.dataset.blogBound) {
        closeButton.addEventListener('click', closeBlogModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeBlogModal();
        });
        overlay.dataset.blogBound = 'true';
    }

    loadBlogPosts();
}

function openResourceModal(resource) {
    const overlay = document.getElementById('resource-modal-overlay');
    if (!overlay) return;

    document.getElementById('resource-modal-header').style.backgroundImage = `url('${getHeaderImageUrl(resource.header)}')`;

    const icon = document.getElementById('resource-modal-icon');
    icon.src = getIconUrl(resource.icon);
    icon.alt = '';

    document.getElementById('resource-modal-title').textContent = resource.title || 'Untitled resource';
    document.getElementById('resource-modal-description').textContent = resource.description || '';
    document.getElementById('resource-modal-link').href = resource.link || '#';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeResourceModal() {
    const overlay = document.getElementById('resource-modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function createResourceCard(resource) {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const image = document.createElement('div');
    image.className = 'event-card-image';
    image.style.backgroundImage = `url('${getHeaderImageUrl(resource.header)}')`;

    const content = document.createElement('div');
    content.className = 'event-card-content';
    const row = document.createElement('div');
    row.className = 'resource-card-title-row';

    const icon = document.createElement('img');
    icon.className = 'resource-card-icon';
    icon.src = getIconUrl(resource.icon);
    icon.alt = '';

    const title = document.createElement('h3');
    title.className = 'event-card-title';
    title.textContent = resource.title || 'Untitled resource';

    row.append(icon, title);
    content.appendChild(row);
    card.append(image, content);
    card.addEventListener('click', () => openResourceModal(resource));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openResourceModal(resource);
        }
    });
    return card;
}

async function loadResources() {
    const grid = document.getElementById('resources-grid');
    if (!grid || !document.getElementById('resource-modal-overlay')) return;

    const loadToken = ++resourcesLoadToken;

    try {
        const response = await fetch(SCIOLY_API_URL, {cache: 'no-store'});
        const data = await response.json();
        const resources = data.resources || [];

        if (loadToken !== resourcesLoadToken || !document.body.contains(grid)) return;

        if (resources.length > 0) {
            clearElement(grid);
            resources.forEach(resource => grid.appendChild(createResourceCard(resource)));
        } else {
            setStatusMessage(grid, 'events-empty', 'No resources here at the moment.');
        }
    } catch (error) {
        console.error('Failed to load resources:', error);
        if (loadToken !== resourcesLoadToken || !document.body.contains(grid)) return;
        setStatusMessage(grid, 'events-error', 'Failed to load resources. Please try again later. Note: sandeepshenoy.dev must be unblocked to view items.');
    }
}

function initResourcesPage() {
    const overlay = document.getElementById('resource-modal-overlay');
    const closeButton = document.getElementById('resource-modal-close');
    if (!overlay || !closeButton) return;

    if (!overlay.dataset.resourcesBound) {
        closeButton.addEventListener('click', closeResourceModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeResourceModal();
        });
        overlay.dataset.resourcesBound = 'true';
    }

    loadResources();
}

function parseResults(text) {
    const lines = text.split('\n');
    const tournaments = [];
    let currentTournament = null;
    let currentTeam = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (lines[i + 1] && lines[i + 1].trim().match(/^=+$/)) {
            if (currentTournament) {
                if (currentTeam) currentTournament.teams.push(currentTeam);
                tournaments.push(currentTournament);
            }
            currentTournament = { name: line, teams: [] };
            currentTeam = null;
            i++;
            continue;
        }

        if (line.startsWith('Rouse High School')) {
            if (currentTeam && currentTournament) currentTournament.teams.push(currentTeam);
            currentTeam = { name: line, events: [] };
            continue;
        }

        const eventMatch = line.match(/^(.+?)\s*-\s*(\d+)$/);
        if (eventMatch && currentTeam) {
            currentTeam.events.push({
                name: eventMatch[1].trim(),
                rank: parseInt(eventMatch[2], 10)
            });
        }
    }

    if (currentTournament) {
        if (currentTeam) currentTournament.teams.push(currentTeam);
        tournaments.push(currentTournament);
    }

    return tournaments.reverse();
}

function countMedals(events) {
    return events.reduce((counts, event) => {
        if (event.rank === 1) counts.gold++;
        else if (event.rank === 2) counts.silver++;
        else if (event.rank === 3) counts.bronze++;
        return counts;
    }, { gold: 0, silver: 0, bronze: 0 });
}

function createMedalCount(className, rank, count, label) {
    const medal = document.createElement('div');
    medal.className = 'medal-count';
    const icon = document.createElement('span');
    icon.className = `medal-icon ${className}`;
    icon.textContent = rank;
    medal.append(icon, ` ${count} ${label}`);
    return medal;
}

function createResultsTable(team) {
    const section = document.createElement('div');
    section.className = 'team-section';

    const teamName = document.createElement('div');
    teamName.className = 'team-name';
    teamName.textContent = team.name;

    const medals = countMedals(team.events);
    const summary = document.createElement('div');
    summary.className = 'medals-summary';
    summary.append(
        createMedalCount('medal-gold', '1', medals.gold, 'Gold'),
        createMedalCount('medal-silver', '2', medals.silver, 'Silver'),
        createMedalCount('medal-bronze', '3', medals.bronze, 'Bronze')
    );

    const table = document.createElement('table');
    table.className = 'results-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Rank', 'Event'].forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement('tbody');
    [...team.events].sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.name.localeCompare(b.name);
    }).forEach(event => {
        const row = document.createElement('tr');
        const rank = document.createElement('td');
        rank.className = 'rank-cell';
        if (event.rank >= 1 && event.rank <= 3) rank.classList.add(`rank-${event.rank}`);
        rank.textContent = event.rank;

        const eventName = document.createElement('td');
        eventName.className = 'event-cell';
        eventName.textContent = event.name;
        row.append(rank, eventName);
        tbody.appendChild(row);
    });
    table.append(thead, tbody);
    section.append(teamName, summary, table);
    return section;
}

function renderResults(tournaments) {
    const container = document.getElementById('results-container');
    if (!container) return;
    clearElement(container);

    tournaments.forEach(tournament => {
        const tournamentEl = document.createElement('div');
        tournamentEl.className = 'tournament';
        const title = document.createElement('div');
        title.className = 'tournament-title';
        title.textContent = tournament.name;
        tournamentEl.appendChild(title);
        tournament.teams.forEach(team => tournamentEl.appendChild(createResultsTable(team)));
        container.appendChild(tournamentEl);
    });
}

async function initResultsPage() {
    const container = document.getElementById('results-container');
    if (!container) return;

    try {
        const response = await fetch('/results/results.txt', {cache: 'no-store'});
        if (!response.ok) throw new Error('Failed to load results');
        const tournaments = parseResults(await response.text());
        renderResults(tournaments);
    } catch (error) {
        console.error('Failed to load results:', error);
        clearElement(container);
        const message = document.createElement('p');
        message.textContent = 'Error loading results.';
        container.appendChild(message);
    }
}

function closeActiveModal() {
    closeEventModal();
    closeBlogModal();
    closeResourceModal();
}

let modalEscapeListenerBound = false;

function bindGlobalModalEscape() {
    if (modalEscapeListenerBound) return;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeActiveModal();
    });
    modalEscapeListenerBound = true;
}

function initPageScripts(path = window.location.pathname) {
    bindGlobalModalEscape();

    if (isPath(path, ['home'])) {
        initHomePage();
    } else if (isPath(path, ['upcomingEvents'])) {
        initUpcomingEventsPage();
    } else if (isPath(path, ['blog'])) {
        initBlogPage();
    } else if (isPath(path, ['resources'])) {
        initResourcesPage();
    } else if (isPath(path, ['results'])) {
        initResultsPage();
    }
}

function initRouting() {
    window.addEventListener('popstate', () => {
        const path = window.location.pathname;
        navigateTo(path, false);
    });
    window.addEventListener('resize', () => {
        const active = document.querySelector('.links a.active');
        if (active) moveUnderlineTo(active, false);
    });
    
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            const active = document.querySelector('.links a.active');
            if (active) moveUnderlineTo(active, false);
        });
    }
    
    const currentPath = window.location.pathname === '/' ? '/' : window.location.pathname;
    const initialLink = getLinks().find(a => a.getAttribute('href') === currentPath) || document.querySelector('.links a.active');
    if (initialLink) setActiveLink(initialLink, false);
}

document.addEventListener('DOMContentLoaded', () => {
    createNav();
    createFooter();
    initRouting();
    initSVGAnimation();
    initWaveCanvas();
    initPageScripts();
    initCustomScrollbar();
});

function initCustomScrollbar() {
    const track = document.createElement('div');
    track.className = 'custom-scrollbar-track';
    
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.className = 'custom-scrollbar-thumb';
    const thumbCtx = thumbCanvas.getContext('2d', { willReadFrequently: true });
    
    track.appendChild(thumbCanvas);
    document.body.appendChild(track);
    
    const rootStyles = getComputedStyle(document.documentElement);
    const colorPrimary = rootStyles.getPropertyValue('--color-primary').trim() || '#8e220f';
    const colorForeground = rootStyles.getPropertyValue('--color-foreground').trim() || '#fde8ce';
    
    const primaryRGB = parseColor(colorPrimary);
    const foregroundRGB = parseColor(colorForeground);
    
    let isDragging = false;
    let dragStartY = 0;
    let dragStartScrollTop = 0;
    let currentThumbTop = 0;
    let currentThumbHeight = 0;
    let thumbWidth = 10;
    let rafId = null;
    
    let bgColorCache = new Map();
    let cacheValid = false;
    
    function getDocumentHeight() {
        return Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
        );
    }
    
    function getViewportHeight() {
        return window.innerHeight;
    }
    
    function parseColor(colorStr) {
        if (colorStr.startsWith('#')) {
            const hex = colorStr.slice(1);
            if (hex.length === 3) {
                return {
                    r: parseInt(hex[0] + hex[0], 16),
                    g: parseInt(hex[1] + hex[1], 16),
                    b: parseInt(hex[2] + hex[2], 16)
                };
            }
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16)
            };
        }
        
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3])
            };
        }
        
        return { r: 0, g: 0, b: 0 };
    }
    
    function colorDistance(c1, c2) {
        const dr = c1.r - c2.r;
        const dg = c1.g - c2.g;
        const db = c1.b - c2.b;
        return dr * dr + dg * dg + db * db;
    }
    
    function getLuminance(color) {
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }
    
    function invalidateCache() {
        cacheValid = false;
        bgColorCache.clear();
    }
    
    function getBackgroundColorAtPoint(x, y) {
        const cacheKey = Math.round(y);
        if (cacheValid && bgColorCache.has(cacheKey)) {
            return bgColorCache.get(cacheKey);
        }
        
        const elements = document.elementsFromPoint(x, y);
        
        for (const el of elements) {
            if (el.classList.contains('custom-scrollbar-track') || 
                el.classList.contains('custom-scrollbar-thumb')) {
                continue;
            }
            
            if (el.tagName === 'CANVAS' && el.id !== 'custom-scrollbar-thumb') {
                try {
                    const rect = el.getBoundingClientRect();
                    const canvasX = (x - rect.left) * (el.width / rect.width);
                    const canvasY = (y - rect.top) * (el.height / rect.height);
                    const ctx = el.getContext('2d', { willReadFrequently: true });
                    if (ctx && canvasX >= 0 && canvasY >= 0 && canvasX < el.width && canvasY < el.height) {
                        const pixel = ctx.getImageData(Math.floor(canvasX), Math.floor(canvasY), 1, 1).data;
                        if (pixel[3] > 0) {
                            const color = { r: pixel[0], g: pixel[1], b: pixel[2] };
                            bgColorCache.set(cacheKey, color);
                            return color;
                        }
                    }
                } catch (e) {
                    // Canvas pixel reads can fail for cross-origin images or browser security rules.
                }
            }
            
            if (el.tagName === 'IMG') {
                continue;
            }
            
            const style = getComputedStyle(el);
            const bgColor = style.backgroundColor;
            
            if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
                const color = parseColor(bgColor);
                bgColorCache.set(cacheKey, color);
                return color;
            }
        }
        
        bgColorCache.set(cacheKey, primaryRGB);
        return primaryRGB;
    }
    
    function renderThumb() {
        const dpr = window.devicePixelRatio || 1;
        const width = thumbWidth;
        const height = Math.ceil(currentThumbHeight);
        
        if (height <= 0) return;
        
        thumbCanvas.width = width * dpr;
        thumbCanvas.height = height * dpr;
        thumbCanvas.style.width = width + 'px';
        thumbCanvas.style.height = height + 'px';
        thumbCanvas.style.top = currentThumbTop + 'px';
        
        thumbCtx.setTransform(1, 0, 0, 1, 0, 0);
        thumbCtx.scale(dpr, dpr);
        
        const sampleX = window.innerWidth - 25;
        
        const imageData = thumbCtx.createImageData(width * dpr, height * dpr);
        const data = imageData.data;
        
        for (let row = 0; row < height; row++) {
            const screenY = currentThumbTop + row;
            const bgColor = getBackgroundColorAtPoint(sampleX, screenY);
            
            const distToPrimary = colorDistance(bgColor, primaryRGB);
            const distToForeground = colorDistance(bgColor, foregroundRGB);
            
            let thumbColor;
            if (distToPrimary < distToForeground) {
                thumbColor = foregroundRGB;
            } else {
                thumbColor = primaryRGB;
            }
            
            for (let subRow = 0; subRow < dpr; subRow++) {
                const actualRow = Math.floor(row * dpr + subRow);
                for (let col = 0; col < width * dpr; col++) {
                    const idx = (actualRow * width * dpr + col) * 4;
                    data[idx] = thumbColor.r;
                    data[idx + 1] = thumbColor.g;
                    data[idx + 2] = thumbColor.b;
                    data[idx + 3] = 255;
                }
            }
        }
        
        thumbCtx.setTransform(1, 0, 0, 1, 0, 0);
        thumbCtx.putImageData(imageData, 0, 0);
        
        thumbCtx.globalCompositeOperation = 'destination-in';
        thumbCtx.beginPath();
        const radius = Math.min(width / 2, 5) * dpr;
        roundRect(thumbCtx, 0, 0, width * dpr, height * dpr, radius);
        thumbCtx.fill();
        thumbCtx.globalCompositeOperation = 'source-over';
        
        cacheValid = true;
    }
    
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
    
    function updateScrollbar() {
        const docHeight = getDocumentHeight();
        const viewportHeight = getViewportHeight();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        
        if (docHeight <= viewportHeight) {
            track.style.display = 'none';
            return;
        }
        track.style.display = 'block';
        
        currentThumbHeight = Math.max((viewportHeight / docHeight) * viewportHeight, 30);
        
        const scrollableHeight = docHeight - viewportHeight;
        const thumbTrackHeight = viewportHeight - currentThumbHeight;
        currentThumbTop = (scrollTop / scrollableHeight) * thumbTrackHeight;
        
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(renderThumb);
    }
    
    thumbCanvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartY = e.clientY;
        dragStartScrollTop = window.scrollY;
        thumbCanvas.classList.add('dragging');
        thumbWidth = 14;
        updateScrollbar();
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const docHeight = getDocumentHeight();
        const viewportHeight = getViewportHeight();
        const scrollableHeight = docHeight - viewportHeight;
        const thumbTrackHeight = viewportHeight - currentThumbHeight;
        
        const deltaY = e.clientY - dragStartY;
        const scrollDelta = (deltaY / thumbTrackHeight) * scrollableHeight;
        
        window.scrollTo(0, dragStartScrollTop + scrollDelta);
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            thumbCanvas.classList.remove('dragging');
            thumbWidth = 10;
            updateScrollbar();
        }
    });
    
    thumbCanvas.addEventListener('mouseenter', () => {
        if (!isDragging) {
            thumbWidth = 14;
            updateScrollbar();
        }
    });
    
    thumbCanvas.addEventListener('mouseleave', () => {
        if (!isDragging) {
            thumbWidth = 10;
            updateScrollbar();
        }
    });
    
    track.addEventListener('click', (e) => {
        if (e.target === thumbCanvas) return;
        
        const trackRect = track.getBoundingClientRect();
        const clickY = e.clientY - trackRect.top;
        const viewportHeight = getViewportHeight();
        const docHeight = getDocumentHeight();
        const scrollableHeight = docHeight - viewportHeight;
        const thumbTrackHeight = viewportHeight - currentThumbHeight;
        
        const targetThumbTop = clickY - currentThumbHeight / 2;
        const scrollPosition = (targetThumbTop / thumbTrackHeight) * scrollableHeight;
        
        window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
    });
    
    window.addEventListener('scroll', () => {
        invalidateCache();
        updateScrollbar();
    }, { passive: true });
    
    window.addEventListener('resize', () => {
        invalidateCache();
        updateScrollbar();
    });
    
    const observer = new MutationObserver(() => {
        invalidateCache();
        requestAnimationFrame(updateScrollbar);
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });
    
    updateScrollbar();
    
    setTimeout(updateScrollbar, 100);
    setTimeout(updateScrollbar, 500);
    
    let lastAnimationUpdate = 0;
    function animationLoop(timestamp) {
        if (timestamp - lastAnimationUpdate > 100) {
            invalidateCache();
            renderThumb();
            lastAnimationUpdate = timestamp;
        }
        requestAnimationFrame(animationLoop);
    }
    requestAnimationFrame(animationLoop);
}

function initSVGAnimation() {
    const img = document.getElementById('title-svg');
    if (!img) return;

    img.addEventListener('load', () => {
        animateSVG();
    });

    if (img.complete) {
        animateSVG();
    }

    function animateSVG() {
        fetch(img.src)
            .then(res => res.text())
            .then(svgText => {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svg = svgDoc.querySelector('svg');
                
                if (!svg) return;
                
                svg.setAttribute('id', 'title-svg');
                svg.style.maxWidth = '100%';
                svg.style.height = 'auto';
                svg.style.width = '600px';
                img.parentNode.replaceChild(svg, img);
                
                const paths = svg.querySelectorAll('.st1');
                
                const outlineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                outlineGroup.setAttribute('class', 'outline-group');
                svg.appendChild(outlineGroup);
                
                const drawDuration = 1000;
                const fillDuration = 800;
                
                let defs = svg.querySelector('defs');
                if (!defs) {
                    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                    svg.insertBefore(defs, svg.firstChild);
                }
                
                const svgBBox = svg.getBBox();
                const fillClipId = 'fill-clip';
                const fillClip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
                fillClip.setAttribute('id', fillClipId);
                
                const fillRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                fillRect.setAttribute('x', svgBBox.x - 10);
                fillRect.setAttribute('width', svgBBox.width + 20);
                fillRect.setAttribute('height', svgBBox.height + 10);
                fillRect.setAttribute('y', svgBBox.y + svgBBox.height);
                fillClip.appendChild(fillRect);
                defs.appendChild(fillClip);
                
                paths.forEach((path, index) => {
                    const clipPathId = `clip-inset-${index}`;
                    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
                    clipPath.setAttribute('id', clipPathId);
                    
                    const clipPathPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    clipPathPath.setAttribute('d', path.getAttribute('d'));
                    clipPath.appendChild(clipPathPath);
                    defs.appendChild(clipPath);
                    
                    const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    outline.setAttribute('d', path.getAttribute('d'));
                    outline.setAttribute('fill', 'none');
                    outline.setAttribute('stroke', '#fde8ce');
                    outline.setAttribute('stroke-width', '10');
                    outline.setAttribute('opacity', '1');
                    outline.setAttribute('clip-path', `url(#${clipPathId})`);
                    
                    const length = outline.getTotalLength();
                    outline.style.strokeDasharray = length;
                    outline.style.strokeDashoffset = length;
                    
                    outlineGroup.appendChild(outline);
                    
                    requestAnimationFrame(() => {
                        outline.style.transition = `stroke-dashoffset ${drawDuration}ms ease-in-out`;
                        outline.style.strokeDashoffset = '0';
                    });
                    
                    path.setAttribute('clip-path', `url(#${fillClipId})`);
                });
                
                setTimeout(() => {
                    svg.classList.add('show-shapes');
                    
                    const startY = svgBBox.y + svgBBox.height;
                    const endY = svgBBox.y;
                    const startTime = performance.now();
                    
                    function animateFill(currentTime) {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / fillDuration, 1);
                        const easeProgress = 1 - Math.pow(1 - progress, 3);
                        
                        const currentY = startY - (startY - endY) * easeProgress;
                        fillRect.setAttribute('y', currentY);
                        
                        if (progress < 1) {
                            requestAnimationFrame(animateFill);
                        }
                    }
                    
                    requestAnimationFrame(animateFill);
                }, drawDuration);
            })
            .catch(err => console.error('Error loading SVG:', err));
    }
}

const waveState = {
    offset: 0,
    animationId: null,
    initialized: false,
    resizeHandler: null
};

function initWaveCanvas() {
    const canvas = document.getElementById('waveCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let w, h;
    
    const pixelRatio = (window.devicePixelRatio || 1) * 1;
    
    function resize() {
        w = window.innerWidth;
        h = 80;
        
        canvas.width = w * pixelRatio;
        canvas.height = h * pixelRatio;
        
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }
    
    resize();
    
    if (waveState.resizeHandler) {
        window.removeEventListener('resize', waveState.resizeHandler);
    }
    waveState.resizeHandler = resize;
    window.addEventListener('resize', resize);
    
    function draw() {
        ctx.clearRect(0, 0, w, h);
        
        waveState.offset += 2 / 3;
        
        const waveHeight = 7;
        const waveY = 30;
        const wavelength = 100;
        const edgeSmoothZone = 100;
        
        ctx.fillStyle = '#fde8ce';
        ctx.beginPath();
        ctx.moveTo(0, h);
        
        for (let x = 0; x <= w; x += 2) {
            let amplitude = waveHeight;
            
            if (x < edgeSmoothZone) {
                const t = x / edgeSmoothZone;
                amplitude *= t * t * (3 - 2 * t);
            }
            
            if (x > w - edgeSmoothZone) {
                const t = (w - x) / edgeSmoothZone;
                amplitude *= t * t * (3 - 2 * t);
            }
            
            const angle = (x / wavelength) * Math.PI * 2 + (waveState.offset / wavelength) * Math.PI * 2;
            const y = waveY + Math.sin(angle) * amplitude;
            ctx.lineTo(x, y);
        }
        
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        
        waveState.animationId = requestAnimationFrame(draw);
    }
    
    if (waveState.animationId) {
        cancelAnimationFrame(waveState.animationId);
    }
    
    draw();
}
