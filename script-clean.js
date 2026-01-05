// AMBI360 - Versão com LocalStorage
const ADMIN_PASSWORD = 'admin123';

let projects = {};
let viewer = null;
let previewViewer = null;
let hotspots = [];
let addingHotspot = false;
let currentParentId = null;
let previewCurrentImage = null;
let previewRootImage = null;
let editingProjectName = null;
let isAdminViewing = false;
let currentScene = 'main';
let projectHotspots = [];

function loadProjects() {
    const saved = localStorage.getItem('ambi360_projects');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.warn('Erro ao carregar projetos');
        }
    }
    return {};
}

function saveProjects() {
    localStorage.setItem('ambi360_projects', JSON.stringify(projects));
}

document.addEventListener('DOMContentLoaded', function() {
    projects = loadProjects();
    setupEventListeners();
    loadTheme();
});

function setupEventListeners() {
    const adminForm = document.getElementById('adminForm');
    if (adminForm) {
        adminForm.addEventListener('submit', handleAdminLogin);
    }

    const logoUpload = document.getElementById('logoUpload');
    if (logoUpload) {
        logoUpload.addEventListener('change', handleLogoUpload);
    }
    
    const imageUpload = document.getElementById('imageUpload');
    if (imageUpload) {
        imageUpload.addEventListener('change', handleImageUpload);
    }

    const addHotspotBtn = document.getElementById('addHotspotBtn');
    if (addHotspotBtn) {
        addHotspotBtn.addEventListener('click', () => setAddHotspotMode(true));
    }
    
    const removeHotspotBtn = document.getElementById('removeHotspotBtn');
    if (removeHotspotBtn) {
        removeHotspotBtn.addEventListener('click', removeAllHotspots);
    }

    const createProjectForm = document.getElementById('createProjectForm');
    if (createProjectForm) {
        createProjectForm.addEventListener('submit', handleCreateProject);
    }

    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', logout);
    }
}

function handleAdminLogin(e) {
    e.preventDefault();
    
    const passwordInput = document.getElementById('adminPassword');
    if (!passwordInput) {
        showError('Campo de senha não encontrado');
        return;
    }
    
    const password = passwordInput.value;
    
    if (password === ADMIN_PASSWORD) {
        hideError();
        showAdminPanel();
    } else {
        showError('Senha incorreta');
    }
}

function showAdminPanel() {
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    showSection('projects');
    updateProjectsGrid();
}

