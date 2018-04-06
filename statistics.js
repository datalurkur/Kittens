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
        maxValues: 2048,

        ValueSet: function()
        {
            this.values  = [];
            this.yDomain = [0,1];
        },

        ValueGroup: function(id)
        {
            this.id          = id;
            this.sets        = [];
            this.totalValues = 0;
            this.timeDomain  = [0,1];
            this.yDomain     = [0,1];
        },

        DataSet: function()
        {
            this.allResources     = [];
            this.perTickResources = {};
            this.events           = {};
            this.timeDomain       = [0,1];
        },

        addValueToSet: function(valueSet, time, value)
        {
            valueSet.values.push([time, value]);
            if (valueSet.values.length == 1)
            {
                valueSet.yDomain = [value, value];
            }
            else
            {
                valueSet.yDomain = [
                    Math.min(valueSet.yDomain[0], value),
                    Math.max(valueSet.yDomain[1], value)
                ];
            }
        },

        recomputeYDomainForSet: function(valueSet)
        {
            valueSet.yDomain = [
                Math.min(...valueSet.values),
                Math.max(...valueSet.values)
            ];
        },

        addValueToGroup: function(valueGroup, time, value, threshold)
        {
            var pair = [time, value];
            valueGroup.totalValues += 1;

            // Is this the first value to be added?
            if (valueGroup.sets.length == 0)
            {
                var newSet = new this.ValueSet();
                valueGroup.sets.push(newSet);
                this.addValueToSet(newSet, time, value);
                valueGroup.timeDomain = [time,  time ];
                valueGroup.yDomain    = [value, value];
                return;
            }

            // Determine if a new set should be started
            var lastSet     = valueGroup.sets[valueGroup.sets.length - 1];
            var lastElement = lastSet.values[lastSet.values.length - 1];
            if (lastElement[0] < threshold)
            {
                lastSet = new this.ValueSet();
                valueGroup.sets.push(lastSet);
            }
            this.addValueToSet(lastSet, time, value);
            valueGroup.timeDomain[1] = time;

            // Determine if an element needs removal
            if (valueGroup.totalValues >= this.maxValues)
            {
                var firstSet = valueGroup.sets[0];
                firstSet.values.shift();
                if (firstSet.values.length == 0)
                {
                    valueGroup.sets.shift();
                }
                else
                {
                    this.recomputeYDomainForSet(firstSet);
                }
                valueGroup.timeDomain[0] = valueGroup.sets[0].values[0][0];
                valueGroup.yDomain = [
                    Math.min(...(valueGroup.sets.map(s => s.yDomain[0]))),
                    Math.max(...(valueGroup.sets.map(s => s.yDomain[1]))),
                ];
            }
            else
            {
                valueGroup.yDomain = [
                    Math.min(valueGroup.yDomain[0], value),
                    Math.max(valueGroup.yDomain[1], value),
                ];
            }
        },

        addDatapoint: function(cache, tickData)
        {
            var time = (new Date()).valueOf();
            // If the last value in a data set is more than 50% behind the last expected tick, start a new data set
            var discontinuityThreshold = time - (ajk.config.tickFrequency * 1500);

            for (var resource in cache.internal.resourceCache)
            {
                var perTick = cache.internal.resourceCache[resource].perTick;
                if (perTick != 0)
                {
                    if (!this.data.perTickResources.hasOwnProperty(resource))
                    {
                        this.data.perTickResources[resource] = new this.ValueGroup();
                        this.data.allResources.push(resource);
                    }
                    this.addValueToGroup(
                        this.data.perTickResources[resource],
                        time,
                        perTick,
                        discontinuityThreshold
                    );
                }
            }

            this.data.timeDomain = [
                Math.min(...(Object.values(this.data.perTickResources).map(v => v.timeDomain[0]))),
                Math.max(...(Object.values(this.data.perTickResources).map(v => v.timeDomain[1]))),
            ];
        },

        saveToWebStorage: function()
        {
            if (typeof Storage === 'undefined') { return; }
            localStorage.ajkStats = JSON.stringify(this.data);
        },

        loadFromWebStorage: function()
        {
            if (typeof Storage === 'undefined' || typeof localStorage.ajkStats === 'undefined')
            {
                this.clear();
            }
            else
            {
                this.data = JSON.parse(localStorage.ajkStats);
            }
        },

        clear: function()
        {
            this.data = new this.DataSet();
        },
    },

    update: function(cache, tickData) { this.internal.addDatapoint(cache, tickData); },
    get:    function()                { return this.internal.data; },
    clear:  function()                { this.internal.clear(); },
};

window.addEventListener('load', () => { ajk.statistics.internal.loadFromWebStorage(); return null; });
window.addEventListener('beforeunload', () => { ajk.statistics.internal.saveToWebStorage(); return null; });