import { parseDerivationalModel as parseDerivationalModelImpl, MORPHEME_PARSER_VERSION, morphemeParserCacheSize } from './morphology/analyzer.js';

export { MORPHEME_PARSER_VERSION, morphemeParserCacheSize };
export const parseDerivationalModel = parseDerivationalModelImpl;

export function parseMorphemeModel(options = {}) {
  return parseDerivationalModelImpl({
    ...options,
    word: options.word || options.candidateWord,
    canonicalRoot: options.canonicalRoot || options.root || options.matchedRootVariant || options.rootVariant || options.match?.fragment,
    matchedRootVariant: options.matchedRootVariant || options.rootVariant || options.match?.fragment,
    matchIndex: options.matchIndex ?? options.rootIndex ?? options.match?.index
  });
}
