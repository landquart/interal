import { createClient } from '@supabase/supabase-js';
import { CARD_PREFIXES, createCardId } from '../api/cards.js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Skipping cards schema integration test: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(0);
}

const client = createClient(SUPABASE_URL.trim(), SUPABASE_SERVICE_ROLE_KEY.trim(), {
  auth: { persistSession: false, autoRefreshToken: false }
});

const createdIds = [];

try {
  for (const [section, prefix] of Object.entries(CARD_PREFIXES)) {
    const id = createCardId(section);
    const discussionId = `card-${id}`;
    const payload = {
      id,
      section,
      status: 'pending',
      discussionId,
      title: `schema smoke test ${section}`,
      test: true
    };
    const row = {
      id,
      section,
      status: 'pending',
      title: `schema smoke test ${section}`,
      category: prefix,
      discussion_id: discussionId,
      payload
    };

    const { error } = await client.from('cards').insert(row);
    if (error) {
      throw new Error(`${section} insert failed: ${error.code || 'NO_CODE'} ${error.message || error}`);
    }

    createdIds.push(id);

    const { data, error: selectError } = await client
      .from('cards')
      .select('id, section, status, category, discussion_id, payload')
      .eq('id', id)
      .single();

    if (selectError) throw new Error(`${section} verification failed: ${selectError.message}`);
    if (data.id !== id) throw new Error(`${section} id mismatch`);
    if (data.section !== section) throw new Error(`${section} section mismatch`);
    if (data.status !== 'pending') throw new Error(`${section} status mismatch`);
    if (data.category !== prefix) throw new Error(`${section} category mismatch`);
    if (data.discussion_id !== discussionId) throw new Error(`${section} discussion_id mismatch`);
    if (data.payload?.id !== id) throw new Error(`${section} payload.id mismatch`);
    if (data.payload?.section !== section) throw new Error(`${section} payload.section mismatch`);
    if (data.payload?.discussionId !== discussionId) throw new Error(`${section} payload.discussionId mismatch`);

    console.log(`${section}: ${id}`);
  }
} finally {
  if (createdIds.length) {
    const { error } = await client.from('cards').delete().in('id', createdIds);
    if (error) {
      console.error(`Cleanup failed for ${createdIds.join(', ')}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