function updateProjectsGrid() {
    const grid = document.getElementById('projectsGrid');
    const emptyState = document.getElementById('emptyState');
    grid.innerHTML = '';
    
    const projectEntries = Object.entries(projects);
    
    if (projectEntries.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    projectEntries.forEach(([name, project]) => {
        const card = createProjectCard(name, project);
        grid.appendChild(card);
    });
}

function createProjectCard(name, project) {
    const createdDate = new Date(project.createdAt).toLocaleDateString('pt-BR');
    const hotspotCount = project.hotspots ? project.hotspots.length : 0;
    
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
        <div class="project-thumbnail">
            <img src="${project.image}" alt="${project.title}">
        </div>
        <div class="project-info">
            <div class="project-name">${project.title}</div>
            <div class="project-meta">Tour Virtual 360° • ${createdDate} • ${hotspotCount} pontos</div>
            <div class="project-actions">
                <button class="btn-sm btn-view" onclick="previewProject('${name}')">👁️ Ver</button>
                <button class="btn-sm btn-edit" onclick="editProject('${name}')">✏️ Editar</button>
                <button class="btn-sm btn-delete" onclick="deleteProject('${name}')">🗑️ Excluir</button>
            </div>
        </div>
    `;
    return card;
}

function handleCreateProject(e) {
    e.preventDefault();
    
    const nameRaw = document.getElementById('newProjectName').value.trim();
    const name = slugify(nameRaw);
    const title = document.getElementById('newProjectTitle').value.trim();
    const imageFile = document.getElementById('imageUpload').files[0];
    const logoFile = document.getElementById('logoUpload').files[0];

    if (!name) return showToast('Informe um nome de projeto.', 'warning');
    if (!title) return showToast('Informe um título.', 'warning');
    if (!imageFile && !editingProjectName) return showToast('Selecione uma imagem 360°.', 'warning');
    if (projects[name] && !editingProjectName) return showToast('Projeto já existe!', 'danger');

    if (editingProjectName && !imageFile) {
        updateExistingProject(name, title, logoFile);
    } else {
        createNewProject(name, title, imageFile, logoFile);
    }
}

function createNewProject(name, title, imageFile, logoFile) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const projectData = {
            image: e.target.result,
            title: title,
            hotspots: [...hotspots],
            createdAt: editingProjectName ? projects[editingProjectName].createdAt : new Date().toISOString(),
            logo: null
        };
        
        if (logoFile) {
            const logoReader = new FileReader();
            logoReader.onload = function(logoEvent) {
                projectData.logo = logoEvent.target.result;
                saveProject(name, projectData);
            };
            logoReader.readAsDataURL(logoFile);
        } else {
            saveProject(name, projectData);
        }
    };
    reader.readAsDataURL(imageFile);
}

function updateExistingProject(name, title, logoFile) {
    const existingProject = projects[editingProjectName];
    if (!existingProject) return;
    
    if (editingProjectName !== name) {
        delete projects[editingProjectName];
    }
    
    const projectData = {
        image: existingProject.image,
        title: title,
        hotspots: [...hotspots],
        logo: existingProject.logo || null,
        createdAt: existingProject.createdAt
    };
    
    if (logoFile) {
        const logoReader = new FileReader();
        logoReader.onload = function(e) {
            projectData.logo = e.target.result;
            saveProject(name, projectData);
        };
        logoReader.readAsDataURL(logoFile);
    } else {
        saveProject(name, projectData);
    }
}

function saveProject(name, projectData) {
    projects[name] = projectData;
    saveProjects();
    
    const message = editingProjectName ? 'Projeto atualizado!' : 'Projeto criado!';
    showToast(message, 'success');
    
    resetCreateForm();
    showSection('projects');
    updateProjectsGrid();
}

function previewProject(name) {
    isAdminViewing = true;
    showViewer(name);
}

function showViewer(projectName) {
    const project = projects[projectName];
    
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('viewerContainer').classList.remove('hidden');
    document.getElementById('projectTitle').textContent = project.title;
    
    const projectLogo = document.getElementById('projectLogo');
    if (project.logo) {
        projectLogo.src = project.logo;
        projectLogo.style.display = 'block';
    } else {
        projectLogo.style.display = 'none';
    }
    
    projectHotspots = project.hotspots || [];
    currentScene = 'main';
    
    initializeViewer(project);
}

function initializeViewer(project) {
    if (viewer) {
        viewer.destroy();
        viewer = null;
    }

    try {
        if (projectHotspots.length > 0) {
            const scenes = createScenesConfig(project.image, projectHotspots);
            viewer = pannellum.viewer('panorama', {
                default: {
                    firstScene: 'main',
                    autoLoad: true,
                    autoRotate: -2,
                    compass: true,
                    showZoomCtrl: true,
                    showFullscreenCtrl: true
                },
                scenes: scenes
            });
            
            viewer.on('scenechange', handleSceneChange);
        } else {
            viewer = pannellum.viewer('panorama', {
                type: 'equirectangular',
                panorama: project.image,
                autoLoad: true,
                autoRotate: -2,
                compass: true,
                showZoomCtrl: true,
                showFullscreenCtrl: true,
                hotSpots: createMainSceneHotspots(project.hotspots || [])
            });
        }
        
        viewer.on('load', updateNavigation);
        
    } catch (e) {
        console.error('Erro ao iniciar viewer:', e);
        showToast('Não foi possível carregar o panorama.', 'danger');
    }
}

function createMainSceneHotspots(hotspotsArray) {
    if (!hotspotsArray || hotspotsArray.length === 0) return [];
    
    return hotspotsArray.map(hotspot => ({
        id: hotspot.id,
        pitch: hotspot.pitch,
        yaw: hotspot.yaw,
        type: 'info',
        text: hotspot.text || hotspot.name || 'Ponto',
        cssClass: getHotspotClass(hotspot.type, hotspot.typeImage)
    }));
}

function getHotspotClass(type, typeImage) {
    if (type === 'door') {
        return typeImage === 'porta 2.png' ? 'hotspot-door porta-2' : 'hotspot-door porta-1';
    } else {
        return typeImage === 'normal 2.png' ? 'hotspot-nav normal-2' : 'hotspot-nav normal-1';
    }
}

function createScenesConfig(mainImage, hotspotsArray) {
    const scenes = { 
        main: { 
            type: 'equirectangular', 
            panorama: mainImage, 
            hotSpots: [] 
        } 
    };
    
    const rootHotspots = hotspotsArray.filter(h => !h.parentId);
    
    rootHotspots.forEach(hotspot => {
        scenes.main.hotSpots.push({
            id: hotspot.id,
            pitch: hotspot.pitch,
            yaw: hotspot.yaw,
            type: hotspot.targetImage ? 'scene' : 'info',
            text: hotspot.text || hotspot.name || 'Ponto',
            sceneId: hotspot.targetImage ? 'scene_' + hotspot.id : undefined,
            cssClass: getHotspotClass(hotspot.type, hotspot.typeImage)
        });
        
        if (hotspot.targetImage) {
            const sceneId = 'scene_' + hotspot.id;
            const hotSpots = [];
            
            hotSpots.push({
                id: `back_${sceneId}`,
                pitch: -10,
                yaw: 180,
                type: 'scene',
                text: 'Voltar',
                sceneId: 'main',
                cssClass: 'hotspot-back'
            });
            
            const childHotspots = hotspotsArray.filter(child => child.parentId === hotspot.id);
            childHotspots.forEach(child => {
                hotSpots.push({
                    id: child.id,
                    pitch: child.pitch,
                    yaw: child.yaw,
                    type: child.targetImage ? 'scene' : 'info',
                    text: child.text || child.name || 'Ponto',
                    sceneId: child.targetImage ? 'scene_' + child.id : undefined,
                    cssClass: getHotspotClass(child.type, child.typeImage)
                });
            });
            
            scenes[sceneId] = {
                type: 'equirectangular',
                panorama: hotspot.targetImage,
                hotSpots: hotSpots
            };
        }
    });
    
    return scenes;
}

function updateNavigation() {
    const navRooms = document.getElementById('navRooms');
    if (!navRooms) return;
    
    navRooms.innerHTML = '';
    
    const mainBtn = document.createElement('button');
    mainBtn.className = 'nav-room active';
    mainBtn.textContent = 'Cena Principal';
    navRooms.appendChild(mainBtn);
    
    const mainHotspots = projectHotspots.filter(h => !h.parentId && h.targetImage);
    
    mainHotspots.forEach((hotspot) => {
        const btn = document.createElement('button');
        btn.className = 'nav-room';
        btn.textContent = hotspot.text || hotspot.name || 'Ponto';
        btn.onclick = () => {
            if (viewer) viewer.loadScene('scene_' + hotspot.id);
        };
        navRooms.appendChild(btn);
    });
}

function handleSceneChange(sceneId) {
    currentScene = sceneId;
    
    const navButtons = document.querySelectorAll('.nav-room');
    navButtons.forEach(btn => btn.classList.remove('active'));
    
    if (sceneId === 'main') {
        navButtons[0]?.classList.add('active');
    } else {
        const hotspotId = sceneId.replace('scene_', '');
        const hotspot = projectHotspots.find(h => h.id === hotspotId);
        if (hotspot) {
            const targetBtn = Array.from(navButtons).find(btn => 
                btn.textContent === (hotspot.text || hotspot.name || 'Ponto')
            );
            targetBtn?.classList.add('active');
        }
    }
}

function editProject(name) {
    const project = projects[name];
    if (!project) return;
    
    editingProjectName = name;
    
    document.getElementById('newProjectName').value = name;
    document.getElementById('newProjectTitle').value = project.title;
    
    if (project.logo) {
        showExistingLogo(project.logo);
    }
    
    if (project.image) {
        showImagePreview(project.image);
        hotspots = project.hotspots ? [...project.hotspots] : [];
        setTimeout(() => updateHotspotsList(), 1000);
    }
    
    document.getElementById('pageTitle').textContent = 'Editar Projeto';
    document.getElementById('pageSubtitle').textContent = 'Modifique as configurações do projeto.';
    document.getElementById('submitProjectBtn').textContent = 'Salvar Alterações';
    
    showSection('create');
}

function deleteProject(name) {
    if (confirm(`Excluir projeto "${projects[name].title}"?`)) {
        delete projects[name];
        saveProjects();
        updateProjectsGrid();
        showToast('Projeto excluído.', 'success');
    }
}

function showSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.getElementById('projectsSection').classList.add('hidden');
    document.getElementById('createSection').classList.add('hidden');
    
    if (section === 'projects') {
        document.getElementById('projectsSection').classList.remove('hidden');
        document.getElementById('pageTitle').textContent = 'Projetos';
        document.getElementById('pageSubtitle').textContent = 'Aqui você faz a gestão de seus projetos.';
        document.querySelectorAll('.nav-item')[0].classList.add('active');
        resetCreateForm();
    } else if (section === 'create') {
        document.getElementById('createSection').classList.remove('hidden');
        updateCreateSectionTitle();
        document.querySelectorAll('.nav-item')[1].classList.add('active');
    }
}

function updateCreateSectionTitle() {
    if (!editingProjectName) {
        document.getElementById('pageTitle').textContent = 'Criar Projeto';
        document.getElementById('pageSubtitle').textContent = 'Configure um novo projeto 360°.';
        document.getElementById('submitProjectBtn').textContent = 'Criar Projeto';
    }
}

function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('logoPreview');
        const uploadText = document.getElementById('logoUploadText');
        
        preview.innerHTML = `
            <img src="${e.target.result}" alt="Logo preview">
            <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">Logo selecionada: ${file.name}</div>
            <button type="button" class="btn-danger" style="margin-top: 8px; padding: 4px 8px; font-size: 12px;" onclick="removeLogo()">Remover Logo</button>
        `;
        preview.classList.remove('hidden');
        uploadText.innerHTML = '✅ Logo selecionada';
    };
    reader.readAsDataURL(file);
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            showImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
    } else {
        hideImagePreview();
    }
}

function showImagePreview(imageSrc) {
    document.getElementById('imagePreview').classList.remove('hidden');
    currentParentId = null;
    previewCurrentImage = imageSrc;
    previewRootImage = imageSrc;

    if (previewViewer) {
        previewViewer.destroy();
    }

    setTimeout(() => {
        previewViewer = pannellum.viewer('previewPanorama', {
            type: 'equirectangular',
            panorama: previewCurrentImage,
            autoLoad: true,
            showZoomCtrl: false,
            showFullscreenCtrl: false
        });
        
        previewViewer.on('load', function() {
            setupHotspotClick();
            updateHotspotsList();
        });
    }, 100);
}

function hideImagePreview() {
    document.getElementById('imagePreview').classList.add('hidden');
    if (previewViewer) {
        previewViewer.destroy();
        previewViewer = null;
    }
    hotspots = [];
    addingHotspot = false;
}

function setupHotspotClick() {
    const panoramaDiv = document.getElementById('previewPanorama');
    if (!panoramaDiv) return;
    
    const onClickPreview = (event) => {
        if (!addingHotspot) return;
        event.preventDefault();
        event.stopPropagation();
        
        let coords = null;
        try { 
            coords = previewViewer.mouseEventToCoords(event); 
        } catch (_) {}
        
        const pitch = coords ? coords[0] : previewViewer.getPitch();
        const yaw = coords ? coords[1] : previewViewer.getYaw();
        
        addHotspot(pitch, yaw);
    };
    
    panoramaDiv.addEventListener('click', onClickPreview, true);
}

function addHotspot(pitch, yaw) {
    const hotspot = {
        id: 'hotspot_' + Date.now(),
        pitch: pitch,
        yaw: yaw,
        text: 'Ponto ' + (hotspots.length + 1),
        targetImage: '',
        parentId: currentParentId,
        type: 'normal',
        typeImage: 'normal 1.png'
    };
    
    hotspots.push(hotspot);
    addHotspotToViewer(hotspot);
    updateHotspotsList();
    setAddHotspotMode(false);
    showToast('Ponto adicionado!', 'success');
}

function addHotspotToViewer(hotspot) {
    if (previewViewer) {
        const hotspotConfig = {
            id: hotspot.id,
            pitch: hotspot.pitch,
            yaw: hotspot.yaw,
            type: 'info',
            text: hotspot.text,
            cssClass: 'hotspot-nav'
        };
        
        previewViewer.addHotSpot(hotspotConfig);
    }
}

function updateHotspotsList() {
    const list = document.getElementById('hotspotsList');
    list.innerHTML = '';

    const currentList = hotspots.filter(h => (h.parentId || null) === (currentParentId || null));

    if (currentParentId) {
        const backBtn = document.createElement('button');
        backBtn.textContent = '↩ Voltar';
        backBtn.className = 'btn-secondary';
        backBtn.style.marginBottom = '8px';
        backBtn.onclick = goBackToParent;
        list.appendChild(backBtn);
    }

    if (currentList.length === 0) {
        const p = document.createElement('p');
        p.style.color = '#6b7280';
        p.style.fontStyle = 'italic';
        p.textContent = 'Nenhum ponto adicionado nesta cena';
        list.appendChild(p);
        return;
    }

    currentList.forEach((hotspot, index) => {
        const item = createHotspotItem(hotspot, index);
        list.appendChild(item);
    });
}

function createHotspotItem(hotspot, index) {
    const item = document.createElement('div');
    item.className = 'hotspot-item';
    
    const hotspotType = hotspot.type || 'normal';
    
    item.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px;">Ponto ${index + 1}</div>
        <input type="text" class="hotspot-input" placeholder="Nome do ponto" value="${hotspot.text}" onchange="updateHotspotText('${hotspot.id}', this.value)">
        
        <div style="margin-bottom: 12px;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">Tipo do Ponto:</div>
            <div style="display: flex; gap: 8px;">
                <button type="button" class="btn-secondary ${hotspotType === 'normal' ? 'btn-primary' : ''}" onclick="changeHotspotType('${hotspot.id}', 'normal')" style="flex: 1; padding: 8px;">Normal</button>
                <button type="button" class="btn-secondary ${hotspotType === 'door' ? 'btn-primary' : ''}" onclick="changeHotspotType('${hotspot.id}', 'door')" style="flex: 1; padding: 8px;">Porta</button>
            </div>
        </div>
        
        <div style="margin-bottom: 12px;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">Ajustar Posição:</div>
            <div class="hotspot-grid">
                <div></div>
                <button class="hotspot-btn" onclick="moveHotspot('${hotspot.id}', 0, 5)">↑</button>
                <div></div>
                <button class="hotspot-btn" onclick="moveHotspot('${hotspot.id}', -5, 0)">←</button>
                <button class="hotspot-btn center" onclick="centerHotspot('${hotspot.id}')">Centro</button>
                <button class="hotspot-btn" onclick="moveHotspot('${hotspot.id}', 5, 0)">→</button>
                <div></div>
                <button class="hotspot-btn" onclick="moveHotspot('${hotspot.id}', 0, -5)">↓</button>
                <div></div>
            </div>
            <div style="font-size: 11px; color: #6b7280; margin-top: 6px; text-align: center;">Pitch: ${hotspot.pitch.toFixed(1)}° | Yaw: ${hotspot.yaw.toFixed(1)}°</div>
        </div>
        
        <input type="file" accept="image/*" onchange="updateHotspotImage('${hotspot.id}', this)" style="width: 100%; margin-bottom: 8px;">
        <small style="color: #6b7280; display: block; margin-bottom: 8px;">Selecione a imagem 360° para este ponto</small>
        
        <button class="${hotspot.targetImage ? 'btn-primary' : 'btn-secondary'}" onclick="${hotspot.targetImage ? `enterHotspot('${hotspot.id}')` : `testHotspot('${hotspot.id}')`}" style="width: 100%; margin-bottom: 8px;">
            ${hotspot.targetImage ? '🔍 Entrar no Ponto' : 'Testar Posição'}
        </button>
        
        <button class="btn-danger" onclick="removeHotspot('${hotspot.id}')" style="width: 100%;">Remover</button>
    `;
    
    return item;
}

function updateHotspotText(id, text) {
    const hotspot = hotspots.find(h => h.id === id);
    if (hotspot) {
        hotspot.text = text;
        if (previewViewer) {
            previewViewer.removeHotSpot(id);
            addHotspotToViewer(hotspot);
        }
    }
}

function changeHotspotType(id, type) {
    const hotspot = hotspots.find(h => h.id === id);
    if (hotspot) {
        hotspot.type = type;
        
        if (type === 'door') {
            hotspot.typeImage = hotspot.typeImage === 'porta 1.png' ? 'porta 2.png' : 'porta 1.png';
        } else {
            hotspot.typeImage = hotspot.typeImage === 'normal 1.png' ? 'normal 2.png' : 'normal 1.png';
        }
        
        if (previewViewer) {
            previewViewer.removeHotSpot(id);
            addHotspotToViewer(hotspot);
        }
        
        updateHotspotsList();
        const imageName = hotspot.typeImage.replace('.png', '').replace(' ', ' ');
        showToast(`Tipo alterado para ${type === 'door' ? 'Porta' : 'Normal'} (${imageName})!`, 'success');
    }
}

function moveHotspot(id, deltaYaw, deltaPitch) {
    const hotspot = hotspots.find(h => h.id === id);
    if (hotspot && previewViewer) {
        hotspot.yaw = ((hotspot.yaw + deltaYaw) % 360 + 360) % 360;
        hotspot.pitch = Math.max(-90, Math.min(90, hotspot.pitch + deltaPitch));
        previewViewer.removeHotSpot(id);
        addHotspotToViewer(hotspot);
        updateHotspotsList();
    }
}

function centerHotspot(id) {
    const hotspot = hotspots.find(h => h.id === id);
    if (hotspot && previewViewer) {
        hotspot.pitch = previewViewer.getPitch();
        hotspot.yaw = previewViewer.getYaw();
        previewViewer.removeHotSpot(id);
        addHotspotToViewer(hotspot);
        updateHotspotsList();
    }
}

function updateHotspotImage(id, input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const hotspot = hotspots.find(h => h.id === id);
            if (hotspot) {
                hotspot.targetImage = e.target.result;
                updateHotspotsList();
                showToast('Cena conectada!', 'success');
            }
        };
        reader.readAsDataURL(file);
    }
}

