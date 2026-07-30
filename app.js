let ws;
let nick;
let autoRefreshInterval;

function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function login() {
  const nickInput = document.getElementById('nick');
  const passInput = document.getElementById('pass');
  const errorDiv = document.getElementById('error');

  nick = nickInput.value.trim();
  const pass = passInput.value.trim();

  if (!nick || !pass) {
    errorDiv.textContent = 'Заполни все поля';
    errorDiv.style.display = 'block';
    return;
  }

  if (!/^[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}$/.test(pass)) {
    errorDiv.textContent = 'Неверный формат пароля (xxxxx-xxxxx-xxxxx)';
    errorDiv.style.display = 'block';
    return;
  }

  errorDiv.style.display = 'none';

  // ПОДСТАВЬ СВОЙ IP
  const server = 'wss://cgi-pure-supposed-make.trycloudflare.com';
  ws = new WebSocket(server);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'auth', nick, pass }));
  };

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);

    if (data.type === 'auth') {
      if (data.status === 'ok') {
        document.getElementById('login').style.display = 'none';
        document.getElementById('chat').style.display = 'flex';
        startAutoRefresh();
      } else {
        errorDiv.textContent = 'Неверный позывной или пароль';
        errorDiv.style.display = 'block';
        ws.close();
      }
    } else if (data.type === 'message') {
      addMessage(escapeHTML(data.nick) + ': ' + escapeHTML(data.text));
    } else if (data.type === 'error') {
      addMessage('[Ошибка] ' + escapeHTML(data.text));
    }
  };

  ws.onclose = () => {
    addMessage('=== Отключено ===');
    stopAutoRefresh();
  };
}

function send() {
  const input = document.getElementById('msg');
  const text = input.value.trim();
  if (!text) return;
  ws.send(JSON.stringify({ type: 'message', text }));
  addMessage('Я: ' + escapeHTML(text));
  input.value = '';
}

function addMessage(text) {
  const div = document.getElementById('messages');
  div.innerHTML += '<div>' + text + '</div>';
  div.scrollTop = div.scrollHeight;
}

// === АВТООБНОВЛЕНИЕ (проверка соединения) ===
function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // отправляем пинг
      ws.send(JSON.stringify({ type: 'ping' }));
      document.getElementById('status').textContent = '● Подключено';
      document.getElementById('status').style.color = '#33cc33';
    } else {
      document.getElementById('status').textContent = '● Нет соединения';
      document.getElementById('status').style.color = '#cc3333';
    }
  }, 10000);
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}
