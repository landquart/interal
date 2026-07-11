import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import handler from '../api/cards.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Skipping cards Supabase integration test: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(0);
}

function createMockResponse() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(chunk = '') {
      this.body += chunk;
    }
  };
}

const diagnosticTitle = `diagnostic-card-${Date.now()}`;
const req = {
  method: 'POST',
  headers: { origin: 'https://interal.vercel.app' },
  body: {
    section: 'internationalismes',
    title: diagnosticTitle,
    category: 'in',
    payload: {
      version: '1.0',
      card_type: 'vord_card',
      vord_type: 'in',
      interal: { word: diagnosticTitle }
    }
  }
};
const res = createMockResponse();

await handler(req, res);
assert.equal(res.statusCode, 200, res.body);

const data = JSON.parse(res.body);
assert.equal(data.ok, true);
assert.match(data.id, /^in_[0-9A-Za-z]{12}$/);
assert.notMatch(data.id, /^in_0{12}$/);
assert.equal(data.section, 'internationalismes');
assert.equal(data.status, 'pending');
assert.equal(data.discussionId, `card-${data.id}`);
assert.equal(data.card?.payload?.id, data.id);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

try {
  const { data: row, error } = await supabase
    .from('cards')
    .select('id,section,status,title,category,discussion_id,payload')
    .eq('id', data.id)
    .single();

  assert.ifError(error);
  assert.equal(row.id, data.id);
  assert.equal(row.section, 'internationalismes');
  assert.equal(row.status, 'pending');
  assert.equal(row.title, diagnosticTitle);
  assert.equal(row.category, 'in');
  assert.equal(row.discussion_id, `card-${data.id}`);
  assert.equal(row.payload.id, data.id);
  assert.equal(row.payload.interal.word, diagnosticTitle);
} finally {
  const { error: deleteError } = await supabase.from('cards').delete().eq('id', data.id);
  assert.ifError(deleteError);
}
