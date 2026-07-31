// ============================================================
// 🔴 КОНФИГУРАЦИЯ — ЗАМЕНИ НА АДРЕС СВОЕГО СЕРВЕРА
// ============================================================
const SERVER_URL = 'https://redline-server.onrender.com'; // 👈 СЮДА СВОЙ АДРЕС

// ============================================================
//  ПОДКЛЮЧЕНИЕ К СЕРВЕРУ
// ============================================================
const socket = io(SERVER_URL, { autoConnect: false });

let currentUser = null;
let currentRole = null;
let currentBranch = null;
let authToken = null;
let lastMessageId = 0; // для отслеживания новых сообщений
let isRefreshing = false;

// ====== ЭЛЕМЕНТЫ ======
const loginForm = document.getElementById('loginForm');
const chatApp = document.getElementById('chatApp');

const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginMessage = document.getElementById('loginMessage');

const messagesEl = document.getElementById('messages');
const usersEl = document.getElementById('users');
const statusEl = document.getElementById('status');
const messageInput = document.getElementById('message');
const displayUsername = document.getElementById('displayUsername');
const displayRole = document.getElementById('displayRole');
const displayBranch = document.getElementById('displayBranch');

// ====== ВХОД ======
async function login() {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();

    if (!username || !password) {
        loginMessage.textContent = '❌ Заполните все поля';
        return;
    }

    try {
        const res = await fetch(`${SERVER_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            authToken = data.token;
            currentUser = data.user.username;
            currentRole = data.user.role;
            currentBranch = data.user.branch;

            loginMessage.textContent = '';
            enterChat();
        } else {
            loginMessage.textContent = '❌ ' + (data.error || 'Ошибка входа');
        }
    } catch (e) {
        loginMessage.textContent = '❌ Ошибка соединения с сервером';
    }
}

// ====== ВХОД В ЧАТ ======
function enterChat() {
    loginForm.style.display = 'none';
    chatApp.style.display = 'block';

    displayUsername.textContent = currentUser;
    displayRole.textContent = currentRole;
    displayBranch.textContent = currentBranch;

    socket.auth = { token: authToken };
    socket.connect();
    statusEl.textContent = '🟢 В сети: ' + currentUser;

    // Загружаем историю
    fetchMessages();

    // Автообновление каждые 10 секунд
    if (window.messageInterval) clearInterval(window.messageInterval);
    window.messageInterval = setInterval(fetchMessages, 10000);
}

// ====== ПОЛУЧЕНИЕ СООБЩЕНИЙ С СЕРВЕРА ======
async function fetchMessages() {
    if (isRefreshing) return;
    isRefreshing = true;

    try {
        const res = await fetch(`${SERVER_URL}/api/messages?after=${lastMessageId}`);
        if (!res.ok) return;
        
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
            // Добавляем только новые сообщения
            data.messages.forEach(msg => {
                if (msg.id > lastMessageId) {
                    addMessage(msg.username, msg.text, msg.time, msg.role, msg.branch);
                    if (msg.id > lastMessageId) lastMessageId = msg.id;
                }
            });
        }
    } catch (e) {
        // тихо падаем
    } finally {
        isRefreshing = false;
    }
}

// ====== ОТПРАВКА СООБЩЕНИЙ ======
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentUser) return;
    socket.emit('message', { message: text });
    messageInput.value = '';
}

// ====== ВЫХОД ======
function logout() {
    currentUser = null;
    authToken = null;
    if (window.messageInterval) {
        clearInterval(window.messageInterval);
        window.messageInterval = null;
    }
    socket.disconnect();
    loginForm.style.display = 'block';
    chatApp.style.display = 'none';
    loginUsername.value = '';
    loginPassword.value = '';
    loginMessage.textContent = '';
    lastMessageId = 0;
}

// ====== СОБЫТИЯ SOCKET.IO ======

socket.on('auth_success', (data) => {
    statusEl.textContent = `🟢 ${data.username} (${data.role} | ${data.branch})`;
    updateUsers(data.users);
    // Загружаем историю после авторизации
    fetchMessages();
});

socket.on('user_joined', (data) => {
    addSystemMessage(`👉 ${data.username} (${data.role} | ${data.branch}) присоединился`);
    updateUsers(data.users);
});

socket.on('user_left', (data) => {
    addSystemMessage(`👈 ${data.username} покинул`);
    fetchUsers();
});

socket.on('new_message', (data) => {
    // Сообщение уже пришло через WebSocket, добавляем сразу
    addMessage(data.username, data.text, data.time, data.role, data.branch);
    // Обновляем lastMessageId, если сервер отдаёт id
    if (data.id) lastMessageId = data.id;
});

// ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======

function addMessage(user, text, time, role, branch) {
    const div = document.createElement('div');
    div.className = 'msg';
    const roleColor = role === 'Совет' ? '#ff3b3b' : '#4b69ff';
    div.innerHTML = `
        <span class="user" style="color: ${roleColor}">${user}</span>
        <span class="role-badge">[${role} | ${branch}]</span>
        <span class="time">${time || ''}</span>
        <div class="text">${text}</div>
    `;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'msg system';
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateUsers(users) {
    usersEl.innerHTML = '';
    if (users && users.length) {
        users.forEach(u => {
            const span = document.createElement('span');
            span.className = 'user-badge';
            span.textContent = '🟢 ' + u;
            usersEl.appendChild(span);
        });
    }
}

async function fetchUsers() {
    try {
        const res = await fetch(`${SERVER_URL}/api/users`);
        if (res.ok) {
            const data = await res.json();
            const online = data.filter(u => u.online).map(u => u.username);
            updateUsers(online);
        }
    } catch (e) {
        // тихо падаем
    }
}

// ====== ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ======
fetchUsers();
setInterval(fetchUsers, 30000); // обновлять список каждые 30 сек

// Enter для отправки
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement === messageInput) {
        sendMessage();
    }
});
