/**
 * EVENTORA - 3D WebGL Engine (Three.js - Light Mode Luxury Edition)
 * 1. Subtle Ambient Floating Particles
 * 2. Interactive 3D Event Stage & Venue Simulator with Polished Titanium Platform
 */

window.Eventora3D = {
    bgScene: null,
    bgCamera: null,
    bgRenderer: null,
    bgParticles: null,
    mouseX: 0,
    mouseY: 0,

    venueScene: null,
    venueCamera: null,
    venueRenderer: null,
    stageGroup: null,
    spotlightLeft: null,
    spotlightRight: null,
    ambientLight: null,
    isRotatingVenue: true,
    isDraggingVenue: false,
    prevMouseX: 0,

    init() {
        if (typeof THREE === 'undefined') {
            console.warn('Three.js not loaded, skipping 3D initialization.');
            return;
        }

        this.initBackgroundConstellation();
        this.initVenueVisualizer();
        this.setupEventListeners();
    },

    // --- 1. AMBIENT LIGHT MODE BACKGROUND CONSTELLATION ---
    initBackgroundConstellation() {
        const canvas = document.getElementById('bgCanvas');
        if (!canvas) return;

        const w = window.innerWidth;
        const h = window.innerHeight;

        this.bgScene = new THREE.Scene();
        this.bgCamera = new THREE.PerspectiveCamera(60, w / h, 1, 2000);
        this.bgCamera.position.z = 800;

        this.bgRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        this.bgRenderer.setSize(w, h);
        this.bgRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const particleCount = 450;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        const colorIndigo = new THREE.Color('#4f46e5');
        const colorCyan = new THREE.Color('#0284c7');
        const colorAmber = new THREE.Color('#d97706');

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 1600;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 1200;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 1200;

            const chosenColor = Math.random() > 0.5 ? colorCyan : Math.random() > 0.3 ? colorIndigo : colorAmber;
            colors[i * 3] = chosenColor.r;
            colors[i * 3 + 1] = chosenColor.g;
            colors[i * 3 + 2] = chosenColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 4,
            vertexColors: true,
            transparent: true,
            opacity: 0.45
        });

        this.bgParticles = new THREE.Points(geometry, material);
        this.bgScene.add(this.bgParticles);

        this.animateBackground();
    },

    animateBackground() {
        requestAnimationFrame(() => this.animateBackground());

        if (this.bgParticles) {
            this.bgParticles.rotation.y += 0.0004;
            this.bgParticles.rotation.x += 0.0002;

            this.bgCamera.position.x += (this.mouseX * 0.15 - this.bgCamera.position.x) * 0.03;
            this.bgCamera.position.y += (-this.mouseY * 0.15 - this.bgCamera.position.y) * 0.03;
            this.bgCamera.lookAt(this.bgScene.position);
        }

        if (this.bgRenderer && this.bgScene && this.bgCamera) {
            this.bgRenderer.render(this.bgScene, this.bgCamera);
        }
    },

    // --- 2. INTERACTIVE 3D EVENT STAGE VISUALIZER ---
    initVenueVisualizer() {
        const canvas = document.getElementById('venue3dCanvas');
        if (!canvas) return;

        const container = canvas.parentElement;
        const w = container.clientWidth || 800;
        const h = container.clientHeight || 420;

        this.venueScene = new THREE.Scene();
        this.venueCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        this.venueCamera.position.set(0, 32, 75);
        this.venueCamera.lookAt(0, 6, 0);

        this.venueRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        this.venueRenderer.setSize(w, h);
        this.venueRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.venueRenderer.shadowMap.enabled = true;
        this.venueRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.stageGroup = new THREE.Group();
        this.venueScene.add(this.stageGroup);

        // Polished White Titanium / Marble Stage Platform
        const floorGeo = new THREE.CylinderGeometry(28, 30, 2.5, 48);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.2,
            metalness: 0.8
        });
        const stageFloor = new THREE.Mesh(floorGeo, floorMat);
        stageFloor.position.y = 0;
        stageFloor.receiveShadow = true;
        this.stageGroup.add(stageFloor);

        // Stage Edge Glow Ring
        const ringGeo = new THREE.TorusGeometry(29, 0.45, 16, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
        const stageRing = new THREE.Mesh(ringGeo, ringMat);
        stageRing.rotation.x = Math.PI / 2;
        stageRing.position.y = 1.3;
        this.stageGroup.add(stageRing);

        // Curved LED Backdrop Screen
        const screenGeo = new THREE.CylinderGeometry(20, 20, 16, 32, 1, true, -Math.PI / 3, (2 * Math.PI) / 3);
        const screenMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            emissive: 0x1e1b4b,
            emissiveIntensity: 0.8,
            side: THREE.DoubleSide
        });
        const screenMesh = new THREE.Mesh(screenGeo, screenMat);
        screenMesh.position.set(0, 9, -5);
        this.stageGroup.add(screenMesh);

        // DJ / Keynote Console
        const consoleGeo = new THREE.BoxGeometry(9, 4, 3);
        const consoleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });
        const consoleMesh = new THREE.Mesh(consoleGeo, consoleMat);
        consoleMesh.position.set(0, 3.2, 4);
        this.stageGroup.add(consoleMesh);

        // Console Accent Strip
        const barGeo = new THREE.BoxGeometry(9.2, 0.35, 0.4);
        const barMat = new THREE.MeshBasicMaterial({ color: 0x4f46e5 });
        const barMesh = new THREE.Mesh(barGeo, barMat);
        barMesh.position.set(0, 5.2, 5.5);
        this.stageGroup.add(barMesh);

        // Audio Trusses & Speakers
        const trussMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });
        [-16, 16].forEach(xPos => {
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 20, 12), trussMat);
            pillar.position.set(xPos, 10, -2);
            this.stageGroup.add(pillar);

            const speakerBox = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 2.5), consoleMat);
            speakerBox.position.set(xPos, 12, -1);
            this.stageGroup.add(speakerBox);
        });

        // Floating Seating Nodes (Orbs)
        const seatGeo = new THREE.SphereGeometry(0.8, 16, 16);
        for (let row = 0; row < 3; row++) {
            const count = 7 + row * 2;
            const radius = 24 + row * 4;
            for (let i = 0; i < count; i++) {
                const angle = -Math.PI / 4 + (i / (count - 1)) * (Math.PI / 2);
                const seatMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, wireframe: true });
                const seat = new THREE.Mesh(seatGeo, seatMat);
                seat.position.set(Math.sin(angle) * radius, 1 + row * 0.8, Math.cos(angle) * radius);
                this.stageGroup.add(seat);
            }
        }

        // Lighting
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.venueScene.add(this.ambientLight);

        this.spotlightLeft = new THREE.SpotLight(0x4f46e5, 4, 100, Math.PI / 6, 0.4);
        this.spotlightLeft.position.set(-25, 30, 20);
        this.spotlightLeft.target = consoleMesh;
        this.venueScene.add(this.spotlightLeft);

        this.spotlightRight = new THREE.SpotLight(0x0284c7, 4, 100, Math.PI / 6, 0.4);
        this.spotlightRight.position.set(25, 30, 20);
        this.spotlightRight.target = consoleMesh;
        this.venueScene.add(this.spotlightRight);

        // Drag to rotate
        canvas.addEventListener('mousedown', (e) => {
            this.isDraggingVenue = true;
            this.prevMouseX = e.clientX;
        });

        window.addEventListener('mouseup', () => {
            this.isDraggingVenue = false;
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDraggingVenue && this.stageGroup) {
                const deltaX = e.clientX - this.prevMouseX;
                this.stageGroup.rotation.y += deltaX * 0.008;
                this.prevMouseX = e.clientX;
            }
        });

        this.animateVenue();
    },

    animateVenue() {
        requestAnimationFrame(() => this.animateVenue());

        if (this.stageGroup && this.isRotatingVenue && !this.isDraggingVenue) {
            this.stageGroup.rotation.y += 0.0035;
        }

        const time = Date.now() * 0.002;
        if (this.spotlightLeft) {
            this.spotlightLeft.position.x = -25 + Math.sin(time) * 8;
        }
        if (this.spotlightRight) {
            this.spotlightRight.position.x = 25 - Math.cos(time) * 8;
        }

        if (this.venueRenderer && this.venueScene && this.venueCamera) {
            this.venueRenderer.render(this.venueScene, this.venueCamera);
        }
    },

    setLightingMood(mood) {
        if (!this.spotlightLeft || !this.spotlightRight) return;

        const moods = {
            gala: { left: 0xd97706, right: 0xf59e0b, ambient: 0xffedd5 },
            cyber: { left: 0x4f46e5, right: 0x0284c7, ambient: 0xe0e7ff },
            sunset: { left: 0xe11d48, right: 0xf97316, ambient: 0xffe4e6 },
            emerald: { left: 0x059669, right: 0x10b981, ambient: 0xd1fae5 }
        };

        const config = moods[mood] || moods.cyber;
        this.spotlightLeft.color.setHex(config.left);
        this.spotlightRight.color.setHex(config.right);
        this.ambientLight.color.setHex(config.ambient);

        document.querySelectorAll('.mood-chip').forEach(c => {
            c.classList.toggle('active', c.dataset.mood === mood);
        });

        if (window.InteractiveFx) window.InteractiveFx.playSynth('mode');
    },

    toggleRotation() {
        this.isRotatingVenue = !this.isRotatingVenue;
        const btn = document.getElementById('btnToggleRotation');
        if (btn) btn.innerText = this.isRotatingVenue ? '⏸ Pause Orbit' : '▶ Resume Orbit';
        if (window.InteractiveFx) window.InteractiveFx.playSynth('click');
    },

    resetVenueCamera() {
        if (this.stageGroup) {
            this.stageGroup.rotation.set(0, 0, 0);
        }
        if (this.venueCamera) {
            this.venueCamera.position.set(0, 32, 75);
            this.venueCamera.lookAt(0, 6, 0);
        }
        if (window.InteractiveFx) window.InteractiveFx.playSynth('click');
    },

    setupEventListeners() {
        window.addEventListener('mousemove', (e) => {
            this.mouseX = (e.clientX - window.innerWidth / 2);
            this.mouseY = (e.clientY - window.innerHeight / 2);
        });

        window.addEventListener('resize', () => {
            if (this.bgRenderer && this.bgCamera) {
                const w = window.innerWidth;
                const h = window.innerHeight;
                this.bgCamera.aspect = w / h;
                this.bgCamera.updateProjectionMatrix();
                this.bgRenderer.setSize(w, h);
            }

            const canvas = document.getElementById('venue3dCanvas');
            if (canvas && this.venueRenderer && this.venueCamera) {
                const container = canvas.parentElement;
                const cw = container.clientWidth;
                const ch = container.clientHeight;
                this.venueCamera.aspect = cw / ch;
                this.venueCamera.updateProjectionMatrix();
                this.venueRenderer.setSize(cw, ch);
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Eventora3D.init();
});
