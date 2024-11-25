(async function () {
    // Get Current Tab URL
    const isCorrectPage = () => /^https:\/\/www\.altered\.gg(\/.*)?$/.test(window.location.href);

    // Get Language from URL
    const getLanguageFromURL = () => {
        const match = window.location.pathname.split('/')[1]; // Get the first part after /
        const validLanguagePattern = /^[a-z]{2}-[a-z]{2}$/; // Match patterns like fr-fr, en-us, etc.
        return validLanguagePattern.test(match) ? match : 'en-us'; // Return valid match or default to en-us
    };

    const language = getLanguageFromURL();

    // Get Token
    const getAccessToken = () => {
        const tokenMatch = document.documentElement.innerHTML.match(/"accessToken":"(.*?)"/);
        if (!tokenMatch) throw new Error('Err01 - Token not found !');
        return tokenMatch[1];
    };

	// Get Raw Card Collection (Stats)
	const fetchCardDataStats = async (accessToken, page) => {
		const response = await fetch(`https://api.altered.gg/cards/stats?collection=true&itemsPerPage=36&page=${page}&locale=${language}`, {
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

	// Get Raw Card Collection (Cards)
	const fetchCardDataCards = async (accessToken, page) => {
		const response = await fetch(`https://api.altered.gg/cards?collection=true&itemsPerPage=36&page=${page}&locale=${language}`, {
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

	// Extract Links and Details
	const extractLinks = (statsData, cardsData) => {
		const statsMembers = statsData?.['hydra:member'];
		const cardsMembers = cardsData?.['hydra:member'];
		if (!statsMembers || !cardsMembers) throw new Error('Err04 - Invalid data format !');

		const collectionLinks = [];
		const detailedCollectionLinks = [];
		const tradeListLinks = [];
		const wantListLinks = [];
		let collectionCount = 0;
		let tradeCount = 0;
		let wantCount = 0;

		statsMembers.forEach((statCard) => {
			const reference = `${statCard.reference}`;
			const cardDetails = cardsMembers.find(card => card.reference === statCard.reference);

			// In Collection (Stats)
			if (statCard.inMyCollection > 0) {
				collectionLinks.push(`${statCard.inMyCollection} ${reference}`);
				collectionCount += statCard.inMyCollection;
			}

			// In Collection (Cards CSV)
			if (statCard.inMyCollection > 0 && cardDetails) {
				const rarityName = cardDetails.rarity?.name || '?';
				const factionName = cardDetails.mainFaction?.name || '?';
				const cardName = cardDetails.name || '?';
				const cardType = cardDetails.cardType?.name || '?';

				detailedCollectionLinks.push(
					`${factionName}\t${rarityName}\t${cardType}\t${statCard.inMyCollection}\t${cardName}`
				);
			}

			// In Want List (Stats)
			if (statCard.inMyWantlist) {
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

	// Get All Card Data
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
		let page = 1;

		const initialStatsData = await fetchCardDataStats(accessToken, page);
		const totalPages = Math.ceil((initialStatsData['hydra:totalItems'] || 0) / 36);

		for (page = 1; page <= totalPages; page++) {
			const progressPercent = Math.round((page / totalPages) * 100);
			chrome.runtime.sendMessage({
				action: 'updateLoadingMessage',
				message: `Retrieving cards collection, please wait...<br/>Do not close this window or leave your browser !<br/><br/>Progress : ${progressPercent}%`
			});

			const [statsData, cardsData] = await Promise.all([
				fetchCardDataStats(accessToken, page),
				fetchCardDataCards(accessToken, page)
			]);

			const links = extractLinks(statsData, cardsData);

			allLinks.collection.push(...links.collectionLinks);
			allLinks.trade.push(...links.tradeListLinks);
			allLinks.want.push(...links.wantListLinks);
			allLinks.detailedCollection.push(...links.detailedCollectionLinks);

			collectionTotal += links.collectionCount;
			tradeTotal += links.tradeCount;
			wantTotal += links.wantCount;
		}

		chrome.runtime.sendMessage({
			action: 'getLinks',
			links: allLinks,
			counts: {
				collectionCount: collectionTotal,
				tradeCount: tradeTotal,
				wantCount: wantTotal
			}
		});
	};

    // Error Handling
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
        chrome.runtime.sendMessage({
            action: 'getError',
            message: errorMap[errorMessage]
        });
    };

    // Main Logic
    try {
        if (!isCorrectPage()) throw new Error('Please go to https://www.altered.gg !');
        const accessToken = getAccessToken();
        await getAllCardData(accessToken);
    } catch (error) {
        handleError(error.message);
    }
})();
