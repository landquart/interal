import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const CLEANUP_CARDS_SECRET = (process.env.CLEANUP_CARDS_SECRET || '').trim();

const DAY_MS = 24 * 60 * 60 * 1000;

const CLEANUP_RULES = {
  pending: {
    table: 'cards',
    status: 'pending',
    column: 'created_at',
    olderThanDays: 60,
    description: 'Delete pending cards where created_at is older than 60 days.'
  },
  rejected: {
    table: 'cards',
    status: 'rejected',
    column: 'updated_at',
    olderThanDays: 30,
    description: 'Delete rejected cards where updated_at is older than 30 days.'
  },
  archived: {
    table: 'cards',
    status: 'archived',
    column: 'updated_at',
    olderThanDays: 60,
    description: 'Delete archived cards where updated_at is older than 60 days.'
  },
  published: {
    table: 'cards',
    status: 'published',
    description: 'Never delete published cards automatically.'
  },
  share_states: {
    table: 'share_states',
    description: 'Never delete or modify share_states from this cleanup endpoint.'
  }
};

let supabaseClient = null;

function validateEnvironment() {
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL environment variable');
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

function getSupabaseClient() {
  validateEnvironment();

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    });
  }

  return supabaseClient;
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
}

function sendJson(res, status, data) {
  res.writeHead(status, getCorsHeaders());
  res.end(JSON.stringify(data));
}

function getQueryValue(req, name) {
  const value = req.query?.[name];
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
}

function getCutoffs() {
  const now = Date.now();

  return {
    pending: new Date(now - CLEANUP_RULES.pending.olderThanDays * DAY_MS).toISOString(),
    rejected: new Date(now - CLEANUP_RULES.rejected.olderThanDays * DAY_MS).toISOString(),
    archived: new Date(now - CLEANUP_RULES.archived.olderThanDays * DAY_MS).toISOString()
  };
}

function createEmptyCounts() {
  return {
    pending: 0,
    rejected: 0,
    archived: 0,
    total: 0
  };
}

function withTotal(counts) {
  return {
    ...counts,
    total: counts.pending + counts.rejected + counts.archived
  };
}

async function countCards(client, status, column, before) {
  const { count, error } = await client
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('status', status)
    .lt(column, before);

  if (error) throw error;
  return count || 0;
}

async function deleteCards(client, status, column, before) {
  const { count, error } = await client
    .from('cards')
    .delete({ count: 'exact' })
    .eq('status', status)
    .lt(column, before);

  if (error) throw error;
  return count || 0;
}

async function runCleanup({ dryRun }) {
  const client = getSupabaseClient();
  const cutoffs = getCutoffs();
  const counts = createEmptyCounts();
  const operation = dryRun ? countCards : deleteCards;

  counts.pending = await operation(
    client,
    CLEANUP_RULES.pending.status,
    CLEANUP_RULES.pending.column,
    cutoffs.pending
  );
  counts.rejected = await operation(
    client,
    CLEANUP_RULES.rejected.status,
    CLEANUP_RULES.rejected.column,
    cutoffs.rejected
  );
  counts.archived = await operation(
    client,
    CLEANUP_RULES.archived.status,
    CLEANUP_RULES.archived.column,
    cutoffs.archived
  );

  return {
    counts: withTotal(counts),
    cutoffs
  };
}

function assertAuthorized(req) {
  if (!CLEANUP_CARDS_SECRET) return;

  const providedSecret = getQueryValue(req, 'secret');
  if (providedSecret !== CLEANUP_CARDS_SECRET) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed'
    });
    return;
  }

  try {
    assertAuthorized(req);

    const dryRun = getQueryValue(req, 'dry') === '1';
    const { counts, cutoffs } = await runCleanup({ dryRun });
    const response = {
      ok: true,
      dryRun,
      [dryRun ? 'wouldDelete' : 'deleted']: counts,
      rules: CLEANUP_RULES,
      cutoffs
    };

    if (!CLEANUP_CARDS_SECRET) {
      response.warning = 'CLEANUP_CARDS_SECRET is not set';
    }

    sendJson(res, 200, response);
  } catch (error) {
    const status = error.status || 500;

    console.error('cleanup-cards error:', status === 401 ? 'Unauthorized' : error);

    sendJson(res, status, {
      ok: false,
      error: status === 401 ? 'Unauthorized' : error.message || 'Internal server error',
      dryRun: getQueryValue(req, 'dry') === '1',
      rules: CLEANUP_RULES
    });
  }
}
