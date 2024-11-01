chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getLinks") {
    chrome.runtime.sendMessage(request);
  }
});