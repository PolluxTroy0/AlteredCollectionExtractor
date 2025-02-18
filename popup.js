document.addEventListener("DOMContentLoaded", async () => {
    // Compatibilité Chrome & Firefox
    const browser = window.browser || window.chrome;

    // Sélection des divs et textareas
    const errorMessageDiv = document.getElementById("errorMessage");
    const loadingMessageDiv = document.getElementById("loadingMessage");
    const mainDiv = document.getElementById("main");
    const collectionTextarea = document.getElementById("collectionTextarea");
    const wantListTextarea = document.getElementById("wantListTextarea");
    const tradeListTextarea = document.getElementById("tradeListTextarea");
    const collectionCSVTextarea = document.getElementById("collectionCSVTextarea");

    // Sélection des compteurs pour mise à jour
    const collectionCountSpan = document.getElementById("collectioncount");
    const tradeListCountSpan = document.getElementById("tradelistcount");
    const wantListCountSpan = document.getElementById("wantlistcount");

    // Sélection des boutons de copie
    const copyCollectionButton = document.getElementById("copyCollectionButton");
    const copyWantListButton = document.getElementById("copyWantListButton");
    const copyTradeListButton = document.getElementById("copyTradeListButton");
    const copyCollectionCSVButton = document.getElementById("copyCollectionCSVButton");
	
    // Fonction utilitaire pour copier le contenu d'un textarea
    const copyToClipboard = (textarea) => {
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length); // Pour s'assurer que tout le contenu est sélectionné
        document.execCommand("copy");
    };

    // Écouteurs sur les boutons de copie
    copyCollectionButton.addEventListener("click", () => copyToClipboard(collectionTextarea));
    copyWantListButton.addEventListener("click", () => copyToClipboard(wantListTextarea));
    copyTradeListButton.addEventListener("click", () => copyToClipboard(tradeListTextarea));
    copyCollectionCSVButton.addEventListener("click", () => copyToClipboard(collectionCSVTextarea));

    // Affiche le message de chargement au départ
    errorMessageDiv.style.display = "none";
    mainDiv.style.display = "none";
    loadingMessageDiv.style.display = "flex";
    
    const updateLoadingMessage = (progress) => {
        loadingMessageDiv.innerHTML = `
            Retrieving cards collection, please wait...<br>
            Do not close this window or leave your browser!<br><br>
            Progress: ${progress}%
        `;
    };

    try {
        // Vérification du domaine de l'onglet actif
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0 || !tabs[0].url) {
            throw new Error("Err01 : Unable to get the active tab !");
        }

        const currentTabDomain = new URL(tabs[0].url).hostname;

        if (!currentTabDomain.endsWith("altered.gg")) {
            throw new Error("Err02 : Please go to https://altered.gg and login into your account !");
        }
		
		// Récupération de la langue du site à partir de l'URL de l'onglet actif
		const language = (() => {
			const url = new URL(tabs[0].url);
			const path = url.pathname.split('/');
			const locale = path[1];
			return locale && /^[a-z]{2}-[a-z]{2}$/.test(locale) ? locale : 'en';
		})();

        // Injection de script pour récupérer le contenu HTML de la page
        const [response] = await browser.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => document.documentElement.innerHTML,
        });

        const pageHTML = response.result;

        // Vérification de la connexion utilisateur avec getAccessToken
        const getAccessToken = () => {
            const tokenMatch = pageHTML.match(/"accessToken":"(.*?)"/);
            if (!tokenMatch) throw new Error("Err03 : Please login into your account !");
            return tokenMatch[1];
        };

        const accessToken = getAccessToken();

        // Fonction pour récupérer les statistiques de la collection de cartes
		const fetchCardDataStatsForSet = async (accessToken, page, setName) => {
			const itemsPerPage = 36;
			const response = await fetch(`https://api.altered.gg/cards/stats?collection=true&itemsPerPage=${itemsPerPage}&page=${page}&locale=${language}&cardSet[]=${setName}`, {
				headers: {
					'Accept-Language': language,
					'Authorization': `Bearer ${accessToken}`,
				},
			});
			if (!response.ok) throw new Error(`Err04 : Invalid response : ${response.statusText}`);
			const rawText = await response.text();
			try {
				return JSON.parse(rawText);
			} catch {
				throw new Error(`Err05 : Invalid JSON : ${rawText}`);
			}
		};

		// Fonction modifiée pour inclure le paramètre cardSet[] dans la requête
		const fetchCardDataCardsForSet = async (accessToken, page, setName) => {
			const itemsPerPage = 36;
			const response = await fetch(`https://api.altered.gg/cards?collection=true&itemsPerPage=${itemsPerPage}&page=${page}&locale=${language}&cardSet[]=${setName}`, {
				headers: {
					'Accept-Language': language,
					'Authorization': `Bearer ${accessToken}`,
				},
			});
			if (!response.ok) throw new Error(`Err06 : Invalid response : ${response.statusText}`);
			const rawText = await response.text();
			try {
				return JSON.parse(rawText);
			} catch {
				throw new Error(`Err07 : Invalid JSON : ${rawText}`);
			}
		};

        // Fonction pour extraire les liens et les détails
		const extractLinks = (statsData, cardsData) => {
			const statsMembers = statsData?.['hydra:member'];
			const cardsMembers = cardsData?.['hydra:member'];
			if (!statsMembers || !cardsMembers) throw new Error('Err08 - Invalid data format !');

			const collectionLinks = [];
			const detailedCollectionLinks = [];
			const tradeListLinks = [];
			const wantListLinks = [];
			let collectionCount = 0;
			let tradeCount = 0;
			let wantCount = 0;

			statsMembers.forEach((statCard) => {
				// Extraction de la référence à partir de "@id"
				const reference = statCard["@id"].split('/').pop();

				// In Collection (Stats)
				if (statCard.inMyCollection > 0) {
					collectionLinks.push(`${statCard.inMyCollection} ${reference}`);
					collectionCount += statCard.inMyCollection;
				}

				// In Collection (Cards CSV)
				if (statCard.inMyCollection > 0) {
					// On recherche les détails correspondants dans cardsMembers
					const cardDetails = cardsMembers.find(card => {
						if (!card["@id"]) return false;
						const ref = card["@id"].split('/').pop();
						return ref === reference;
					});
					if (cardDetails) {
						const rarityName = cardDetails.rarity?.name || '?';
						const factionName = cardDetails.mainFaction?.name || '?';
						const cardName = cardDetails.name || '?';
						const cardType = cardDetails.cardType?.name || '?';
						const cardSet = reference.split('_')[1];

						detailedCollectionLinks.push(
							`${factionName}\t${rarityName}\t${cardType}\t${cardSet}\t${statCard.inMyCollection}\t${cardName}`
						);
					}
				}

				// In Want List (Stats)
				// La propriété inMyWantlist est désormais un booléen
				if (statCard.inMyWantlist === true) {
					wantListLinks.push(`1 ${reference}`);
					wantCount += 1;
				}

				// In Trade List (Stats)
				if (statCard.inMyTradelist > 0) {
					tradeListLinks.push(`${statCard.inMyTradelist} ${reference}`);
					tradeCount += statCard.inMyTradelist;
				}
			});

			return {
				collectionLinks,
				detailedCollectionLinks,
				tradeListLinks,
				wantListLinks,
				collectionCount,
				tradeCount,
				wantCount
			};
		};
		
		// Liste des sets à traiter
		const cardSets = ['CORE', 'COREKS', 'ALIZE'];

		// Fonction principale pour récupérer toutes les données des cartes pour chaque set
		const getAllCardData = async (accessToken) => {
			const allLinks = {
				collection: [],
				trade: [],
				want: [],
				detailedCollection: []
			};

			let collectionTotal = 0;
			let tradeTotal = 0;
			let wantTotal = 0;

			// Fonction pour récupérer les données pour un set spécifique
			const fetchCardDataForSet = async (setName) => {
				const initialStatsData = await fetchCardDataStatsForSet(accessToken, 1, setName);
				const totalPages = Math.ceil((initialStatsData['hydra:totalItems'] || 0) / 36);
				return totalPages;
			};

			// Calculer le total des pages pour tous les sets avant de commencer
			const totalPagesForAllSets = await Promise.all(cardSets.map(setName => fetchCardDataForSet(setName)));
			const totalPages = totalPagesForAllSets.reduce((acc, pages) => acc + pages, 0);
			const totalRequests = totalPages * 2; // Chaque page nécessite 2 requêtes : stats + cartes
			let completedRequests = 0;

			// Fonction pour gérer la progression globale
			const updateGlobalProgress = () => {
				const progressPercent = Math.round((completedRequests / totalRequests) * 100);
				updateLoadingMessage(progressPercent);
			};

			// Fonction pour créer une tâche pour une page
			const fetchPageData = async (page, setName) => {
				const [statsData, cardsData] = await Promise.all([
					fetchCardDataStatsForSet(accessToken, page, setName),
					fetchCardDataCardsForSet(accessToken, page, setName)
				]);

				const links = extractLinks(statsData, cardsData);

				allLinks.collection.push(...links.collectionLinks);
				allLinks.trade.push(...links.tradeListLinks);
				allLinks.want.push(...links.wantListLinks);
				allLinks.detailedCollection.push(...links.detailedCollectionLinks);

				collectionTotal += links.collectionCount;
				tradeTotal += links.tradeCount;
				wantTotal += links.wantCount;

				// Mettre à jour les requêtes terminées et la progression
				completedRequests += 2; // Une page correspond à 2 requêtes
				updateGlobalProgress();
			};

			// Fonction pour exécuter les requêtes en parallèle avec une limite
			const fetchInBatches = async (startPage, endPage, setName, batchSize) => {
				const pages = [];
				for (let page = startPage; page <= endPage; page++) {
					pages.push(page);
				}

				while (pages.length > 0) {
					const batch = pages.splice(0, batchSize); // Extraire les pages pour ce lot
					await Promise.all(batch.map(page => fetchPageData(page, setName))); // Effectuer les requêtes du lot
				}
			};

			// Boucle pour récupérer les données pour chaque set
			for (const setName of cardSets) {
				const initialStatsData = await fetchCardDataStatsForSet(accessToken, 1, setName);
				const totalPagesForSet = Math.ceil((initialStatsData['hydra:totalItems'] || 0) / 36);
				await fetchInBatches(1, totalPagesForSet, setName, 5);
			}

			// Mise à jour des textareas
			collectionTextarea.value = allLinks.collection.join('\n');
			wantListTextarea.value = allLinks.want.join('\n');
			tradeListTextarea.value = allLinks.trade.join('\n');
			collectionCSVTextarea.value = allLinks.detailedCollection.join('\n');

			// Mise à jour des totaux dans les onglets
			collectionCountSpan.textContent = collectionTotal;
			tradeListCountSpan.textContent = tradeTotal;
			wantListCountSpan.textContent = wantTotal;
		};

        await getAllCardData(accessToken);

        loadingMessageDiv.style.display = "none";
        mainDiv.style.display = "block";

    } catch (error) {
        //console.error(error.message);
        loadingMessageDiv.style.display = "none";
        mainDiv.style.display = "none";
        errorMessageDiv.style.display = "flex";
        errorMessageDiv.textContent = error.message;
    }
});