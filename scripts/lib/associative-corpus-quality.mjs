const KNOWN_NOISE = new Set(['brokethemouldaftertheymadepeter', 'pediatricianand', 'pediatricianwho', 'helpedallof', 'eroticizedit', 'dutheillet', 'madrillet', 'ennuyeux']);

export function classifyCorpusLemma(value) {
  const word = String(value || '').normalize('NFC').trim();
  const normalized = word.toLocaleLowerCase('und');
  const reasons = [];
  if (!word) return { status: 'rejected', reasons: ['empty'] };
  if (KNOWN_NOISE.has(normalized)) reasons.push('known_audit_noise');
  if (/https?:\/\/|www\.|<[^>]+>|&(?:lt|gt|amp|quot);/i.test(word)) reasons.push('markup_or_url');
  if (/[@#][\p{L}\p{N}_-]{2,}/u.test(word)) reasons.push('username_or_tag');
  if (/\s/u.test(word)) reasons.push('multiword_or_sentence');
  if (word.length > 48) reasons.push('excessive_length');
  if (/[^\p{L}\p{M}'’-]/u.test(word)) reasons.push('mixed_nonlexical_characters');
  const rejected = reasons.some(reason => ['known_audit_noise', 'markup_or_url', 'username_or_tag', 'multiword_or_sentence'].includes(reason));
  if (rejected) return { status: 'rejected', reasons };
  if (reasons.length || word.length > 30) return { status: 'suspicious', reasons: reasons.length ? reasons : ['unusually_long'] };
  return { status: 'accepted', reasons: [] };
}

export const isRuntimeCorpusMember = member => !['rejected'].includes(member?.corpus_quality?.status);
