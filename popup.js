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

  document.getElementById('copyButton').addEventListener('click', function() {
    const textarea = document.getElementById('imageLinks');
    textarea.select();
    document.execCommand('copy');
  });

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getLinks') {
      textarea.value = request.links.join('\n');
      loadingMessage.style.display = 'none';
      errorMessage.style.display = 'none';
      textarea.style.display = 'block';
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
