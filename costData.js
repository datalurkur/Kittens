'use strict';

// Builds a sparse structure that contains various options for constructing something, but makes no decisions based on time or current resource availability
// Depends on cached trade data
// These can be cached per-item, but need to be recomputed whenever trade data changes or resources are unlocked
ajk.costDataFactory = {
    internal:
    {
        log: ajk.log.addChannel('costdata', true),

        buildOptionCostData: function(cache, method, basePrices, extraPrices, ratio, extraData)
        {
            var priceData = [];
            for (var i = 0; i < basePrices.length; ++i)
            {
                priceData.push(this.buildResourceCostData(cache, basePrices[i].name, basePrices[i].val));
            }
            for (var i = 0; i < extraPrices.length; ++i)
            {
                priceData.push(this.buildResourceCostData(cache, extraPrices[i][0], extraPrices[i][1]));
            }
            return {
                method:       method,
                dependencies: priceData,
                ratio:        ratio,
                extraData:    extraData,
            };
        },

        buildResourceCostData: function(cache, resource, value)
        {
            this.log.detail('Building sparse data for ' + value + ' ' + resource);
            this.log.indent();

            var rData = ajk.base.getResource(resource);
            var data = {
                log: this.log,

                // Basic Info
                resourceName: resource,
                price:        value,
                options:      [],
            };

            if (rData.craftable)
            {
                this.log.detail('Data includes crafting option');
                var cData = ajk.base.getCraft(resource);
                data.options.push(this.buildOptionCostData(cache, 'craft', cData.prices, [], ajk.base.getCraftRatio(), null));
            }

            // Don't trade for catnip
            if (resource != 'catnip')
            {
                var tradeData = cache.getTradeDataForResource(resource);
                for (var i = 0; i < tradeData.length; ++i)
                {
                    this.log.detail('Adding trade option with ' + tradeData[i].race.name);
                    data.options.push(this.buildOptionCostData(cache, 'trade', tradeData[i].race.buys, [['gold', 15], ['manpower', 50]], tradeData[i].tradeAmount, tradeData[i].race));
                }
            }

            this.log.unindent();
            return data;
        },
    },
    buildCostData: function(cache, item) { return this.internal.buildOptionCostData(cache, 'purchase', item.model.prices, [], 1, item); },
};

ajk.decisionTreeFactory = {
    internal:
    {
        log: ajk.log.addChannel('dtree', true),
        buildOptionNode: function(cache, option, parentResourceNode)
        {
            this.log.detail('Building decision tree for option: ' + option.method);
            this.log.indent();

            var dTree = {
                log: this.log,

                // External objects and linkage
                optionData:     option,
                parentResource: parentResourceNode,

                // Child objects
                dependencies:   [],

                // Computed properties
                actionCount:    1,
                maxTime:        0,
                bottleneck:     null,

                // Accumulator
                consumption:    {},

                update: function()
                {
                    this.log.trace('Updating option node: ' + this.optionData.method);
                    this.log.indent();
                    if (this.parentOption == null)
                    {
                        this.actionCount = 1;
                        this.consumption = {};
                    }
                    else
                    {
                        this.actionCount = Math.ceil(this.parentResource.deficit / this.optionData.ratio);
                        this.consumption = $.extend({}, this.parentResource.consumption);
                    }
                    this.log.detail('Costed option at ' + this.actionCount + ' actions required');

                    for (var i = 0; i < this.dependencies.length; ++i)
                    {
                        this.dependencies[i].update();
                        if (this.maxTime < this.dependencies[i].decisionTime)
                        {
                            this.maxTime = this.dependencies[i].decisionTime;
                            this.bottleneck = this.dependencies[i];
                        }
                    }
                    this.log.unindent();
                },
            };

            for (var i = 0; i < option.dependencies.length; ++i)
            {
                dTree.dependencies.push(this.buildResourceNode(cache, option.dependencies[i], dTree));
            }

            this.log.unindent();
            return dTree;
        },

        buildResourceNode: function(cache, costData, parentOptionNode)
        {
            this.log.detail('Building decision tree for resource: ' + costData.resourceName);
            this.log.indent();

            var dTree = {
                log: this.log,

                // External objects and linkage
                costData:        costData,
                parentOption:    parentOptionNode,

                // Child objects
                options:         [],

                // Computed properties
                multiplier:      1,
                consumed:        0,
                deficit:         0,
                baseTime:        0,
                decision:        null,
                decisionTime:    Infinity,

                // Accumulator
                consumption: {},

                update: function()
                {
                    this.log.trace('Updating resource node: ' + this.costData.resourceName);
                    this.log.indent();

                    var rawAmountAvailable = cache.getAvailableQuantityOfResource(this.costData.resourceName);
                    var production         = cache.getCurrentProductionOfResource(this.costData.resourceName);

                    // Compute properties dependent on the parent node
                    if (this.parentOption == null)
                    {
                        this.multiplier  = 1;
                        this.consumption = {};
                    }
                    else
                    {
                        this.multiplier  = this.parentOption.actionCount;
                        this.consumption = this.parentOption.consumption;
                    }
                    this.log.trace('Costing resource with multiplier ' + this.multiplier);

                    // Compute properties dependent on accumulated resource consumption at this decision
                    var adjustedAmountAvailable = rawAmountAvailable;
                    var amountRequired = this.costData.price * this.multiplier;
                    if (this.consumption.hasOwnProperty(this.costData.resoureName))
                    {
                        adjustedAmountAvailable -= this.consumption(this.costData.resourceName);
                    }

                    this.log.trace('Computing deficit based on adjusted cost and amount available ' + amountRequired + ' and ' + adjustedAmountAvailable);

                    // Compute required amounts and accumulate consumption
                    var leftOver = Math.max(0, adjustedAmountAvailable - amountRequired);
                    this.deficit = Math.max(0, amountRequired - adjustedAmountAvailable);
                    this.consumed = amountRequired - this.deficit;
                    if (!this.consumption.hasOwnProperty(this.costData.resourceName))
                    {
                        this.consumption[this.costData.resourceName] = 0;
                    }
                    this.consumption[this.costData.resourceName] += this.consumed;

                    // Compute time-to-completion based on deficit
                    if (this.deficit == 0) { this.baseTime = 0; }
                    else
                    {
                        this.baseTime = this.deficit / production;
                        if (this.baseTime < 0) { this.baseTime = Infinity; }
                    }
                    this.decisionTime = this.baseTime;

                    this.log.trace('It will be ' + this.baseTime + ' ticks until quantity ' + this.deficit + ' is produced');

                    // TODO - Factor current production time into options (or figure out if there's even an intelligent way to do that)
                    // In the amount of time we wait to trade / craft the deficit of a resource, there may be some production happening in the background that actually changes the amount of that resource we need to trade / craft for
                    // However, if we adjust the amount accordingly, that changes the time required to trade / craft for the new amount, which changes the total amount produced in the background...
                    // The solution to this problem is likely creating an equation that represents the time for a given decision path and then solving the equation
                    // The benefits of doing this are likely marginal at best...
                    // Nah. This is probably gonna stay a TODO forever.

                    // Update the dependent decision trees and adjust the decision / decision time accordingly
                    for (var i = 0; i < this.options.length; ++i)
                    {
                        this.options[i].update();
                        if (this.options[i].maxTime < this.decisionTime)
                        {
                            this.log.trace('Updating decision to ' + this.options[i].optionData.method + ' based on improved time of ' + this.options[i].maxTime + ' (old time was ' + this.decisionTime + ')');
                            this.decision     = this.options[i];
                            this.decisionTime = this.options[i].maxTime;
                        }
                    }

                    this.log.unindent();
                },
            };

            for (var i = 0; i < costData.options.length; ++i)
            {
                dTree.options.push(this.buildOptionNode(cache, costData.options[i], dTree));
            }

            this.log.unindent();
            return dTree;
        },
    },
    buildDecisionTree: function(cache, costData) { return this.internal.buildOptionNode(cache, costData, null); },
};

