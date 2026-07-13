/*
 * Pocky 的大脑：理解主人说的话，决定用什么行为回应。
 *
 * 两种模式：
 * 1. 接入 Claude API（在聊天面板的"大脑设置"里填 API Key）——
 *    由模型根据性格档案、时间、亲密度等情境做行为决策。
 *    设计原则：狗不说人话，模型只输出动作 + 拟声，不输出人类句子。
 * 2. 无 Key 兜底：内置口令识别（坐下/握手/趴下/睡觉/过来）。
 */
(function () {
  const SETTINGS_KEY = 'pocky-brain';
  const DEFAULT_PERSONALITY =
    'Pocky，一只活泼粘人的小狗。喜欢零食和摸头，开心时疯狂摇尾巴。' +
    '听得懂的口令：坐下、握手、趴下、过来。深夜容易犯困。';

  const settings = Object.assign(
    { apiKey: '', model: 'claude-opus-4-8', personality: '' },
    JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
  );
  // Electron 下尝试用仓库里的性格档案作为默认值
  if (!settings.personality) {
    settings.personality =
      window.petAPI?.readPersonality?.() || DEFAULT_PERSONALITY;
  }
  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  // 模型必须从这些动作里选，pet.js 的 performAction 逐一实现
  const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['idle', 'wag', 'bark', 'sit', 'shake', 'lie', 'sleep', 'come', 'walk'],
        description: '要做的动作。shake=握手，lie=趴下，come=跑向主人',
      },
      bubble: {
        type: 'string',
        description: '狗狗的发声：拟声词或极短语气表达，10个字以内，绝不能是人类句子。如：汪汪！、呜…、哼哼～',
      },
      sound: { type: 'string', enum: ['none', 'bark'] },
      mood: { type: 'string', enum: ['happy', 'calm', 'sleepy', 'excited', 'curious'] },
    },
    required: ['action', 'bubble', 'sound', 'mood'],
    additionalProperties: false,
  };

  function systemPrompt() {
    return `你是 Pocky，一只真实的狗，现在以数字生命的形式住在主人的电脑桌面上。

关于你：
${settings.personality}

规则：
- 你不会说人话。bubble 字段只能是拟声词或极短的语气表达（汪汪！、呜…、哼哼～、蹭蹭），10个字以内。
- 主人下口令（坐下、握手、趴下、过来等）时尽量配合。
- 根据情境（时间、亲密度、最近发生的事）选择自然、符合狗狗天性的反应。
- 深夜时你会犯困，反应可以慵懒一些。`;
  }

  // 多轮记忆：保留最近的对话（含模型自己的 JSON 回复）
  const history = [];

  function contextMessage(text) {
    const s = window.pocky.getStatus();
    const now = new Date();
    return (
      `[情境] 现在 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}，` +
      `亲密度 ${s.affection}，已陪伴主人 ${s.days} 天，` +
      `今天被摸了 ${s.pets} 次。当前状态：${s.state}。\n` +
      `[主人说] ${text}`
    );
  }

  async function askClaude(text) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const messages = [...history, { role: 'user', content: contextMessage(text) }];
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01',
          // 允许从桌面应用/浏览器直连 API
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: settings.model,
          max_tokens: 300,
          system: systemPrompt(),
          messages,
          output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.stop_reason === 'refusal') throw new Error('refusal');
      const raw = (data.content || []).find((b) => b.type === 'text')?.text;
      const decision = JSON.parse(raw);
      history.push(messages[messages.length - 1], { role: 'assistant', content: raw });
      while (history.length > 12) history.shift();
      return decision;
    } finally {
      clearTimeout(timer);
    }
  }

  // 无 API Key 时的内置口令理解
  function keywordFallback(text) {
    const rules = [
      [/坐|sit/i, { action: 'sit', bubble: '汪！', sound: 'none' }],
      [/握手|爪|paw|shake/i, { action: 'shake', bubble: '汪汪～', sound: 'none' }],
      [/趴/, { action: 'lie', bubble: '呼…', sound: 'none' }],
      [/睡|困|晚安/, { action: 'sleep', bubble: 'Zzz…', sound: 'none' }],
      [/过来|来|come/i, { action: 'come', bubble: '汪！汪！', sound: 'bark' }],
      [/叫|说话|汪/, { action: 'bark', bubble: '汪汪汪！', sound: 'bark' }],
      [/乖|好狗|爱你|喜欢|棒/, { action: 'wag', bubble: '哼哼～', sound: 'none' }],
      [/吃|零食|饭|骨头/, { action: 'come', bubble: '汪！！', sound: 'bark' }],
    ];
    for (const [re, resp] of rules) {
      if (re.test(text)) return { ...resp, mood: 'happy' };
    }
    return { action: 'wag', bubble: '汪？', sound: 'none', mood: 'curious' };
  }

  async function decide(text) {
    if (!settings.apiKey) return keywordFallback(text);
    try {
      return await askClaude(text);
    } catch (err) {
      console.warn('brain offline, fallback:', err.message);
      return keywordFallback(text);
    }
  }

  // ---------- 聊天面板 ----------
  const chat = document.getElementById('chat');
  const log = document.getElementById('chatLog');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  let busy = false;

  function addLine(who, text) {
    const div = document.createElement('div');
    div.className = 'line ' + who;
    div.textContent = (who === 'me' ? '你：' : 'Pocky：') + text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  const ACTION_LABEL = {
    sit: '坐下了', shake: '伸出了爪子', lie: '趴下了', sleep: '睡着了',
    come: '跑了过来', bark: '叫了两声', wag: '摇起尾巴', walk: '溜达去了', idle: '看着你',
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    addLine('me', text);
    busy = true;
    window.pocky.say('…', 8);
    const d = await decide(text);
    busy = false;
    window.pocky.performAction(d.action, d.bubble, d.sound);
    addLine('dog', `${d.bubble}（${ACTION_LABEL[d.action] || d.action}）`);
  });

  window.openPockyChat = () => {
    chat.hidden = false;
    window.petAPI?.setIgnoreMouse(false);
    input.focus();
  };
  document.getElementById('chatClose').addEventListener('click', () => {
    chat.hidden = true;
  });

  // ---------- 大脑设置 ----------
  const keyInput = document.getElementById('apiKey');
  const modelSel = document.getElementById('modelSel');
  const personaInput = document.getElementById('personality');
  keyInput.value = settings.apiKey;
  modelSel.value = settings.model;
  personaInput.value = settings.personality;
  document.getElementById('saveBrain').addEventListener('click', () => {
    settings.apiKey = keyInput.value.trim();
    settings.model = modelSel.value;
    settings.personality = personaInput.value.trim() || DEFAULT_PERSONALITY;
    saveSettings();
    history.length = 0; // 人格变了，记忆重新开始
    addLine('dog', settings.apiKey ? '汪！（大脑已连接）' : '汪～（使用内置口令模式）');
  });
})();
