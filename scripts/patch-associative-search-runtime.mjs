#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const RUNTIME_MARKER = '// Static associative search runtime v2';

function replaceOnce(source, oldValue, newValue, label) {
  const first = source.indexOf(oldValue);
  if (first === -1) throw new Error(`Could not find runtime patch target: ${label}`);
  if (source.indexOf(oldValue, first + oldValue.length) !== -1) throw new Error(`Runtime patch target is ambiguous: ${label}`);
  return source.slice(0, first) + newValue + source.slice(first + oldValue.length);
}

export function patchAssociativeSearchRuntime(input) {
  let source = String(input || '');
  if (source.includes(RUNTIME_MARKER)) return source;

  source = replaceOnce(source,
`    let activeLang = 'en';

    function emptyState() {`,
`    let activeLang = 'en';
    ${RUNTIME_MARKER}
    const SEARCH_RESULTS_PAGE_SIZE = 100;
    const visibleCandidateCounts = Object.fromEntries(LANGUAGES.map(lang => [lang.code, SEARCH_RESULTS_PAGE_SIZE]));

    function resetVisibleCandidateCounts() {
      for (const lang of LANGUAGES) visibleCandidateCounts[lang.code] = SEARCH_RESULTS_PAGE_SIZE;
    }

    function showMoreCandidates(langCode) {
      visibleCandidateCounts[langCode] = (visibleCandidateCounts[langCode] || SEARCH_RESULTS_PAGE_SIZE) + SEARCH_RESULTS_PAGE_SIZE;
      renderLanguagePanel();
    }

    function emptyState() {`,
  'pagination state');

  source = replaceOnce(source,
`        frequency_score: null,
        association_score: null,
        final_score: null,
        selected: false`,
`        frequency_score: Number.isFinite(Number(item.frequency_score)) ? Number(item.frequency_score) : null,
        association_score: null,
        final_score: null,
        selected: false`,
  'preserve frequency on analysis error');

  source = replaceOnce(source,
`      state.elementType = elementType;
      state.maxModels = 5;
      const nextLangs = {};`,
`      state.elementType = elementType;
      state.maxModels = 5;
      resetVisibleCandidateCounts();
      const nextLangs = {};`,
  'reset result pagination');

  source = replaceOnce(source,
`        state.languageStatuses[lang.code] = createLanguageStatus('analyzing', { candidateCount: validCandidates.length });
        if (!isCurrentRun(runId)) return;
        onProgress?.(\`Qwen3.6: оценка слов — \${languageName}\`);
        const analyzed = await mapWithConcurrency(
          validCandidates,
          QWEN_RUNTIME_CONFIG.maxConcurrentQwenRequests,
          item => analyzeCandidateItem(lang.code, item, onProgress, runId, targetTranslations[lang.code] || '')
        );

        if (!isCurrentRun(runId)) return;
        onProgress?.(\`Расчёт языковых баллов: \${languageName}\`);
        nextLangs[lang.code] = groupByBestModel(analyzed, state.maxModels);
        const failedCount = analyzed.filter(item => item.analysis?.status === 'error').length;
        {
          const successfulCount = analyzed.length - failedCount;
          state.languageStatuses[lang.code] = createLanguageStatus(
            successfulCount === 0 ? 'qwen_error' : 'completed',
            { errorCode: failedCount ? (successfulCount === 0 ? 'QWEN_FAILED' : 'QWEN_PARTIAL_FAILURE') : null, candidateCount: validCandidates.length, analyzedCount: analyzed.length, successfulCount, failedCount }
          );
        }`,
`        const preparedCandidates = validCandidates.map(item => ({ ...item, selected: false, analysisStatus: 'pending' }));
        const automaticLimit = Math.min(
          preparedCandidates.length,
          Math.max(0, Number(QWEN_RUNTIME_CONFIG.autoAnalyzeCandidatesPerLanguage) || 0)
        );
        const automaticCandidates = preparedCandidates.slice(0, automaticLimit);
        state.languageStatuses[lang.code] = createLanguageStatus(automaticCandidates.length ? 'analyzing' : 'completed', { candidateCount: preparedCandidates.length });
        if (!isCurrentRun(runId)) return;

        let analyzed = [];
        if (automaticCandidates.length) {
          onProgress?.(\`Qwen3.6: оценка первых \${automaticCandidates.length} слов — \${languageName}\`);
          analyzed = await mapWithConcurrency(
            automaticCandidates,
            QWEN_RUNTIME_CONFIG.maxConcurrentQwenRequests,
            item => analyzeCandidateItem(lang.code, item, onProgress, runId, targetTranslations[lang.code] || '')
          );
        }

        if (!isCurrentRun(runId)) return;
        const analyzedByWord = new Map(analyzed.map(item => [normalizeText(item.word), {
          ...item,
          analysisStatus: item.analysis?.status === 'error' ? 'error' : null
        }]));
        nextLangs[lang.code] = preparedCandidates.map(item => analyzedByWord.get(normalizeText(item.word)) || item);
        const failedCount = analyzed.filter(item => item.analysis?.status === 'error').length;
        const successfulCount = analyzed.length - failedCount;
        state.languageStatuses[lang.code] = createLanguageStatus(
          analyzed.length > 0 && successfulCount === 0 ? 'qwen_error' : 'completed',
          {
            errorCode: failedCount ? (successfulCount === 0 ? 'QWEN_FAILED' : 'QWEN_PARTIAL_FAILURE') : null,
            candidateCount: preparedCandidates.length,
            analyzedCount: analyzed.length,
            successfulCount,
            failedCount
          }
        );`,
  'separate full search from automatic analysis');

  source = replaceOnce(source,
`    function calculateLanguage(langCode) {
      return calculateLanguageScore(state.languages[langCode] || [], { maxModels: state.maxModels, scoreGetter: wordWeight });
    }`,
`    function scoringCandidates(langCode) {
      const byModel = new Map();
      for (const item of state.languages[langCode] || []) {
        const score = wordWeight(item);
        if (!item.selected || !Number.isFinite(score)) continue;
        const key = item.model || item.word;
        const current = byModel.get(key);
        const currentScore = current ? wordWeight(current) : null;
        if (!current || score > currentScore || (score === currentScore && Number(item.rank) < Number(current.rank))) byModel.set(key, item);
      }
      return [...byModel.values()]
        .sort((a, b) => wordWeight(b) - wordWeight(a) || a.word.localeCompare(b.word))
        .slice(0, state.maxModels);
    }

    function calculateLanguage(langCode) {
      return calculateLanguageScore(scoringCandidates(langCode), { maxModels: Infinity, scoreGetter: wordWeight });
    }`,
  'score only the best selected models');

  source = replaceOnce(source,
`      const items = state.languages[activeLang] || [];
      const score = calculateLanguage(activeLang);
      const labels = textGroup('panel');
      panel.innerHTML = \`
        <div class="row" style="margin-bottom:12px;">
          <div>
            <h3>\${textGroup('languages')[lang.code] || lang.name}</h3>
            <p class="muted">\${labels.group}: \${textGroup('groups')[lang.group] || lang.group}. \${labels.languageScore}: <strong>\${formatFixed(score.normalized, 2)}%</strong>; \${labels.weightSum}: <strong>\${formatFixed(score.sum, 2)}</strong>. \${labels.status}: <strong>\${languageStatusLabel(state.languageStatuses[activeLang], currentLang())}</strong></p>
          </div>
          <button class="tool-btn interal-btn interal-btn--secondary fit short" onclick="addRow('\${activeLang}')">\${labels.addWord}</button>
        </div>
        <div class="derivatives-table-wrap">
          <table class="derivatives-table">
            <thead>
              <tr>
                <th class="col-word sticky-word">\${labels.word}</th>
                <th class="col-score">\${labels.finalPercent}</th>
                <th class="col-score">\${labels.status}</th>
                <th class="col-score">\${labels.associationPercent}</th>
                <th class="col-score">\${labels.frequencyPercent}</th>
                <th class="col-score">SWOW</th>
                <th class="col-details">\${labels.details}</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>\${items.map((item, idx) => rowHtml(activeLang, item, idx)).join('')}</tbody>
          </table>
        </div>
      \`;`,
`      const items = state.languages[activeLang] || [];
      const visibleCount = Math.min(visibleCandidateCounts[activeLang] || SEARCH_RESULTS_PAGE_SIZE, items.length);
      const visibleItems = items.slice(0, visibleCount);
      const score = calculateLanguage(activeLang);
      const labels = textGroup('panel');
      const resultCountText = currentLang() === 'en'
        ? \`Showing \${visibleCount} of \${items.length} candidates\`
        : \`Показано \${visibleCount} из \${items.length} кандидатов\`;
      const showMoreText = currentLang() === 'en' ? 'Show 100 more' : 'Показать ещё 100';
      panel.innerHTML = \`
        <div class="row" style="margin-bottom:12px;">
          <div>
            <h3>\${textGroup('languages')[lang.code] || lang.name}</h3>
            <p class="muted">\${labels.group}: \${textGroup('groups')[lang.group] || lang.group}. \${labels.languageScore}: <strong>\${formatFixed(score.normalized, 2)}%</strong>; \${labels.weightSum}: <strong>\${formatFixed(score.sum, 2)}</strong>. \${labels.status}: <strong>\${languageStatusLabel(state.languageStatuses[activeLang], currentLang())}</strong></p>
            <p class="muted">\${resultCountText}</p>
          </div>
          <button class="tool-btn interal-btn interal-btn--secondary fit short" onclick="addRow('\${activeLang}')">\${labels.addWord}</button>
        </div>
        <div class="derivatives-table-wrap">
          <table class="derivatives-table">
            <thead>
              <tr>
                <th class="col-word sticky-word">\${labels.word}</th>
                <th class="col-score">\${labels.finalPercent}</th>
                <th class="col-score">\${labels.status}</th>
                <th class="col-score">\${labels.associationPercent}</th>
                <th class="col-score">\${labels.frequencyPercent}</th>
                <th class="col-score">SWOW</th>
                <th class="col-details">\${labels.details}</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>\${visibleItems.map((item, idx) => rowHtml(activeLang, item, idx)).join('')}</tbody>
          </table>
        </div>
        \${visibleCount < items.length ? \`<div class="row" style="justify-content:center;margin-top:12px;"><button class="tool-btn interal-btn interal-btn--secondary fit" onclick="showMoreCandidates('\${activeLang}')">\${showMoreText}</button></div>\` : ''}
      \`;`,
  'paginate rendered candidates');

  source = replaceOnce(source,
`      const warningList = analysis.warnings || [];
      const warnings = warningList.join('; ');
      return \``,
`      const warningList = analysis.warnings || [];
      const warnings = warningList.join('; ');
      const pendingLabel = currentLang() === 'en' ? 'not analyzed' : 'не анализировалось';
      const displayStatus = item.analysisStatus === 'analyzing'
        ? statusLabel('analyzing')
        : item.analysisStatus === 'pending'
          ? pendingLabel
          : item.analysisStatus === 'error'
            ? statusLabel('error')
            : \`\${thresholdStatusLabel(thresholdStatusForResult({ final_score: analysis.final_score ?? item.final_score }), currentLang())}\${assoc.semantic_confirmed === false ? \`<br><span class="muted">\${semanticWarningLabel(currentLang())}</span>\` : ''}\`;
      const analysisButton = item.analysisStatus === 'analyzing'
        ? \`<button class="tool-btn interal-btn interal-btn--secondary fit short" disabled>\${statusLabel('analyzing')}</button>\`
        : (!analysis.association || item.analysisStatus === 'pending' || item.analysisStatus === 'error')
          ? \`<button class="tool-btn interal-btn interal-btn--secondary fit short" onclick="analyzeItem('\${lang}', \${idx})">\${labels.analyze}</button>\`
          : '';
      return \``,
  'render analysis state');

  source = replaceOnce(source,
`          <td class="col-score">\${thresholdStatusLabel(thresholdStatusForResult({ final_score: analysis.final_score ?? item.final_score }), currentLang())}\${assoc.semantic_confirmed === false ? \`<br><span class="muted">\${semanticWarningLabel(currentLang())}</span>\` : ''}</td>`,
`          <td class="col-score">\${displayStatus}</td>`,
  'render pending status');

  source = replaceOnce(source,
`          <td class="col-actions"><button class="word-remove-btn" title="\${labels.delete}" aria-label="\${labels.delete}" onclick="deleteItem('\${lang}', \${idx})">×</button></td>`,
`          <td class="col-actions">\${analysisButton}<button class="word-remove-btn" title="\${labels.delete}" aria-label="\${labels.delete}" onclick="deleteItem('\${lang}', \${idx})">×</button></td>`,
  'render manual analysis action');

  source = replaceOnce(source,
`      } catch (error) {
        const failed = failedAnalysis(lang, item, error);
        Object.assign(item, failed, { analysisStatus: 'error' });
      }
      renderAll();`,
`      } catch (error) {
        const failed = failedAnalysis(lang, item, error);
        Object.assign(item, failed, { analysisStatus: 'error' });
      }
      const languageItems = state.languages[lang] || [];
      const analyzedItems = languageItems.filter(candidate => candidate.analysis);
      const failedCount = analyzedItems.filter(candidate => candidate.analysis?.status === 'error').length;
      const successfulCount = analyzedItems.length - failedCount;
      state.languageStatuses[lang] = createLanguageStatus(
        analyzedItems.length > 0 && successfulCount === 0 ? 'qwen_error' : 'completed',
        { candidateCount: languageItems.length, analyzedCount: analyzedItems.length, successfulCount, failedCount, errorCode: failedCount ? (successfulCount === 0 ? 'QWEN_FAILED' : 'QWEN_PARTIAL_FAILURE') : null }
      );
      renderAll();`,
  'update status after manual analysis');

  source = replaceOnce(source,
`      state = emptyState();
      activeLang = 'en';`,
`      state = emptyState();
      activeLang = 'en';
      resetVisibleCandidateCounts();`,
  'reset pagination with page state');

  source = replaceOnce(source,
`    window.addRow = addRow;
    window.analyzeItem = analyzeItem;`,
`    window.addRow = addRow;
    window.analyzeItem = analyzeItem;
    window.showMoreCandidates = showMoreCandidates;`,
  'expose pagination action');

  return source;
}

export async function main(argv = process.argv.slice(2)) {
  const path = argv[0] || 'associativvordes/script.js';
  const source = await readFile(path, 'utf8');
  const patched = patchAssociativeSearchRuntime(source);
  if (patched !== source) await writeFile(path, patched);
  console.log(`Associative search runtime patched: ${path}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