function enterHotspot(id) {
    const hotspot = hotspots.find(h => h.id === id);
    if (hotspot && hotspot.targetImage && previewViewer) {
        currentParentId = hotspot.id;
        previewCurrentImage = hotspot.targetImage;
        showImagePreview(previewCurrentImage);
        currentParentId = hotspot.id;
        updateHotspotsList();
    }
}

function testHotspot(id) {
    const hotspot = hotspots.find(h => h.id === id);
    if (hotspot && previewViewer) {
        previewViewer.lookAt(hotspot.pitch, hotspot.yaw, 75, 1000);
    }
}

function goBackToParent() {
    const parentHotspot = hotspots.find(h => h.id === currentParentId);
    const grandParentId = parentHotspot ? (parentHotspot.parentId || null) : null;
    currentParentId = grandParentId;
    
    if (grandParentId) {
        const gpHotspot = hotspots.find(h => h.id === grandParentId);
        if (gpHotspot && gpHotspot.targetImage) {
            previewCurrentImage = gpHotspot.targetImage;
            previewViewer.setPanorama(previewCurrentImage);
        }
    } else {
        previewCurrentImage = previewRootImage;
        showImagePreview(previewCurrentImage);
    }
    updateHotspotsList();
}

function removeHotspot(id) {
    hotspots = hotspots.filter(h => h.id !== id);
    if (previewViewer) {
        previewViewer.removeHotSpot(id);
    }
    updateHotspotsList();
}

