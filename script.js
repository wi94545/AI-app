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
const suggestionsList = document.getElementById('suggestionsList');
const addItemBtn = document.getElementById('addItemBtn');
const itemsList = document.getElementById('itemsList');
const itemCountSpan = document.getElementById('itemCount');
const winnerModal = document.getElementById('winnerModal');
const winnerText = document.getElementById('winnerText');
const closeModalBtn = document.getElementById('closeModalBtn');
const historyList = document.getElementById('historyList');
const categorySelect = document.getElementById('categorySelect'); // New
const dropdownToggle = document.getElementById('dropdownToggle');

// Constants & Defaults
const SUGGESTED_DRINKS = [
    "茶湯會", "鶴茶樓", "50嵐", "迷克夏",
    "八曜和茶", "理茶", "珍煮丹", "龜記",
    "五桐號", "麻古茶坊", "先喝道", "一沐日"
];

const SUGGESTED_FOOD = [
    "壽司", "拉麵", "小吃", "咖哩飯",
    "火鍋", "燒肉", "麥當勞", "便當"
];

const SUGGESTED_LOTTERY = [
    "頭獎", "二獎", "三獎", "安慰獎",
    "現金100元", "飲料請客", "再一次", "銘謝惠顧"
];

const DEFAULT_FOOD = [
    "壽司", "拉麵", "小吃", "咖哩飯"
];

// State
let allCategories = {
    drinks: [],
    food: [],
    lottery: []
};
let currentCategory = 'drinks'; // Default start
let items = []; // Current view (pointer)
let currentSuggestions = SUGGESTED_DRINKS; // Current suggestions
let history = [];
let colors = [];
let currentUser = null;

// Wheel Config
let startAngle = 0;
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

        subscribeToData();
        addListeners();
    } catch (error) {
        console.error("Auth Error:", error);
    }
}

function subscribeToData() {
    if (!currentUser) return;

    const userDocRef = doc(db, "users", currentUser.uid);

    onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            history = data.history || [];

            // Check for Migration (Old format has 'items' at root)
            if (data.items && !data.categories) {
                console.log("Migrating old data...");
                const rawItems = data.items;
                // Convert to objects if needed
                const migratedDrinks = rawItems.map(item =>
                    (typeof item === 'string') ? { text: item, weight: 1 } : item
                );

                allCategories = {
                    drinks: migratedDrinks, // Keep existing user data
                    food: [], // Start empty
                    lottery: [] // Start empty
                };

                // Save immediately to complete migration
                saveDataToCloud();
            } else if (data.categories) {
                // New format
                allCategories = data.categories;

                // Ensure structure exists
                if (!allCategories.food) allCategories.food = [];
                if (!allCategories.drinks) allCategories.drinks = [];
                if (!allCategories.lottery) allCategories.lottery = [];

            } else {
                // Totally fresh user
                allCategories = {
                    drinks: [], // Start empty
                    food: [], // Start empty
                    lottery: [] // Start empty
                };
                saveDataToCloud();
            }

            // Sync View
            switchCategory(currentCategory);
            renderHistory();

        } else {
            console.log("No existing data, initiating defaults.");
            allCategories = {
                drinks: [], // Start empty
                food: [], // Start empty
                lottery: [] // Start empty
            };
            saveDataToCloud();
            switchCategory(currentCategory);
        }
    });
}

function switchCategory(cat) {
    currentCategory = cat;
    items = allCategories[currentCategory] || [];

    // Update Dropdown UI
    categorySelect.value = cat;

    // Update Suggestions
    if (cat === 'food') {
        currentSuggestions = SUGGESTED_FOOD;
    } else if (cat === 'lottery') {
        currentSuggestions = SUGGESTED_LOTTERY;
    } else {
        currentSuggestions = SUGGESTED_DRINKS;
    }

    // Always show toggle (unless suggestions are empty, but we have defaults now)
    if (dropdownToggle) dropdownToggle.style.display = 'block';

    generateColors();
    drawWheel();
    renderList();
}

async function saveDataToCloud() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            categories: allCategories, // Save all cats
            history: history,
            updatedAt: new Date()
        });
    } catch (e) {
        console.error("Error saving data:", e);
    }
}

function generateColors() {
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

    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    let currentAngle = startAngle;

    for (let i = 0; i < items.length; i++) {
        const weight = items[i].weight || 1;
        const sliceAngle = (weight / totalWeight) * 2 * Math.PI;

        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.arc(250, 250, outsideRadius, currentAngle, currentAngle + sliceAngle, false);
        ctx.arc(250, 250, insideRadius, currentAngle + sliceAngle, currentAngle, true);
        ctx.stroke();
        ctx.fill();

        ctx.save();
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.translate(250 + Math.cos(currentAngle + sliceAngle / 2) * textRadius,
            250 + Math.sin(currentAngle + sliceAngle / 2) * textRadius);
        ctx.rotate(currentAngle + sliceAngle / 2 + Math.PI / 2);
        const text = items[i].text;
        ctx.font = 'bold 16px Outfit, sans-serif';
        const metrics = ctx.measureText(text);
        if (metrics.width > 100) {
            ctx.fillText(text.substring(0, 8) + '...', -40, 0);
        } else {
            ctx.fillText(text, -metrics.width / 2, 0);
        }
        ctx.restore();

        currentAngle += sliceAngle;
    }
}

