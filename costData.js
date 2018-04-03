'use strict';

/*
  Builds a sparse structure that contains various options for constructing something,
  but makes no decisions based on time or current resource availability.
  Also stores current craft ratios and trade amounts.
  Depends on cached trade and craft information.
*/
ajk.costDataFactory = {
    internal:
    {
        log: ajk.log.addChannel('costdata', false),

        buildOptionCostData: function(identifier, cache, method, basePrices, extraPrices, ratio, extraData)
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
                identifier:   identifier,
            };
        },

        buildResourceCostData: function(cache, resource, value)
        {
            this.log.detail('Building sparse data for ' + value + ' ' + resource);
            this.log.indent();

            var data = {
                resourceName:        resource,
                price:               value,
                options:             []
            };

            if (ajk.base.getResource(resource).craftable && resource != 'wood')
            {
                this.log.detail('Data includes crafting option');
                var cData = ajk.base.getCraft(resource);
                data.options.push(this.buildOptionCostData(
                    cData.name,
                    cache,
                    'craft',
                    cData.prices,
                    [],
                    ajk.base.getCraftRatio(),
                    cData
                ));
            }

            // Don't trade for catnip
            if (resource != 'catnip')
            {
                var tradeData = cache.getTradeDataForResource(resource);
                for (var i = 0; i < tradeData.length; ++i)
                {
                    this.log.detail('Adding trade option with ' + tradeData[i].race.name);
                    data.options.push(this.buildOptionCostData(
                        tradeData[i].race.name,
                        cache,
                        'trade',
                        tradeData[i].race.buys,
                        [['gold', 15], ['manpower', 50]],
                        tradeData[i].tradeAmount,
                        tradeData[i].race
                    ));
                }
            }

            this.log.unindent();
            return data;
        },
    },

    buildCostData: function(cache, item)
    {
        return this.internal.buildOptionCostData(item.model.metadata.name, cache, 'purchase', item.model.prices, [], 1, item);
    },

    buildCustomCostData: function(cache, method, identifier, productionCosts, data)
    {
        return this.internal.buildOptionCostData(identifier, cache, method, productionCosts, [], 1, data);
    },

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
    },
};

/*
  Given a cost data structure, builds a detailed set of decisions regarding which options should be followed
  in order to minimize the total time until completion.
*/
ajk.decisionTreeFactory = {
    internal:
    {
        log: ajk.log.addChannel('dtree', false),
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
                actionCount:        1,    // The number of times this node must be executed before it is fulfilled
                capacityLimiters:   [],   // A list of resources whose capacity constraints are limiting the effectiveness of this node
                capacityBlockers:   [],   // A list of resources whose capacity constraints are preventing the fulfillment of this node
                maxTime:            0,    // The number of ticks until the most expensive dependency is met
                bottleneck:         null, // The resource that is most in-demand for fulfillment of this node
                effFulfillmentRate: 0,    // The minimum effFulfillmentRate of all the dependencies

                // Accumulator
                consumption:        {},
                consumptionApplied: false,

                identifier: function()
                {
                    var syntaxAdjust = (this.optionData.method == 'trade') ? 'with ' : ' ';
                    return this.optionData.method + syntaxAdjust + this.actionCount + ' ' + this.optionData.identifier;
                },

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

                traverse: function(opCallback, resCallback, leavesFirst)
                {
                    if (!leavesFirst && opCallback != null)
                    {
                        opCallback(this);
                        this.log.indent();
                    }
                    for (var i = 0; i < this.dependencies.length; ++i) { this.dependencies[i].traverse(opCallback, resCallback, leavesFirst); }
                    if (leavesFirst && opCallback != null)
                    {
                        opCallback(this);
                    }
                    else if (opCallback != null)
                    {
                        this.log.unindent();
                    }
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
                            this.bottleneck = this.dependencies[i].bottleneck;
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
                baseFulfillmentRate: 0,        // What ratio of the base cost is produced per-tick purely by waiting
                multiplier:          1,        // The full price is the base cost times this number
                consumed:            0,        // How much of the available resource pool was used to fulfill the cost
                deficit:             0,        // How much of the full price is left to be produced
                baseTime:            0,        // The number of ticks until this node is fulfilled by waiting
                decision:            null,     // The selected option to optimize fulfillment of this node
                decisionTime:        Infinity, // The number of ticks until this node is fulfilled
                effFulfillmentRate:  0,        // What ratio of the base cost is produced per-tick including the decision
                capacityLimiters:    [],       // A list of resources whose capacity constraints are limiting the effectiveness of this node
                capacityBlockers:    [],       // A list of resources whose capacity constraints are preventing the fulfillment of this node
                bottleneck:          null,     // The resource that is most in-demand for fulfillment of this node

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
                    ajk.util.ensureKeyAndModify(this.consumption, this.costData.resourceName, 0, this.consumed);

                    if (recursive && this.decision != null) { this.decision.applyConsumption(recursive); }
                },

                rewindConsumption: function(recursive)
                {
                    if (!this.consumptionApplied) { this.log.error('Rewinding consumption twice'); return; }
                    this.consumptionApplied = false;

                    if (recursive && this.decision != null) { this.decision.rewindConsumption(recursive); }

                    this.consumption[this.costData.resourceName] -= this.consumed;
                },

                traverse: function(opCallback, resCallback, leavesFirst)
                {
                    if (this.decision == null && resCallback != null) { resCallback(this); }
                    else if (this.decision != null) { this.decision.traverse(opCallback, resCallback, leavesFirst); }
                },

                update: function()
                {
                    this.log.trace('Updating resource node: ' + this.costData.resourceName);
                    this.log.indent();

                    var rData = cache.getResourceData(this.costData.resourceName);
                    this.baseFulfillmentRate = rData.perTick / this.costData.price;

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

                    if (this.costData.price > rData.max)
                    {
                        this.log.trace('Capacity limited (max storage is ' + rData.max + ')');
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
                        this.baseTime = this.deficit / rData.perTick;
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
                        if (this.options[i].capacityBlockers.length == 0 && this.options[i].maxTime < this.decisionTime)
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

                    this.effFulfillmentRate = this.baseFulfillmentRate;
                    if (this.decision != null)
                    {
                        this.decision.applyConsumption(true);
                        if (this.decision.bottleneck != null) { this.bottleneck = this.decision.bottleneck; }
                        this.effFulfillmentRate += this.decision.effFulfillmentRate;
                    }
                    else if (this.deficit > 0)
                    {
                        this.bottleneck = this;
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

        updateDemand: function(tree)
        {
            tree.demand = {};
            tree.traverse(null, (resDecision) => {
                if (resDecision.deficit > 0)
                {
                    var resName = resDecision.costData.resourceName;
                    ajk.util.ensureKeyAndModify(tree.demand, resName, 0, resDecision.deficit);
                }
            });
        },
    },

    buildDecisionTree: function(cache, costData)
    {
        var dTree = this.internal.buildOptionNode(cache, costData, null);
        dTree.update();
        this.internal.updateDemand(dTree);
        return dTree;
    },

    updateDecisionTree: function(dTree)
    {
        dTree.rewindConsumption(true);
        dTree.update();
        this.internal.updateDemand(dTree);
    },

    areInCompetition: function(cache, treeA, treeB)
    {
        var combinedCostData = ajk.costDataFactory.buildCombinedCostData(treeA.optionData, treeB.optionData);
        var combinedTree = this.buildDecisionTree(cache, combinedCostData);
        return (combinedTree.maxTime > treeA.maxTime && combinedTree.maxTime > treeB.maxTime)
    },
};