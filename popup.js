document.addEventListener("DOMContentLoaded", async () => {

	// Chrome & Firefox compatibility
	// Firefox Manifest v3 does not support service workers for now.
	const browser = window.browser || window.chrome;

	// Divs
	const errorMessageDiv = document.getElementById("errorMessage");
	const loadingMessageDiv = document.getElementById("loadingMessage");
	const mainDiv = document.getElementById("main");
	
	// Textareas
	const collectionTextarea = document.getElementById("collectionTextarea");
	const wantListTextarea = document.getElementById("wantListTextarea");
	const tradeListTextarea = document.getElementById("tradeListTextarea");
	const collectionCSVTextarea = document.getElementById("collectionCSVTextarea");

	// Counters
	const collectionCountSpan = document.getElementById("collectioncount");
	const tradeListCountSpan = document.getElementById("tradelistcount");
	const wantListCountSpan = document.getElementById("wantlistcount");

	// Buttons
	const copyCollectionButton = document.getElementById("copyCollectionButton");
	const copyWantListButton = document.getElementById("copyWantListButton");
	const copyTradeListButton = document.getElementById("copyTradeListButton");
	const copyCollectionCSVButton = document.getElementById("copyCollectionCSVButton");

	// Selects
	const select = document.getElementById("setSelect");

	// Utility function to copy the contents of a textarea
	const copyToClipboard = (textarea) => {
		textarea.select();
		textarea.setSelectionRange(0, textarea.value.length);
		document.execCommand("copy");
	};

	// Listeners on the copy buttons
	copyCollectionButton.addEventListener("click", () => copyToClipboard(collectionTextarea));
	copyWantListButton.addEventListener("click", () => copyToClipboard(wantListTextarea));
	copyTradeListButton.addEventListener("click", () => copyToClipboard(tradeListTextarea));
	copyCollectionCSVButton.addEventListener("click", () => copyToClipboard(collectionCSVTextarea));

	// Global variables
	let useUniques = 0;
	let language = "en-us";

	// Display the loading message at the start
	errorMessageDiv.style.display = "none";
	mainDiv.style.display = "none";
	loadingMessageDiv.style.display = "none";

	const updateLoadingMessage = (progress) => {
		loadingMessageDiv.innerHTML = `
			<br/><br/>
			Retrieving cards collection, please wait...<br>
			Do not close this window or leave your browser !<br><br>
			<progress value="${progress}" max="100" style="width: 100%;"></progress><br/>
			Progress: ${progress}%
			
		`;
	};

	// Function to communicate with the service worker
	const fetchViaWorker = (url, options = {}) => {
		return new Promise((resolve, reject) => {
			chrome.runtime.sendMessage({
					type: "fetch",
					url,
					options,
				},
				(response) => {
					if (chrome.runtime.lastError) {
						reject(new Error(chrome.runtime.lastError.message));
						return;
					}
					if (!response.ok) {
						reject(new Error(`HTTP error! Status: ${response.status}`));
						return;
					}
					resolve(response.text);
				}
			);
		});
	};

	// Populate the set select
	const setToDownload = document.getElementById("setSelect");
	setToDownload.querySelectorAll("option:not([value='ALL'])").forEach(opt => opt.remove());
	const excludedCodes = ['WCS25', 'TEST', 'WCQ25'];

	try {
		const rawText = await fetchViaWorker("https://api.altered.gg/card_sets?locale=en-us");
		const data = JSON.parse(rawText);

		if (data?.['hydra:member']?.length) {
			allCardSets = data['hydra:member']
				.filter(set =>
					set.reference &&
					set.name &&
					set.code &&
					!excludedCodes.includes(set.code)
				)
				.map(set => {
					// Fix for the COREKS set
					if (set.reference === 'COREKS') {
						set.code = 'BTGKS';
					}
					return {
						reference: set.reference,
						code: set.code,
						name: set.name
					};
				})
				.reverse(); // Revers sets order

			allCardSets.forEach(set => {
				const option = document.createElement("option");
				option.value = set.reference;
				option.textContent = set.name;
				option.setAttribute("data-code", set.code);
				setToDownload.appendChild(option);
			});
		} else {
			console.warn("No sets found in API response.");
		}
	} catch (err) {
		console.error("Error fetching card sets:", err);
	}

	// Change the button based on the select
	setToDownload.addEventListener("change", function() {
		const selectedOption = setToDownload.options[setToDownload.selectedIndex];
		const code = selectedOption.dataset.code;
		const value = selectedOption.value;

		if (value === "ALL") {
			btnComplete.innerHTML = "<b>Full Collection</b>";
			btnUniques.innerHTML = "<b>Uniques Only</b>";
		} else if (value === "COREKS") {
			btnComplete.innerHTML = `<b>${code} KS Collection</b>`;
			btnUniques.innerHTML = `<b>${code} KS Uniques Only</b>`;
		} else {
			btnComplete.innerHTML = `<b>${code} Collection</b>`;
			btnUniques.innerHTML = `<b>${code} Uniques Only</b>`;
		}
	});

	// Function to fetch the card collection statistics
	const fetchCardDataStatsForSet = async (accessToken, page, setName) => {
		const itemsPerPage = 36;
		let url = `https://api.altered.gg/cards/stats?collection=true&itemsPerPage=${itemsPerPage}&page=${page}&locale=${language}&cardSet[]=${setName}`;
		if (useUniques) {
			url += `&rarity[]=UNIQUE`;
		}

		const rawText = await fetchViaWorker(url, {
			method: "GET",
			headers: {
				'Accept-Language': language,
				'Authorization': `Bearer ${accessToken}`,
			},
		});

		try {
			return JSON.parse(rawText);
		} catch {
			throw new Error('Err06 : Invalid data received !');
		}
	};

	// Function to fetch the card wantlist statistics
	const fetchCardDataStatsForSetWantList = async (accessToken, page, setName) => {
		const itemsPerPage = 36;
		let url = `https://api.altered.gg/cards/stats?cardList.name=wantlist&itemsPerPage=${itemsPerPage}&page=${page}&locale=${language}&cardSet[]=${setName}`;
		if (useUniques) {
			url += `&rarity[]=UNIQUE`;
		}

		const rawText = await fetchViaWorker(url, {
			method: "GET",
			headers: {
				'Accept-Language': language,
				'Authorization': `Bearer ${accessToken}`,
			},
		});

		try {
			return JSON.parse(rawText);
		} catch {
			throw new Error('Err08 : Invalid data received !');
		}
	};

	// Function to fetch the cards from the collection
	const fetchCardDataCardsForSet = async (accessToken, page, setName) => {
		const itemsPerPage = 36;
		let url = `https://api.altered.gg/cards?collection=true&itemsPerPage=${itemsPerPage}&page=${page}&locale=${language}&cardSet[]=${setName}`;
		if (useUniques) {
			url += `&rarity[]=UNIQUE`;
		}

		const rawText = await fetchViaWorker(url, {
			method: "GET",
			headers: {
				'Accept-Language': language,
				'Authorization': `Bearer ${accessToken}`,
			},
		});

		try {
			return JSON.parse(rawText);
		} catch {
			throw new Error('Err10 : Invalid data received !');
		}
	};

	// Function to extract links and details
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

	// Function to extract sets to process (from sets list at load time)
	const fetchCardSets = async () => {
		if (!allCardSets.length) {
			throw new Error("Err12 : No sets loaded ! Please reload the extension.");
		}

		let cardSets = [...allCardSets];

		// Verify user select value
		const selectedSet = setToDownload.value;

		if (selectedSet !== 'ALL') {
			cardSets = cardSets.filter(set => set.reference === selectedSet);
		}

		return cardSets;
	};

	// Main function to fetch all card data for each set
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

		// Rate limiter (2 requests/second)
		const createRateLimiter = (maxRequestsPerSecond) => {
			let queue = [];
			let activeCount = 0;

			const processQueue = () => {
				if (queue.length === 0) {
					activeCount = 0;
					return;
				}
				while (activeCount < maxRequestsPerSecond && queue.length > 0) {
					const {
						fn,
						resolve,
						reject
					} = queue.shift();
					activeCount++;
					fn()
						.then(resolve)
						.catch(reject)
						.finally(() => {
							activeCount--;
							// Waiting for 1.25 seconds for the api rate limit
							setTimeout(processQueue, 1250);
						});
				}
			};

			const schedule = (fn) => {
				return new Promise((resolve, reject) => {
					queue.push({
						fn,
						resolve,
						reject
					});
					processQueue();
				});
			};

			return schedule;
		};

		const schedule = createRateLimiter(2); // 2 requests (per second)

		const cardSets = await fetchCardSets();

		// Function to calculate the total number of pages for a given set
		const fetchCardDataForSet = async (accessToken, reference, code, isWantlist = false) => {
			const fetchStats = isWantlist ? fetchCardDataStatsForSetWantList : fetchCardDataStatsForSet;
			const initialStatsData = await schedule(() => fetchStats(accessToken, 1, reference));
			const totalPages = Math.ceil((initialStatsData['hydra:totalItems'] || 0) / 36);
			return totalPages;
		};

		// Calculate total pages for all sets (collection + wantlist)
		const totalPagesForAllSets = await Promise.all(
			cardSets.map(set => fetchCardDataForSet(accessToken, set.reference, set.code))
		);
		const totalPages = totalPagesForAllSets.reduce((acc, pages) => acc + pages, 0);
		const totalRequests = totalPages * 2;

		const totalPagesForWantlist = await Promise.all(
			cardSets.map(set => fetchCardDataForSet(accessToken, set.reference, set.code, true))
		);
		const totalPagesWantlist = totalPagesForWantlist.reduce((acc, pages) => acc + pages, 0);
		const totalRequestsWantlist = totalPagesWantlist * 2;

		// Progression update
		const updateGlobalProgress = () => {
			const totalGlobalRequests = totalRequests + totalRequestsWantlist;
			const progressPercent = Math.round((completedRequests / totalGlobalRequests) * 100);
			updateLoadingMessage(progressPercent);
		};

		// Function to fetch data of a page (stats + cards), going through the rate limiter
		const fetchPageData = async (accessToken, page, reference, code, isWantlist = false) => {
			const fetchStats = isWantlist ? fetchCardDataStatsForSetWantList : fetchCardDataStatsForSet;

			// Schedule the 2 requests via the rate limiter
			const statsPromise = schedule(() => fetchStats(accessToken, page, reference));
			const cardsPromise = schedule(() => fetchCardDataCardsForSet(accessToken, page, reference));

			const [statsData, cardsData] = await Promise.all([statsPromise, cardsPromise]);

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

			completedRequests += 2;
			updateGlobalProgress();
		};

		// Loop over each set page by page sequentially (no batching or sleeping needed)
		for (const set of cardSets) {
			const totalPagesForSet = await fetchCardDataForSet(accessToken, set.reference, set.code);
			for (let page = 1; page <= totalPagesForSet; page++) {
				await fetchPageData(accessToken, page, set.reference, set.code);
			}
		}

		for (const set of cardSets) {
			const totalPagesForSetWantlist = await fetchCardDataForSet(accessToken, set.reference, set.code, true);
			for (let page = 1; page <= totalPagesForSetWantlist; page++) {
				await fetchPageData(accessToken, page, set.reference, set.code, true);
			}
		}

		// Updating the textareas
		collectionTextarea.value = allLinks.collection.join('\n');
		wantListTextarea.value = allLinks.want.join('\n');
		tradeListTextarea.value = allLinks.trade.join('\n');
		collectionCSVTextarea.value = allLinks.detailedCollection.join('\n');

		// Updating the totals
		collectionCountSpan.textContent = collectionTotal;
		tradeListCountSpan.textContent = tradeTotal;
		wantListCountSpan.textContent = wantTotal;

		if (useUniques === 0) {
			/*
			// Add promo/events non owned cards (Add tokens ?), only for global collection
			const promoCardIDs = [
				'3 ALT_ALIZE_P_OR_48_C',
				'3 ALT_ALIZE_P_OR_48_R1',
				'3 ALT_ALIZE_P_OR_48_R2'
			];
			promoCardIDs.forEach(id => {
				allLinks.collection.push(id);
			});

			// Updating the textareas and totals
			collectionTextarea.value = allLinks.collection.join('\n');
			wantListTextarea.value = allLinks.want.join('\n');
			tradeListTextarea.value = allLinks.trade.join('\n');
			collectionCSVTextarea.value = allLinks.detailedCollection.join('\n');
			collectionCountSpan.textContent = collectionTotal + 9;
			wantListCountSpan.textContent = wantTotal;
			tradeListCountSpan.textContent = tradeTotal;
			*/
		} else {
			// Filtering lines with 'FOILER' or 'Foiler'
			const filterFoilers = (list) => {
				let newList = [];
				let removed = 0;
				list.forEach(line => {
					if (line.includes('_FOILER_') || line.includes('Foiler')) {
						const match = line.match(/^(\d+)\s/);
						if (match) removed += parseInt(match[1], 10);
					} else {
						newList.push(line);
					}
				});
				return {
					newList,
					removed
				};
			};

			const filteredCollection = filterFoilers(allLinks.collection);
			const filteredWant = filterFoilers(allLinks.want);
			const filteredTrade = filterFoilers(allLinks.trade);
			const filteredDetailed = filterFoilers(allLinks.detailedCollection);

			allLinks.collection = filteredCollection.newList;
			allLinks.want = filteredWant.newList;
			allLinks.trade = filteredTrade.newList;
			allLinks.detailedCollection = filteredDetailed.newList;

			collectionTextarea.value = allLinks.collection.join('\n');
			wantListTextarea.value = allLinks.want.join('\n');
			tradeListTextarea.value = allLinks.trade.join('\n');
			collectionCSVTextarea.value = allLinks.detailedCollection.join('\n');

			collectionCountSpan.textContent = collectionTotal - filteredCollection.removed;
			wantListCountSpan.textContent = wantTotal - filteredWant.removed;
			tradeListCountSpan.textContent = tradeTotal - filteredTrade.removed;
		}
	};

	async function fetchCollection(useUniques) {
		try {

			// Checking the domain of the active tab
			const tabs = await browser.tabs.query({
				active: true,
				currentWindow: true
			});
			if (tabs.length === 0 || !tabs[0].url) {
				throw new Error("Err01 : Unable to retrieve URL ! Please reload the page and try again.");
			}

			const currentTabDomain = new URL(tabs[0].url).hostname;

			if (!currentTabDomain.endsWith("altered.gg")) {
				throw new Error("Err02 : Please go to https://altered.gg and login into your account !");
			}

			// Retrieving the site language from the active tab’s URL
			language = (() => {
				const url = new URL(tabs[0].url);
				const path = url.pathname.split('/');
				const locale = path[1];
				return locale && /^[a-z]{2}-[a-z]{2}$/.test(locale) ? locale : 'en';
			})();

			// Function to retrieve the access token from the API
			const getAccessTokenFromAPI = async () => {
				try {
					const rawText = await fetchViaWorker("https://www.altered.gg/api/auth/session", {
						method: "GET",
						headers: {
							"Content-Type": "application/json",
						},
					});

					const data = JSON.parse(rawText);

					if (!data.accessToken) {
						throw new Error("Err04 : Please login into your account !");
					}

					return data.accessToken;
				} catch (error) {
					console.error(error);
					throw new Error('Err03 : Invalid API response ! Please reload the page and try again.');
				}
			};
			
			// Function to retrieve the access token from the altered.gg page (API backup fallback)
			const getAccessToken = () => {
				const tokenMatch = pageHTML.match(/"accessToken":"(.*?)"/);
				if (!tokenMatch) throw new Error("Err04 : Please login into your account !");
				return tokenMatch[1];
			};

			// Retrieving the token
			const accessToken = await getAccessTokenFromAPI();

			await getAllCardData(accessToken);

			loadingMessageDiv.style.display = "none";
			mainDiv.style.display = "block";

		} catch (error) {
			loadingMessageDiv.style.display = "none";
			mainDiv.style.display = "none";
			errorMessageDiv.style.display = "flex";
			errorMessageDiv.textContent = error.message;
		}
	}

	// Handling clicks on the buttons
	btnComplete.addEventListener("click", () => {
		useUniques = 0;
		fetchCollection(0);
		document.getElementById("choiceButtons").style.display = "none";
		loadingMessageDiv.style.display = "block";
	});

	btnUniques.addEventListener("click", () => {
		useUniques = 1;
		fetchCollection(1);
		document.getElementById("choiceButtons").style.display = "none";
		loadingMessageDiv.style.display = "block";
	});

});