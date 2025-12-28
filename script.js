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
    
    const pageStyles = [];
    doc.head.querySelectorAll('style').forEach(style => {
        pageStyles.push(style.textContent);
    });
    
    return {contentElements, title, inlineScripts, bodyExtras, pageStyles};
}

async function navigateTo(href, addHistory = true) {
    try {
        const data = await fetchPageContent(href);
        if (data.title) document.title = data.title;
        
        const card = document.querySelector('.card');
        const nav = card ? card.querySelector('.nav') : null;
        
        document.querySelectorAll('[data-page-extra]').forEach(el => el.remove());
        document.querySelectorAll('[data-page-style]').forEach(el => el.remove());
        
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
    initRouting();
    initSVGAnimation();
    initWaveCanvas();
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
                    // ntutil fatty moment
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
