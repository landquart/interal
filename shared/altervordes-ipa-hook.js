(() => {
  const cards = window.InteralJsonCards;
  if (!cards?.createCardOnServer || cards.__altervordesIpaHookInstalled) return;

  const originalCreateCardOnServer = cards.createCardOnServer;
  const hookUrl = document.currentScript?.src || window.location.href;
  const transcriberUrl = new URL('./interal-ipa.mjs', hookUrl).href;
  let transcriberModulePromise = null;

  function clonePayload(payload) {
    if (typeof structuredClone === 'function') return structuredClone(payload);
    return JSON.parse(JSON.stringify(payload));
  }

  cards.createCardOnServer = async function createCardWithInteralIpa(payload, options = {}) {
    const section = String(options?.section || '');
    const word = typeof payload?.interal?.word === 'string'
      ? payload.interal.word.trim()
      : '';
    const existingIpa = typeof payload?.interal?.ipa === 'string'
      ? payload.interal.ipa.trim()
      : '';

    let preparedPayload = payload;
    if (section === 'altervordes' && word && !existingIpa) {
      transcriberModulePromise ||= import(transcriberUrl);
      const { transcribeInteral } = await transcriberModulePromise;
      preparedPayload = clonePayload(payload);
      preparedPayload.interal = {
        ...preparedPayload.interal,
        ipa: transcribeInteral(word, {
          partOfSpeech: preparedPayload.interal?.part_of_speech
        })
      };
    }

    return originalCreateCardOnServer.call(this, preparedPayload, options);
  };

  cards.__altervordesIpaHookInstalled = true;
})();
