import assert from 'node:assert/strict';

function encodePageData(data) {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
}

function decodePageData(encoded) {
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
}

function createLocalStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key(index) { return Array.from(map.keys())[index] ?? null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    snapshot() { return Object.fromEntries(map.entries()); }
  };
}

function createManager({ href = 'https://example.test/tool/', storage = createLocalStorage(), confirm = async () => true } = {}) {
  const location = new URL(href);
  const navigation = [];
  let api = null;
  let didRestore = false;
  let isApplying = false;
  let isResetting = false;
  let saveTimer = null;

  function getPathKey() { return location.pathname; }
  function getStorageKey() { return `interal.explicitPageState:${getPathKey()}`; }
  function register(candidate) {
    api = {
      pageId: candidate.pageId || getPathKey(),
      collect: candidate.collect,
      apply: candidate.apply,
      clearStorageKeys: Array.isArray(candidate.clearStorageKeys) ? candidate.clearStorageKeys : []
    };
    return true;
  }
  function getPayload() { return { version: 1, page: api.pageId, path: getPathKey(), data: api.collect() }; }
  function saveNow() {
    if (isResetting || isApplying || !api) return false;
    storage.setItem(getStorageKey(), JSON.stringify(getPayload()));
    return true;
  }
  function scheduleSave() {
    if (isResetting || isApplying || !api) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, 150);
  }
  function decodeUrlPayload() {
    const encoded = location.searchParams.get('state');
    return encoded ? decodePageData(encoded) : null;
  }
  function applyPayload(payload, source) {
    if (didRestore || isResetting || !api || !payload || typeof payload !== 'object') return false;
    isApplying = true;
    try {
      api.apply(payload.data || {});
      didRestore = true;
      if (source === 'url') storage.setItem(getStorageKey(), JSON.stringify({ version: 1, page: payload.page || api.pageId, path: payload.path || getPathKey(), data: payload.data || {} }));
      return true;
    } finally { isApplying = false; }
  }
  function restoreInitial() {
    if (!api || didRestore || isResetting) return false;
    const fromUrl = decodeUrlPayload();
    if (fromUrl) return applyPayload(fromUrl, 'url');
    if (location.searchParams.has('state')) return false;
    const raw = storage.getItem(getStorageKey());
    return raw ? applyPayload(JSON.parse(raw), 'storage') : false;
  }
  function cleanCurrentUrl() {
    location.searchParams.delete('s');
    location.searchParams.delete('state');
    if (/state=/.test(location.hash)) location.hash = '';
    return `${location.pathname}${location.search}${location.hash}`;
  }
  function clearStorage(extraKeys = []) {
    const keys = new Set([...extraKeys, getStorageKey(), 'interal_associative_state', 'determinator-valentyp-state-v1']);
    if (api) api.clearStorageKeys.forEach((key) => keys.add(key));
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (key?.startsWith('interal.pageState:') || key?.startsWith('interal.explicitPageState:') || keys.has(key)) storage.removeItem(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  }
  async function reset(options = {}) {
    if (!(options.skipConfirm || await confirm())) return false;
    isResetting = true;
    clearTimeout(saveTimer);
    saveTimer = null;
    clearStorage(options.storageKeys || []);
    const cleanUrl = cleanCurrentUrl();
    navigation.push(cleanUrl);
    return true;
  }
  function copyStateLink() {
    const payload = getPayload();
    const url = new URL(location.href);
    url.hash = '';
    url.searchParams.delete('s');
    url.searchParams.delete('state');
    url.searchParams.set('state', encodePageData(payload));
    return url.toString();
  }
  return { register, saveNow, scheduleSave, restoreInitial, reset, copyStateLink, clearStorage, getStorageKey, storage, navigation };
}

async function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

{
  const storage = createLocalStorage();
  const first = createManager({ storage });
  first.register({ pageId: 'tool', collect: () => ({ value: 'saved' }), apply() {} });
  assert.equal(first.saveNow(), true);
  assert.deepEqual(JSON.parse(storage.getItem('interal.explicitPageState:/tool/')).data, { value: 'saved' });
  let applied;
  const second = createManager({ storage });
  second.register({ pageId: 'tool', collect: () => ({}), apply: (data) => { applied = data; } });
  assert.equal(second.restoreInitial(), true);
  assert.deepEqual(applied, { value: 'saved' });
}

{
  const storage = createLocalStorage({ 'interal.explicitPageState:/tool/': JSON.stringify({ data: { value: 'local' } }) });
  const encoded = encodePageData({ page: 'tool', data: { value: 'url' } });
  let applied;
  const manager = createManager({ href: `https://example.test/tool/?state=${encoded}`, storage });
  manager.register({ pageId: 'tool', collect: () => ({}), apply: (data) => { applied = data; } });
  assert.equal(manager.restoreInitial(), true);
  assert.deepEqual(applied, { value: 'url' });
  assert.deepEqual(JSON.parse(storage.getItem('interal.explicitPageState:/tool/')).data, { value: 'url' });
}

{
  const storage = createLocalStorage({
    'interal.explicitPageState:/tool/': 'x',
    'interal.explicitPageState:/other/': 'x',
    'interal.pageState:/tool/': 'x',
    interal_associative_state: 'x',
    'determinator-valentyp-state-v1': 'x',
    api_extra: 'x',
    option_extra: 'x',
    keep: 'x'
  });
  const manager = createManager({ href: 'https://example.test/tool/?state=abc&s=old#state=old', storage });
  manager.register({ pageId: 'tool', collect: () => ({ value: 'new' }), apply() {}, clearStorageKeys: ['api_extra'] });
  assert.equal(await manager.reset({ skipConfirm: true, storageKeys: ['option_extra'] }), true);
  assert.deepEqual(storage.snapshot(), { keep: 'x' });
  assert.deepEqual(manager.navigation, ['/tool/']);
  assert.equal(manager.saveNow(), false);
  manager.scheduleSave();
  await delay(180);
  assert.deepEqual(storage.snapshot(), { keep: 'x' });
}

{
  const manager = createManager({ href: 'https://example.test/tool/?s=old&state=old#state=old' });
  manager.register({ pageId: 'tool', collect: () => ({ value: 'copy' }), apply() {} });
  const link = new URL(manager.copyStateLink());
  assert.equal(link.searchParams.has('s'), false);
  assert.equal(link.hash, '');
  assert.deepEqual(decodePageData(link.searchParams.get('state')).data, { value: 'copy' });
}

{
  let calls = 0;
  const storage = createLocalStorage({ 'interal.explicitPageState:/tool/': JSON.stringify({ data: { value: 1 } }) });
  const manager = createManager({ storage });
  manager.register({ pageId: 'tool', collect: () => ({}), apply: () => { calls += 1; } });
  assert.equal(manager.restoreInitial(), true);
  assert.equal(manager.restoreInitial(), false);
  assert.equal(calls, 1);
}

console.log('page-state-manager tests passed');
