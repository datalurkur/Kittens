'use strict';

/*
  Builds a sparse structure that contains various options for constructing something,
  but makes no decisions based on time or current resource availability.
  Also stores current craft ratios and trade amounts
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
                options:             [],
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

                // Accumulators
                consumption:        {},
                consumptionApplied: false,
                finiteWaitTimes:    {},
                infiniteWaitTimes:  {},

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
                    this.log.trace('Updating decisions for option ' + this.optionData.method);
                    this.log.indent();

                    if (this.parentResource == null)
                    {
                        this.actionCount       = 1;
                        this.consumption       = {};
                        this.finiteWaitTimes   = {};
                        this.infiniteWaitTimes = {};
                    }
                    else
                    {
                        this.actionCount       = Math.ceil(this.parentResource.deficit / this.optionData.ratio);
                        this.consumption       = this.parentResource.consumption;
                        this.finiteWaitTimes   = this.parentResource.finiteWaitTimes;
                        this.infiniteWaitTimes = this.parentResource.infiniteWaitTimes;
                    }

                    this.maxTime = 0;
                    this.dependencies.forEach((dep) => {
                        dep.update();
                        this.capacityLimiters = this.capacityLimiters.concat(dep.capacityLimiters);
                        this.capacityBlockers = this.capacityBlockers.concat(dep.capacityBlockers);
                        if (this.maxTime < dep.decisionTime)
                        {
                            this.maxTime    = dep.decisionTime;
                            this.bottleneck = dep.bottleneck;
                        }
                    });

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
                multiplier:          1,        // The full price is the base cost times this number
                consumed:            0,        // How much of the available resource pool was used to fulfill the cost
                deficit:             0,        // How much of the full price is left to be produced
                baseTime:            0,        // The number of ticks until this node's deficit is fulfilled by base production
                adjustedTime:        0,        // The number of ticks until this node is fulfilled, including existing wait times
                decision:            null,     // The selected option to optimize fulfillment of this node
                decisionTime:        Infinity, // The number of ticks until this node is fulfilled
                capacityLimiters:    [],       // A list of resources whose capacity constraints are limiting the effectiveness of this node
                capacityBlockers:    [],       // A list of resources whose capacity constraints are preventing the fulfillment of this node
                bottleneck:          null,     // The resource that is most in-demand for fulfillment of this node

                // Accumulators
                consumption:        {},
                consumptionApplied: false,
                finiteWaitTimes:    {},
                infiniteWaitTimes:  {},
                waitTimeApplied:    false,

                applyConsumption: function(recursive)
                {
                    if (this.consumptionApplied) { this.log.error('Applying consumption twice'); return; }
                    this.consumptionApplied = true;

                    var resourceData = cache.getResourceData(this.costData.resourceName);

                    // Compute properties dependent on accumulated resource consumption at this decision
                    var adjustedAmountAvailable = resourceData.available;
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

                    // Compute time-to-completion based on deficit
                    if (this.deficit == 0)
                    {
                        this.baseTime     = 0;
                        this.adjustedTime = 0;
                        this.log.trace('Resource is immediately available');
                    }
                    else if (this.deficit > resourceData.max) // Check for capacity blockers
                    {
                        // We use the deficit rather than the full amount, in case resource storage decreased (or we performed a reset with chronospheres)
                        this.log.trace('Capacity limited (max storage is ' + resourceData.max + ')');
                        this.capacityBlockers.push([this.costData.resourceName, this.costData.price]);
                        this.baseTime = Infinity;
                        this.adjustedTime = Infinity;
                    }
                    else
                    {
                        this.baseTime = this.deficit / resourceData.perTick;
                        if ((this.infiniteWaitTimes[this.costData.resourceName] || 0) > 0)
                        {
                            this.adjustedTime = Infinity;
                        }
                        else
                        {
                            var existingWait  = this.finiteWaitTimes[this.costData.resourceName] || 0;
                            this.adjustedTime = this.baseTime + existingWait;
                        }

                        if (this.baseTime < 0) { this.baseTime = Infinity; }
                        this.log.trace('It will be ' + this.baseTime + ' base ticks until quantity ' + this.deficit + ' is produced');
                        this.log.trace('Adjusted wait time is ' + this.adjustedTime);
                    }

                    if (recursive)
                    {
                        if (this.decision != null)
                        {
                            // We're acquiring this resource via other means
                            this.decision.applyConsumption(recursive);
                        }
                        else
                        {
                            // Add wait time for this resource's production
                            this.applyWaitTime();
                        }
                    }
                },

                rewindConsumption: function(recursive)
                {
                    if (!this.consumptionApplied) { this.log.error('Rewinding consumption twice'); return; }
                    this.consumptionApplied = false;

                    if (recursive)
                    {
                        if (this.decision != null)
                        {
                            this.decision.rewindConsumption(recursive);
                        }
                        else
                        {
                            this.rewindWaitTime();
                        }
                    }

                    this.consumption[this.costData.resourceName] -= this.consumed;
                },

                applyWaitTime: function()
                {
                    if (this.waitTimeApplied) { this.log.error('Double-applying wait time'); return; }
                    this.waitTimeApplied = true;

                    if (this.baseTime == Infinity)
                    {
                        this.log.trace('Applying infinite wait time');
                        ajk.util.ensureKeyAndModify(this.infiniteWaitTimes, this.costData.resourceName, 0, 1);
                    }
                    else if (this.baseTime > 0)
                    {
                        this.log.trace('Applying wait time of ' + this.baseTime);
                        ajk.util.ensureKeyAndModify(this.finiteWaitTimes, this.costData.resourceName, 0, this.baseTime);
                    }
                },

                rewindWaitTime: function()
                {
                    if (!this.waitTimeApplied) { this.log.error('Double-rewinding wait time'); return; }
                    this.waitTimeApplied = false;

                    if (this.baseTime == Infinity)
                    {
                        this.log.trace('Rewinding infinite wait time');
                        ajk.util.ensureKeyAndModify(this.infiniteWaitTimes, this.costData.resourceName, 0, -1);
                    }
                    else if (this.baseTime > 0)
                    {
                        this.log.trace('Rewinding wait time of ' + this.baseTime);
                        ajk.util.ensureKeyAndModify(this.finiteWaitTimes, this.costData.resourceName, 0, -this.baseTime);
                    }
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

                    // Compute properties dependent on the parent node
                    if (this.parentOption == null)
                    {
                        this.multiplier        = 1;
                        this.consumption       = {};
                        this.infiniteWaitTimes = {};
                        this.finiteWaitTimes   = {};
                    }
                    else
                    {
                        this.multiplier        = this.parentOption.actionCount;
                        this.consumption       = this.parentOption.consumption;
                        this.infiniteWaitTimes = this.parentOption.infiniteWaitTimes;
                        this.finiteWaitTimes   = this.parentOption.finiteWaitTimes;
                    }

                    // Accumulate resource consumption
                    this.applyConsumption(false);

                    // Compute time-to-completion based on deficit
                    this.decisionTime = this.adjustedTime;

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

                    // Apply resource consumption for the decision made (or apply wait time for this leaf)
                    // Plumb bottlneck while we're at it
                    if (this.decision != null)
                    {
                        this.decision.applyConsumption(true);
                        if (this.decision.bottleneck != null) { this.bottleneck = this.decision.bottleneck; }
                    }
                    else
                    {
                        this.applyWaitTime();
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
        var competition = (combinedTree.maxTime > treeA.maxTime && combinedTree.maxTime > treeB.maxTime)

        // DEBUG
        this.internal.log.debug('Competition check for ' + treeA.identifier() + ' and ' + treeB.identifier());
        this.internal.log.indent();
        this.internal.log.debug('Independent costs of ' + treeA.maxTime + ' and ' + treeB.maxTime);
        this.internal.log.debug('Combined cost of ' + combinedTree.maxTime);
        this.internal.log.debug('' + (competition) ? 'COMPETITION!' : 'no competition');
        // Demand check
        for (var r in treeA.demand)
        {
            if (treeB.demand.hasOwnProperty(r) && !competition)
            {
                this.internal.log.warn('Something is fishy in the competition checks (items not found to be in competition but both have a demand for ' + r + ')');
                break;
            }
        }
        this.internal.log.unindent();

        return competition;
    },
};