function removeAllHotspots() {
    hotspots = [];
    updateHotspotsList();
    if (previewViewer) {
        previewViewer.removeAllHotSpots();
    }
}

function setAddHotspotMode(on) {
    const btn = document.getElementById('addHotspotBtn');
    addingHotspot = !!on;
    if (btn) {
        if (on) {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');
            btn.textContent = 'Clique na imagem';
        } else {
            btn.classList.add('btn-secondary');
            btn.classList.remove('btn-primary');
            btn.textContent = 'Adicionar Ponto';
        }
    }
}

function showExistingLogo(logoSrc) {
    const preview = document.getElementById('logoPreview');
    const uploadText = document.getElementById('logoUploadText');
    
    preview.innerHTML = `
        <img src="${logoSrc}" alt="Logo preview">
        <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">Logo atual do projeto</div>
        <button type="button" class="btn-danger" style="margin-top: 8px; padding: 4px 8px; font-size: 12px;" onclick="removeLogo()">Remover Logo</button>
    `;
    preview.classList.remove('hidden');
    uploadText.innerHTML = '✅ Logo carregada';
}

function removeLogo() {
    document.getElementById('logoUpload').value = '';
    document.getElementById('logoPreview').classList.add('hidden');
    document.getElementById('logoUploadText').innerHTML = '🖼️ Clique para selecionar uma logo';
}

