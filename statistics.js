'use strict'

// Interesting statistics
// ----------------------
// -Net resource production over time
// -Trade data - scatter plot?
// -Craft data - scatter plot?
// -Job balancing // https://bl.ocks.org/mbostock/4062085
// -Resource usage sunburst // https://bl.ocks.org/kerryrodden/7090426

// -Decision Tree visualization
// -Item weights / time
// -Bottleneck ranking

ajk.statistics = {
    version: 0,

    internal:
    {
        log: ajk.log.addChannel('stats', true),

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
            this.version          = ajk.statistics.version;
            this.allResources     = [];
            this.perTickResources = {};
            this.purchases        = [];
            this.crafts           = [];
            this.trades           = [];
            this.utilization      = {};
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
                ajk.util.arrayMin(valueSet.values.map(v => v[1])),
                ajk.util.arrayMax(valueSet.values.map(v => v[1]))
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
                    valueGroup.totalValues -= 1;
                }
                else
                {
                    this.recomputeYDomainForSet(firstSet);
                }
                valueGroup.timeDomain[0] = valueGroup.sets[0].values[0][0];
                valueGroup.yDomain = [
                    ajk.util.arrayMin(valueGroup.sets.map(s => s.yDomain[0])),
                    ajk.util.arrayMax(valueGroup.sets.map(s => s.yDomain[1])),
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

        addDatapoint: function(cache, events, crafts, trades, utilization)
        {
            if (typeof this.data === 'undefined')
            {
                return;
            }

            var time = (new Date()).valueOf();
            // If the last value in a data set is more than 50% behind the last expected tick, start a new data set
            var discontinuityThreshold = time - (ajk.config.tickFrequency * 1500);

            // Update per-tick values
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

            // Update purchases
            if (events.length > 0)
            {
                this.data.purchases.push({
                    time:         time,
                    list:         events.map(e => [e.name, e.significance]),
                    significance: events.reduce((s, e) => { return (e.significance > s) ? e.significance : s; }, 0),
                    label:        (events.length > 1) ? '...' : events[0].name,
                });
                if (this.data.purchases.length > this.maxValues) { this.data.purchases.shift(); }
            }

            // TODO - Incorporate crafts, trading, production, and consumption

            // Update utilization
            for (var resource in utilization)
            {
                if (utilization[resource] == Infinity) { continue; }
                if (!this.data.utilization.hasOwnProperty(resource))
                {
                    this.data.utilization[resource] = new this.ValueGroup();
                }
                this.addValueToGroup(
                    this.data.utilization[resource],
                    time,
                    utilization[resource],
                    discontinuityThreshold
                );
            }

            // Update time domain
            // There should always be at least 1 per-tick value
            this.data.timeDomain = [
                ajk.util.arrayMin(Object.values(this.data.perTickResources).map(v => v.timeDomain[0])),
                ajk.util.arrayMax(Object.values(this.data.perTickResources).map(v => v.timeDomain[1])),
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
                try
                {
                    var parsed = JSON.parse(localStorage.ajkStats);
                    if (parsed.version != ajk.statistics.version)
                    {
                        this.log.warn('Old version of statistics data detected, clearing previous stats');
                        this.log.flush(false);
                        this.clear();
                    }
                    else
                    {
                        this.data = parsed;
                    }
                }
                catch (err)
                {
                    this.clear();
                }
            }
        },

        clear: function()
        {
            this.data = new this.DataSet();
        },
    },

    update: function(cache, events, crafts, trades, utilization)
    {
        this.internal.addDatapoint(cache, events, crafts, trades, utilization);
    },

    get: function()
    {
        return this.internal.data;
    },

    clear: function()
    {
        this.internal.clear();
    },
};

window.addEventListener('load', () => { ajk.statistics.internal.loadFromWebStorage(); return null; });
window.addEventListener('beforeunload', () => { ajk.statistics.internal.saveToWebStorage(); return null; });