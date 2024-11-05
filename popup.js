document.addEventListener('DOMContentLoaded', function() {
	const loadingMessage = document.getElementById('loadingMessage');
	const errorMessage = document.getElementById('errorMessage');
	const collectionTextarea = document.getElementById('imageLinks');
	const wantListTextarea = document.getElementById('WantListText');
	const tradeListTextarea = document.getElementById('TradeListText');

	loadingMessage.style.display = 'flex';

	chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
		chrome.scripting.executeScript({
				target: { tabId: tabs[0].id },
				files: ['content.js']
			},
			(results) => {
				if (chrome.runtime.lastError) {
					handleError('To retrieve your collection, you first need to go to https://altered.gg and log in to your account !');
				}
			}
		);
	});

	document.getElementById('copyButton1').addEventListener('click', function() {
		copyToClipboard(collectionTextarea);
	});

	document.getElementById('copyButton2').addEventListener('click', function() {
		copyToClipboard(tradeListTextarea);
	});

	document.getElementById('copyButton3').addEventListener('click', function() {
		copyToClipboard(wantListTextarea);
	});

	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		if (request.action === 'getLinks') {
			collectionTextarea.value = request.links.collection.join('\n');
			wantListTextarea.value = request.links.want.join('\n');
			tradeListTextarea.value = request.links.trade.join('\n');

			document.getElementById('collectioncount').textContent = request.counts.collectionCount;
			document.getElementById('tradelistcount').textContent = request.counts.tradeCount;
			document.getElementById('wantlistcount').textContent = request.counts.wantCount;

			loadingMessage.style.display = 'none';
			errorMessage.style.display = 'none';
			collectionTextarea.style.display = 'block';
			wantListTextarea.style.display = 'block';
			tradeListTextarea.style.display = 'block';
		} else if (request.action === 'getError') {
			handleError(request.message);
		} else if (request.action === 'updateLoadingMessage') {
			if (loadingMessage) {
				loadingMessage.innerHTML = request.message;
			}
		}
	});

	function handleError(message) {
		loadingMessage.style.display = 'none';
		errorMessage.textContent = message;
		errorMessage.style.display = 'flex';
		collectionTextarea.style.display = 'none';
		wantListTextarea.style.display = 'none';
		tradeListTextarea.style.display = 'none';
	}

	function copyToClipboard(textarea) {
		textarea.select();
		document.execCommand('copy');
	}
});
