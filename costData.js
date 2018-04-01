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

            var data = {
                log: this.log,

                // Basic Info
                resourceName: resource,
                price:        value,
                options:      [],
            };

            if (ajk.base.getResource(resource).craftable && resource != 'wood')
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
    buildCombinedCostData: function(optionA, optionB)
    {
        var deps = [];
        deps = deps.concat(optionA.dependencies);
        deps = deps.concat(optionB.dependencies);
        return {
            method:       'combined',
            dependencies: deps,
            ratio:        1,
            extraData:    null,
        };
    }
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
                optionData:         option,
                parentResource:     parentResourceNode,

                // Child objects
                dependencies:       [],

                // Computed properties
                actionCount:        1,
                capacityLimiters:   [],
                capacityBlockers:   [],
                maxTime:            0,
                bottleneck:         null,

                // Accumulator
                consumption:        {},
                consumptionApplied: false,

                applyConsumption: function(recursive)
                {
                    if (this.consumptionApplied) { this.log.error('Applying consumption twice'); return; }
                    this.consumptionApplied = true;
                    for (var i = 0; i < this.dependencies.length; ++i) { this.dependencies[i].applyConsumption(recursive); }
                },

                rewindConsumption: function(recursive)
                {
                    if (!this.consumptionApplied) { this.log.error('Rewinding consumption twice'); return; }
                    this.consumptionApplied = false;
                    for (var i = 0; i < this.dependencies.length; ++i) { this.dependencies[i].rewindConsumption(recursive); }
                },

                traverse: function(func)
                {
                    for (var i = 0; i < this.dependencies.length; ++i) { this.dependencies[i].traverse(func); }
                },

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
                        this.consumption = this.parentResource.consumption;
                    }
                    this.log.detail('Costed option at ' + this.actionCount + ' actions required');

                    for (var i = 0; i < this.dependencies.length; ++i)
                    {
                        this.dependencies[i].update();
                        this.capacityLimiters = this.capacityLimiters.concat(this.dependencies[i].capacityLimiters);
                        this.capacityBlockers = this.capacityBlockers.concat(this.dependencies[i].capacityBlockers);
                        if (this.maxTime < this.dependencies[i].decisionTime)
                        {
                            this.maxTime = this.dependencies[i].decisionTime;
                            this.bottleneck = this.dependencies[i];
                        }
                    }

                    // This implicitly happens during update
                    this.consumptionApplied = true;

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
                costData:           costData,
                parentOption:       parentOptionNode,

                // Child objects
                options:            [],

                // Computed properties
                capacityLimiters:   [],
                capacityBlockers:   [],
                multiplier:         1,
                consumed:           0,
                deficit:            0,
                baseTime:           0,
                decision:           null,
                decisionTime:       Infinity,

                // Accumulator
                consumption:        {},
                consumptionApplied: false,

                applyConsumption: function(recursive)
                {
                    if (this.consumptionApplied) { this.log.error('Applying consumption twice'); return; }
                    this.consumptionApplied = true;

                    // Compute properties dependent on accumulated resource consumption at this decision
                    var adjustedAmountAvailable = cache.getAvailableQuantityOfResource(this.costData.resourceName);
                    var amountRequired = this.costData.price * this.multiplier;
                    if (this.consumption.hasOwnProperty(this.costData.resourceName))
                    {
                        adjustedAmountAvailable -= this.consumption[this.costData.resourceName];
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
                },

                rewindConsumption: function(recursive)
                {
                    if (!this.consumptionApplied) { this.log.error('Rewinding consumption twice'); return; }
                    this.consumptionApplied = false;

                    this.consumption[this.costData.resourceName] -= this.consumed;
                },

                traverse: function(func)
                {
                    if (this.decision == null) { func(this); }
                    else { this.decision.traverse(func); }
                },

                update: function()
                {
                    this.log.trace('Updating resource node: ' + this.costData.resourceName);
                    this.log.indent();

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

                    var maxCapacity = cache.getMaxQuantityOfResource(this.costData.resourceName);
                    if (this.costData.price > maxCapacity)
                    {
                        this.log.trace('Capacity limited (max storage is ' + maxCapacity + ')');
                        this.capacityBlockers.push([this.costData.resourceName, this.costData.price]);
                    }

                    this.log.trace('Costing resource with multiplier ' + this.multiplier);
                    this.applyConsumption(false);

                    // Compute time-to-completion based on deficit
                    if (this.deficit == 0)
                    {
                        this.baseTime = 0;
                        this.log.trace('Resource is immediately available');
                    }
                    else
                    {
                        this.baseTime = this.deficit / cache.getCurrentProductionOfResource(this.costData.resourceName);
                        if (this.baseTime < 0) { this.baseTime = Infinity; }
                        this.log.trace('It will be ' + this.baseTime + ' ticks until quantity ' + this.deficit + ' is produced');
                    }
                    this.decisionTime = this.baseTime;

                    // TODO - Factor current production time into options (or figure out if there's even an intelligent way to do that)
                    // In the amount of time we wait to trade / craft the deficit of a resource, there may be some production happening in the background that actually changes the amount of that resource we need to trade / craft for
                    // However, if we adjust the amount accordingly, that changes the time required to trade / craft for the new amount, which changes the total amount produced in the background...
                    // The solution to this problem is likely creating an equation that represents the time for a given decision path and then solving the equation
                    // The benefits of doing this are likely marginal at best...
                    // Nah. This is probably gonna stay a TODO forever.

                    // Update the dependent decision trees
                    this.options.forEach((opt) => {
                        opt.update();
                        opt.rewindConsumption(true);
                    });

                    // Sort the options by max time
                    this.options.sort((a, b) => { return a.maxTime - b.maxTime; });

                    // Choose the best possible path
                    for (var i = 0; i < this.options.length; ++i)
                    {
                        if (this.options[i].capacityBlockers.length == 0)
                        {
                            this.decision     = this.options[i];
                            this.decisionTime = this.options[i].maxTime;
                            break;
                        }
                    }

                    // Make note of capacity blockers and limitations
                    this.options.forEach((opt) => {
                        this.capacityLimiters = this.capacityLimiters.concat(opt.capacityLimiters);
                        if (this.decisionTime == Infinity)
                        {
                            // If the current decision is going to take forever, assume that any blockers in the options are blockers for the resource
                            this.log.detail('Treating capacity limitations as blockers, given production time of ' + this.decisionTime);
                            this.capacityBlockers = this.capacityBlockers.concat(opt.capacityBlockers);
                        }
                        else
                        {
                            this.capacityLimiters = this.capacityLimiters.concat(opt.capacityLimiters);
                        }
                    });

                    if (this.decision != null)
                    {
                        this.decision.applyConsumption(true);
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

    extractBottlenecks: function(tree)
    {
        var unordered = [];
        for (var resource in tree.consumption)
        {
            unordered.push([resource, tree.consumption[resource]]);
        }
        return unordered.sort(function(a, b) { return a[1] - b[1]; });
    },

    areInCompetition: function(cache, treeA, treeB)
    {
        var combinedCostData = ajk.costDataFactory.buildCombinedCostData(treeA.optionData, treeB.optionData);
        var combinedTree = this.buildDecisionTree(cache, combinedCostData);
        combinedTree.update();
        return (combinedTree.maxTime > treeA.maxTime && combinedTree.maxTime > treeB.maxTime)
    },
};