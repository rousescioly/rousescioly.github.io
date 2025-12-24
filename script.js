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

function normalizeFetchPath(href) {
    try {
        const u = new URL(href, window.location.origin);
        let p = u.pathname;
        if (p.endsWith('/')) p += 'index.html';
        if (p === '/') p = '/index.html';
        return p;
    } catch (e) {
        if (href.endsWith('/')) return href + 'index.html';
        if (href === '/') return '/index.html';
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
    
    const inlineScripts = [];
    doc.body.querySelectorAll('script:not([src])').forEach(script => {
        inlineScripts.push(script.textContent);
    });
    
    const bodyExtras = [];
    Array.from(doc.body.children).forEach(child => {
        if (child.tagName !== 'SCRIPT' && !child.classList.contains('card')) {
            const cloned = child.cloneNode(true);
            cloned.setAttribute('data-page-extra', 'true');
            bodyExtras.push(cloned);
        }
    });
    
    return {contentElements, title, inlineScripts, bodyExtras};
}

async function navigateTo(href, addHistory = true) {
    try {
        const data = await fetchPageContent(href);
        if (data.title) document.title = data.title;
        
        const card = document.querySelector('.card');
        const nav = card ? card.querySelector('.nav') : null;
        
        document.querySelectorAll('[data-page-extra]').forEach(el => el.remove());
        
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
        
        if (nav) {
            nav.classList.remove('open');
            const overlay = document.querySelector('.nav-overlay');
            if (overlay) overlay.remove();
            const mt = nav.querySelector('.menu-toggle');
            if (mt) mt.classList.remove('open');
        }
        
        const links = getLinks();
        const targetLink = links.find(a => a.getAttribute('href') === href || a.href.endsWith(href));
        if (targetLink) setActiveLink(targetLink, true);
        
        if (addHistory) history.pushState({path: href}, '', href);
        
        const isHome = href === '/' || href === '/index.html';
        if (isHome) {
            initSVGAnimation();
        }
        initWaveCanvas();
        
        if (data.inlineScripts && data.inlineScripts.length > 0) {
            setTimeout(() => {
                data.inlineScripts.forEach(scriptContent => {
                    try {
                        const script = document.createElement('script');
                        script.textContent = scriptContent;
                        document.body.appendChild(script);
                        document.body.removeChild(script);
                    } catch (err) {
                        console.error('Error executing inline script:', err);
                    }
                });
            }, 0);
        }
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
                nav.classList.remove('open');
                const overlay = document.querySelector('.nav-overlay');
                if (overlay) overlay.remove();
                menuToggle.classList.remove('open');
        });
        linksWrap.appendChild(a);
    });
        const menuToggle = document.createElement('button');
        menuToggle.className = 'menu-toggle';
        menuToggle.setAttribute('aria-label', 'Toggle menu');
        menuToggle.innerHTML = '<img src="/assets/hamburger.svg" alt="Menu" class="hamburger-icon">';
        menuToggle.addEventListener('click', () => {
            const opening = !nav.classList.contains('open');
            nav.classList.toggle('open');
            if (opening) {
                const overlay = document.createElement('div');
                overlay.className = 'nav-overlay';
                overlay.addEventListener('click', () => {
                    nav.classList.remove('open');
                    overlay.remove();
                    menuToggle.classList.remove('open');
                });
                document.body.appendChild(overlay);
                menuToggle.classList.add('open');
            } else {
                const overlay = document.querySelector('.nav-overlay');
                if (overlay) overlay.remove();
                menuToggle.classList.remove('open');
            }
        });
    nav.appendChild(logoWrap);
    nav.appendChild(linksWrap);
    nav.appendChild(menuToggle);
    card.insertBefore(nav, card.firstChild);
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
    const currentPath = window.location.pathname === '/' ? '/' : window.location.pathname;
    const initialLink = getLinks().find(a => a.getAttribute('href') === currentPath) || document.querySelector('.links a.active');
    if (initialLink) setActiveLink(initialLink, false);
}

document.addEventListener('DOMContentLoaded', () => {
    createNav();
    initRouting();
    initSVGAnimation();
    initWaveCanvas();
});

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

function initWaveCanvas() {
    const canvas = document.getElementById('waveCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let w, h;
    let offset = 0;
    let animationId;
    
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
    window.addEventListener('resize', resize);
    
    function draw() {
        ctx.clearRect(0, 0, w, h);
        
        offset += 2 / 3;
        
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
            
            const angle = (x / wavelength) * Math.PI * 2 + (offset / wavelength) * Math.PI * 2;
            const y = waveY + Math.sin(angle) * amplitude;
            ctx.lineTo(x, y);
        }
        
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        
        animationId = requestAnimationFrame(draw);
    }
    
    draw();
}