function resetCreateForm() {
    editingProjectName = null;
    document.getElementById('createProjectForm').reset();
    hideImagePreview();
    removeLogo();
    hotspots = [];
    updateCreateSectionTitle();
}

function slugify(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    document.getElementById('errorMessage').classList.add('hidden');
}

function showToast(message, type = 'success') {
    const errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) return alert(message);
    
    errorDiv.textContent = message;
    errorDiv.className = `error ${type}`;
    errorDiv.classList.remove('hidden');
    
    setTimeout(() => {
        errorDiv.classList.add('hidden');
        errorDiv.className = 'error';
    }, 3000);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function showHelpModal() {
    document.getElementById('helpModal').classList.remove('hidden');
}

function closeHelpModal() {
    document.getElementById('helpModal').classList.add('hidden');
}

function toggleNavigation() {
    if (isAdminViewing) {
        if (viewer) {
            viewer.destroy();
            viewer = null;
        }
        document.getElementById('viewerContainer').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        isAdminViewing = false;
    } else {
        logout();
    }
}

function logout() {
    if (viewer) {
        viewer.destroy();
        viewer = null;
    }
    
    if (previewViewer) {
        previewViewer.destroy();
        previewViewer = null;
    }
    
    document.getElementById('viewerContainer').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('loginContainer').classList.remove('hidden');
    document.getElementById('adminForm').reset();
    hideError();
    resetCreateForm();
    isAdminViewing = false;
}

