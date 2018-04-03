'use strict'

// Interesting statistics
// ----------------------
// -Resource production over time
// -Net resource production over time
// -Trade data - scatter plot?
// -Craft data - scatter plot?
// -Job balancing // https://bl.ocks.org/mbostock/4062085
// -Resource usage sunburst // https://bl.ocks.org/kerryrodden/7090426
// -Action map / plot / ?

// -Decision Tree visualization
// -Item weights / time
// -Bottleneck ranking

// TODO
// -Start collecting data
// -Determine how to store and reload previous data
// -Figure out how to get amounts from trading

ajk.statistics = {
    internal:
    {
        maxSnapshots: 6 * 60 * 24 * 1, // 6 snapshots per minute -> 1 full day of data
        snapshots:    [],

        getSnapshot: function(cache)
        {
            return {
                time:      new Date(),
                resources: jQuery.extend(true, {}, cache.internal.resourceCache),
            };
        },

        saveToWebStorage: function()
        {
            if (typeof Storage === 'undefined') { return; }
            localStorage.ajkStats = JSON.stringify(this.snapshots);
        },

        loadFromWebStorage: function()
        {
            if (typeof Storage === 'undefined') { return; }
            if (localStorage.ajkStats)
            {
                this.snapshots = JSON.parse(localStorage.ajkStats);
            }
            else
            {
                this.snapshots = [];
            }
        },

        clearSnapshots: function()
        {
            this.snapshots = [];
        },
    },

    update: function(cache)
    {
        this.internal.getSnapshot(cache);
    },
};

window.addEventListener('load', () => { ajk.statistics.internal.loadFromWebStorage(); return null; });
window.addEventListener('beforeunload', () => { ajk.statistics.internal.saveToWebStorage(); return null; });