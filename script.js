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

// Default Items
let items = ['今天吃什麼？'];
let colors = [];

// Wheel Config
let startAngle = 0;
let arc = Math.PI / (items.length / 2);
let spinTimeout = null;
let spinAngleStart = 10;
let spinTime = 0;
let spinTimeTotal = 0;
let isSpinning = false;

// Initialize
function init() {
    generateColors();
    drawWheel();
    renderList();
    addListeners();
}

function generateColors() {
    // Generate a beautiful palette based on item count
    colors = items.map((_, i) => {
        // HSL: distributed hue, high saturation, medium lightness for premium look
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
        ctx.rotate(angle + arc / 2 + Math.PI / 2); // Rotate text to face center

        const text = items[i];
        ctx.font = 'bold 16px Outfit, sans-serif';
        ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
        ctx.restore();
    }
}

function spin() {
    if (isSpinning || items.length === 0) return;

    isSpinning = true;
    spinBtn.disabled = true;
    spinTime = 0;
    spinTimeTotal = (Math.random() * 3000) + 4000; // Random time 4-7 seconds
    spinAngleStart = Math.random() * 10 + 10;
    rotateWheel();
}

function rotateWheel() {
    spinTime += 30;
    if (spinTime >= spinTimeTotal) {
        stopRotateWheel();
        return;
    }

    // Easing function: Quartic ease out
    const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
    startAngle += (spinAngle * Math.PI / 180);
    drawWheel();
    spinTimeout = requestAnimationFrame(rotateWheel);
}

function stopRotateWheel() {
    isSpinning = false;
    spinBtn.disabled = false;
    cancelAnimationFrame(spinTimeout);

    const degrees = startAngle * 180 / Math.PI + 90;
    const arcd = arc * 180 / Math.PI;
    const index = Math.floor((360 - degrees % 360) / arcd);

    // Show Winner
    const winner = items[index];
    showWinner(winner);
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
            <button class="delete-btn" onclick="removeItem(${index})">&times;</button>
        `;
        itemsList.appendChild(li);
    });
}

function addItem() {
    const val = itemInput.value.trim();
    if (val) {
        items.push(val);
        itemInput.value = '';
        generateColors();
        drawWheel();
        renderList();
    }
}

window.removeItem = function (index) {
    if (isSpinning) return;
    items.splice(index, 1);
    generateColors();
    drawWheel();
    renderList();
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

init();