function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    }
    
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        const isDark = document.body.classList.contains('dark');
        btn.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
    }
}

// Funções de filtro e navegação
function toggleFilterDropdown() {
    const dropdown = document.getElementById('filterDropdown');
    dropdown.classList.toggle('hidden');
}

function sortProjects(type) {
    const projectEntries = Object.entries(projects);
    
    switch(type) {
        case 'newest':
            projectEntries.sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt));
            break;
        case 'oldest':
            projectEntries.sort((a, b) => new Date(a[1].createdAt) - new Date(b[1].createdAt));
            break;
        case 'alphabetical':
            projectEntries.sort((a, b) => a[1].title.localeCompare(b[1].title));
            break;
        case 'alphabetical-reverse':
            projectEntries.sort((a, b) => b[1].title.localeCompare(a[1].title));
            break;
    }
    
    const sortedProjects = {};
    projectEntries.forEach(([key, value]) => {
        sortedProjects[key] = value;
    });
    projects = sortedProjects;
    
    updateProjectsGrid();
    toggleFilterDropdown();
}

function filterNavigation(searchTerm) {
    const rooms = document.querySelectorAll('.nav-room');
    rooms.forEach(room => {
        const text = room.textContent.toLowerCase();
        const matches = text.includes(searchTerm.toLowerCase());
        room.style.display = matches ? 'block' : 'none';
    });
}

function shareCurrentView() {
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({
            title: 'AMBI360 - Tour Virtual',
            url: url
        });
    } else {
        navigator.clipboard.writeText(url).then(() => {
            showToast('Link copiado!', 'success');
        });
    }
}

function goBackToPreviousScene() {
    if (viewer && currentScene !== 'main') {
        viewer.loadScene('main');
    }
}