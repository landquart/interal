const $ = id => document.getElementById(id);
let busy = false;
let session, card, rows = [], offset = 0, group = '', preview, pending;
const staged = new Map();
const filterIds = ['language', 'family', 'search', 'status', 'category', 'grouped', 'independent', 'doubtful', 'disagreement'];
function el(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
function message(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
async function api(path, body) {
  const response = await fetch('/api/' + path, body === undefined ? {} : {method: 'POST', headers: {'Content-Type': 'application/json', 'X-CSRF-Token': session?.csrf || ''}, body: JSON.stringify(body)});
  const value = await response.json(); if (!response.ok) throw new Error(value.error); return value;
}
function action(fn) { return async event => { event?.preventDefault(); if (busy) return; busy = true; document.body.dataset.busy = 'true'; $('workspace').inert = true; try { await fn(event); } catch (e) { message(e.message, true); } finally { busy = false; document.body.dataset.busy = 'false'; $('workspace').inert = false; } }; }
function filters() { return Object.fromEntries(filterIds.map(id => [id, $(id).type === 'checkbox' ? ($(id).checked ? 'yes' : '') : $(id).value]).concat([['offset', offset], ['group', group]])); }
async function remember() { await api('progress', {filters: filters(), question: card?.question.id}); }
function fill(id, values) { const select = $(id), old = select.value; select.replaceChildren(select.options[0]); for (const v of values) { const o = el('option', v); o.value = v; select.append(o); } select.value = old; }
async function list() {
  const result = await api('questions?' + new URLSearchParams(filters())); rows = result.items;
  fill('language', result.languages); fill('family', result.families);
  $('progress').textContent = `Мой прогресс: ${result.progress.done} / ${result.progress.total}`;
  $('count').textContent = `Найдено: ${result.total} · ${offset + 1}–${Math.min(offset + rows.length, result.total)}`;
  $('prev-page').disabled = offset === 0; $('next-page').disabled = offset + rows.length >= result.total;
  $('queue').replaceChildren();
  for (const q of rows) {
    const row = el('div', undefined, 'queue-row' + (q.id === card?.question.id ? ' active' : ''));
    const button = el('button', q.lemma, 'queue-word'); button.type = 'button'; button.dataset.qid = q.id;
    button.append(el('small', `${q.language} · ${q.family} · ${q.status || 'без моего решения'}${staged.has(q.id) ? ' · в пакете' : ''}`));
    button.onclick = action(() => openCard(q.id)); row.append(button);
    if (session.role !== 'blind') { const g = el('button', '≡'); g.title = 'Показать эту группу'; g.onclick = action(async () => { group = q.group; offset = 0; $('clear-group').hidden = false; await list(); }); row.append(g); }
    $('queue').append(row);
  }
  await remember();
}
function section(parent, title, data, open = false) {
  const d = el('details'); d.open = open; d.append(el('summary', title), el('pre', JSON.stringify(data ?? 'unknown', null, 2))); parent.append(d);
}
function label(text, control) { const n = el('label', text); n.append(control); return n; }
function options(values, placeholder) { const select = el('select'); if (placeholder) { const o = el('option', placeholder); o.value = ''; select.append(o); } for (const v of values) { const o = el('option', v); o.value = v; select.append(o); } return select; }
function draftKey() { return `interal-review-draft:${session.actor}:${card.question.id}`; }
function itemFromForm() {
  return {question_id: card.question.id, source_snapshot: card.snapshot, expected_revision: card.revision, lexeme_id: $('lexeme').value, status: $('decision').value,
    relation: $('relation').value, reason: $('reason').value, pair_hash: card.pair_hash};
}
async function openCard(id) {
  card = await api('card?id=' + encodeURIComponent(id)); const q = card.question, root = $('card'); root.replaceChildren(); root.dataset.qid = q.id;
  root.append(el('h2', `${q.lemma} · ${q.language}`), el('p', `Семейная область проверки: ${q.family}`));
  root.append(el('p', `POS: ${q.pos || 'unknown'} (${q.pos_status || 'не проверен'}). Значение: ${q.sense_status || 'unknown'}.`, 'muted'));
  root.append(el('p', 'Ни написание, ни POS не устанавливают тождество значений. Утверждения источников требуют проверки.', 'muted'));
  if (card.source_changed) root.append(el('p', 'Источники обновлены после вашего решения. История сохранена; требуется повторная проверка.'));
  if (session.role === 'blind') root.append(el('p', 'Слепая проверка: доступны исходные утверждения источников и ваша история.'));
  else {
    for (const c of q.categories || []) root.append(el('span', c, 'badge'));
    section(root, 'Действующие соответствия · ссылки реестра', {memberships: q.existing_memberships, anchors: q.anchors, guard: q.guard});
    section(root, 'Морфологические пути · гипотезы алгоритма', q.discovery_paths);
    section(root, 'Конфликты и неопределённость · очередь поиска', {conflicts: q.conflicts, uncertainty: q.uncertainty_reasons, identity: q.grouping, independence: q.independence, priority: q.priority});
    section(root, 'Исторические решения · исходные области действия', {queue: q.previous_decisions, scoped: q.prior_scoped_decisions, unassigned: q.prior_unassigned_questions});
    section(root, 'Инфлекции · отдельные наблюдения', q.inflection_observations);
  }
  const evidence = el('details'); evidence.append(el('summary', 'Свидетельства · исходные строки и версии'));
  const unique = new Map(); for (const e of q.evidence_refs || []) { const key = JSON.stringify([e.id, e.claim]); if (!unique.has(key)) unique.set(key, e); }
  for (const e of unique.values()) {
    const block = el('div', undefined, 'claim');
    block.append(el('strong', `${e.source || 'unknown'} · ${e.revision || 'версия unknown'} · строка ${e.raw_locator?.line ?? 'unknown'}`));
    block.append(el('p', `Артефакт: ${e.artifact || 'unknown'}. Независимость: ${e.source_lineage?.status || 'unknown'}.`));
    if (/^https?:\/\//.test(e.url || '')) { const a = el('a', 'Открыть исходный ресурс'); a.href = e.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; block.append(a); }
    if (card.source_rows?.[e.id]) block.append(el('pre', card.source_rows[e.id].raw_text));
    else block.append(el('p', 'Локатор и хеш сохранены. Текст исходной строки в этой очереди не вложен; сверяйте с ресурсом.', 'muted'));
    section(block, 'Утверждение источника и точный локатор', e); evidence.append(block);
  }
  if (!unique.size) evidence.append(el('p', 'Свидетельства отсутствуют. Сохраните UNCERTAIN при недостаточных основаниях.'));
  root.append(evidence);
  if (session.role !== 'blind' && q.automated_proposals?.length) section(root, 'Предварительные выводы моделей · требуют проверки, не решения разметчика', q.automated_proposals, true);
  section(root, 'Лексемы · исходное написание, POS, ключи и область значения', q.lexeme_alternatives);
  section(root, 'Частота · наблюдения и их происхождение', q.frequency || {status: 'unknown'});
  section(root, 'История этой проверки', card.history);
  if (card.comparison) section(root, 'Независимые проверки · арбитраж', card.comparison, true);
  const form = el('form'); form.id = 'decision-form';
  const lexeme = options([], 'Выберите конкретную лексему'); lexeme.id = 'lexeme'; lexeme.required = true;
  for (const x of q.lexeme_alternatives || []) { const o = el('option', `${x.original || x.lemma} · ${x.native_pos || x.pos || 'POS unknown'} · ${x.native_key ? JSON.stringify(x.native_key) : x.id} · ${x.id}`); o.value = x.id; lexeme.append(o); }
  const decision = options(session.statuses); decision.id = 'decision'; decision.value = 'UNCERTAIN';
  const relation = options(session.relations); relation.id = 'relation'; relation.value = 'unresolved';
  const reason = el('textarea'); reason.id = 'reason'; reason.required = true; reason.maxLength = 8000;
  form.append(label('Лексема (решение относится только к этой лексеме и семье)', lexeme), label('Решение', decision), label('Тип связи', relation), label('Основание и ссылки на свидетельства', reason));
  const controls = el('div', undefined, 'actions'); const save = el('button', session.role === 'arbiter' ? 'Сохранить арбитраж' : 'Сохранить и далее'); save.id = 'save'; controls.append(save);
  if (session.role === 'arbiter' && !card.comparison) save.disabled = true;
  const next = el('button', 'Следующий вопрос'); next.id = 'next'; next.type = 'button'; next.onclick = action(nextCard); controls.append(next);
  const undo = el('button', 'Отменить последнее решение'); undo.id = 'undo'; undo.type = 'button'; undo.disabled = !card.own?.status;
  undo.onclick = action(async () => { if (!reason.value.trim()) throw new Error('Укажите основание отмены.'); await sendDecision('undo'); await openCard(id); await list(); }); controls.append(undo);
  if (session.role === 'reviewer') { const remove = el('button', 'Убрать из пакета'); remove.type = 'button'; remove.onclick = action(async () => { staged.delete(id); await list(); message(`В пакете: ${staged.size}`); }); controls.append(remove); const stage = el('button', 'Добавить в пакет принятия'); stage.id = 'stage'; stage.type = 'button'; stage.onclick = action(async () => { if (!form.reportValidity()) return; staged.set(id, {...itemFromForm(), status: 'ACCEPT_PROPOSED'}); message(`Подготовлено к предпросмотру: ${staged.size}`); await list(); }); controls.append(stage); }
  form.append(controls); root.append(form);
  const saved = staged.get(id) || JSON.parse(localStorage.getItem(draftKey()) || 'null');
  if (saved) { lexeme.value = saved.lexeme_id; decision.value = saved.status; relation.value = saved.relation; reason.value = saved.reason; }
  form.oninput = () => localStorage.setItem(draftKey(), JSON.stringify(itemFromForm()));
  form.onsubmit = action(async () => { save.disabled = true; try { await sendDecision(session.role === 'arbiter' ? 'arbitrate' : 'decide'); localStorage.removeItem(draftKey()); await list(); await nextCard(); } finally { if (save.isConnected) save.disabled = false; } });
  await remember();
}
async function sendDecision(route) {
  const body = {request_id: crypto.randomUUID(), snapshot: card.snapshot, item: itemFromForm()};
  // Retain the exact request on transport failure, so a retry never duplicates a save.
  if (!pending || JSON.stringify(pending.body.item) !== JSON.stringify(body.item) || pending.route !== route) pending = {route, body};
  const start = performance.now(); await api(pending.route, pending.body); pending = null;
  message(`Решение сохранено (${Math.round(performance.now() - start)} мс).`);
}
async function nextCard() {
  const at = rows.findIndex(q => q.id === card?.question.id);
  const next = rows[at + 1] || (at < 0 ? rows[0] : undefined);
  if (next) await openCard(next.id); else if (!$('next-page').disabled) { offset += 50; await list(); if (rows[0]) await openCard(rows[0].id); } else { $('card').replaceChildren(el('p', 'Очередь фильтра обработана. Измените фильтр для продолжения.')); card = null; }
}
async function start() {
  session = await api('session'); if (!session.actor) throw new Error('login required'); $('login').hidden = true; $('workspace').hidden = false;
  $('identity').textContent = `${session.actor} · ${session.role}`;
  document.querySelectorAll('.unblind').forEach(n => n.hidden = session.role === 'blind');
  $('batch').hidden = session.role !== 'reviewer'; $('backup').hidden = $('disagreement-label').hidden = session.role !== 'arbiter';
  for (const s of session.statuses) { const o = el('option', s); o.value = s; $('status').append(o); }
  await list();
  for (const [id, value] of Object.entries(session.progress.filters || {})) if (filterIds.includes(id)) { if ($(id).type === 'checkbox') $(id).checked = value === 'yes'; else $(id).value = value; }
  offset = Number(session.progress.filters?.offset) || 0; group = session.role === 'blind' ? '' : session.progress.filters?.group || ''; $('clear-group').hidden = !group;
  await list(); if (session.progress.question) { try { await openCard(session.progress.question); } catch { /* A question can be inactive in a refreshed queue. */ } }
}
$('login').onsubmit = action(async () => { await api('login', {token: $('token').value}); $('token').value = ''; await start(); message('Сессия открыта.'); });
$('filter').onclick = action(async () => { offset = 0; await list(); });
$('clear-group').onclick = action(async () => { group = ''; offset = 0; $('clear-group').hidden = true; await list(); });
$('prev-page').onclick = action(async () => { offset = Math.max(0, offset - 50); await list(); });
$('next-page').onclick = action(async () => { offset += 50; await list(); });
$('logout').onclick = action(async () => { await api('logout', {}); location.reload(); });
$('backup').onclick = () => { location.href = '/api/backup'; };
$('batch').onclick = action(async () => {
  preview = await api('preview', {items: [...staged.values()]}); $('preview-items').replaceChildren();
  for (const i of preview.items) { const row = el('div', undefined, 'claim'); row.append(el('strong', `${i.lemma} · ${i.language} · ${i.family}`), el('p', `Лексема: ${i.lexeme_id}`), el('p', `Связь: ${i.relation} · Прежний статус: ${i.prior_status || 'нет'}`), el('p', `Основание: ${i.reason}`), el('p', `Предупреждения: ${i.warnings.join(', ')}`)); $('preview-items').append(row); }
  $('preview').showModal();
});
$('cancel-batch').onclick = () => $('preview').close();
$('confirm-batch').onclick = action(async () => { const button = $('confirm-batch'); button.disabled = true; try { await api('commit-preview', {preview: preview.preview, request_id: preview.request_id ||= crypto.randomUUID()}); staged.clear(); $('preview').close(); message('Индивидуальные решения пакета сохранены.'); await list(); } finally { button.disabled = false; } });
$('login').hidden = true;
busy = true; document.body.dataset.busy = 'true'; $('workspace').inert = true;
start().catch(() => { $('login').hidden = false; }).finally(() => { busy = false; document.body.dataset.busy = 'false'; $('workspace').inert = false; });
