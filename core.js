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


        // Operating variables
        tickThread:   null,

        year:        -1,
        season:      -1,
        successes:    0,
        cache:        ajk.cache,
        itemData:     {},
        analysisData: null,

        priorityResourceDemand: {},

        events: [],

        checkForObservationEvent: function()
        {
            var btn = ajk.base.getObserveButton();
            if (btn != null) { btn.click(); }
        },

        addEvent: function(type, data)
        {
            this.events.push({
                type: type,
                data: data
            });
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
                if (mData.hasOwnProperty('noStackable') && mData.noStackable && mData.val > 0) { continue; }
                this.itemData[mData.name] = {
                    item:         pItems[i],
                    costData:     null,
                    decisionTree: null,
                };
            }
        },

        rebuildExplorationData: function()
        {
            var dipTab = ajk.base.diplomacyTab();
            if (!dipTab.visible) { return; }

            // Add exploration item
            // TODO - Exploration data format is *highly* coupled with what the cache returns
            //        It feels like a super special case, which is why I'm not jumping up to fix this
            //        But MAN is it oogly
            var explorationData = this.cache.getExplorationData();
            if (explorationData == null)
            {
                // No exploration options available
                this.log.detail('No race discovery actions available');
            }
            else
            {
                var productionCosts    = [];
                var nonProductionCosts = false;

                var costType = explorationData[0];
                var costData = explorationData[1];
                if (costType == 'purchase')
                {
                    nonProductionCosts = true;
                    // TODO - Pipe purchase priorites to analysis
                }
                else if (costType == 'storage')
                {
                    nonProductionCosts = true;
                    // TODO - Pipe purchase priorites to analysis
                }
                else if (costType == 'accumulate')
                {
                    productionCosts.push({
                        name: costData[0],
                        val:  costData[1],
                    });
                }

                if (!nonProductionCosts)
                {
                    productionCosts.push({
                        name: 'manpower',
                        val:  1000,
                    });

                    // God, this whole exploration thing is just such a mess
                    ajk.base.switchToTab(dipTab);
                    var exploreItem = dipTab.exploreBtn;
                    ajk.base.switchToTab(null);

                    var costData = ajk.costDataFactory.buildCustomCostData(this.cache, 'explore', 'trade route', productionCosts, exploreItem);

                    this.itemData['tradeRouteDiscovery'] = {
                        item:         exploreItem,
                        costData:     costData,
                        decisionTree: null,
                    };
                }
            }
        },

        rebuildCache: function()
        {
            this.cache.rebuild(this.itemData);
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

            // Custom cost data section
            this.rebuildExplorationData();
            timerData.interval('Rebuild Exploration Data');
            // No more custom cost data

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

        inDemand: function(resourceName) { return this.priorityResourceDemand.hasOwnProperty(resourceName) && this.priorityResourceDemand[resourceName] > 0; },

        craftUpTo: function(craftName, amount)
        {
            var craftAllCount = ajk.base.getCraftAllAmount(craftName);
            var actualCraftCount = Math.min(craftAllCount, amount);
            if (actualCraftCount == 0) { return true; }
            if (ajk.base.craft(craftName, actualCraftCount))
            {
                var resultAmount = actualCraftCount * ajk.base.getCraftRatio();
                this.log.detail('Crafted ' + resultAmount + ' ' + craftName);
                this.addEvent('craft', {
                    name:   craftName,
                    amount: resultAmount
                });
                return true;
            }
            else
            {
                this.log.error('Failed to craft ' + actualCraftCount + ' ' + craftName);
                return false;
            }
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
                    var method = opDecision.optionData.method;
                    if (method == 'craft')
                    {
                        this.craftUpTo(opDecision.optionData.extraData.name, opDecision.actionCount);
                    }
                    else if (method == 'trade')
                    {
                        var resources = ajk.base.trade(opDecision.optionData.extraData, opDecision.actionCount);
                        this.addEvent('trade', {
                            race:   opDecision.optionData.extraData.name,
                            result: resources
                        });
                    }
                    else if (method == 'purchase' || method == 'explore')
                    {
                        if (ajk.base.readyForPurchase(opDecision.optionData.extraData))
                        {
                            this.log.detail('Ready to ' + method);
                            if (!ajk.base.purchaseItem(opDecision.optionData.extraData))
                            {
                                this.log.error('Failed to ' + method + ' ' + opDecision.optionData.identifier);
                            }
                            else
                            {
                                this.log.info(method + 'd ' + opDecision.optionData.identifier);
                                this.addEvent(method, {item: opDecision.optionData.identifier});
                                this.successes += 1;
                            }
                        }
                        else
                        {
                            this.log.detail('Waiting on resources to ' + method);
                        }
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
            if (this.successes > 0) { this.cache.refresh(); }

            for (var rName in this.resourceConversions)
            {
                var rData = this.cache.getResourceData(rName);
                var craftName = this.resourceConversions[rName];
                if (!rData.unlocked || !this.cache.isCraftUnlocked(craftName)) { continue; }

                if (rData.available / rData.max >= ajk.config.conversionMaxRatio)
                {
                    var amountToConvert =  rData.max * ajk.config.conversionRatio;
                    var craftPrice = this.cache.getResourceCostForCraft(rName, craftName);
                    var numCrafts = Math.ceil(amountToConvert / craftPrice);
                    this.log.debug('Converting ' + amountToConvert + ' ' + rName + 's into ' + craftName);
                    this.craftUpTo(craftName, numCrafts);
                }
            }

            var catPower = this.cache.getResourceData('manpower');
            if (catPower.unlocked && catPower.available / catPower.max >= ajk.config.conversionMaxRatio && !this.inDemand('manpower'))
            {
                var numHunts = Math.ceil(catPower.max * ajk.config.catpowerConversionRatio / 100);
                this.log.debug('Sending hunters ' + numHunts + ' times');
                ajk.base.hunt(numHunts);
            }

            var faith = this.cache.getResourceData('faith');
            if (faith.unlocked && faith.available == faith.max && !this.inDemand('faith'))
            {
                this.log.debug('Praising the sun');
                ajk.base.praise();
            }

            // We don't particularly care if these fail or not, for now...
            this.log.debug('Crafting all parchment');
            ajk.base.craftAll('parchment');
            if (!this.inDemand('parchment') && !this.inDemand('culture'))
            {
                this.log.debug('Crafting all manuscripts');
                ajk.base.craftAll('manuscript');
            }
            if (!this.inDemand('manuscript') && !this.inDemand('science'))
            {
                this.log.debug('Crafting all compendiums');
                ajk.base.craftAll('compedium');
            }
        },

        refreshUI: function()
        {
            ajk.ui.refreshPriorities(this.itemData, this.analysisData);
            ajk.ui.refresh();
        },

        cacheNeedsUpdate: function()
        {
            return (this.successes > 0 ||
                    ajk.base.getYear() != this.year ||
                    ajk.base.getSeason() != this.season);
        },

        unsafeTick: function()
        {
            var timerData = ajk.timer.start('Tick Execution');
            this.events = [];

            var doRebuild = this.cacheNeedsUpdate();
            this.year = ajk.base.getYear();
            this.season = ajk.base.getSeason();
            this.succeses = 0;

            this.checkForObservationEvent();
            timerData.interval('Event Observation');

            // If we didn't build anything previously, we don't need to recompute priorities and such
            if (doRebuild)
            {
                this.rebuildAndPrioritize();
                timerData.interval('Rebuild and Prioritize');
            }
            else
            {
                this.cache.refresh();
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

            ajk.statistics.update(this.cache);
            timerData.interval('Statistics');

            this.refreshUI();
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
            this.log.flush(this.successes > 0 && ajk.config.detailedLogsOnSuccess);
        },
    },

    simulateTick: function()
    {
        this.internal.log.info('Simulating tick');
        var pSimulate = ajk.base.simulate;
        ajk.base.simulate = true;
        this.internal.tick();
        ajk.base.simulate = pSimulate;
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
            this.internal.log.info('Ticking every ' + ajk.config.tickFrequency + ' seconds');
            this.internal.tickThread = setInterval(function() { ajk.core.internal.tick(); }, ajk.config.tickFrequency * 1000);
        }

        // Yeah yeah, singletons are gross, get over it
        ajk.config.ticking = doTick;
        ajk.ui.refresh();
    }
};
