ajk.previousTab = null;

ajk.Util = class
{
    static ensureKey(object, key, defaultValue)
    {
        if (!object.hasOwnProperty(key)) { object[key] = defaultValue; }
        return object[key];
    }

    static switchTab(tabId)
    {
        // This is expensive - avoid doing this wherever possible
        if (tabId == null && ajk.previousTab != null)
        {
            tabId = ajk.previousTab;
            ajk.previousTab = null;
        }
        else if (ajk.previousTab == null && tabId != null)
        {
            ajk.previousTab = gamePage.ui.activeTabId;
        }
        else if (ajk.previousTab == null && tabId == null)
        {
            return;
        }

        if (tabId == gamePage.ui.activeTabId) { return; }

        gamePage.ui.activeTabId = tabId;
        gamePage.render(); 
    }
}