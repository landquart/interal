export function normalizeLanguageSource(category, source) {
  const fileName = typeof source === 'string' ? source : source?.file;
  const optional = typeof source === 'string' ? false : source?.optional === true;

  if (!source || (typeof source !== 'string' && typeof source !== 'object')) {
    throw new Error(`Invalid LANGUAGE_SOURCES entry for ${category}`);
  }
  if (typeof fileName !== 'string' || fileName.trim() !== fileName || fileName.length === 0) {
    throw new Error(`Invalid LANGUAGE_SOURCES file for ${category}`);
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(fileName)) {
    throw new Error(`LANGUAGE_SOURCES file must not be a URL for ${category}: ${fileName}`);
  }
  if (fileName.includes('../') || fileName.includes('..\\')) {
    throw new Error(`LANGUAGE_SOURCES file must not contain parent traversal for ${category}: ${fileName}`);
  }
  if (fileName.includes('/') || fileName.includes('\\')) {
    throw new Error(`LANGUAGE_SOURCES file must not contain directory separators for ${category}: ${fileName}`);
  }
  if (fileName.split(/[\\/]/).pop() !== fileName) {
    throw new Error(`LANGUAGE_SOURCES file basename must match fileName for ${category}: ${fileName}`);
  }
  if (typeof source === 'object' && source.optional != null && source.optional !== true) {
    throw new Error(`Invalid optional metadata for ${category}/${fileName}: use optional: true or omit it`);
  }

  return { fileName, sourceId: `${category}/${fileName}`, category, optional };
}
