'use strict';

ajk.analysis = {
    log: ajk.log.addChannel('analysis', true),
    oneShotModifier: -7,
    explorationModifier: -5,

    data: {},
    capacityDemand: {},
    outputDemand: {},

    priorityList: [],
    filteredPriorityList: [],

    shouldExplore: false,

    defaultItemWeight: {
        'deepMining': -10,
        'coalFurnace': -10,

        'printingPress': -10,

        // Speculative
        'geodesy': -10,
        'oxidation': -5,
    },

    previousPriority: [],
    previousOrder: [],

    weightAdjustments: function()
    {
        return [
        // TODO - Fix this
        /*
            ajk.adjustment.priceRatioModule,
            ajk.adjustment.reinforceTopPriority,
            ajk.adjustment.weightedDemandScaling,
            ajk.adjustment.tabDiscovery,
            ajk.adjustment.tradingModule,
            ajk.adjustment.capacityUnblocking,
            */
        ];
    },

    modifyWeight: function(itemName, modifier, adjustment)
    {
        if (!this.data.hasOwnProperty(itemName))
        {
            this.data[itemName] = {};
        }
        if (!this.data[itemName].hasOwnProperty('weight'))
        {
            if (this.defaultItemWeight.hasOwnProperty(itemName))
            {
                this.data[itemName].weight = this.defaultItemWeight[itemName];
            }
            else
            {
                this.data[itemName].weight = 0;
            }
            this.data[itemName].adjustments = [];
        }
        this.data[itemName].weight += modifier;
        if (adjustment != null)
        {
            this.data[itemName].adjustments.push([adjustment, modifier]);
        }
    },

    reset: function()
    {
        this.previousOrder = this.priorityList;
        this.previousPriority = this.filteredPriorityList;

        this.data = {}
        this.capacityDemand = {};
        this.outputDemand = {};
        this.priorityList = [];
        this.filteredPriorityList = [];
        this.shouldExplore = false;

        ajk.resources.reset();
    },

    preanalysis: function()
    {
        var explorationRequirement = ajk.trade.explorationRequirement();
        if (explorationRequirement != null)
        {
            if (explorationRequirement.length > 0)
            {
                for (var i = 0; i < explorationRequirement.length; ++i)
                {
                    this.log.detail('Modifying the weight of ' + explorationRequirement[i] + ' to account for exploration requirements');
                    this.modifyWeight(explorationRequirement[i], this.explorationModifier, 'exploration requirements');
                }
            }
            else
            {
                this.log.detail('New races are available for discovery');
                this.shouldExplore = true;
            }
        }
    },

    analyzeItems: function(items)
    {
        this.log.detail('Analyzing ' + items.length + ' items');
        this.log.indent();
        for (var i = 0; i < items.length; ++i)
        {
            if (!items[i].model.hasOwnProperty('metadata')) { continue; }

            var mData = items[i].model.metadata;
            var itemKey = mData.name;
            this.log.detail('Analyzing ' + itemKey);

            if (!mData.unlocked) { continue; }
            if (mData.hasOwnProperty('researched') && mData.researched) { continue; }

            var itemPrices = items[i].controller.getPrices(items[i].model);
            /*
            // TODO - Fix this
            this.log.trace('Determining how to best produce ' + itemKey + ' and how long it will take');
            var costData = ajk.resources.analyzeCostProduction(itemPrices);
            this.log.detail('It will be ' + costData.time + ' ticks until there are enough resources for ' + itemKey);
            */

            if (!this.data.hasOwnProperty(itemKey))
            {
                this.data[itemKey] = {};
            }
            this.data[itemKey].item = items[i];
            this.data[itemKey].missingMaxResources = false;
            // TODO - Fix this
            //this.data[itemKey].costData = costData;

            if (mData.hasOwnProperty('effects'))
            {
                var overConsumption = false;
                for (var effectKey in mData.effects)
                {
                    if (mData.effects[effectKey] == 0) { continue; }
                    var consumedResource = ajk.cache.getResourceConsumedByEffect(effectKey);
                    if (consumedResource == null) { continue; }
                    if (ajk.resources.getNetProductionOf(consumedResource) - mData.effects[effectKey] <= 0)
                    {
                        this.log.detail('Production of ' + consumedResource + ' does not meet the requirements for another ' + itemKey);
                        overConsumption = true;
                        this.outputDemand[consumedResource] = true;
                    }
                }
                if (overConsumption)
                {
                    this.data[itemKey].missingMaxResources = true;
                    continue;
                }
            }

            if (!mData.hasOwnProperty('val'))
            {
                // Favor one-shots
                this.log.debug('Prioritizing ' + itemKey + ' as a one-shot');
                this.modifyWeight(itemKey, this.oneShotModifier, 'one-shot');
            }

            var missingMaxResources = false;
            for (var j = 0; j < itemPrices.length; ++j)
            {
                var resource = ajk.base.getResource(itemPrices[j].name);
                if (!ajk.resources.available(itemPrices[j].name))
                {
                    missingMaxResources = true;
                }
                else if (resource.maxValue != 0 && resource.maxValue < itemPrices[j].val)
                {
                    this.log.detail('Max ' + resource.name + ' lacking to produce ' + itemKey);
                    missingMaxResources = true;
                    this.capacityDemand[itemPrices[j].name] = true;
                }
            }
            if (missingMaxResources)
            {
                this.data[itemKey].missingMaxResources = true;
            }
        }
        this.log.unindent();
    },

    analyzeResults: function()
    {
        // Adjust item weights
        var adjustments = this.weightAdjustments();
        for (var i = 0; i < adjustments.length; ++i)
        {
            adjustments[i].prepare();
            for (var itemKey in this.data)
            {
                if (!this.data[itemKey].hasOwnProperty('item')) { continue; }
                adjustments[i].modifyItem(itemKey, this.data[itemKey].item);
            }
        }

        // Organize the items in terms of priority
        for (var itemKey in this.data)
        {
            if (!this.data[itemKey].hasOwnProperty('item')) { continue; }

            var inserted = false;
            for (var i = 0; i < this.priorityList.length; ++i)
            {
                if (this.data[itemKey].weight < this.data[this.priorityList[i]].weight)
                {
                    this.priorityList.splice(i, 0, itemKey);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) { this.priorityList.push(itemKey); }
        }

        // Account for exploration costs
        if (this.shouldExplore)
        {
            this.log.detail('Accounting for catpower demand for exploration');
            // TODO - Fix this
            //ajk.resources.accumulateSimpleDemand('manpower', 1000, ajk.trade.explorationDemandWeight);
        }
    },

    postAnalysisPass: function()
    {
        // Filter the priority list and build up the table of resource requirements
        for (var i = 0; i < this.priorityList.length; ++i)
        {
            var itemData = this.data[this.priorityList[i]];
            if (itemData.missingMaxResources)
            {
                this.log.trace('Filtered out ' + this.priorityList[i] + ' due to max resource capacity');
                continue;
            }

            /*
            // TODO - Fix this
            if (!ajk.resources.hasCompetition(itemData.costData))
            {
                this.log.trace('Added ' + this.priorityList[i] + ' to list of filtered items');
                this.filteredPriorityList.push(this.priorityList[i]);
                ajk.resources.accumulateDemand(itemData.costData, itemData.weight);
            }
            else
            {
                this.log.trace('Filtered out ' + this.priorityList[i] + ' due to resource competition');
            }
            */
        }
    },
};
