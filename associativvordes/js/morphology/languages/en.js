import { morph } from './base.js';
export const en = Object.freeze({
  prefixes: ['de','re','inter','un','in','dis','pre','post','anti','trans'].map(form => morph(form, form, { type: 'derivational_prefix', priority: 80 })),
  derivationalSuffixes: ['ation','ative','native','ism','istic','ist','ity','ive','al','ion','tion','ly','ness','s'].map(s => morph(s, s === 'istic' ? 'ism' : s, { outputPos: ['ism','ation','ion','tion','ity','ness'].includes(s) ? 'noun' : 'adjective' })),
  inflectionalEndings: ['ingly','edly','ally','ies','es','s','ed','ing','er','est','e'].map(form => morph(form, form, { type: 'inflection' })),
  connectors: ['at','ac','o','i'].map(form => morph(form, form, { type: 'connector' })), serviceMorphs: ['e'].map(form => morph(form, form, { type: 'service' })), contextualSequences: [], orthographicAlternations: [], morphotacticRules: { allowMultipleDerivationalSuffixes: true }, lexicalRootRules: { minimumLength: 3 }
});
