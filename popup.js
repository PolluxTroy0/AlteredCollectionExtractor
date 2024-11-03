document.addEventListener('DOMContentLoaded', function() {
	const loadingMessage = document.getElementById('loadingMessage');
	const errorMessage = document.getElementById('errorMessage');
	const collectionTextarea = document.getElementById('imageLinks');
	const wantListTextarea = document.getElementById('WantListText');
	const tradeListTextarea = document.getElementById('TradeListText');

	// Affiche le message de chargement au démarrage
	loadingMessage.style.display = 'flex';

	// Exécute content.js dans l'onglet actif
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

	// Boutons de copie pour chaque liste
	document.getElementById('copyButton1').addEventListener('click', function() {
		copyToClipboard(collectionTextarea);
	});

	document.getElementById('copyButton2').addEventListener('click', function() {
		copyToClipboard(tradeListTextarea);
	});

	document.getElementById('copyButton3').addEventListener('click', function() {
		copyToClipboard(wantListTextarea);
	});

	// Écoute les messages envoyés par content.js
	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		if (request.action === 'getLinks') {
			// Affiche les liens de chaque liste dans les textareas
			collectionTextarea.value = request.links.collection.join('\n');
			wantListTextarea.value = request.links.want.join('\n');
			tradeListTextarea.value = request.links.trade.join('\n');

			// Met à jour les compteurs pour chaque liste
			document.getElementById('collectioncount').textContent = request.counts.collectionCount;
			document.getElementById('tradelistcount').textContent = request.counts.tradeCount;
			document.getElementById('wantlistcount').textContent = request.counts.wantCount;

			// Cache le message de chargement et les erreurs, puis affiche les textareas
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

	// Gère les erreurs en affichant un message dans errorMessage
	function handleError(message) {
		loadingMessage.style.display = 'none';
		errorMessage.textContent = message;
		errorMessage.style.display = 'flex';
		collectionTextarea.style.display = 'none';
		wantListTextarea.style.display = 'none';
		tradeListTextarea.style.display = 'none';
	}

	// Fonction pour copier le texte d'un textarea dans le presse-papier
	function copyToClipboard(textarea) {
		textarea.select();
		document.execCommand('copy');
	}
});
