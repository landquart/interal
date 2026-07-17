export const FREQUENCY_LIST_BASE_PATH = './frequency lists';

export const BASE_CATEGORY_WEIGHTS = {
  subtitles: 0.30,
  normative: 0.30,
  web: 0.30,
  mixed: 0.10
};

export const LANGUAGE_SOURCES = {
  en: {
    subtitles: [
      { file: 'hermit_2016_en_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json', optional: true },
      'hermit_2018_en_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json'
    ],
    normative: ['bnc-clean2.lemmatized_spacy_ipm6.json'],
    web: ['sorted.uk.lemma.unigrams.cleaned_recommended_min100_ipm6.json'],
    mixed: []
  },
  de: {
    subtitles: ['hermit_2018_de_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json'],
    normative: ['deu_lemma_rank_word_ipm_corrected.json'],
    web: ['sorted.de.lemma.unigrams.cleaned_recommended_min100_ipm6.json'],
    mixed: []
  },
  es: {
    subtitles: [
      'hermit_2016_es_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json',
      'hermit_2018_es_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json'
    ],
    normative: [],
    web: [],
    mixed: ['es_wordlist.lemmatized_stanza_ipm6.json']
  },
  fr: {
    subtitles: ['hermit_2018_fr_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json'],
    normative: [],
    web: ['sorted.fr.lemma.unigrams.cleaned_recommended_min100_ipm6.json'],
    mixed: []
  },
  it: {
    subtitles: [
      'hermit_2016_it_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json',
      'hermit_2018_it_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json'
    ],
    normative: [],
    web: ['sorted.it.lemma.unigrams.cleaned_recommended_min100_ipm6.json'],
    mixed: []
  },
  ru: {
    subtitles: ['hermit_2018_ru_full_lemmatized_pymorphy3_ipm6.json'],
    normative: ['rnc-orig.out.lpos-clean2-biwt.cleaned_ipm6.json'],
    web: ['ruwac.out.gz.lpos-clean2-biwt.cleaned_recommended_min100_ipm6.json'],
    mixed: []
  }
};

export const CATEGORY_ORDER = ['subtitles', 'normative', 'web', 'mixed'];


if (typeof window !== 'undefined') {
  window.InteralFrequencySources = { FREQUENCY_LIST_BASE_PATH, BASE_CATEGORY_WEIGHTS, LANGUAGE_SOURCES, CATEGORY_ORDER };
}
