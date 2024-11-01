document.addEventListener('DOMContentLoaded', function() {
  const loadingMessage = document.getElementById('loadingMessage');
  const errorMessage = document.getElementById('errorMessage');
  const textarea = document.getElementById('imageLinks');

  loadingMessage.style.display = 'flex';

  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        files: ['content.js']
      },
      (results) => {
        if (chrome.runtime.lastError) {
          handleError('To retrieve your collection, you first need to go to https://altered.gg and log in to your account !');
        } else {
        }
      }
    );
  });

  document.getElementById('copyButton1').addEventListener('click', function() {
    const textarea = document.getElementById('imageLinks');
    textarea.select();
    document.execCommand('copy');
  });
  
  document.getElementById('copyButton2').addEventListener('click', function() {
    const textarea = document.getElementById('TradeListText');
    textarea.select();
    document.execCommand('copy');
  });
  
  document.getElementById('copyButton3').addEventListener('click', function() {
    const textarea = document.getElementById('WantListText');
    textarea.select();
    document.execCommand('copy');
  });
  
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getLinks') {
        // Récupérer les textarea par leur ID
        const collectionTextarea = document.getElementById('imageLinks');
        const wantListTextarea = document.getElementById('WantListText');
        const tradeListTextarea = document.getElementById('TradeListText');

        // Remplir les textarea avec les liens respectifs
        collectionTextarea.value = request.links.collection.join('\n');
        wantListTextarea.value = request.links.want.join('\n');
        tradeListTextarea.value = request.links.trade.join('\n');

        // Afficher ou masquer les éléments de l'interface utilisateur
        loadingMessage.style.display = 'none';
        errorMessage.style.display = 'none';
        collectionTextarea.style.display = 'block';
        wantListTextarea.style.display = 'block';
        tradeListTextarea.style.display = 'block';
    } else if (request.action === 'getError') {
        handleError(request.message);
    }
});
  
  

  function handleError(message) {
    loadingMessage.style.display = 'none';
    errorMessage.textContent = message;
    errorMessage.style.display = 'flex';
    textarea.style.display = 'none';
  }
});