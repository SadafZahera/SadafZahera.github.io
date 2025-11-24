const API_BASE_URL = "https://script.google.com/macros/s/AKfycbySCnqvTmSF5hsaKOcl3lYfi8vZaofsRITebd9P6MuWC8u8vpLzJbggE_zFOXIp8saM/exec";
const API_TOKEN = "ILoveS7f8a";

const LOCAL_KEY_DATA = "ahmad_portfolio_data_v6";
const LOCAL_KEY_THEME = "ahmad_portfolio_theme_v6";

// Default Theme Structure (Dual Mode)
const DEFAULT_THEME_CONFIG = {
    activeMode: "dark",
    dark: {
        primaryColor: "#64ffda",
        secondaryColor: "#22c55e",
        backgroundColor: "#0a192f",
        surfaceColor: "#112240",
        surfaceLightColor: "#233554",
        accentColor: "#f97316",
        textColor: "#e6f1ff",
        textMutedColor: "#8892b0",
        glassColor: "rgba(30, 41, 59, 0.7)",
        borderRadius: "4px",
        cardRadius: "8px",
        buttonRadius: "999px",
        fontFamily: "'Poppins', system-ui, sans-serif"
    },
    light: {
        primaryColor: "#0f766e", /* Darker Teal */
        secondaryColor: "#0284c7", /* Darker Blue */
        backgroundColor: "#e0e3e6", /* Light Grey */
        surfaceColor: "#ffffff", /* Pure White */
        surfaceLightColor: "#e2e8f0", /* Light Border */
        accentColor: "#e11d48",
        textColor: "#0f172a", /* Very Dark Blue/Black */
        textMutedColor: "#475569", /* Darker Grey for readability */
        glassColor: "rgba(255, 255, 255, 0.8)",
        borderRadius: "8px",
        cardRadius: "20px",
        buttonRadius: "12px",
        fontFamily: "'Inter', sans-serif"
    }
};

// --- STATE ---
let siteData = {};
let themeConfig = {};

function buildApiUrl(action) {
    const url = new URL(API_BASE_URL);
    url.searchParams.set("action", action);
    url.searchParams.set("token", API_TOKEN);
    return url.toString();
}

/* 
  ========================================
  INIT & LOADING
  ========================================
*/
async function init() {
    document.body.classList.add('loading');
    setupEventListeners();

    // 1. Load Content
    try {
        const res = await fetch(buildApiUrl("getData"));
        const json = await res.json();
        if (json.profile) {
            siteData = json;
            if (!siteData.education) siteData.education = [];
            if (!siteData.userSections) siteData.userSections = [];
            localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(siteData));
        } else throw new Error("Invalid data");
    } catch (e) {
        console.warn("Remote data failed.");
        // Try Local Storage
        const local = localStorage.getItem(LOCAL_KEY_DATA);
        if (local) {
            siteData = JSON.parse(local);
        } else {
            // FATAL ERROR: No data available
            showFatalError();
            return; // Stop execution
        }
    }

    // 2. Load Theme
    try {
        const res = await fetch(buildApiUrl("getTheme"));
        const json = await res.json();
        if (json.dark) {
            themeConfig = json;
            localStorage.setItem(LOCAL_KEY_THEME, JSON.stringify(themeConfig));
        } else throw new Error("Invalid theme");
    } catch (e) {
        console.warn("Remote theme failed, using local/default.");
        themeConfig = JSON.parse(localStorage.getItem(LOCAL_KEY_THEME) || JSON.stringify(DEFAULT_THEME_CONFIG));
    }

    showAdminStatus("Loading remote data...", false);
    applyTheme(themeConfig);
    renderAll();
    setupScrollReveal();
    showAdminStatus("");

    // Hide Loader
    setTimeout(() => {
        const loader = document.getElementById('loading-overlay');
        if (loader) {
            loader.style.opacity = '0';
            loader.style.visibility = 'hidden';
            document.body.classList.remove('loading');
        }
    }, 800); // Small delay for smooth transition
}

/* 
  ========================================
  THEMING
  ========================================
*/
function applyTheme(cfg) {
    if (!cfg) return;
    const mode = cfg.activeMode || "dark";
    const t = cfg[mode];
    if (!t) return;

    const root = document.documentElement;
    root.style.setProperty("--color-primary", t.primaryColor);
    root.style.setProperty("--color-secondary", t.secondaryColor);
    root.style.setProperty("--color-bg", t.backgroundColor);
    root.style.setProperty("--color-surface", t.surfaceColor);
    root.style.setProperty("--color-surface-light", t.surfaceLightColor);
    root.style.setProperty("--color-accent", t.accentColor);
    root.style.setProperty("--color-text", t.textColor);
    root.style.setProperty("--color-text-muted", t.textMutedColor);
    root.style.setProperty("--glass-bg", t.glassColor || (mode === 'dark' ? "rgba(30, 41, 59, 0.7)" : "rgba(255, 255, 255, 0.8)"));
    root.style.setProperty("--radius-global", t.borderRadius);
    root.style.setProperty("--radius-card", t.cardRadius);
    root.style.setProperty("--radius-button", t.buttonRadius);
    root.style.setProperty("--font-family-base", t.fontFamily);

    // Update toggle icon
    const btn = document.getElementById("theme-toggle");
    btn.innerHTML = mode === "dark" ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
}

