(async function () {
  const ITEMS_PER_PAGE = 36;
  const extensionId = chrome.runtime.id;
  const language = "en-us";

  const isCorrectPage = () => /^https:\/\/www\.altered\.gg(\/.*)?$/.test(window.location.href);

  const getAccessToken = () => {
    const tokenMatch = document.documentElement.innerHTML.match(/"accessToken":"(.*?)"/);
    if (!tokenMatch) throw new Error('Err01 - Token not found !');
    return tokenMatch[1];
  };

  const fetchCardData = async (accessToken, page) => {
    const response = await fetch(`https://api.altered.gg/cards/stats?collection=true&itemsPerPage=${ITEMS_PER_PAGE}&page=${page}`, {
      headers: {
        'Accept-Language': language,
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) throw new Error(`Err02 - Invalid response : ${response.statusText}`);
    const rawText = await response.text();
    try {
      return JSON.parse(rawText);
    } catch {
      throw new Error(`Err03 - Invalid JSON : ${rawText}`);
    }
  };

  const extractLinks = (cardData) => {
    const members = cardData?.['hydra:member'];
    if (!members) throw new Error('Err04 - Invalid data format !');
    return members.map(card => `${card.inMyCollection} ${card.reference}`);
  };

  const getAllCardData = async (accessToken) => {
    const allLinks = [];
    let page = 1;
    const initialData = await fetchCardData(accessToken, page);
    const totalPages = Math.ceil((initialData['hydra:totalItems'] || 0) / ITEMS_PER_PAGE);

    for (page = 1; page <= totalPages; page++) {
      const cardData = page === 1 ? initialData : await fetchCardData(accessToken, page);
      allLinks.push(...extractLinks(cardData));
    }

    chrome.runtime.sendMessage({ action: 'getLinks', links: allLinks });
  };

  const handleError = (message) => {
    const errorMap = {
      'Please': 'To retrieve your collection, you first need to go to https://www.altered.gg and log in to your account !',
      'Err01': 'To retrieve your collection, you first need to go to https://www.altered.gg and log in to your account !',
      'Err02': 'Error retrieving collection (Err02) !',
      'Err03': 'Error retrieving collection (Err03) !',
      'Err04': 'Error retrieving collection (Err04) !',
      'Unknown': 'Unknown error (Err05) !',
    };

    const errorMessage = Object.keys(errorMap).find(key => message.includes(key)) || 'Unknown error (Err05) !';
    chrome.runtime.sendMessage({ action: 'getError', message: errorMap[errorMessage] });
  };

  // Main logic
  try {
    if (!isCorrectPage()) throw new Error('Please go to https://www.altered.gg !');
    const accessToken = getAccessToken();
    await getAllCardData(accessToken);
  } catch (error) {
    handleError(error.message);
  }
})();
