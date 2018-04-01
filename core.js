'use strict';

ajk.core = {
    internal:
    {
        log: ajk.log.addChannel('core', true),

        // Definitions
        resourceConversions:
        {
            'catnip':      'wood',
            'wood':        'beam',
            'minerals':    'slab',
            'coal':        'steel',
            'iron':        'plate',
            'titanium':    'alloy',
            'oil':         'kerosene',
            'uranium':     'thorium',
            'unobtainium': 'eludium'
        },

        // Configuration
        tickFrequency: 10,

        catpowerConversionRatio: 0.75,
        conversionRatio: 0.1,
        conversionMaxRatio: 0.97,

        // Operating variables
        tickThread:   null,

        successes:    -1, // Ensure the cache gets built on the first tick
        cache:        ajk.cache,
        itemData:     {},
        analysisData: null,

        priorityResourceDemand: {},

        checkForObservationEvent: function()
        {
            var btn = ajk.base.getObserveButton();
            if (btn != null) { btn.click(); }
        },

        rebuildItemList: function()
        {
            this.itemData = {};

            var pItems = [];

            var bonfireTab = ajk.base.bonfireTab();
            ajk.base.switchToTab(bonfireTab);
            pItems = pItems.concat(bonfireTab.buttons);

            var scienceTab = ajk.base.scienceTab();
            if (scienceTab.visible)
            {
                ajk.base.switchToTab(scienceTab);
                pItems = pItems.concat(scienceTab.buttons);
            }

            var workshopTab = ajk.base.workshopTab();
            if (workshopTab.visible)
            {
                ajk.base.switchToTab(workshopTab);
                pItems = pItems.concat(workshopTab.buttons);
            }

            var religionTab = ajk.base.religionTab();
            if (religionTab.visible)
            {
                ajk.base.switchToTab(religionTab);
                pItems = pItems.concat(religionTab.rUpgradeButtons);
                pItems = pItems.concat(religionTab.zgUpgradeButtons);
            }

            var spaceTab = ajk.base.spaceTab();
            if (spaceTab.visible)
            {
                ajk.base.switchToTab(spaceTab);
                pItems = pItems.concat(spaceTab.GCPanel.children);
                // TODO - Add the rest of the planets
            }
            ajk.base.switchToTab(null);

            for (var i = 0; i < pItems.length; ++i)
            {
                var mData = pItems[i].model.metadata;
                if (typeof mData === 'undefined')        { continue; }
                if (!mData.unlocked || (typeof mData.researched !== 'undefined' && mData.researched)) { continue; }
                this.itemData[mData.name] = {
                    item:         pItems[i],
                    costData:     null,
                    decisionTree: null,
                };
            }
        },

        rebuildCache: function()
        {
            var resources = ajk.base.getAllResources();
            this.cache.rebuild(resources, this.itemData);
        },

        rebuildCostData: function()
        {
            this.data = {};
            for (var itemName in this.itemData)
            {
                this.log.detail('Rebuilding cost data for ' + itemName);
                this.log.indent();
                var costData = ajk.costDataFactory.buildCostData(this.cache, this.itemData[itemName].item);
                this.itemData[itemName].costData = costData;
                this.log.unindent();
            }
        },

        rebuildAndPrioritize: function()
        {
            var timerData = ajk.timer.start('Rebuilding / Analysis');
            this.rebuildItemList();
            timerData.interval('Rebuild Item List');

            this.rebuildCache();
            timerData.interval('Rebuild Effect / Resource / Trade Cache');

            this.rebuildCostData();
            timerData.interval('Rebuild Cost Data');

            this.analysisData = ajk.analysisModule.prepare(this.itemData);
            timerData.interval('Analysis Preparation');

            this.analysisData.eligible.forEach((itemName) => {
                this.log.detail('Rebuilding decision tree for ' + itemName);
                this.log.indent();
                var decisionTree = ajk.decisionTreeFactory.buildDecisionTree(this.cache, this.itemData[itemName].costData);
                this.itemData[itemName].decisionTree = decisionTree;
                this.log.unindent();
            });
            timerData.interval('Decision Tree Population');

            ajk.analysisModule.preprocess(this.analysisData, this.cache, this.itemData);
            timerData.interval('Analysis preprocessing');

            ajk.analysisModule.prioritize(this.analysisData);
            timerData.interval('Prioritization step 1');

            ajk.analysisModule.postprocess(this.analysisData, this.cache, this.itemData);
            timerData.interval('Analysis postprocessing');

            ajk.analysisModule.prioritize(this.analysisData);
            timerData.end('Prioritization step 2');
        },

        pursuePriority: function()
        {
            this.priorityResourceDemand = {};

            this.analysisData.priorityOrder.forEach((itemName) => {
                this.log.debug('Acting on priority ' + itemName);
                this.log.indent();

                var tree = this.itemData[itemName].decisionTree;
                tree.traverse((opDecision) => {
                    this.log.debug(opDecision.identifier());
                    if (opDecision.optionData.method == 'craft')
                    {
                        ajk.base.craft(opDecision.optionData.extraData.name, opDecision.actionCount);
                    }
                    else if (opDecision.optionData.method == 'trade')
                    {
                        ajk.base.trade(opDecision.optionData.extraData, opDecision.actionCount);
                    }
                    else if (opDecision.optionData.method == 'purchase')
                    {
                        if (opDecision.maxTime == 0)
                        {
                            this.log.detail('Ready for purchase');
                            if (!ajk.base.purchaseItem(opDecision.optionData.extraData))
                            {
                                this.log.warn('Failed to purchase');
                            }
                            else
                            {
                                this.log.info('Purchased ' + opDecision.optionData.identifier);
                                this.successes += 1;
                            }
                        }
                        else
                        {
                            this.log.detail('Waiting on resources for purchase');
                        }
                    }
                    else if (opDecision.optionData.method == 'explore')
                    {
                        // TODO
                    }
                }, null, true);

                for (var resource in tree.demand)
                {
                    ajk.util.ensureKeyAndModify(this.priorityResourceDemand, resource, 0, tree.demand[resource]);
                }

                this.log.unindent();
            });
        },

        convertResources: function()
        {
            this.log.debug('Converting resources');
        },

        /*
        operateOnPriority: function()
        {
            if (ajk.analysis.shouldExplore)
            {
                ajk.ui.switchToTab('Trade');
                var explore = ajk.base.getExploreItem();
                if (explore.controller.hasResources(explore.model))
                {
                    this.log.debug('Attempting to discover new race');
                    if (!ajk.simulate)
                    {
                        explore.controller.buyItem(explore.model, {}, function(result) {
                            var ajkI = ajk.core.internal;
                            if (result)
                            {
                                ajkI.log.info('Unlocked new race');
                                // This is sort of a hack, but fuck if I know why this gets called twice on success with both true and false
                                ajkI.explorationSuccess = true;
                            }
                            else if (!ajkI.explorationSuccess)
                            {
                                ajkI.log.error('Failed to unlock new race');
                                ajkI.explorationSuccess = false;
                            }
                        });
                    }
                }
                else
                {
                    this.log.debug('Waiting on catpower for exploration');
                }
                ajk.ui.switchToTab(null);
            }

            for (var i = 0; i < ajk.analysis.filteredPriorityList.length; ++i)
            {
                var priority = ajk.analysis.filteredPriorityList[i];
                this.log.debug('Attempting to act on ' + priority + ' (weight ' + ajk.analysis.data[priority].weight + ')');

                // TODO - Fix this
                var costData = ajk.analysis.data[priority].costData;
                if (this.operateOnCostData(costData))
                {
                    this.log.detail('Cost operations succeeded, acting');
                    var itemData = ajk.analysis.data[priority];

                    // Make sure the model is up-to-date (that way if we purchased something this tick already, we don't try to purchase something else we no longer have resources for)
                    itemData.item.update();
                    if (itemData.item.controller.hasResources(itemData.item.model))
                    {
                        this.successes += 1;
                        if (!ajk.simulate)
                        {
                            itemData.item.controller.buyItem(itemData.item.model, {}, function(result) {
                                if (result)
                                {
                                    ajk.core.internal.log.info('Purchased ' + priority);
                                    ajk.cache.dirty();
                                }
                                else
                                {
                                    ajk.core.internal.log.error('Failed to purchase ' + priority);
                                }
                            });
                        }
                    }
                    else if (!ajk.simulate)
                    {
                        this.log.error('Item has insufficient resources, even after operating on costs successfully');
                    }
                }
            }
        },*/

        /*
        convertResources: function()
        {
            for (var rName in this.resourceConversions)
            {
                var resource = ajk.base.getResource(rName);
                var conversion = ajk.base.getResource(this.resourceConversions[rName]);
                if (!resource.unlocked || !conversion.unlocked) { continue; }
                if (resource.value / resource.maxValue >= this.conversionMaxRatio)
                {
                    var amountToConvert = resource.maxValue * this.conversionRatio;
                    var craft = ajk.base.getCraft(conversion.name);
                    var craftCost = Infinity;
                    for (var i = 0; i < craft.prices.length; ++i)
                    {
                        if (craft.prices[i].name == resource.name)
                        {
                            craftCost = craft.prices[i].val;
                            break;
                        }
                    }
                    var numCrafts = Math.ceil(amountToConvert / craftCost);
                    this.log.debug('Converting ' + amountToConvert + ' ' + rName + 's into ' + craft.name);
                    if (!ajk.base.craft(craft.name, numCrafts))
                    {
                        this.log.error('Conversion failed');
                    }
                }
            }

            var catPower = ajk.base.getResource('manpower');
            // TODO - Fix this
            if (catPower.unlocked && catPower.value / catPower.maxValue >= this.conversionMaxRatio && !this.inDemand('manpower'))
            {
                var numHunts = Math.ceil(catPower.maxValue * this.catpowerConversionRatio / 100);
                this.log.debug('Sending hunters ' + numHunts + ' times');
                ajk.base.hunt(numHunts);
            }

            var faith = ajk.base.getResource('faith');
            if (faith.unlocked && faith.value == faith.maxValue)
            {
                this.log.debug('Praising the sun');
                ajk.base.praise();
            }

            if (!ajk.simulate)
            {
                ajk.base.craft('parchment');
            }
            if (!ajk.simulate && !this.inDemand('parchment') && !this.inDemand('culture'))
            {
                ajk.base.craft('manuscript');
            }
            if (!ajk.simulate && this.inDemand('manuscript') && !this.inDemand('science'))
            {
                ajk.base.craft('compedium');
            }
        },
        */

        unsafeTick: function()
        {
            var timerData = ajk.timer.start('Tick Execution');

            this.checkForObservationEvent();
            timerData.interval('Event Observation');

            // If we didn't build anything previously, we don't need to recompute priorities and such
            if (this.successes != 0)
            {
                this.rebuildAndPrioritize();
                timerData.interval('Rebuild and Prioritize');
            }
            else
            {
                this.analysisData.eligible.forEach((itemName) => {
                    this.log.debug('Rebuilding decision tree for ' + itemName);
                    this.log.indent();
                    ajk.decisionTreeFactory.updateDecisionTree(this.itemData[itemName].decisionTree);
                    this.log.unindent();
                });
                timerData.interval('Update Decision Trees');
            }
            this.successes = 0;

            ajk.analysisModule.computeBottlenecks(this.analysisData, this.cache, this.itemData);
            timerData.interval('Bottleneck Analysis');

            this.pursuePriority();
            timerData.interval('Pursue Priority');

            this.convertResources();
            timerData.interval('Resource Conversion');

            //ajk.jobs.assignFreeKittens();
            timerData.interval('Job Assignment');

            //this.refreshUI();
            timerData.end('UI Refresh');
        },

        tick: function()
        {
            var timestamp = new Date();
            this.log.debug('Starting tick at ' + timestamp.toUTCString());
            try
            {
                this.unsafeTick();
            }
            catch (e)
            {
                this.log.error('Error encountered during tick\n' + e.stack);
            }
            // TODO - Move this option into a config
            this.log.flush(this.successes > 0 && ajk.log.detailedLogsOnSuccess);
        },
    },

    simulateTick: function()
    {
        this.internal.log.info('Simulating tick');
        var pSimulate = ajk.simulate;
        ajk.simulate = true;
        this.internal.tick();
        ajk.simulate = pSimulate;
    },

    shouldTick: function(doTick)
    {
        if (this.internal.tickThread != null)
        {
            if (doTick)
            {
                this.internal.log.info('Restarting tick thread');
            }
            else
            {
                this.internal.log.info('Stopping tick thread');
            }
            clearInterval(this.internal.tickThread);
            this.internal.tickThread = null;
        }

        if (doTick)
        {
            this.internal.log.info('Ticking every ' + this.internal.tickFrequency + ' seconds');
            this.simulateTick();
            this.internal.tickThread = setInterval(function() { ajk.core.internal.tick(); }, this.internal.tickFrequency * 1000);
        }

        // TODO - Move this into a UI call
        //$('#tickToggle')[0].checked = doTick;
    }
};
