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
        textarea.setSelectionRange(0, textarea.value.length);
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
    loadingMessageDiv.style.display = "block";
    
	const updateLoadingMessage = (progress) => {
		loadingMessageDiv.innerHTML = `
			<br/><br/>
			Retrieving cards collection, please wait...<br>
			Do not close this window or leave your browser !<br><br>
			<progress value="${progress}" max="100" style="width: 100%;"></progress><br/>
			Progress: ${progress}%
			
		`;
	};

    try {
        // Vérification du domaine de l'onglet actif
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0 || !tabs[0].url) {
            throw new Error("Err01 : Unable to retrieve URL ! Please reload the page and try again.");
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
		
		// Fonction pour récupérer le token d'accès à partir de l'API
		const getAccessTokenFromAPI = async () => {
			try {
				const response = await fetch("https://www.altered.gg/api/auth/session", {
					method: "GET",
					headers: {
						"Content-Type": "application/json",
					},
				});

				if (!response.ok) {
					throw new Error('Err03 : Invalid API response ! Please reload the page and try again.');
				}

				const data = await response.json();
				
				if (!data.accessToken) {
					throw new Error("Err04 : Please login into your account !");
				}

				return data.accessToken;
			} catch (error) {
				console.error(error);
				throw error;
			}
		};

		// Récupération du token
		const accessToken = await getAccessTokenFromAPI();

        // Fonction pour récupérer les statistiques de la collection de cartes
		const fetchCardDataStatsForSet = async (accessToken, page, setName) => {
			const itemsPerPage = 36;
			const response = await fetch(`https://api.altered.gg/cards/stats?collection=true&itemsPerPage=${itemsPerPage}&page=${page}&locale=${language}&cardSet[]=${setName}`, {
				headers: {
					'Accept-Language': language,
					'Authorization': `Bearer ${accessToken}`,
				},
			});
			if (!response.ok) throw new Error('Err05 : Invalid API response ! Please reload the page and try again.');
			const rawText = await response.text();
			try {
				return JSON.parse(rawText);
			} catch {
				throw new Error('Err06 : Invalid data received !');
			}
		};
		
        // Fonction pour récupérer les statistiques de la wantlist de cartes
		const fetchCardDataStatsForSetWantList = async (accessToken, page, setName) => {
			const itemsPerPage = 36;
			const response = await fetch(`https://api.altered.gg/cards/stats?cardList.name=wantlist&itemsPerPage=${itemsPerPage}&page=${page}&locale=${language}&cardSet[]=${setName}`, {
				headers: {
					'Accept-Language': language,
					'Authorization': `Bearer ${accessToken}`,
				},
			});
			if (!response.ok) throw new Error('Err07 : Invalid API response ! Please reload the page and try again.');
			const rawText = await response.text();
			try {
				return JSON.parse(rawText);
			} catch {
				throw new Error('Err08 : Invalid data received !');
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
			if (!response.ok) throw new Error('Err09 : Invalid API response ! Please reload the page and try again.');
			const rawText = await response.text();
			try {
				return JSON.parse(rawText);
			} catch {
				throw new Error('Err10 : Invalid data received !');
			}
		};
		
        // Fonction pour extraire les liens et les détails
		const extractLinks = (statsData, cardsData, code) => {
			const statsMembers = statsData?.['hydra:member'];
			const cardsMembers = cardsData?.['hydra:member'];
			if (!statsMembers || !cardsMembers) throw new Error('Err11 - Invalid data format !');

			const collectionLinks = [];
			const detailedCollectionLinks = [];
			const tradeListLinks = [];
			const wantListLinks = [];
			let collectionCount = 0;
			let tradeCount = 0;
			let wantCount = 0;

			statsMembers.forEach((statCard) => {
				const reference = statCard["@id"].split('/').pop();

				// In Collection (Stats)
				if (statCard.inMyCollection > 0) {
					collectionLinks.push(`${statCard.inMyCollection} ${reference}`);
					collectionCount += statCard.inMyCollection;
				}

				// In Collection (Cards CSV)
				if (statCard.inMyCollection > 0) {
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
						const cardSet = code;

						detailedCollectionLinks.push(
							`${factionName}\t${rarityName}\t${cardType}\t${cardSet}\t${statCard.inMyCollection}\t${cardName}`
						);
					}
				}

				// In Want List (Stats)
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
		
		// Fonction pour extraire les sets à traiter
		const fetchCardSets = async () => {
			try {
				const response = await fetch('https://api.altered.gg/card_sets?locale=en-us');
				const data = await response.json();

				if (data && data['hydra:member']) {
					const cardSets = data['hydra:member']
						.filter(set => set.code !== null)
						.map(set => {
							if (set.reference === 'COREKS') {
								set.code = 'BTGKS';
							}
							return { reference: set.reference, code: set.code };
						});
					return cardSets;
				} else {
					throw new Error('Err12 : Invalid data received !');
				}
			} catch (error) {
				throw new Error('Err13 : Invalid API response ! Please reload the page and try again.');
			}
		};

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
			let completedRequests = 0;

			const cardSets = await fetchCardSets();

			// Fonction pour calculer le total des pages et les requêtes pour un type spécifique
			const fetchCardDataForSet = async (accessToken, reference, code, isWantlist = false) => {
				const fetchStats = isWantlist ? fetchCardDataStatsForSetWantList : fetchCardDataStatsForSet;
				const initialStatsData = await fetchStats(accessToken, 1, reference);
				const totalPages = Math.ceil((initialStatsData['hydra:totalItems'] || 0) / 36);
				return totalPages;
			};

			// Calculer le total des pages pour tous les sets avant de commencer
			const totalPagesForAllSets = await Promise.all(
				cardSets.map(set => fetchCardDataForSet(accessToken, set.reference, set.code))
			);
			const totalPages = totalPagesForAllSets.reduce((acc, pages) => acc + pages, 0);
			const totalRequests = totalPages * 2; // Chaque page nécessite 2 requêtes : stats + cartes

			// Calcul pour la Wantlist
			const totalPagesForWantlist = await Promise.all(
				cardSets.map(set => fetchCardDataForSet(accessToken, set.reference, set.code, true))
			);
			const totalPagesWantlist = totalPagesForWantlist.reduce((acc, pages) => acc + pages, 0);
			const totalRequestsWantlist = totalPagesWantlist * 2; // Chaque page nécessite 2 requêtes pour la wantlist

			// Fonction pour gérer la progression globale
			const updateGlobalProgress = () => {
				const totalGlobalRequests = totalRequests + totalRequestsWantlist;
				const progressPercent = Math.round((completedRequests / totalGlobalRequests) * 100);
				updateLoadingMessage(progressPercent);
			};

			// Fonction générique pour récupérer les pages de données
			const fetchPageData = async (accessToken, page, reference, code, isWantlist = false) => {
				const fetchStats = isWantlist ? fetchCardDataStatsForSetWantList : fetchCardDataStatsForSet;
				const [statsData, cardsData] = await Promise.all([
					fetchStats(accessToken, page, reference),
					fetchCardDataCardsForSet(accessToken, page, reference)
				]);

				const links = extractLinks(statsData, cardsData, code);

				if (!isWantlist) {
					allLinks.collection.push(...links.collectionLinks);
					allLinks.trade.push(...links.tradeListLinks);
					allLinks.detailedCollection.push(...links.detailedCollectionLinks);
					collectionTotal += links.collectionCount;
					tradeTotal += links.tradeCount;
				} else {
					allLinks.want.push(...links.wantListLinks);
					wantTotal += links.wantCount;
				}

				completedRequests += 2; // Une page correspond à 2 requêtes
				updateGlobalProgress();
			};

			// Fonction pour exécuter les requêtes en parallèle avec une limite pour n'importe quel type de données
			const fetchInBatches = async (accessToken, startPage, endPage, reference, code, batchSize, isWantlist = false) => {
				const pages = [];
				for (let page = startPage; page <= endPage; page++) {
					pages.push(page);
				}

				while (pages.length > 0) {
					const batch = pages.splice(0, batchSize); // Extraire les pages pour ce lot
					await Promise.all(batch.map(page => fetchPageData(accessToken, page, reference, code, isWantlist))); // Effectuer les requêtes du lot
				}
			};

			// Boucle pour récupérer les données pour la collection et trade (et wantlist séparément)
			for (const set of cardSets) {
				const initialStatsData = await fetchCardDataStatsForSet(accessToken, 1, set.reference);
				const totalPagesForSet = Math.ceil((initialStatsData['hydra:totalItems'] || 0) / 36);
				await fetchInBatches(accessToken, 1, totalPagesForSet, set.reference, set.code, 5);
			}

			// Boucle pour récupérer les données pour la Wantlist
			for (const set of cardSets) {
				const initialStatsData = await fetchCardDataStatsForSetWantList(accessToken, 1, set.reference);
				const totalPagesForSetWantlist = Math.ceil((initialStatsData['hydra:totalItems'] || 0) / 36);
				await fetchInBatches(accessToken, 1, totalPagesForSetWantlist, set.reference, set.code, 5, true);
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