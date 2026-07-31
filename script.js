// ============================================================
// 🔴 АДРЕС СЕРВЕРА — ЗАМЕНИ НА СВОЙ
// ============================================================
const SERVER_URL = 'https://redline-server.onrender.com';

// ============================================================
//  ПОДКЛЮЧЕНИЕ
// ============================================================
const socket = io(SERVER_URL);

let username = "Гость";
let lastMessageId = 0;
let isRefreshing = false;

// ====== ЭЛЕМЕНТЫ ======
const messagesEl = document.getElementById('messages');
const usersEl = document.getElementById('users');
const statusEl = document.getElementById('status');
const usernameInput = document.getElementById('username');
const messageInput = document.getElementById('message');

// ====== ПРИСОЕДИНЕНИЕ ======
function join() {
    username = usernameInput.value.trim() || "Гость";
    socket.emit('join', { username: username });
    statusEl.textContent = '🟢 В сети: ' + username;
}

usernameInput.addEventListener('change', join);

// ====== ОТПРАВКА ======
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    socket.emit('message', { username: username, message: text });
    messageInput.value = '';
}

// ====== ПОЛУЧЕНИЕ СООБЩЕНИЙ (автообновление) ======
async function fetchMessages() {
    if (isRefreshing) return;
    isRefreshing = true;

    try {
        const res = await fetch(`${SERVER_URL}/api/messages?after=${lastMessageId}`);
        if (!res.ok) return;
        
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(msg => {
                if (msg.id > lastMessageId) {
                    addMessage(msg.username, msg.text, msg.time);
                    if (msg.id > lastMessageId) lastMessageId = msg.id;
                }
            });
        }
        if (data.lastId && data.lastId > lastMessageId) {
            lastMessageId = data.lastId;
        }
    } catch (e) {
        // тихо падаем
    } finally {
        isRefreshing = false;
    }
}

// ====== СОБЫТИЯ SOCKET ======

socket.on('connect', () => {
    join();
});

socket.on('user_joined', (data) => {
    addSystemMessage(`👉 ${data.username} присоединился`);
    updateUsers(data.users);
});

socket.on('user_left', (data) => {
    addSystemMessage(`👈 ${data.username} покинул`);
});

socket.on('new_message', (data) => {
    addMessage(data.username, data.text, data.time);
    if (data.id) lastMessageId = data.id;
});

// ====== ВСПОМОГАТЕЛЬНЫЕ ======

function addMessage(user, text, time) {
    const div = document.createElement('div');
    div.className = 'msg';
    div.innerHTML = `<span class="user">${user}</span><span class="time">${time || ''}</span><div class="text">${text}</div>`;
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
    if (users) {
        users.forEach(u => {
            const span = document.createElement('span');
            span.className = 'user-badge';
            span.textContent = '🟢 ' + u;
            usersEl.appendChild(span);
        });
    }
}

// ====== АВТООБНОВЛЕНИЕ (каждые 10 секунд) ======
setInterval(fetchMessages, 10000);

// ====== СТАТУС СЕРВЕРА ======
fetch(`${SERVER_URL}/api/status`)
    .then(res => res.json())
    .then(data => {
        statusEl.textContent = '🟢 Онлайн | Пользователей: ' + data.users + ' | Сообщений: ' + data.messages;
    })
    .catch(() => {
        statusEl.textContent = '🔴 Ошибка подключения к серверу';
    });
