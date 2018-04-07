const tabChanged = function(tabId, selectInfo)
{
    chrome.tabs.query({currentWindow: true, active: true}, (tabs) => {
        if (tabs.length == 0 ||
            typeof tabs[0].url === 'undefined' ||
            tabs[0].url.indexOf('bloodrizer.ru/games/kittens') == -1)
        {
            chrome.browserAction.disable();
        }
        else
        {
            chrome.browserAction.enable();
        }
    })
};
chrome.tabs.onActiveChanged.addListener(tabChanged);