/*

        populateFlatList: function(data, decisionTree)
        {
            for (var i = 0; i < data.dependencies.length; ++i)
            {
                var dep = data.dependencies[i];
                this.log.detail('Checking dependency ' + dep.resourceName + ' for resource requirements');
                this.log.indent();
                if (dep.decision != null)
                {
                    this.populateFlatList(dep.decision, resourceCache);
                }
                else if (dep.deficit > 0)
                {
                    this.log.detail('Adding ' + dep.deficit + ' ' + dep.resourceName + ' to the list of in-demand resources');
                    resourceCache.lacking[dep.resourceName] += dep.deficit;
                }
                this.log.unindent();
            }
        },

        computeResults: function(data, decisionTree)
        {
            var maxTime = 0;
            var bottlenecks = [];
            for (var resource in resourceCache.lacking)
            {
                var lacking = resourceCache.lacking[resource];
                if (lacking > 0)
                {
                    if (resourceCache.buffer[resource] > 0)
                    {
                        this.log.detail('Adding ' + resourceCache.buffer[resource] + ' to cost to account for missing ' + resource + ' buffer');
                        lacking += resourceCache.buffer[resource];
                    }
                    var resProduction = ajk.resources.getNetProductionOf(resource);
                    var thisTime = lacking / resProduction;
                    resourceCache.waitTime[resource] = thisTime;

                    var emplaced = false;
                    for (var i = 0; i < bottlenecks.length; ++i)
                    {
                        if (thisTime > bottlenecks[i][1])
                        {
                            bottlenecks.splice(i, 0, [resource, thisTime]);
                            emplaced = true;
                            break;
                        }
                    }
                    if (!emplaced)
                    {
                        bottlenecks.push([resource, thisTime]);
                    }

                    this.log.detail('It will take ' + thisTime.toFixed(2) + ' ticks to produce ' + lacking.toFixed(2) + ' ' + resource + ' at a rate of ' + resProduction.toFixed(2) + ' per tick');
                    maxTime = Math.max(maxTime, thisTime);
                }
            }

            data.flatTime    = maxTime;
            data.bottlenecks = bottlenecks;

            resourceCache.reset();
        },
    },

    isSlowedBy: function(data, resource, amount)
    {

    },

    build: function(item, resourceCache)
    {
        var timerData = ajk.timer.start('Cost Data Contruction');

        var data = this.internal.buildSparseDependencies('construct', item.model.prices, [], 1, item);
        timerData.interval('Build Sparse Dependencies');

        var dTree = this.internal.buildEmptyDecisionTree(null);
        this.internal.buildDependencyDecisionTree(1, data, dTree);

        this.internal.populateTimeDependencyData(1, data, resourceCache);
        timerData.interval('Populate Time Data');

        data.consume(resourceCache, true);
        timerData.interval('Mark Resources');

        this.internal.populateFlatList(data, resourceCache);
        timerData.interval('Populate Flat List');

        this.internal.computeResults(data, resourceCache);
        timerData.end('Compute Results');
        return data;
    },
};
*/