function spin() {
    if (isSpinning || items.length === 0) return;
    isSpinning = true;
    spinBtn.disabled = true;
    categorySelect.disabled = true; // Disable switching while spinning
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
    categorySelect.disabled = false;
    cancelAnimationFrame(spinTimeout);

    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    let pointerAngle = ((3 * Math.PI / 2) - startAngle) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

    let currentAngle = 0;
    let winnerIndex = -1;

    for (let i = 0; i < items.length; i++) {
        const weight = items[i].weight || 1;
        const sliceAngle = (weight / totalWeight) * 2 * Math.PI;
        if (pointerAngle >= currentAngle && pointerAngle < currentAngle + sliceAngle) {
            winnerIndex = i;
            break;
        }
        currentAngle += sliceAngle;
    }

    if (winnerIndex !== -1) {
        const result = items[winnerIndex].text;
        showWinner(result);

        history.unshift({
            result: result,
            timestamp: new Date().toISOString()
        });
        saveDataToCloud();
    }
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
        const text = item.text;
        const weight = item.weight || 1;

        li.innerHTML = `
            <span>${text}</span>
            <input type="number" class="weight-input" data-index="${index}" value="${weight}" min="1" max="100" title="權重">
            <button class="delete-btn" data-index="${index}">&times;</button>
        `;
        itemsList.appendChild(li);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            removeItem(idx);
        });
    });

    document.querySelectorAll('.weight-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            let val = parseInt(e.target.value);
            if (val < 1) val = 1;
            updateWeight(idx, val);
        });
    });
}

function formatDate(isoString) {
    const date = new Date(isoString);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
}

function renderHistory() {
    historyList.innerHTML = '';
    if (history.length === 0) {
        historyList.innerHTML = '<li style="text-align:center;color:#64748b;margin-top:2rem;">尚無紀錄</li>';
        return;
    }
    const groups = {};
    history.forEach(item => {
        const dateStr = formatDate(item.timestamp);
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(item);
    });
    Object.keys(groups).forEach(date => {
        const groupContainer = document.createElement('li');
        groupContainer.className = 'history-date-group';
        let html = `<div class="history-date">${date}</div>`;
        groups[date].forEach(item => {
            html += `<div class="history-item"><span>${item.result}</span></div>`;
        });
        groupContainer.innerHTML = html;
        historyList.appendChild(groupContainer);
    });
}

function updateWeight(index, newWeight) {
    if (items[index]) {
        items[index].weight = newWeight;
        saveDataToCloud();
        drawWheel();
    }
}

function addItem(value) {
    const val = value || itemInput.value.trim();
    if (val) {
        items.push({ text: val, weight: 1 });
        itemInput.value = '';
        suggestionsList.classList.add('hidden');
        if (dropdownToggle) dropdownToggle.classList.remove('open');
        saveDataToCloud();
    }
}

function removeItem(index) {
    if (isSpinning) return;
    items.splice(index, 1);
    saveDataToCloud();
}

function handleInput(e) {
    const val = e.target.value.trim().toLowerCase();
    if (!val) {
        suggestionsList.classList.add('hidden');
        if (dropdownToggle) dropdownToggle.classList.remove('open');
        return;
    }

    // Search within currentSuggestions
    const matches = currentSuggestions.filter(item =>
        item.toLowerCase().includes(val)
    );
    if (matches.length > 0) {
        renderSuggestions(matches);
        if (dropdownToggle) dropdownToggle.classList.add('open');
    } else {
        suggestionsList.classList.add('hidden');
        if (dropdownToggle) dropdownToggle.classList.remove('open');
    }
}

function renderSuggestions(matches) {
    suggestionsList.innerHTML = '';
    matches.forEach(match => {
        const li = document.createElement('li');
        li.className = 'suggestion-item';
        li.textContent = match;
        li.addEventListener('click', () => {
            addItem(match);
        });
        suggestionsList.appendChild(li);
    });
    suggestionsList.classList.remove('hidden');
}

function addListeners() {
    spinBtn.addEventListener('click', spin);
    addItemBtn.addEventListener('click', () => addItem());

    itemInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem();
    });

    itemInput.addEventListener('input', handleInput);

    // Dropdown arrow listener
    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            suggestionsList.classList.toggle('hidden');
            dropdownToggle.classList.toggle('open');
            if (!suggestionsList.classList.contains('hidden')) {
                // Show current category suggestions
                renderSuggestions(currentSuggestions);
            }
        });
    }

    // Category Switcher Listener
    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            switchCategory(e.target.value);
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.input-wrapper')) {
            suggestionsList.classList.add('hidden');
            if (dropdownToggle) dropdownToggle.classList.remove('open');
        }
    });

    closeModalBtn.addEventListener('click', () => {
        winnerModal.classList.remove('show');
        setTimeout(() => winnerModal.classList.add('hidden'), 300);
    });
}

init();