function toggleTheme() {
    themeConfig.activeMode = themeConfig.activeMode === "dark" ? "light" : "dark";
    applyTheme(themeConfig);
    // Auto-save local preference
    localStorage.setItem(LOCAL_KEY_THEME, JSON.stringify(themeConfig));
    // Persist to backend
    saveThemeToCloud();
}

/* 
  ========================================
  HELPER: PDF NATIVE VIEWER
  ========================================
*/
function toPdfViewerUrl(url) {
    if (!url) return "#";

    // 1. Handle Direct Upload Links (lh3.googleusercontent.com)
    // These are returned by the Apps Script uploader. We must convert them 
    // to standard Drive Viewer links to see all pages of a PDF.
    if (url.includes("googleusercontent.com/d/")) {
        const id = url.split("/d/")[1];
        return `https://drive.google.com/file/d/${id}/view`;
    }

    // 2. Handle Standard Drive Links
    if (url.includes("drive.google.com")) {
        // If it's already a /view link, it's good.
        if (url.includes("/view")) return url;

        // If it's a /preview link, switch to /view for better new-tab experience
        if (url.includes("/preview")) return url.replace("/preview", "/view");

        // Extract ID from other formats (like export=download) and force /view
        const m = url.match(/\/d\/(.*?)(\/|$)/);
        if (m && m[1]) return `https://drive.google.com/file/d/${m[1]}/view`;

        // Handle ID parameter format
        const m2 = url.match(/[?&]id=([^&]+)/);
        if (m2 && m2[1]) return `https://drive.google.com/file/d/${m2[1]}/view`;
    }

    // Return original if it's not a Google Drive link
    return url;
}

/* 
  ========================================
  RENDERING UI
  ========================================
*/
function renderAll() {
    renderHero();
    renderAbout();
    renderSkills();
    renderExperience();
    renderEducation();
    renderProjects();
    renderResearch();
    renderCustomSections();
    renderDocuments();
    renderContact();
    document.getElementById('footer-copy').innerHTML = `&copy; ${new Date().getFullYear()} ${siteData.profile.name}.`;
    setupTimelineAnimation();
}

function renderHero() {
    const p = siteData.profile;
    document.title = `${p.name} | Portfolio`;
    document.getElementById('nav-logo').textContent = p.name ? p.name.split(' ')[0] + "." : "ABZ.";
    document.getElementById('hero-name').textContent = p.name;
    document.getElementById('hero-role').textContent = p.role;
    document.getElementById('hero-bio').textContent = p.bio;

    let socialsHtml = '';
    if (p.github) socialsHtml += `<a href="${p.github}" target="_blank"><i class="fa-brands fa-github"></i></a>`;
    if (p.linkedin) socialsHtml += `<a href="${p.linkedin}" target="_blank"><i class="fa-brands fa-linkedin"></i></a>`;
    document.getElementById('hero-socials').innerHTML = socialsHtml;

    // Profile Photo
    const photoContainer = document.getElementById('hero-photo-wrapper');
    const imageContainer = document.querySelector('.hero-image-container');

    if (p.photoUrl && p.photoUrl.trim() !== "") {
        imageContainer.style.display = 'flex';
        photoContainer.innerHTML = `<img src="${p.photoUrl}" alt="${p.name}">`;
    } else {
        // Hide the entire image container if no photo
        imageContainer.style.display = 'none';
        // Optional: Center the text if you want, but for now just hiding the image
        // document.querySelector('.hero-content').style.gridTemplateColumns = '1fr';
        // document.querySelector('.hero-content').style.textAlign = 'center';
    }
}

function renderAbout() {
    document.getElementById('about-desc').textContent = siteData.profile.aboutDesc;
    const p = siteData.profile;
    const info = [{ label: "Location", val: p.location }, { label: "Email", val: p.email }];
    document.getElementById('about-info-grid').innerHTML = info.map(i => `<div class="info-item"><h4>${i.label}</h4><p>${i.val}</p></div>`).join('');
}

function renderSkills() {
    const s = siteData.skills;
    const container = document.getElementById('skills-container');
    let html = '';
    for (let cat in s) {
        html += `<div class="skill-category"><h3>${cat.charAt(0).toUpperCase() + cat.slice(1)}</h3><div class="skill-list">`;
        html += s[cat].map(skill => {
            const name = typeof skill === 'string' ? skill : skill.name;
            const icon = (typeof skill === 'object' && skill.iconUrl) ? `<img src="${skill.iconUrl}" class="skill-icon">` : '';
            return `<div class="skill-pill">${icon}<span>${name}</span></div>`;
        }).join('');
        html += `</div></div>`;
    }
    container.innerHTML = html;
}

function renderExperience() {
    document.getElementById('experience-timeline').innerHTML = siteData.experience.map(exp => `
        <div class="exp-card">
            <div class="exp-header">
                <h3>${exp.role}</h3>
                <span class="company">@ ${exp.company}</span>
                <span class="date">${exp.date} | ${exp.location}</span>
            </div>
            <p class="exp-desc">${exp.desc}</p>
            ${exp.docUrl ? `<a href="${toPdfViewerUrl(exp.docUrl)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">View Certificate</a>` : ''}
        </div>
    `).join('');
}

