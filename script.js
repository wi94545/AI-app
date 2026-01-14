// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAtVBXMuI2MT0Ihl88OUHCrzILUATZYbNc",
    authDomain: "wheel-panel.firebaseapp.com",
    projectId: "wheel-panel",
    storageBucket: "wheel-panel.firebasestorage.app",
    messagingSenderId: "62274199040",
    appId: "1:62274199040:web:ad020ea8e8f5624168c2e5",
    measurementId: "G-8B7HMB39SB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const itemInput = document.getElementById('itemInput');
const addItemBtn = document.getElementById('addItemBtn');
const itemsList = document.getElementById('itemsList');
const itemCountSpan = document.getElementById('itemCount');
const winnerModal = document.getElementById('winnerModal');
const winnerText = document.getElementById('winnerText');
const closeModalBtn = document.getElementById('closeModalBtn');

// State
let items = []; // Start empty, will sync from DB
let colors = [];
let currentUser = null;

// Wheel Config
let startAngle = 0;
let arc = Math.PI / (items.length / 2);
let spinTimeout = null;
let spinAngleStart = 10;
let spinTime = 0;
let spinTimeTotal = 0;
let isSpinning = false;

// Initialize
async function init() {
    try {
        console.log("Signing in anonymously...");
        const userCredential = await signInAnonymously(auth);
        currentUser = userCredential.user;
        console.log("Signed in as:", currentUser.uid);

        // Start listening to the database
        subscribeToData();

        addListeners();
    } catch (error) {
        console.error("Auth Error:", error);
    }
}

function subscribeToData() {
    if (!currentUser) return;

    // Listen to document 'users/{uid}'
    const userDocRef = doc(db, "users", currentUser.uid);

    onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            items = data.items || [];
            console.log("Data loaded:", items);
        } else {
            console.log("No existing data, starting fresh.");
            items = []; // New user starts with empty list
        }

        // Update UI whenever data changes
        generateColors();
        drawWheel();
        renderList();
    });
}

async function saveItemsToCloud() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            items: items,
            updatedAt: new Date()
        });
    } catch (e) {
        console.error("Error saving items:", e);
    }
}

function generateColors() {
    // Generate a beautiful palette based on item count
    colors = items.map((_, i) => {
        const hue = i * (360 / items.length);
        return `hsl(${hue}, 70%, 60%)`;
    });
}

function drawWheel() {
    if (items.length === 0) {
        ctx.clearRect(0, 0, 500, 500);
        return;
    }

    const outsideRadius = 240;
    const textRadius = 160;
    const insideRadius = 0;

    ctx.clearRect(0, 0, 500, 500);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    arc = Math.PI * 2 / items.length;

    for (let i = 0; i < items.length; i++) {
        const angle = startAngle + i * arc;

        // Draw Segment
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.arc(250, 250, outsideRadius, angle, angle + arc, false);
        ctx.arc(250, 250, insideRadius, angle + arc, angle, true);
        ctx.stroke();
        ctx.fill();

        // Draw Text
        ctx.save();
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;

        ctx.translate(250 + Math.cos(angle + arc / 2) * textRadius,
            250 + Math.sin(angle + arc / 2) * textRadius);
        ctx.rotate(angle + arc / 2 + Math.PI / 2);

        const text = items[i];
        ctx.font = 'bold 16px Outfit, sans-serif';
        const metrics = ctx.measureText(text);
        // Truncate text if too long
        if (metrics.width > 100) {
            ctx.fillText(text.substring(0, 8) + '...', -40, 0);
        } else {
            ctx.fillText(text, -metrics.width / 2, 0);
        }
        ctx.restore();
    }
}

function spin() {
    if (isSpinning || items.length === 0) return;
    isSpinning = true;
    spinBtn.disabled = true;
    spinTime = 0;
    spinTimeTotal = (Math.random() * 3000) + 4000;
    spinAngleStart = Math.random() * 10 + 10;
    rotateWheel();
}

function rotateWheel() {
    spinTime += 30;
    if (spinTime >= spinTimeTotal) {
        stopRotateWheel();
        return;
    }
    const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
    startAngle += (spinAngle * Math.PI / 180);
    drawWheel();
    spinTimeout = requestAnimationFrame(rotateWheel);
}

function stopRotateWheel() {
    isSpinning = false;
    spinBtn.disabled = false;
    cancelAnimationFrame(spinTimeout);

    // Normalize angle to find winner
    const degrees = startAngle * 180 / Math.PI + 90;
    const arcd = arc * 180 / Math.PI;
    const index = Math.floor((360 - degrees % 360) / arcd);

    showWinner(items[index]);
}

function easeOut(t, b, c, d) {
    t /= d;
    t--;
    return c * (t * t * t * t - 1) + b;
}

function showWinner(text) {
    winnerText.textContent = text;
    winnerModal.classList.remove('hidden');
    setTimeout(() => winnerModal.classList.add('show'), 10);
}

function renderList() {
    itemsList.innerHTML = '';
    itemCountSpan.textContent = `(${items.length})`;

    items.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'item';
        li.innerHTML = `
            <span>${item}</span>
            <button class="delete-btn" data-index="${index}">&times;</button>
        `;
        itemsList.appendChild(li);
    });

    // Re-attach delete listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            removeItem(idx);
        });
    });
}

// Actions now just update Cloud, UI updates via listener
function addItem() {
    const val = itemInput.value.trim();
    if (val) {
        items.push(val);
        itemInput.value = '';
        saveItemsToCloud(); // Save to Firebase
    }
}

function removeItem(index) {
    if (isSpinning) return;
    items.splice(index, 1);
    saveItemsToCloud(); // Save to Firebase
}

function addListeners() {
    spinBtn.addEventListener('click', spin);
    addItemBtn.addEventListener('click', addItem);
    itemInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem();
    });
    closeModalBtn.addEventListener('click', () => {
        winnerModal.classList.remove('show');
        setTimeout(() => winnerModal.classList.add('hidden'), 300);
    });
}

// Start
init();
