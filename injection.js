'use strict';

const scripts = [
    'base.js',
    'backup.js',
    'cache.js',
    'customItems.js',
    'costData.js',
    'jobs.js',
    'analysis.js',
    'core.js',
    'ui.js'
];

const loadScript = function(index)
{
    if (index >= scripts.length) { return; }
    var scriptName = scripts[index];
    var head = document.head || document.getElementsByTagName('head')[0];

    var script = document.createElement('script');
    script.src = chrome.extension.getURL(scriptName);
    script.onload = function()
    {
        console.log('Script ' + scriptName + ' loaded');
        loadScript(index + 1);
    }
    head.appendChild(script);
}

const handleDocumentLoaded = function()
{
    console.log('Injecting kittens code');
    loadScript(0);
};

if (document.readyState === "loading")
{
    document.addEventListener("DOMContentLoaded", handleDocumentLoaded);
}
else
{
    handleDocumentLoaded();
}