function renderEducation() {
    const eduContainer = document.getElementById('education-timeline');
    if (!siteData.education || siteData.education.length === 0) {
        eduContainer.innerHTML = "<p>No education added yet.</p>"; return;
    }
    eduContainer.innerHTML = siteData.education.map(e => `
        <div class="edu-timeline-card">
            <div class="exp-header"> <!-- Reusing exp-header for consistent layout -->
                <h3>${e.degree}</h3>
                <span class="company" style="color:var(--color-primary)">@ ${e.institution}</span>
                <span class="date">${e.startYear} - ${e.endYear} | ${e.location}</span>
            </div>
            <p class="exp-desc">${e.details}</p>
            ${e.docUrl ? `<a href="${toPdfViewerUrl(e.docUrl)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline" style="margin-top:10px;">View Document</a>` : ''}
        </div>
    `).join('');
}

function renderProjects() {
    document.getElementById('projects-grid').innerHTML = siteData.projects.map(proj => `
        <div class="project-card">
            ${proj.imageUrl ? `<div class="project-image-wrapper"><img src="${proj.imageUrl}" class="project-img"></div>` : ''}
            <div class="project-content">
                <div class="project-top">
                    <h3>${proj.title}</h3>
                    <div class="project-links">
                        ${proj.githubUrl ? `<a href="${proj.githubUrl}" target="_blank"><i class="fa-brands fa-github"></i></a>` : ''}
                        ${proj.liveUrl ? `<a href="${proj.liveUrl}" target="_blank"><i class="fa-solid fa-external-link-alt"></i></a>` : ''}
                        ${proj.docUrl ? `<a href="${toPdfViewerUrl(proj.docUrl)}" target="_blank" rel="noopener"><i class="fa-regular fa-file-lines"></i></a>` : ''}
                    </div>
                </div>
                <p>${proj.desc}</p>
                <div class="tech-stack">${proj.techStack.map(t => {
        const name = typeof t === 'string' ? t : t.name;
        const icon = (typeof t === 'object' && t.iconUrl) ? `<img src="${t.iconUrl}" style="width:12px;height:12px;object-fit:contain;">` : '';
        return `<span class="tech-pill">${icon}${name}</span>`;
    }).join('')}</div>
            </div>
        </div>
    `).join('');
}

