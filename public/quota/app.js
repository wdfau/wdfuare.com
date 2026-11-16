/* Quota Board · Mac product demo. All accounts and readings are illustrative. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clone = value => structuredClone(value);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const newAlias = '项目工作号';
  const platformDefinitions = [
    { id: 'codex', name: 'Codex', shortName: 'Codex', color: '#28a745', icon: 'codex.svg', period: '5 Hours', value: 58 },
    { id: 'kiro', name: 'Kiro', shortName: 'Kiro', color: '#5856d6', icon: 'kiro.svg', period: 'Monthly', value: 72 },
    { id: 'cursor', name: 'Cursor', shortName: 'Cursor', color: '#6e6e73', icon: 'cursor.svg', period: 'Monthly', value: 38 },
    { id: 'claude', name: 'Claude', shortName: 'Claude', color: '#ff9500', icon: 'claude.svg', period: '5 Hours', value: 46 },
    { id: 'copilot', name: 'GitHub Copilot', shortName: 'Copilot', color: '#007aff', icon: 'copilot.svg', period: 'Monthly', value: 92 }
  ];

  function initialData() {
    return platformDefinitions.map(provider => ({
      ...provider,
      visible: true,
      currentId: `${provider.id}-work`,
      accounts: provider.id === 'codex' ? [
        { id: 'codex-work', alias: '工作账号', email: 'work@example.com', windows: [{ period: '5 Hours', value: 58, reset: '1 小时后重置' }, { period: 'Weekly', value: 72, reset: '3 天后重置' }] },
        { id: 'codex-personal', alias: '个人账号', email: 'personal@example.com', windows: [{ period: '5 Hours', value: 84, reset: '3 小时后重置' }, { period: 'Weekly', value: 68, reset: '5 天后重置' }] }
      ] : [
        { id: `${provider.id}-work`, alias: provider.id === 'cursor' ? '个人工作区' : '主账号', email: `${provider.id}@example.com`, windows: [{ period: provider.period, value: provider.value, reset: provider.period === '5 Hours' ? '2 小时后重置' : '12 天后重置' }, ...(provider.id === 'claude' ? [{ period: 'Weekly', value: 73, reset: '4 天后重置' }] : [])] }
      ]
    }));
  }

  function initialUI() {
    return { panelOpen: true, panelView: 'overview', providerId: 'codex', settingsOpen: false, modal: null, windowPosition: null };
  }

  const chapters = [
    { label: '额度总览', title: 'Five tools. One glance.', description: '打开菜单栏，总览当前账号的最短额度周期<br>还有多少可用，扫一眼就知道', progress: .04 },
    { label: '账号详情', title: 'Every account, in full.', description: '点进一个平台，比较不同账号的额度窗口<br>剩余百分比与重置时间，一起看', progress: .32 },
    { label: '账号管理', title: 'Name it. Know it.', description: '打开设置，给账号一个熟悉的名字<br>邮箱保留，用来核对身份', progress: .56 },
    { label: '同步更新', title: 'Rename once. See it everywhere.', description: '保存后，总览与详情同步显示新名称<br>一个名字，处处认得' },
    { label: '切换账号', title: 'Double-click to switch.', description: '' }
  ];
  // Switch notes are the ones the Mac app shows in its own switch prompt.
  const switchNotes = { codex: 'Codex 会退出并重新打开', kiro: '将在终端打开此账号的 Kiro CLI 会话', cursor: '将打开此账号对应的 Cursor 窗口', claude: '将在终端打开此账号的 Claude Code 会话', copilot: '将此账号设为 GitHub CLI 的当前账号' };

  const state = {
    mode: reducedMotion.matches ? 'manual' : 'guided',
    progress: 0,
    guidedData: initialData(),
    guidedUI: initialUI(),
    manualData: initialData(),
    manualUI: initialUI(),
    guideSignature: '',
    setupStep: 0,
    toastTimer: 0,
    updatedLabel: '10:42 已更新',
    focusReturn: null
  };
  const currentData = () => state.mode === 'manual' ? state.manualData : state.guidedData;
  const currentUI = () => state.mode === 'manual' ? state.manualUI : state.guidedUI;
  const providerFor = (id = currentUI().providerId) => currentData().find(item => item.id === id);
  const currentAccount = provider => provider.accounts.find(account => account.id === provider.currentId) || provider.accounts[0];
  // A freshly renamed account glows blue for a moment in every view it shows up in next.
  const fresh = id => state.freshName && state.freshName.id === id && performance.now() < state.freshName.until ? ' is-fresh' : '';
  const brand = provider => `<span class="brand-icon"><img src="assets/icons/${provider.icon}" alt="" width="14" height="14"></span>`;

  function gauge(value, color) {
    return `<div class="quota-gauge" style="--provider-color:${color}" role="img" aria-label="剩余 ${value}%"><svg viewBox="0 0 58 58" aria-hidden="true"><path class="gauge-track" d="M 12.03 45.97 A 24 24 0 1 1 45.97 45.97" pathLength="100"/><path class="gauge-value" d="M 12.03 45.97 A 24 24 0 1 1 45.97 45.97" pathLength="100" stroke-dasharray="${value} 100" data-percentage="${value}"/></svg><span class="quota-number">${value}<small>%</small></span></div>`;
  }

  function panelFooter() {
    return `<div class="app-panel-footer"><span class="update-label"><span class="live-dot"></span>${state.updatedLabel}</span><div class="panel-footer-actions"><button class="icon-button" data-action="open-settings" aria-label="打开账号设置"><img src="assets/icons/settings.svg" alt="" width="16" height="16"></button><button class="icon-button" data-action="refresh" aria-label="刷新演示额度"><img src="assets/icons/refresh.svg" alt="" width="16" height="16"></button></div></div>`;
  }

  function renderPanel() {
    const ui = currentUI();
    const root = $('#app-panels');
    if (!ui.panelOpen || ui.settingsOpen) { root.innerHTML = ''; return; }
    if (ui.panelView === 'overview') {
      const providers = currentData().filter(item => item.visible);
      root.innerHTML = `<div class="app-panel overview-panel" data-node-id="82:299"><div class="app-panel-header"><h3>额度总览</h3><span>最短周期 · 剩余额度</span></div>${providers.length ? `<div class="overview-grid" style="grid-template-columns:repeat(${providers.length},minmax(0,1fr))">${providers.map(provider => {
        const account = currentAccount(provider);
        return `<button class="provider-tile" data-action="open-detail" data-provider="${provider.id}" aria-label="查看 ${provider.name} 的账号详情"><span class="provider-name">${brand(provider)}<span>${provider.shortName}</span></span><span class="provider-alias${fresh(account.id)}">${escape(account.alias)}</span>${gauge(account.windows[0].value, provider.color)}<span class="quota-period">${account.windows[0].period}</span></button>`;
      }).join('')}</div>` : '<div class="empty-panel">选择你想放在菜单栏里的平台<br><button class="mac-button" data-action="open-settings">打开设置</button></div>'}${panelFooter()}</div>`;
    } else {
      const provider = providerFor();
      root.innerHTML = `<div class="app-panel detail-panel" data-node-id="82:393"><div class="app-panel-header"><button class="icon-button" data-action="back" aria-label="返回额度总览"><img src="assets/icons/back.svg" alt="" width="16" height="16"></button><h3 class="detail-title">${brand(provider)}${provider.name}</h3><button class="icon-button" data-action="open-settings" aria-label="打开账号设置"><img src="assets/icons/settings.svg" alt="" width="16" height="16"></button></div><div class="accounts-grid" style="--account-count:${Math.min(provider.accounts.length,3)}">${provider.accounts.map(account => `<article class="account-card ${account.id === provider.currentId ? `is-current${state.justSwitched === account.id ? ' just-switched' : ''}` : 'is-switchable'}" data-account="${account.id}"${account.id === provider.currentId ? '' : ` tabindex="0" title="双击切换账号" aria-label="${escape(account.alias)}，双击或按回车切换到此账号"`}><h4 class="account-name${fresh(account.id)}">${account.id === provider.currentId ? '<span class="live-dot"></span>' : ''}${escape(account.alias)}</h4><div class="account-windows">${account.windows.map(window => `<div class="quota-window">${gauge(window.value, provider.color)}<p class="quota-period">${window.period}</p><p class="reset-time">${window.reset}</p></div>`).join('')}</div><p class="current-label">${account.id === provider.currentId ? '当前登录' : '&nbsp;'}</p></article>`).join('')}</div>${panelFooter()}</div>`;
    }
  }

  function renderSettings() {
    const ui = currentUI();
    const root = $('#settings-layer');
    if (!ui.settingsOpen) { root.innerHTML = ''; return; }
    const provider = providerFor();
    const position = ui.windowPosition ? `style="left:${ui.windowPosition.x}px;top:${ui.windowPosition.y}px;transform:none"` : '';
    root.innerHTML = `<section class="settings-window" ${position} aria-label="账号设置"><aside class="settings-sidebar"><div class="traffic-lights"><button class="traffic-close" data-action="close-settings" aria-label="关闭设置窗口"></button><span class="traffic-yellow"></span><span class="traffic-green"></span></div><p class="sidebar-label">平台</p><div class="platform-nav" role="tablist" aria-label="选择设置平台">${currentData().map(item => `<button role="tab" aria-selected="${item.id === provider.id}" data-action="select-provider" data-provider="${item.id}">${brand(item)}${item.name}</button>`).join('')}</div></aside><div class="settings-main"><div class="window-titlebar">设置</div><h3>${provider.name}</h3><p class="settings-subtitle">管理此平台的显示方式与登录账号</p><div class="visibility-setting"><div><strong>在总览中显示</strong><small>显示当前登录账号的最短周期额度</small></div><button class="switch" role="switch" aria-checked="${provider.visible}" aria-label="在总览中显示 ${provider.name}" data-action="toggle-visible"></button></div><div class="accounts-heading"><strong>登录账号</strong><button class="mac-button" data-action="add-account">添加账号</button></div><div class="settings-accounts">${provider.accounts.map(account => `<div class="settings-account-row ${account.id === provider.currentId ? 'is-current' : ''}"><span class="account-avatar">${escape(account.alias.slice(0,1))}</span><div class="account-info"><strong>${escape(account.alias)}</strong><span>${escape(account.email)}</span><small>${account.id === provider.currentId ? '当前登录' : '已连接'}</small></div><div class="account-actions">${account.id !== provider.currentId ? `<button class="mac-button" data-action="switch-account" data-account="${account.id}">切换</button>` : ''}<button class="mac-button" data-action="rename" data-account="${account.id}" aria-label="编辑${escape(account.alias)}">编辑</button></div></div>`).join('')}</div><p class="settings-note">邮箱用于核对账号，此处为网页演示数据</p></div></section>`;
  }

  function nextDemoAccount(provider) {
    const count = provider.accounts.length + 1;
    return { id: `${provider.id}-sample-${count}`, alias: count > 2 ? `备用账号 ${count - 2}` : '个人账号', email: `sample${count}@example.com`, windows: [{ period: provider.period, value: 81, reset: provider.period === '5 Hours' ? '4 小时后重置' : '18 天后重置' }] };
  }

  // The scripted name field never takes real focus, so a drawn caret sits right after its text.
  const measure = document.createElement('canvas').getContext('2d');
  function placeCaret() {
    const input = $('#account-name'); const caret = $('.type-caret');
    if (!input || !caret) return;
    const style = getComputedStyle(input);
    measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    caret.style.left = `${parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth) + measure.measureText(input.value).width}px`;
  }

  function renderModal() {
    const modal = currentUI().modal;
    const root = $('#modal-layer');
    root.hidden = !modal;
    $('#settings-layer').inert = !!modal;
    $('#app-panels').inert = !!modal;
    $('#menu-bar').inert = !!modal;
    // A switch asked for from the panel opens over the panel itself, like the Mac app's prompt.
    const panel = modal?.inPanel && $('.app-panel');
    root.classList.toggle('is-panel', !!panel);
    if (panel) Object.assign(root.style, { left: `${panel.offsetLeft}px`, top: `${panel.offsetTop}px`, width: `${panel.offsetWidth}px`, height: `${panel.offsetHeight}px` });
    else root.removeAttribute('style');
    if (!modal) { root.innerHTML = ''; return; }
    const provider = providerFor(modal.providerId);
    if (modal.type === 'rename') {
      const account = provider.accounts.find(item => item.id === modal.accountId);
      root.innerHTML = `<form class="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" data-form="rename"><h3 id="dialog-title">编辑账号</h3><p class="dialog-subtitle">${provider.name} · ${account.id === provider.currentId ? '当前登录' : '已连接'}</p><span class="field-label">登录邮箱</span><div class="dialog-email"><span>${escape(account.email)}</span><small>用于核对账号</small></div><label class="field-label" for="account-name">显示名称</label><div class="name-field"><input id="account-name" class="name-input ${state.mode === 'guided' ? 'is-scripted' : ''}" name="alias" value="${escape(modal.draft)}" maxlength="60" autocomplete="off" ${state.mode === 'guided' ? 'readonly' : ''} aria-describedby="name-hint"><i class="type-caret" aria-hidden="true"></i></div><div class="field-hint" id="name-hint">保存后，总览与详情会更新此账号的名称</div><div class="dialog-actions"><button class="mac-button" type="button" data-action="close-modal">取消</button><button class="mac-button primary" type="submit" data-action="save-name">保存</button></div></form>`;
    } else if (modal.type === 'switch') {
      const account = provider.accounts.find(item => item.id === modal.accountId);
      root.innerHTML = `<div class="edit-dialog switch-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h3 id="dialog-title">切换 ${provider.name} 账号？</h3><p class="switch-target">将切换到 ${escape(account.alias)}（${escape(account.email)}）</p><p class="switch-note">${switchNotes[provider.id]}</p><div class="dialog-actions"><button class="mac-button" data-action="close-modal">取消</button><button class="mac-button primary" data-action="confirm-switch">确认切换</button></div></div>`;
    } else if (modal.type === 'import') {
      const titles = ['选择平台', '选择账号', '确认导入'];
      let body = '';
      if (modal.step === 0) body = `<p class="field-hint">选择要体验添加账号的平台</p><div class="import-options">${currentData().map(item => `<label class="import-option"><input type="checkbox" data-import-provider="${item.id}" ${modal.selected.includes(item.id) ? 'checked' : ''}>${brand(item)}${item.name}</label>`).join('')}</div>`;
      if (modal.step === 1) body = `<p class="field-hint">以下是用于演示的示例账号</p><div class="import-options">${modal.selected.map(id => { const item = providerFor(id); const account = nextDemoAccount(item); return `<label class="import-option"><input type="checkbox" data-import-account="${id}" ${modal.accounts.includes(id) ? 'checked' : ''}>${brand(item)}${escape(account.alias)}<small>${item.shortName}</small></label>`; }).join('')}</div>`;
      if (modal.step === 2) body = `<div class="import-success"><span>✓</span>已添加 ${modal.accounts.length} 个演示账号</div>`;
      root.innerHTML = `<div class="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h3 id="dialog-title">${titles[modal.step]}</h3><p class="dialog-subtitle">添加账号 · ${modal.step + 1} / 3</p>${body}<div class="field-hint" id="import-hint">仅添加虚拟数据，用于体验账号列表变化</div><div class="dialog-actions">${modal.step < 2 ? '<button class="mac-button" data-action="close-modal">取消</button>' : ''}<button class="mac-button primary" data-action="import-next">${modal.step === 0 ? '下一步' : modal.step === 1 ? '确认导入' : '完成'}</button></div></div>`;
    }
  }

  // The canvas is a whole 1512 × 982 Mac screen; the frame shows only a crop of its top-right corner.
  // A settings window needs a wider crop, so the view zooms out while one is open.
  const cropRegions = { corner: { x: 793, y: 0, w: 719 }, window: { x: 512, y: 0, w: 1000 } };
  let activeCrop = cropRegions.corner;
  function applyCamera() {
    const ui = currentUI();
    activeCrop = ui.settingsOpen || (ui.modal && !ui.modal.inPanel) ? cropRegions.window : cropRegions.corner;
    const scale = $('#macbook').clientWidth / activeCrop.w;
    $('#desktop').style.transform = `scale(${scale}) translate(${-activeCrop.x}px, ${-activeCrop.y}px)`;
  }

  let lastPanelKey = ''; let lastSettingsOpen = false; let lastModalKey = '';
  // Going between overview and detail resizes the one panel smoothly, like a macOS popover, instead of swapping it.
  function morphPanel(panel, before) {
    const width = panel.offsetWidth; const height = panel.offsetHeight;
    panel.classList.add('is-morphing');
    if (reducedMotion.matches || (Math.abs(width - before.width) < 2 && Math.abs(height - before.height) < 2)) return;
    panel.style.overflow = 'hidden';
    const easing = 'cubic-bezier(.32,.72,0,1)';
    panel.animate([{ width: `${before.width}px`, height: `${before.height}px` }, { width: `${width}px`, height: `${height}px` }], { duration: 380, easing })
      .finished.then(() => { panel.style.overflow = ''; }, () => {});
    [...panel.children].forEach(child => child.animate([{ opacity: 0 }, { opacity: 0, offset: .3 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' }));
  }

  function markEntering(before) {
    const ui = currentUI();
    const panelKey = ui.panelOpen && !ui.settingsOpen ? (ui.panelView === 'detail' ? `detail:${ui.providerId}` : 'overview') : '';
    const panel = $('.app-panel');
    if (panel && panelKey && panelKey !== lastPanelKey) {
      if (before && lastPanelKey) morphPanel(panel, before); else panel.classList.add('is-entering');
    }
    lastPanelKey = panelKey;
    if (ui.settingsOpen && !lastSettingsOpen) $('.settings-window')?.classList.add('is-entering');
    lastSettingsOpen = !!ui.settingsOpen;
    const modalKey = ui.modal ? `${ui.modal.type}:${ui.modal.step ?? ''}` : '';
    if (modalKey && modalKey !== lastModalKey) $('#modal-layer .edit-dialog')?.classList.add('is-entering');
    lastModalKey = modalKey;
  }

  function renderAll() {
    const old = $('.app-panel');
    const before = old ? { width: old.offsetWidth, height: old.offsetHeight } : null;
    renderPanel();
    renderSettings();
    renderModal();
    placeCaret();
    markEntering(before);
    state.justSwitched = null;
    applyCamera();
    $('.menu-app').setAttribute('aria-expanded', String(currentUI().panelOpen && !currentUI().settingsOpen));
  }

  function updateModeControls() {
    const manual = state.mode === 'manual';
    $('#try-button').hidden = manual;
    $('#resume-button').hidden = !manual || reducedMotion.matches;
    $('#reset-button').hidden = !manual;
    $('#demo-cursor').hidden = manual || reducedMotion.matches;
    $('#mode-label').innerHTML = `<span class="live-dot"></span>${manual ? '正在自主体验' : '自动演示'}`;
    $('#story-scroll-hint').innerHTML = manual ? '正在体验虚拟账号 · 点击「继续演示」回到自动演示' : '点击上方章节切换 <span class="hint-divider">/</span> 随时点击界面，自己试试';
    document.documentElement.dataset.demoMode = state.mode;
  }

  function enterManual({ render = true } = {}) {
    if (state.mode === 'manual') return;
    stopPlay();
    state.manualData = clone(state.guidedData);
    state.manualUI = clone(state.guidedUI);
    const input = $('#account-name');
    if (input && state.manualUI.modal?.type === 'rename') {
      state.manualUI.modal.draft = input.value;
      input.readOnly = false;
      input.classList.remove('is-scripted');
    }
    state.mode = 'manual';
    updateModeControls();
    $('#chapter-label').textContent = '自主体验';
    $('#chapter-title').textContent = 'Your turn.';
    $('#chapter-description').innerHTML = '点进平台，比较账号；或打开设置，改个名字<br>你的操作会保留，直到继续演示或重置';
    if (render) { renderAll(); if (currentUI().modal?.type === 'rename') focusName(); }
  }

  function toast(message, { inSettings = false } = {}) {
    window.clearTimeout(state.toastTimer);
    const root = $('#app-toast');
    const note = $('.settings-note');
    if (note?.classList.contains('is-save-status')) {
      note.textContent = note.dataset.originalNote;
      note.classList.remove('is-save-status');
      delete note.dataset.originalNote;
    }
    root.textContent = message;
    if (inSettings && note) {
      root.classList.remove('is-visible');
      note.dataset.originalNote = note.textContent;
      note.textContent = message;
      note.classList.add('is-save-status');
      state.toastTimer = window.setTimeout(() => {
        if (!note.isConnected) return;
        note.textContent = note.dataset.originalNote;
        note.classList.remove('is-save-status');
        delete note.dataset.originalNote;
      }, 2300);
      return;
    }
    root.classList.add('is-visible');
    state.toastTimer = window.setTimeout(() => root.classList.remove('is-visible'), 2300);
  }

  function focusName() {
    requestAnimationFrame(() => { const input = $('#account-name'); if (input) { input.focus({ preventScroll: true }); input.select(); } });
  }

  function focusModal() {
    requestAnimationFrame(() => $('input,button', $('#modal-layer'))?.focus({ preventScroll: true }));
  }

  function saveName() {
    const modal = currentUI().modal;
    if (modal?.type !== 'rename') return;
    const name = $('#account-name').value.trim();
    if (!name) {
      const hint = $('#name-hint');
      hint.textContent = '请输入显示名称';
      hint.classList.add('is-error');
      $('#account-name').setAttribute('aria-invalid', 'true');
      $('#account-name').focus();
      return;
    }
    const account = providerFor(modal.providerId).accounts.find(item => item.id === modal.accountId);
    account.alias = name.slice(0,60);
    state.freshName = { id: account.id, until: performance.now() + 6000 };
    currentUI().modal = null;
    renderAll();
    $(`[data-action="rename"][data-account="${account.id}"]`)?.focus({ preventScroll: true });
    toast('名称已保存，总览与详情已同步', { inSettings: true });
  }

  function handleAction(action, button) {
    const ui = currentUI();
    switch (action) {
      case 'toggle-panel': ui.panelOpen = !ui.panelOpen; break;
      case 'open-detail': ui.panelOpen = true; ui.panelView = 'detail'; ui.providerId = button.dataset.provider; break;
      case 'back': ui.panelView = 'overview'; break;
      case 'open-settings': ui.settingsOpen = true; break;
      case 'close-settings': ui.settingsOpen = false; ui.panelOpen = true; ui.windowPosition = null; break;
      case 'select-provider': ui.providerId = button.dataset.provider; break;
      case 'toggle-visible': providerFor().visible = !providerFor().visible; break;
      case 'rename': {
        const account = providerFor().accounts.find(item => item.id === button.dataset.account);
        ui.modal = { type: 'rename', providerId: ui.providerId, accountId: account.id, draft: account.alias };
        state.focusReturn = `[data-action="rename"][data-account="${account.id}"]`;
        break;
      }
      case 'close-modal': ui.modal = null; break;
      case 'save-name': return;
      case 'switch-account': ui.modal = { type: 'switch', providerId: ui.providerId, accountId: button.dataset.account }; break;
      case 'confirm-switch': {
        const provider = providerFor(ui.modal.providerId);
        provider.currentId = ui.modal.accountId; state.justSwitched = ui.modal.accountId; ui.modal = null;
        toast(`已切换到 ${currentAccount(provider).alias}`);
        break;
      }
      case 'add-account': ui.modal = { type: 'import', step: 0, providerId: ui.providerId, selected: [ui.providerId], accounts: [] }; break;
      case 'import-next': {
        const modal = ui.modal;
        if (modal.step === 0) {
          modal.selected = $$('[data-import-provider]:checked').map(input => input.dataset.importProvider);
          if (!modal.selected.length) { $('#import-hint').textContent = '请至少选择一个平台'; return; }
          modal.accounts = [...modal.selected];
          modal.step = 1;
        } else if (modal.step === 1) {
          modal.accounts = $$('[data-import-account]:checked').map(input => input.dataset.importAccount);
          if (!modal.accounts.length) { $('#import-hint').textContent = '请至少选择一个示例账号'; return; }
          for (const id of modal.accounts) { const provider = providerFor(id); provider.accounts.push(nextDemoAccount(provider)); }
          modal.step = 2;
        } else { ui.modal = null; toast('演示账号已添加'); }
        break;
      }
      case 'refresh': state.updatedLabel = '刚刚更新'; toast('额度已更新'); break;
      default: return;
    }
    renderAll();
    if (action === 'rename') focusName();
    else if (ui.modal) focusModal();
    else if (action === 'close-modal' && state.focusReturn) $(state.focusReturn)?.focus({ preventScroll: true });
  }

  $('#desktop').addEventListener('pointerdown', event => {
    if (event.target.closest('button,input,label,.window-titlebar')) enterManual({ render: false });
  }, true);
  $('#desktop').addEventListener('focusin', event => {
    if (event.target.closest('button,input')) enterManual({ render: false });
  });
  $('#desktop').addEventListener('keydown', event => {
    if (['Enter',' ','ArrowLeft','ArrowRight'].includes(event.key) && event.target.closest('button,input')) enterManual({ render: false });
  }, true);
  $('#desktop').addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) { enterManual({ render: false }); handleAction(button.dataset.action, button); }
    else if (event.target.id === 'desktop' && state.mode === 'manual' && !currentUI().settingsOpen) { currentUI().panelOpen = false; renderAll(); }
  });
  // Double-click (or Enter on) another account in the detail panel to ask for a switch, as in the Mac app.
  function askSwitch(card) {
    enterManual({ render: false });
    const ui = currentUI();
    ui.modal = { type: 'switch', providerId: ui.providerId, accountId: card.dataset.account, inPanel: true };
    state.focusReturn = `.account-card[data-account="${card.dataset.account}"]`;
    renderAll(); focusModal();
  }
  $('#desktop').addEventListener('dblclick', event => {
    const card = event.target.closest('.account-card.is-switchable');
    if (card && !currentUI().modal) askSwitch(card);
  });
  $('#desktop').addEventListener('keydown', event => {
    const card = event.target.closest?.('.account-card.is-switchable');
    if (card && event.key === 'Enter' && !currentUI().modal) { event.preventDefault(); askSwitch(card); }
  });
  $('#desktop').addEventListener('submit', event => {
    if (event.target.dataset.form === 'rename') { event.preventDefault(); enterManual({ render: false }); saveName(); }
  });
  $('#desktop').addEventListener('input', event => {
    if (event.target.id === 'account-name') { currentUI().modal.draft = event.target.value; event.target.removeAttribute('aria-invalid'); $('#name-hint').classList.remove('is-error'); $('#name-hint').textContent = '保存后，总览与详情会更新此账号的名称'; }
  });
  document.addEventListener('keydown', event => {
    const modal = currentUI().modal;
    if (!modal) return;
    if (event.key === 'Escape') { event.preventDefault(); enterManual({ render: false }); currentUI().modal = null; renderAll(); $(state.focusReturn || '[data-action="open-settings"]')?.focus({ preventScroll: true }); }
    if (event.key === 'Tab') {
      // Scroll narration must never move keyboard focus into its scripted dialog.
      if (state.mode === 'guided') return;
      const focusable = $$('button:not([disabled]), input:not([disabled])', $('#modal-layer'));
      const first = focusable[0]; const last = focusable.at(-1);
      if (!focusable.includes(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });

  // Dragging is restricted to the settings title bar and the visible desktop.
  $('#desktop').addEventListener('pointerdown', event => {
    const titlebar = event.target.closest('.window-titlebar');
    if (!titlebar || window.innerWidth <= 760 || currentUI().modal) return;
    const desktop = $('#desktop'); const windowElement = $('.settings-window');
    const desktopRect = desktop.getBoundingClientRect(); const rect = windowElement.getBoundingClientRect();
    const ratio = desktop.offsetWidth / desktopRect.width;
    const start = { x: (rect.left - desktopRect.left) * ratio, y: (rect.top - desktopRect.top) * ratio, pointerX: event.clientX, pointerY: event.clientY };
    titlebar.setPointerCapture(event.pointerId);
    const move = pointer => {
      const cropHeight = activeCrop.w * desktop.closest('.screen-corner').clientHeight / desktop.closest('.screen-corner').clientWidth;
      const x = clamp(start.x + (pointer.clientX - start.pointerX) * ratio, activeCrop.x + 6, activeCrop.x + activeCrop.w - windowElement.offsetWidth - 6);
      const y = clamp(start.y + (pointer.clientY - start.pointerY) * ratio, 36, activeCrop.y + cropHeight - windowElement.offsetHeight - 8);
      Object.assign(windowElement.style, { left: `${x}px`, top: `${y}px`, transform: 'none' });
      currentUI().windowPosition = { x, y };
    };
    const end = () => { titlebar.removeEventListener('pointermove', move); titlebar.removeEventListener('pointerup', end); titlebar.removeEventListener('pointercancel', end); };
    titlebar.addEventListener('pointermove', move);
    titlebar.addEventListener('pointerup', end);
    titlebar.addEventListener('pointercancel', end);
  });

  // ---------- Guided demo ----------
  // Each chapter is one continuous gesture (glide, click, react, move on), then a calm hold on the result
  // before the next chapter starts, so every screen gets its own moment.
  const codexTile = '[data-action="open-detail"][data-provider="codex"]';
  const personalCard = '.account-card[data-account="codex-personal"]';

  // How the screen looks once chapter `stage` has finished (-1 is before the first chapter).
  function sceneFor(stage) {
    const data = initialData(); const ui = initialUI();
    if (stage < 0) ui.panelOpen = false;
    if (stage === 1 || stage === 2 || stage === 4) ui.panelView = 'detail';
    if (stage === 2) { ui.settingsOpen = true; ui.modal = { type: 'rename', providerId: 'codex', accountId: 'codex-work', draft: newAlias }; }
    if (stage >= 3) data[0].accounts[0].alias = newAlias;
    if (stage === 4) data[0].currentId = 'codex-personal';
    return { data, ui };
  }

  class Cancelled extends Error {}
  let runId = 0; let hovered = null;
  const cursor = { x: 1180, y: 250 };
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function setCursor(x, y) {
    cursor.x = x; cursor.y = y;
    $('#demo-cursor').style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }
  // Where a control sits on the 1512 × 982 screen, whatever the camera is doing.
  function pointOf(selector, fx = .5, fy = .5) {
    const desktop = $('#desktop'); const target = $(selector, desktop);
    if (!target || !target.getClientRects().length) return null;
    const box = desktop.getBoundingClientRect(); const rect = target.getBoundingClientRect();
    const scale = box.width / 1512 || 1;
    return { x: (rect.left + rect.width * fx - box.left) / scale, y: (rect.top + rect.height * fy - box.top) / scale };
  }

  function director(id) {
    const alive = () => { if (id !== runId || state.mode !== 'guided') throw new Cancelled(); };
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms)).then(alive);
    // One eased, slightly curved path; it keeps tracking the target while that target animates in.
    const glide = (selector, fx = .5, fy = .5) => new Promise((resolve, reject) => {
      hovered?.classList.remove('is-demo-hover'); hovered = null;
      const from = { ...cursor };
      const first = pointOf(selector, fx, fy) || from;
      const distance = Math.hypot(first.x - from.x, first.y - from.y);
      const duration = clamp(360 + distance * .75, 420, 1000);
      const bend = Math.min(36, distance * .1);
      const begin = performance.now();
      const frame = now => {
        if (id !== runId || state.mode !== 'guided') { reject(new Cancelled()); return; }
        const t = clamp((now - begin) / duration); const e = easeInOut(t);
        const to = pointOf(selector, fx, fy) || first;
        const dx = to.x - from.x; const dy = to.y - from.y; const length = Math.hypot(dx, dy) || 1;
        const cx = (from.x + to.x) / 2 - dy / length * bend; const cy = (from.y + to.y) / 2 + dx / length * bend;
        const u = 1 - e;
        setCursor(u * u * from.x + 2 * u * e * cx + e * e * to.x, u * u * from.y + 2 * u * e * cy + e * e * to.y);
        if (t < 1) { requestAnimationFrame(frame); return; }
        hovered = $(selector, $('#desktop')); hovered?.classList.add('is-demo-hover');
        resolve();
      };
      requestAnimationFrame(frame);
    });
    const press = selector => {
      const pointer = $('#demo-cursor');
      const ring = document.createElement('i'); ring.className = 'click-ring';
      ring.addEventListener('animationend', () => ring.remove(), { once: true });
      pointer.append(ring); pointer.classList.add('is-pressing');
      const target = $(selector, $('#desktop')); target?.classList.add('is-demo-pressed');
      setTimeout(() => { pointer.classList.remove('is-pressing'); target?.classList.remove('is-demo-pressed'); }, 110);
    };
    const click = async (selector, change, { double = false } = {}) => {
      alive();
      press(selector);
      if (double) { await wait(150); press(selector); }
      await wait(90);
      change(state.guidedUI, state.guidedData);
      renderAll();
    };
    // One character at a time, with an uneven human rhythm; the caret stays solid while typing.
    const type = async text => {
      const rhythm = [230, 180, 260, 200, 220];
      $('.type-caret')?.classList.add('is-typing');
      for (let i = 1; i <= text.length; i++) {
        state.guidedUI.modal.draft = text.slice(0, i);
        const input = $('#account-name'); if (input) input.value = state.guidedUI.modal.draft;
        placeCaret();
        if (i < text.length) await wait(rhythm[(i - 1) % rhythm.length]);
      }
      $('.type-caret')?.classList.remove('is-typing');
    };
    return { wait, glide, click, type };
  }

  const scripts = [
    // 01 Open the menu bar panel.
    async go => {
      await go.wait(700);
      await go.glide('.menu-app');
      await go.click('.menu-app', ui => { ui.panelOpen = true; });
      await go.wait(2800);
    },
    // 02 Open Codex and look across its accounts.
    async go => {
      await go.wait(600);
      await go.glide(codexTile, .5, .42);
      await go.click(codexTile, ui => { ui.panelView = 'detail'; ui.providerId = 'codex'; });
      await go.wait(420);
      await go.glide(personalCard, .5, .58);
      await go.wait(2800);
    },
    // 03 Settings, edit, type a new name.
    async go => {
      await go.wait(600);
      const settings = '.detail-panel [data-action="open-settings"]';
      const edit = '[data-action="rename"][data-account="codex-work"]';
      await go.glide(settings);
      await go.click(settings, ui => { ui.settingsOpen = true; });
      await go.wait(160);
      await go.glide(edit);
      await go.click(edit, ui => { ui.modal = { type: 'rename', providerId: 'codex', accountId: 'codex-work', draft: '' }; });
      await go.wait(200);
      await go.glide('#account-name', .92, .5);
      await go.type(newAlias);
      await go.wait(2600);
    },
    // 04 Save, close settings, see the name in detail and overview.
    async go => {
      await go.wait(600);
      await go.glide('[data-action="save-name"]');
      await go.click('[data-action="save-name"]', (ui, data) => {
        data[0].accounts[0].alias = newAlias; ui.modal = null;
        state.freshName = { id: 'codex-work', until: performance.now() + 6000 };
        toast('名称已保存，总览与详情已同步', { inSettings: true });
      });
      await go.wait(700);
      await go.glide('.traffic-close');
      await go.click('.traffic-close', ui => { ui.settingsOpen = false; ui.panelOpen = true; });
      await go.wait(1100);
      const back = '.detail-panel [data-action="back"]';
      await go.glide(back);
      await go.click(back, ui => { ui.panelView = 'overview'; });
      await go.wait(2800);
    },
    // 05 Double-click another account, confirm the switch.
    async go => {
      await go.wait(600);
      await go.glide(codexTile, .5, .42);
      await go.click(codexTile, ui => { ui.panelView = 'detail'; ui.providerId = 'codex'; });
      await go.wait(420);
      await go.glide(personalCard, .5, .3);
      await go.click(personalCard, ui => { ui.modal = { type: 'switch', providerId: 'codex', accountId: 'codex-personal', inPanel: true }; }, { double: true });
      await go.wait(360);
      await go.glide('[data-action="confirm-switch"]');
      await go.click('[data-action="confirm-switch"]', (ui, data) => {
        data[0].currentId = 'codex-personal'; ui.modal = null; state.justSwitched = 'codex-personal';
        toast('已切换到 个人账号');
      });
      await go.wait(2000);
    }
  ];

  function showChapter(index) {
    state.chapter = index;
    const chapter = chapters[index];
    $('#chapter-number').textContent = `0${index + 1}`;
    $('#chapter-label').textContent = chapter.label;
    $('#chapter-title').textContent = chapter.title;
    $('#chapter-description').innerHTML = chapter.description;
    $$('[data-chapter]').forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)));
    const heading = $('.story-heading');
    heading.classList.remove('is-swapping'); void heading.offsetWidth; heading.classList.add('is-swapping');
  }

  function stopPlay() { runId++; hovered?.classList.remove('is-demo-hover'); hovered = null; }
  // Chapters play on a timer, never on scroll. A jump starts from how the previous chapter left the screen.
  async function playChapter(index, { jump = true } = {}) {
    stopPlay();
    const id = runId;
    if (reducedMotion.matches) return;
    if (jump) { const scene = sceneFor(index - 1); state.guidedData = scene.data; state.guidedUI = scene.ui; renderAll(); }
    showChapter(index);
    try {
      await scripts[index](director(id));
      if (index < scripts.length - 1) playChapter(index + 1, { jump: false });
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
    }
  }

  $('#try-button').addEventListener('click', () => enterManual());
  $('#resume-button').addEventListener('click', () => {
    state.mode = 'guided';
    state.updatedLabel = '10:42 已更新';
    $('#app-toast').classList.remove('is-visible');
    updateModeControls();
    playChapter(state.chapter || 0);
  });
  $('#reset-button').addEventListener('click', () => {
    state.manualData = initialData(); state.manualUI = initialUI(); state.updatedLabel = '10:42 已更新';
    renderAll(); toast('演示已重置');
  });
  $$('[data-chapter]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.chapter);
    if (reducedMotion.matches) {
      const scene = sceneFor(index);
      state.manualData = scene.data; state.manualUI = scene.ui;
      renderAll(); showChapter(index);
      return;
    }
    state.mode = 'guided'; updateModeControls();
    playChapter(index);
  }));

  // The preview window is built once, with all three steps stacked in the same spot. The window keeps the
  // height of its tallest step, so the blue button never moves or resizes; a step change only cross-fades.
  const setupTitles = ['选择你的平台', '选择要导入的账号', '准备好，开始吧'];
  const setupNotes = ['只选择你想查看额度的服务', '扫描本机登录，勾选需要的账号', '示例流程已完成'];
  function setupBody(step) {
    let i = 2; let content = '';
    if (step === 0) content = `<div class="setup-preview-options">${platformDefinitions.map(provider => `<div class="setup-preview-option rise" style="--i:${i++}">${brand(provider)}${provider.shortName}<span>✓</span></div>`).join('')}</div>`;
    if (step === 1) content = ['工作账号', '个人账号'].map((name, index) => `<div class="setup-preview-account rise" style="--i:${i++}">${brand(platformDefinitions[0])}<div><strong>${name}</strong><small>${index ? 'personal' : 'work'}@example.com</small></div><span>✓</span></div>`).join('');
    if (step === 2) content = '<div class="import-success rise" style="--i:2"><svg class="success-check" viewBox="0 0 48 48" aria-hidden="true"><path pathLength="1" d="M11 25l8.5 8.5L37.5 15"/></svg>你的菜单栏，准备就绪<small>五个平台，随时查看</small></div>';
    return `<div class="setup-body"><h3 class="rise" style="--i:0">${setupTitles[step]}</h3><p class="rise" style="--i:1">${setupNotes[step]}</p>${content}</div>`;
  }
  // Labels that change in place share one grid cell, so the box is always as wide as the longest one.
  const swapText = (name, labels) => `<span class="swap ${name}">${labels.map(text => `<span>${text}</span>`).join('')}</span>`;
  function renderSetup() {
    const step = state.setupStep;
    const root = $('#setup-preview');
    if (!$('.setup-stage', root)) {
      root.innerHTML = `<div class="setup-window-top"><div class="traffic-lights"><span class="traffic-close"></span><span class="traffic-yellow"></span><span class="traffic-green"></span></div>${swapText('setup-count', ['1 / 3', '2 / 3', '3 / 3'])}</div><div class="setup-stage">${[0, 1, 2].map(setupBody).join('')}</div><div class="setup-preview-footer">${swapText('setup-footnote', ['可以稍后从设置中补充', '虚拟数据演示'])}<button class="setup-next" data-setup-next>${swapText('setup-next-label', ['下一步 →', '再看一次 ↺'])}</button></div><span class="sr-only" id="setup-status" aria-live="polite"></span>`;
    }
    const pick = (selector, index) => [...$(selector, root).children].forEach((label, position) => { label.classList.toggle('is-on', position === index); label.setAttribute('aria-hidden', String(position !== index)); });
    pick('.setup-count', step);
    pick('.setup-footnote', step === 2 ? 1 : 0);
    pick('.setup-next-label', step === 2 ? 1 : 0);
    // Earlier steps wait on the left and later ones on the right, so content slides the way you are going.
    $$('.setup-body', root).forEach((body, index) => {
      body.classList.toggle('is-on', index === step);
      body.classList.toggle('is-before', index < step);
      body.classList.toggle('is-after', index > step);
      body.inert = index !== step;
      body.setAttribute('aria-hidden', String(index !== step));
    });
    $('#setup-status').textContent = `第 ${step + 1} 步，共 3 步：${setupTitles[step]}`;
    $$('[data-setup-step]').forEach((button, index) => button.setAttribute('aria-pressed', String(step === index)));
  }
  $$('[data-setup-step]').forEach(button => button.addEventListener('click', () => { state.setupStep = Number(button.dataset.setupStep); renderSetup(); }));
  $('#setup-preview').addEventListener('click', event => { if (event.target.closest('[data-setup-next]')) { state.setupStep = (state.setupStep + 1) % 3; renderSetup(); } });
  $('#mini-provider-row').innerHTML = platformDefinitions.map(provider => `<span>${brand(provider)}</span>`).join('');
  const brandRows = [
    [['icons/codex.svg','Codex',1],['icons/claude.svg','Claude',1],['icons/cursor.svg','Cursor',1],['icons/copilot.svg','GitHub Copilot',1],['icons/kiro.svg','Kiro',1],['brands/openai.svg','ChatGPT'],['brands/gemini-color.svg','Gemini'],['brands/grok.svg','Grok'],['brands/perplexity-color.svg','Perplexity'],['brands/meta-color.svg','Meta AI'],['brands/windsurf.svg','Windsurf']],
    [['brands/deepseek-color.svg','DeepSeek'],['brands/qwen-color.svg','通义千问'],['brands/doubao-color.svg','豆包'],['brands/kimi-color.svg','Kimi'],['brands/zhipu-color.svg','智谱清言'],['brands/wenxin-color.svg','文心一言'],['brands/hunyuan-color.svg','腾讯混元'],['brands/yuanbao-color.svg','腾讯元宝'],['brands/minimax-color.svg','MiniMax'],['brands/stepfun-color.svg','阶跃星辰'],['brands/spark-color.svg','讯飞星火'],['brands/baichuan-color.svg','百川'],['brands/trae-color.svg','Trae']]
  ];
  const brandChip = ([icon, name, supported]) => `<span class="brand-chip${supported ? ' is-supported' : ''}"><img src="assets/${icon}" alt="" width="24" height="24">${name}${supported ? '<i class="live-dot" title="Mac 版已支持"></i>' : ''}</span>`;
  ['#provider-strip', '#provider-strip-2'].forEach((id, index) => {
    const group = brandRows[index].map(brandChip).join('');
    $(id).innerHTML = `<div class="marquee-track"><div class="marquee-group">${group}</div><div class="marquee-group" aria-hidden="true">${group}</div></div>`;
  });
  renderSetup();
  renderAll();
  updateModeControls();

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) { enterManual(); state.manualUI.modal = null; renderAll(); }
    updateModeControls();
  });
  window.addEventListener('resize', () => {
    if (state.mode === 'manual' && state.manualUI.windowPosition) { state.manualUI.windowPosition = null; renderAll(); }
  });
  new ResizeObserver(applyCamera).observe($('#macbook'));
  if (reducedMotion.matches) enterManual();
  else {
    const start = sceneFor(-1); state.guidedData = start.data; state.guidedUI = start.ui;
    renderAll(); showChapter(0); setCursor(cursor.x, cursor.y);
    // Start the first chapter once the demo is actually on screen; scrolling never drives it.
    const viewer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && state.mode === 'guided') { viewer.disconnect(); playChapter(0, { jump: false }); }
    }, { threshold: .5 });
    viewer.observe($('#macbook'));
  }
  // Dot field behind the whole page: React Bits DotGrid (dotgrid.js), tuned for the light Apple palette.
  if (window.createDotGrid) {
    const softQuiet = [
      '.story-heading-main, #chapter-description, .demo-note, .chapter-controls, .demo-mode-controls, .story-scroll-hint',
      '.quiet-section > .section-kicker, .quiet-section > h2',
      '.setup-copy > .section-kicker, .setup-copy > h2, .setup-copy > p, .preview-caption',
      '.support-header > *, .marquee-note, .site-footer > *'
    ].join(', ');
    window.createDotGrid($('.page-dots'), {
      dotSize: 4, gap: 14, baseColor: '#c7c7cc', activeColor: '#0071e3',
      proximity: 140, shockRadius: 320, shockStrength: 5, returnDuration: 0.8,
      quiet: softQuiet + ', .screen-corner, .bento > article, .setup-steps, .setup-preview, .provider-marquee, .support-details',
      quietSoft: softQuiet,
      quietWhole: '.screen-corner, .provider-marquee',
      ignoreInteraction: '.site-header, .screen-corner, .chapter-controls, .bento > article, .setup-steps, .setup-preview, .provider-marquee, .support-details, .download-section'
    });
  }

  // The hero title keeps still; its colour rings centre on wherever the pointer is.
  (() => {
    const lines = $$('.hero-line');
    const glow = lines.map(() => ({ x: 0, y: 0, tx: 0, ty: 0, ready: false }));
    let frame = 0;
    const centre = () => lines.forEach((line, i) => { glow[i].tx = line.offsetWidth / 2; glow[i].ty = line.offsetHeight / 2; });
    function tick() {
      frame = 0; let moving = false;
      lines.forEach((line, i) => {
        const g = glow[i];
        if (!g.ready) { g.x = g.tx; g.y = g.ty; g.ready = true; }
        g.x += (g.tx - g.x) * .1; g.y += (g.ty - g.y) * .1;
        if (Math.abs(g.tx - g.x) + Math.abs(g.ty - g.y) > .3) moving = true;
        line.style.setProperty('--mx', `${g.x.toFixed(1)}px`); line.style.setProperty('--my', `${g.y.toFixed(1)}px`);
      });
      if (moving) frame = requestAnimationFrame(tick);
    }
    const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
    window.addEventListener('pointermove', event => {
      lines.forEach((line, i) => { const box = line.getBoundingClientRect(); glow[i].tx = event.clientX - box.left; glow[i].ty = event.clientY - box.top; });
      wake();
    }, { passive: true });
    document.addEventListener('pointerleave', () => { centre(); wake(); });
    centre(); wake();
  })();

  // Inside the demo, the visitor's own pointer carries a "You" tag so it never looks like the Demo cursor.
  (() => {
    const tag = $('#you-tag'); const desktop = $('#desktop');
    if (!window.matchMedia('(pointer: fine)').matches) return;
    desktop.addEventListener('pointermove', event => { tag.hidden = false; tag.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 20}px)`; });
    desktop.addEventListener('pointerleave', () => { tag.hidden = true; });
  })();

  document.documentElement.dataset.demoReady = 'true';
})();
