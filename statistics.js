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
        maxSnapshots: (60 * 60 * 24 * 1) / ajk.config.tickFrequency,
        snapshots:
        {
            size:    0,
            current: 0,
            buffer:  [],
        },

        buildSnapshot: function(cache)
        {
            return {
                time: (new Date()).valueOf(),
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
            if (typeof localStorage.ajkStats === 'undefined')
            {
                this.snapshots.buffer = new Array(this.maxSnapshots);
            }
            else
            {
                this.snapshots = JSON.parse(localStorage.ajkStats);
            }
        },

        addSnapshot: function(snapshot)
        {
            this.snapshots.buffer[this.snapshots.current] = snapshot;
            this.snapshots.current += 1;
            if (this.snapshots.current >= this.snapshots.buffer.length) { this.snapshots.current -= this.snapshots.buffer.length; }
            if (this.snapshots.size < this.snapshots.buffer.length) { this.snapshots.size += 1; }
        },

        getSnapshot: function(index)
        {
            var offsetIndex = (index + this.snapshots.current) - this.snapshots.size;
                 if (offsetIndex >= this.snapshots.buffer.length) { offsetIndex -= this.snapshots.buffer.length; }
            else if (offsetIndex < 0) { offsetIndex += this.snapshots.buffer.length; }
            return this.snapshots.buffer[offsetIndex];
        },

        clearSnapshots: function()
        {
            this.snapshots = {
                buffer:  new Array(this.maxSnapshots),
                size:    0,
                current: 0,
            }
        },
    },

    update: function(cache)
    {
        var snapshot = this.internal.buildSnapshot(cache);
        this.internal.addSnapshot(snapshot);
    },

    length: function()  { return this.internal.snapshots.size; },
    get:    function(i) { return this.internal.getSnapshot(i); },

    getAll: function()
    {
        var i0 = this.internal.snapshots.current - this.internal.snapshots.size;
        if (i0 < 0) { i0 += this.internal.snapshots.buffer.length; }
        var endIndex = i0 + this.internal.snapshots.size;
        var i1 = Math.min(this.internal.snapshots.buffer.length, endIndex);
        var i2 = 0;
        var i3 = Math.max(0, endIndex - this.internal.snapshots.buffer.length);
        return this.internal.snapshots.buffer.slice(i0, i1).concat(this.internal.snapshots.buffer.slice(i2, i3));
    },

    getDataSize: function()
    {
        return this.internal.snapshots.buffer.length;
    },

    getTimeRange: function()
    {
        this.internal.snapshots.buffer.length * ajk.config.tickFrequency * 1000;
    },
};

window.addEventListener('load', () => { ajk.statistics.internal.loadFromWebStorage(); return null; });
window.addEventListener('beforeunload', () => { ajk.statistics.internal.saveToWebStorage(); return null; });