function renderResearch() {
    document.getElementById('research-grid').innerHTML = siteData.research.map(paper => {
        const s = paper.status.toLowerCase();
        const statusClass = s === 'published' ? 'status-published' : (s.includes('review') ? 'status-under-review' : 'status-draft');
        return `
        <div class="research-card">
            <span class="research-status ${statusClass}">${paper.status}</span>
            <h3>${paper.title}</h3>
            <p class="research-meta">${paper.authors} • ${paper.venue}, ${paper.year}</p>
            <div class="research-actions">
                ${paper.paperUrl ? `<a href="${toPdfViewerUrl(paper.paperUrl)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Read Paper</a>` : ''}
                ${paper.certUrl ? `<a href="${toPdfViewerUrl(paper.certUrl)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Certificate</a>` : ''}
            </div>
        </div>`;
    }).join('');
}

function renderCustomSections() {
    const wrapper = document.getElementById('custom-sections-wrapper');
    if (!siteData.userSections) { wrapper.innerHTML = ""; return; }

    // Start numbering from 08 since 07 is the last static section
    let sectionCounter = 8;

    wrapper.innerHTML = siteData.userSections.map(sec => {
        const sectionNum = sectionCounter < 10 ? `0${sectionCounter}` : sectionCounter;
        sectionCounter++;

        return `
        <section class="section">
            <div class="container hidden-section">
                <h2 class="section-title">
                    <span>${sectionNum}.</span> 
                    ${sec.title}
                </h2>
                <div class="custom-grid">
                    ${sec.items.map(item => `
                    <div class="custom-card">
                        ${item.badgeUrl ? `<img src="${item.badgeUrl}" class="custom-badge" style="width:40px;height:40px;margin-bottom:15px;border-radius:6px;">` : ''}
                        <h3>${item.title}</h3>
                        <span style="color:var(--color-primary);font-size:0.9rem;display:block;margin-bottom:4px;font-weight:500;">${item.subtitle}</span>
                        <span style="color:var(--color-text-muted);font-size:0.85rem;display:block;margin-bottom:15px;font-family:var(--font-mono);">${item.date}</span>
                        <p style="font-size:0.95rem;color:var(--color-text-muted);line-height:1.6;flex-grow:1;">${item.description}</p>
                        ${item.docUrl ? `<a href="${toPdfViewerUrl(item.docUrl)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline" style="margin-top:20px;align-self:flex-start;">View Document</a>` : ''}
                    </div>
                    `).join('')}
                </div>
            </div>
        </section>
    `}).join('');
}

function renderDocuments() {
    document.getElementById('documents-grid').innerHTML = siteData.documents.map(doc => `
        <div class="doc-card">
            <i class="fa-solid fa-file-arrow-down doc-icon"></i>
            <h3>${doc.title}</h3>
            <p>${doc.desc}</p>
            <a href="${toPdfViewerUrl(doc.url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">View / Download</a>
        </div>
    `).join('');
}

function renderContact() {
    document.getElementById('contact-email-btn').href = `mailto:${siteData.profile.email}`;
    const p = siteData.profile;
    let html = '';
    if (p.github) html += `<a href="${p.github}" target="_blank"><i class="fa-brands fa-github"></i></a>`;
    if (p.linkedin) html += `<a href="${p.linkedin}" target="_blank"><i class="fa-brands fa-linkedin"></i></a>`;
    document.getElementById('contact-socials').innerHTML = html;
}

/* 
  ========================================
  ADMIN SYSTEM
  ========================================
*/
const loginModal = document.getElementById('login-modal');
const adminPanel = document.getElementById('admin-dashboard');

function setupEventListeners() {
    document.querySelector('.hamburger').addEventListener('click', () => {
        document.querySelector('.nav-links').classList.toggle('active');
    });

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('admin-trigger').addEventListener('click', (e) => { e.preventDefault(); loginModal.style.display = 'block'; });
    document.getElementById('footer-admin-link').addEventListener('click', (e) => { e.preventDefault(); loginModal.style.display = 'block'; });
    document.querySelector('.close-modal').addEventListener('click', () => loginModal.style.display = 'none');

    document.getElementById('do-login-btn').addEventListener('click', async () => {
        const u = document.getElementById('admin-user').value;
        const p = document.getElementById('admin-pass').value;
        const btn = document.getElementById('do-login-btn');
        btn.innerText = "Checking...";

        try {
            const res = await fetch(buildApiUrl("login"), {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await res.json();
            if (data.success) {
                loginModal.style.display = 'none';
                adminPanel.style.display = 'flex';
                renderAdminForms();
            } else {
                document.getElementById('login-error').textContent = "Invalid Credentials";
            }
        } catch (e) {
            document.getElementById('login-error').textContent = "Login Error";
        } finally {
            btn.innerText = "Login";
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => adminPanel.style.display = 'none');
    document.getElementById('save-data-btn').addEventListener('click', saveDataToCloud);
    document.getElementById('save-theme-btn').addEventListener('click', saveThemeToCloud);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });
}

function showAdminStatus(msg, isError = false) {
    const el = document.getElementById('admin-status');
    if (!msg) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = msg;
    el.style.color = isError ? '#ff5f56' : themeConfig[themeConfig.activeMode].primaryColor;
}

// Data Saving
async function saveDataToCloud() {
    showAdminStatus("Saving Content...", false);
    try {
        await fetch(buildApiUrl("saveData"), { method: "POST", body: JSON.stringify(siteData) });
        localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(siteData));
        showAdminStatus("Content Saved!", false);
        renderAll();
    } catch (e) { showAdminStatus("Save Failed", true); }
}

async function saveThemeToCloud() {
    showAdminStatus("Saving Theme...", false);
    try {
        await fetch(buildApiUrl("saveTheme"), { method: "POST", body: JSON.stringify(themeConfig) });
        localStorage.setItem(LOCAL_KEY_THEME, JSON.stringify(themeConfig));
        showAdminStatus("Theme Saved!", false);
    } catch (e) { showAdminStatus("Theme Save Failed", true); }
}

// File Upload
function handleUpload(input, callback) {
    const file = input.files[0];
    if (!file) return;
    const span = input.nextElementSibling;
    span.textContent = "Uploading...";

    const reader = new FileReader();
    reader.onload = async () => {
        const base64 = reader.result.split(",")[1];
        try {
            const res = await fetch(buildApiUrl("uploadFile"), {
                method: "POST",
                body: JSON.stringify({ filename: file.name, mimeType: file.type, data: base64 })
            });
            const data = await res.json();
            if (data.success) {
                span.textContent = "Done";
                callback(data.url);
            } else throw new Error();
        } catch (e) { span.textContent = "Error"; }
    };
    reader.readAsDataURL(file);
}

// --- ADMIN FORM GENERATION ---
function renderAdminForms() {
    // Profile
    let p = siteData.profile;
    let html = `<div class="form-group"><label>Profile Photo</label><input type="text" value="${p.photoUrl || ''}" onchange="siteData.profile.photoUrl=this.value">
        <div class="file-upload-group"><input type="file" onchange="handleUpload(this, u=>{siteData.profile.photoUrl=u;renderAll();})"><span class="upload-status"></span></div></div>`;

    for (let k in p) {
        if (k === 'photoUrl') continue;
        html += `<div class="form-group"><label>${k}</label>`;
        if (k.includes('bio') || k.includes('Desc')) html += `<textarea onchange="siteData.profile['${k}']=this.value">${p[k]}</textarea>`;
        else html += `<input type="text" value="${p[k]}" onchange="siteData.profile['${k}']=this.value">`;
        html += `</div>`;
    }
    document.getElementById('edit-profile').innerHTML = html;

    renderSkillsEditor();
    renderComplexList('edit-exp', siteData.experience, 'experience', ['role', 'company', 'date', 'location', 'desc', 'docUrl']);
    renderComplexList('edit-edu', siteData.education, 'education', ['degree', 'institution', 'startYear', 'endYear', 'location', 'details', 'docUrl']);
    renderProjectsEditor();
    renderComplexList('edit-research', siteData.research, 'research', ['title', 'authors', 'venue', 'year', 'status', 'paperUrl', 'certUrl']);
    renderComplexList('edit-docs', siteData.documents, 'documents', ['title', 'desc', 'url']);
    renderCustomSectionEditor();
    renderThemeEditor();
}

// --- CUSTOM SECTION EDITOR ---
function renderCustomSectionEditor() {
    const el = document.getElementById('edit-custom');
    if (!siteData.userSections) siteData.userSections = [];

    let html = siteData.userSections.map((sec, sIdx) => `
        <div class="admin-item-card" style="border:1px solid var(--color-primary);">
            <div style="position:absolute; top:12px; right:12px; display:flex; gap:5px;">
                <button class="btn btn-sm btn-outline" onclick="moveCustomSection(${sIdx}, -1)" ${sIdx === 0 ? 'disabled' : ''} style="padding:4px 8px; font-size:0.8rem;">&uarr;</button>
                <button class="btn btn-sm btn-outline" onclick="moveCustomSection(${sIdx}, 1)" ${sIdx === siteData.userSections.length - 1 ? 'disabled' : ''} style="padding:4px 8px; font-size:0.8rem;">&darr;</button>
                <button class="delete-btn" onclick="deleteCustomSection(${sIdx})" style="position:static; margin-left:5px;">Delete Section</button>
            </div>
            <div class="form-group"><label>Section Title</label><input value="${sec.title}" onchange="siteData.userSections[${sIdx}].title=this.value"></div>
            <div class="form-group"><label>Icon Class</label><input value="${sec.icon || ''}" onchange="siteData.userSections[${sIdx}].icon=this.value"></div>
            
            <h5 style="margin:10px 0;color:var(--color-primary)">Items</h5>
            ${sec.items.map((item, iIdx) => `
                <div class="admin-item-card">
                    <div style="position:absolute; top:12px; right:12px; display:flex; gap:5px;">
                        <button class="btn btn-sm btn-outline" onclick="moveCustomItem(${sIdx}, ${iIdx}, -1)" ${iIdx === 0 ? 'disabled' : ''} style="padding:4px 8px; font-size:0.8rem;">&uarr;</button>
                        <button class="btn btn-sm btn-outline" onclick="moveCustomItem(${sIdx}, ${iIdx}, 1)" ${iIdx === sec.items.length - 1 ? 'disabled' : ''} style="padding:4px 8px; font-size:0.8rem;">&darr;</button>
                        <button class="delete-btn" onclick="deleteCustomItem(${sIdx}, ${iIdx})" style="position:static; margin-left:5px;">&times;</button>
                    </div>
                    <div class="form-group"><label>Title</label><input value="${item.title}" onchange="siteData.userSections[${sIdx}].items[${iIdx}].title=this.value"></div>
                    <div class="form-group"><label>Subtitle</label><input value="${item.subtitle || ''}" onchange="siteData.userSections[${sIdx}].items[${iIdx}].subtitle=this.value"></div>
                    <div class="form-group"><label>Date</label><input value="${item.date || ''}" onchange="siteData.userSections[${sIdx}].items[${iIdx}].date=this.value"></div>
                    <div class="form-group"><label>Desc</label><textarea onchange="siteData.userSections[${sIdx}].items[${iIdx}].description=this.value">${item.description || ''}</textarea></div>
                    
                    <div class="form-group"><label>Doc URL</label><input value="${item.docUrl || ''}" onchange="siteData.userSections[${sIdx}].items[${iIdx}].docUrl=this.value">
                    <div class="file-upload-group"><input type="file" onchange="handleUpload(this, u=>{siteData.userSections[${sIdx}].items[${iIdx}].docUrl=u;renderAll();})"><span class="upload-status"></span></div></div>

                    <div class="form-group"><label>Badge URL</label><input value="${item.badgeUrl || ''}" onchange="siteData.userSections[${sIdx}].items[${iIdx}].badgeUrl=this.value">
                    <div class="file-upload-group"><input type="file" onchange="handleUpload(this, u=>{siteData.userSections[${sIdx}].items[${iIdx}].badgeUrl=u;renderAll();})"><span class="upload-status"></span></div></div>
                </div>
            `).join('')}
            <button class="btn btn-sm btn-outline" onclick="addCustomItem(${sIdx})">+ Add Item</button>
        </div>
    `).join('');

    html += `<button class="btn btn-primary btn-sm" onclick="addCustomSection()">+ Add New Section</button>`;
    el.innerHTML = html;
}

window.addCustomSection = () => { siteData.userSections.push({ title: "New Section", icon: "fa-solid fa-star", items: [] }); renderAdminForms(); };
window.deleteCustomSection = (idx) => { if (confirm("Delete section?")) { siteData.userSections.splice(idx, 1); renderAdminForms(); } };
window.addCustomItem = (sIdx) => { siteData.userSections[sIdx].items.push({ title: "New Item", subtitle: "", description: "" }); renderAdminForms(); };
window.deleteCustomItem = (sIdx, iIdx) => { siteData.userSections[sIdx].items.splice(iIdx, 1); renderAdminForms(); };
window.moveCustomSection = (idx, direction) => {
    const arr = siteData.userSections;
    if (idx + direction < 0 || idx + direction >= arr.length) return;
    const temp = arr[idx];
    arr[idx] = arr[idx + direction];
    arr[idx + direction] = temp;
    renderAdminForms();
    renderAll();
};
window.moveCustomItem = (sIdx, iIdx, direction) => {
    const arr = siteData.userSections[sIdx].items;
    if (iIdx + direction < 0 || iIdx + direction >= arr.length) return;
    const temp = arr[iIdx];
    arr[iIdx] = arr[iIdx + direction];
    arr[iIdx + direction] = temp;
    renderAdminForms();
    renderAll();
};

// --- THEME EDITOR ---
function renderThemeEditor() {
    const el = document.getElementById('edit-theme');
    const m = themeConfig.activeMode;
    const t = themeConfig[m];

    let html = `<div style="margin-bottom:20px; background:var(--color-bg); padding:15px; border-radius:8px; border:1px solid var(--glass-border);">
        <label style="display:block;margin-bottom:8px;color:var(--color-text-muted);">Active Mode</label>
        <select onchange="themeConfig.activeMode=this.value; applyTheme(themeConfig); renderAdminForms();" style="width:100%;padding:10px;background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-surface-light);border-radius:6px;">
            <option value="dark" ${m === 'dark' ? 'selected' : ''}>Dark Mode</option>
            <option value="light" ${m === 'light' ? 'selected' : ''}>Light Mode</option>
        </select>
    </div>
    
    <h4 style="margin-bottom:15px;border-bottom:1px solid var(--glass-border);padding-bottom:10px;">Color Palette (${m.toUpperCase()})</h4>
    <div class="config-group">
        <div class="config-item"><label>Primary</label><input type="color" value="${t.primaryColor}" onchange="themeConfig['${m}'].primaryColor = this.value; applyTheme(themeConfig);"></div>
        <div class="config-item"><label>Secondary</label><input type="color" value="${t.secondaryColor}" onchange="themeConfig['${m}'].secondaryColor = this.value; applyTheme(themeConfig);"></div>
        <div class="config-item"><label>Background</label><input type="color" value="${t.backgroundColor}" onchange="themeConfig['${m}'].backgroundColor = this.value; applyTheme(themeConfig);"></div>
        <div class="config-item"><label>Surface</label><input type="color" value="${t.surfaceColor}" onchange="themeConfig['${m}'].surfaceColor = this.value; applyTheme(themeConfig);"></div>
        <div class="config-item"><label>Surface Light</label><input type="color" value="${t.surfaceLightColor}" onchange="themeConfig['${m}'].surfaceLightColor = this.value; applyTheme(themeConfig);"></div>
        <div class="config-item"><label>Text Main</label><input type="color" value="${t.textColor}" onchange="themeConfig['${m}'].textColor = this.value; applyTheme(themeConfig);"></div>
        <div class="config-item"><label>Text Muted</label><input type="color" value="${t.textMutedColor}" onchange="themeConfig['${m}'].textMutedColor = this.value; applyTheme(themeConfig);"></div>
        <div class="config-item"><label>Accent</label><input type="color" value="${t.accentColor}" onchange="themeConfig['${m}'].accentColor = this.value; applyTheme(themeConfig);"></div>
    </div>

    <h4 style="margin-bottom:15px;border-bottom:1px solid var(--glass-border);padding-bottom:10px;">Typography & Shape</h4>
    <div class="config-group">
        <div class="config-item"><label>Global Radius</label><input type="text" value="${t.borderRadius}" onchange="themeConfig['${m}'].borderRadius = this.value; applyTheme(themeConfig);"></div>
        <div class="config-item"><label>Card Radius</label><input type="text" value="${t.cardRadius}" onchange="themeConfig['${m}'].cardRadius = this.value; applyTheme(themeConfig);"></div>
        <div class="config-item"><label>Button Radius</label><input type="text" value="${t.buttonRadius}" onchange="themeConfig['${m}'].buttonRadius = this.value; applyTheme(themeConfig);"></div>
        <div class="config-item"><label>Font Family</label><input type="text" value="${t.fontFamily.replace(/'/g, "")}" onchange="themeConfig['${m}'].fontFamily = this.value; applyTheme(themeConfig);"></div>
    </div>`;
    el.innerHTML = html;
}

// Reuse existing renderers for Skills, Projects, Lists from previous code...
function renderSkillsEditor() {
    const el = document.getElementById('edit-skills');
    let html = '';
    const cats = siteData.skills;

    // Add New Category Input
    html += `<div style="margin-bottom:20px; padding:15px; border:1px dashed var(--color-primary); border-radius:8px;">
        <h5 style="margin-bottom:10px;">Add New Category</h5>
        <div style="display:flex; gap:10px;">
            <input type="text" id="new-skill-cat" placeholder="Category Name (e.g. 'Databases')" style="flex-grow:1;">
            <button class="btn btn-sm btn-primary" onclick="addSkillCategory()">Add</button>
        </div>
    </div>`;

    for (let cat in cats) {
        html += `<div style="margin-bottom:30px; border:1px solid var(--glass-border); padding:15px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h4 style="margin:0; text-transform:capitalize;">${cat}</h4>
                <button class="btn btn-sm btn-danger" onclick="deleteSkillCategory('${cat}')" style="padding:4px 10px; font-size:0.8rem;">Delete Category</button>
            </div>`;

        cats[cat].forEach((skill, idx) => {
            let name = typeof skill === 'string' ? skill : skill.name;
            let icon = typeof skill === 'object' ? skill.iconUrl || '' : '';
            html += `<div class="admin-item-card">
                <div style="position:absolute; top:12px; right:12px; display:flex; gap:5px;">
                    <button class="btn btn-sm btn-outline" onclick="moveSkill('${cat}', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} style="padding:4px 8px; font-size:0.8rem;">&uarr;</button>
                    <button class="btn btn-sm btn-outline" onclick="moveSkill('${cat}', ${idx}, 1)" ${idx === cats[cat].length - 1 ? 'disabled' : ''} style="padding:4px 8px; font-size:0.8rem;">&darr;</button>
                    <button class="delete-btn" onclick="deleteSkill('${cat}', ${idx})" style="position:static; margin-left:5px;">&times;</button>
                </div>
                <div class="form-group"><label>Name</label><input value="${name}" onchange="updateSkill('${cat}', ${idx}, 'name', this.value)"></div>
                <div class="form-group"><label>Icon URL</label><input value="${icon}" onchange="updateSkill('${cat}', ${idx}, 'iconUrl', this.value)">
                <div class="file-upload-group"><input type="file" onchange="handleUpload(this, url => updateSkill('${cat}', ${idx}, 'iconUrl', url))"><span class="upload-status"></span></div>
                </div>
            </div>`;
        });
        html += `<button class="btn btn-sm btn-primary" onclick="addSkill('${cat}')">+ Add Skill to ${cat}</button>
        </div>`;
    }
    el.innerHTML = html;
}
window.updateSkill = (cat, idx, key, val) => { let item = siteData.skills[cat][idx]; if (typeof item === 'string') item = { name: item, iconUrl: '' }; item[key] = val; siteData.skills[cat][idx] = item; renderAll(); };
window.addSkill = (cat) => { siteData.skills[cat].push({ name: "New Skill", iconUrl: "" }); renderAdminForms(); };
window.deleteSkill = (cat, idx) => { siteData.skills[cat].splice(idx, 1); renderAdminForms(); };
window.moveSkill = (cat, idx, direction) => {
    const arr = siteData.skills[cat];
    if (idx + direction < 0 || idx + direction >= arr.length) return;
    const temp = arr[idx];
    arr[idx] = arr[idx + direction];
    arr[idx + direction] = temp;
    renderAdminForms();
    renderAll();
};
window.addSkillCategory = () => {
    const name = document.getElementById('new-skill-cat').value.trim();
    if (name && !siteData.skills[name]) {
        siteData.skills[name] = [];
        renderAdminForms();
        renderAll();
    }
};
window.deleteSkillCategory = (cat) => {
    if (confirm(`Delete category '${cat}' and all its skills?`)) {
        delete siteData.skills[cat];
        renderAdminForms();
        renderAll();
    }
};

function renderProjectsEditor() {
    const el = document.getElementById('edit-projects');
    let html = siteData.projects.map((p, idx) => `
        <div class="admin-item-card">
            <div style="position:absolute; top:12px; right:12px; display:flex; gap:5px;">
                <button class="btn btn-sm btn-outline" onclick="moveItem('projects', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} style="padding:4px 8px; font-size:0.8rem;">&uarr;</button>
                <button class="btn btn-sm btn-outline" onclick="moveItem('projects', ${idx}, 1)" ${idx === siteData.projects.length - 1 ? 'disabled' : ''} style="padding:4px 8px; font-size:0.8rem;">&darr;</button>
                <button class="delete-btn" onclick="deleteItem('projects', ${idx})" style="position:static; margin-left:5px;">&times;</button>
            </div>
            <div class="form-group"><label>Title</label><input value="${p.title}" onchange="siteData.projects[${idx}].title=this.value"></div>
            <div class="form-group"><label>Desc</label><textarea onchange="siteData.projects[${idx}].desc=this.value">${p.desc}</textarea></div>
            <div class="form-group"><label>Image URL</label><input value="${p.imageUrl || ''}" onchange="siteData.projects[${idx}].imageUrl=this.value">
                <div class="file-upload-group"><input type="file" onchange="handleUpload(this, u => { siteData.projects[${idx}].imageUrl=u; renderAdminForms(); })"><span class="upload-status"></span></div>
            </div>
            <div class="form-group"><label>Tech (Names only)</label><input value="${p.techStack.map(t => typeof t === 'string' ? t : t.name).join(', ')}" onchange="updateProjectTechSimple(${idx}, this.value)"></div>
            <div class="form-group"><label>Doc URL</label><input value="${p.docUrl || ''}" onchange="siteData.projects[${idx}].docUrl=this.value">
                <div class="file-upload-group"><input type="file" onchange="handleUpload(this, u => { siteData.projects[${idx}].docUrl=u; renderAdminForms(); })"><span class="upload-status"></span></div>
            </div>
            <div class="form-group"><label>Github</label><input value="${p.githubUrl || ''}" onchange="siteData.projects[${idx}].githubUrl=this.value"></div>
        </div>
    `).join('') + `<button class="btn btn-primary btn-sm" onclick="addItem('projects')">+ Project</button>`;
    el.innerHTML = html;
}
window.updateProjectTechSimple = (idx, str) => { siteData.projects[idx].techStack = str.split(',').map(s => s.trim()); renderAll(); }

function renderComplexList(elId, arr, arrName, fields) {
    const el = document.getElementById(elId);
    let html = arr.map((item, idx) => `
        <div class="admin-item-card">
            <div style="position:absolute; top:12px; right:12px; display:flex; gap:5px;">
                <button class="btn btn-sm btn-outline" onclick="moveItem('${arrName}', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} style="padding:4px 8px; font-size:0.8rem;">&uarr;</button>
                <button class="btn btn-sm btn-outline" onclick="moveItem('${arrName}', ${idx}, 1)" ${idx === arr.length - 1 ? 'disabled' : ''} style="padding:4px 8px; font-size:0.8rem;">&darr;</button>
                <button class="delete-btn" onclick="deleteItem('${arrName}', ${idx})" style="position:static; margin-left:5px;">&times;</button>
            </div>
            
            ${fields.map(k => `
            <div class="form-group"><label>${k}</label>
                ${k.toLowerCase().includes('url') ?
            `<input value="${item[k] || ''}" onchange="siteData.${arrName}[${idx}].${k}=this.value"><div class="file-upload-group"><input type="file" onchange="handleUpload(this, u=>{siteData.${arrName}[${idx}].${k}=u;renderAdminForms();})"><span class="upload-status"></span></div>` :
            (k === 'desc' || k === 'details' ? `<textarea onchange="siteData.${arrName}[${idx}].${k}=this.value">${item[k] || ''}</textarea>` : `<input value="${item[k] || ''}" onchange="siteData.${arrName}[${idx}].${k}=this.value">`)
        }
            </div>`).join('')}
        </div>
    `).join('') + `<button class="btn btn-primary btn-sm" onclick="addItem('${arrName}')">+ Item</button>`;
    el.innerHTML = html;
}

window.deleteItem = (arrName, idx) => { siteData[arrName].splice(idx, 1); renderAdminForms(); renderAll(); };
window.addItem = (arrName) => { siteData[arrName].push({}); renderAdminForms(); };
window.moveItem = (arrName, idx, direction) => {
    const arr = siteData[arrName];
    if (idx + direction < 0 || idx + direction >= arr.length) return;
    const temp = arr[idx];
    arr[idx] = arr[idx + direction];
    arr[idx + direction] = temp;
    renderAdminForms();
    renderAll();
};

function setupScrollReveal() {
    const observer = new IntersectionObserver(e => e.forEach(o => { if (o.isIntersecting) o.target.classList.add('show-section') }), { threshold: 0.1 });
    document.querySelectorAll('.hidden-section').forEach(el => observer.observe(el));
}

function setupTimelineAnimation() {
    const timelines = document.querySelectorAll('.timeline');
    timelines.forEach(timeline => {
        // Inject lines if not present
        if (!timeline.querySelector('.timeline-line')) {
            const line = document.createElement('div');
            line.className = 'timeline-line';
            timeline.prepend(line);
        }
        if (!timeline.querySelector('.timeline-progress')) {
            const progress = document.createElement('div');
            progress.className = 'timeline-progress';
            timeline.prepend(progress);
        }

        const progressLine = timeline.querySelector('.timeline-progress');
        const cards = timeline.querySelectorAll('.exp-card, .edu-timeline-card');

        // Scroll Listener for Line Height
        const updateProgress = () => {
            const rect = timeline.getBoundingClientRect();
            const windowHeight = window.innerHeight;

            // Start filling when top of timeline hits middle of screen
            const startOffset = windowHeight * 0.5;

            if (rect.top < startOffset) {
                let height = startOffset - rect.top;
                // Cap at 100%
                if (height > rect.height) height = rect.height;
                if (height < 0) height = 0;
                progressLine.style.height = `${height}px`;
            } else {
                progressLine.style.height = '0px';
            }
        };

        window.addEventListener('scroll', updateProgress);
        updateProgress(); // Initial check

        // Intersection Observer for Dots
        const dotObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                } else {
                    // Optional: Remove active class when scrolling back up? 
                    // Let's keep it active for a "filled" look, or remove it for dynamic feel.
                    // User asked for "glow on scrolling", implying dynamic.
                    const rect = entry.target.getBoundingClientRect();
                    if (rect.top > window.innerHeight * 0.6) {
                        entry.target.classList.remove('active');
                    }
                }
            });
        }, { threshold: 0.5, rootMargin: "0px 0px -20% 0px" });

        cards.forEach(card => dotObserver.observe(card));
    });
}

function showFatalError() {
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        loader.innerHTML = `
            <div style="text-align:center; color:#ef4444;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; margin-bottom:1rem;"></i>
                <h2 style="font-size:1.5rem; margin-bottom:0.5rem;">System Error</h2>
                <p>Failed to load portfolio data.</p>
                <button onclick="location.reload()" class="btn btn-outline" style="margin-top:1rem; color: inherit; border-color: currentColor;">Retry</button>
            </div>
        `;
    }
}

// Boot
init();