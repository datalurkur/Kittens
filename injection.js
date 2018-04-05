'use strict';

const scripts = [
    {name: 'base.js', external: false, asModule: false},
    {name: 'backup.js', external: false, asModule: false},
    {name: 'cache.js', external: false, asModule: false},
    {name: 'costData.js', external: false, asModule: false},
    {name: 'jobs.js', external: false, asModule: false},
    {name: 'analysis.js', external: false, asModule: false},
    {name: 'core.js', external: false, asModule: false},
    {name: "https://d3js.org/d3.v3.min.js", external: true, asModule: false},
    {name: 'statistics.js', external: false, asModule: false},
    {name: 'graph.js', external: false, asModule: false},
    {name: 'ui.js', external: false, asModule: false},
    {name: 'easteregg.js', external: false, asModule: false},
];

const loadScript = function(index)
{
    if (index >= scripts.length) { return; }
    var data = scripts[index];

    var scriptName = scripts[index].name;
    var head = document.head || document.getElementsByTagName('head')[0];

    var script = document.createElement('script');
    script.src = (data.external) ? scriptName : chrome.runtime.getURL(scriptName);
    if (data.asModule)
    {
        script.type = 'module';
    }
    script.onload = function()
    {
        console.log('Script ' + scriptName + ' loaded');
        loadScript(index + 1);
    }
    head.appendChild(script);
}

const injectHtml = function(resource, targetElement)
{
    console.log('Injecting ' + resource + ' into ' + targetElement);
    var req = new XMLHttpRequest();
    req.onreadystatechange = function()
    {
        if (this.readyState == 4 && this.status == 200)
        {
            var target = document.getElementById(targetElement);
            var div = document.createElement('div');
            div.id = 'test_injected_' + resource;
            div.innerHTML = this.responseText;
            target.append(div);
        }
    };
    req.open('GET', chrome.runtime.getURL(resource), true);
    req.send();
}

const handleDocumentLoaded = function()
{
    console.log('Injecting AJK automation code');

    var head = document.head || document.getElementsByTagName('head')[0];

    // Inject stylesheet
    var link = document.createElement('link')
    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.href = chrome.runtime.getURL('style.css');
    head.appendChild(link);

    // Inject UI
    // Inject left column controls
    injectHtml('sidebar.html', 'leftColumn');
    injectHtml('backupWidget.html', 'leftColumn');

    // Inject scripts
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