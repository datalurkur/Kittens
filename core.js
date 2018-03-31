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
        tickThread: null,

        successes: -1, // Ensure the cache gets built on the first tick
        explorationSuccess: false,

        cache: ajk.cache,
        itemGroups: [],

        checkForObservationEvent: function()
        {
            var btn = ajk.base.getObserveButton();
            if (btn != null) { btn.click(); }
        },

        prepare: function()
        {
            // If we didn't build anything, no buttons need updating and the cache doesn't need rebuilding
            if (this.successes == 0)
            {
                this.log.debug('No successes, skipping cache and item group refresh');
                return;
            }

            this.log.debug('Refreshing cache and item groups');
            this.successes = 0;

            // Collect all the buttons
            var resources = ajk.base.getAllResources();
            this.itemGroups = [];

            var bonfireTab = ajk.base.bonfireTab();
            ajk.base.switchToTab(bonfireTab);
            this.itemGroups.push(bonfireTab.buttons);

            var scienceTab = ajk.base.scienceTab();
            if (scienceTab.visible)
            {
                ajk.base.switchToTab(scienceTab);
                this.itemGroups.push(scienceTab.buttons);
            }

            var workshopTab = ajk.base.workshopTab();
            if (workshopTab.visible)
            {
                ajk.base.switchToTab(workshopTab);
                this.itemGroups.push(workshopTab.buttons);
            }

            var religionTab = ajk.base.religionTab();
            if (religionTab.visible)
            {
                ajk.base.switchToTab(religionTab);
                this.itemGroups.push(religionTab.rUpgradeButtons);
                this.itemGroups.push(religionTab.zgUpgradeButtons);
            }

            var spaceTab = ajk.base.spaceTab();
            if (spaceTab.visible)
            {
                ajk.base.switchToTab(spaceTab);
                this.itemGroups.push(spaceTab.GCPanel.children);
                // TODO - Add the rest of the planets
            }
            ajk.base.switchToTab(null);

            // Rebuild the cache
            this.cache.rebuild(resources, this.itemGroups);
        },

/*
        analyze: function()
        {
            var timerData = ajk.timer.start('Analysis');

            ajk.analysis.reset();
            timerData.interval('Reset');

            ajk.analysis.preanalysis();
            timerData.interval('Pre-Analysis Pass');

            ajk.analysis.analyzeItems(ajk.customItems.get());
            timerData.interval('Custom Item Analysis');

            ajk.ui.switchToTab('Bonfire');
            ajk.analysis.analyzeItems(ajk.core.bonfireTab.buttons);
            timerData.interval('Bonfire Analysis');

            if (ajk.core.scienceTab.visible)
            {
                ajk.ui.switchToTab('Sciene');
                ajk.analysis.analyzeItems(ajk.core.scienceTab.buttons);
                timerData.interval('Science Analysis');
            }

            if (ajk.base.workshopTab.visible)
            {
                ajk.ui.switchToTab('Workshop');
                ajk.analysis.analyzeItems(ajk.base.workshopTab.buttons);
                timerData.interval('Workshop Analysis');
            }

            ajk.analysis.analyzeResults();
            timerData.interval('Analysis Resolution Pass');

            ajk.analysis.postAnalysisPass();
            timerData.end('Post-Analysis Pass');

            ajk.ui.switchToTab(null);
            timerData.end('Cleanup');
        },*/

        /*
        // TODO - Fix this
        operateOnCostData: function(costData)
        {
            this.log.indent();
            var allSucceeded = true;
            for (var j = costData.prices.length - 1; j >= 0; --j)
            {
                var price = costData.prices[j];
                this.log.detail('Operating on cost data of ' + price.name);
                if (price.hasOwnProperty('dependencies'))
                {
                    this.log.trace('Diving into dependencies');
                    allSucceeded &= this.operateOnCostData(costData.prices[j].dependencies);
                }
                if (price.method == 'Trade')
                {
                     if (ajk.trade.tradeWith(price.tradeRace, price.trades))
                     {
                        // TODO - Replace this with the resource cache
                        var requirementMet = (ajk.base.getResource(price.name).value >= price.amount);
                        if (!requirementMet)
                        {
                            this.log.debug('Trading failed to satisfy expected requirements');
                        }
                        allSucceeded &= requirementMet;
                     }
                     else
                     {
                        allSucceeded = false;
                     }
                }
                else if (price.method == 'Craft')
                {
                    allSucceeded &= ajk.base.craft(price.name, price.craftAmount);
                }
                else
                {
                    // TODO - Replace this with the resource cache
                    var resource = ajk.base.getResource(costData.prices[j].name);
                    var deficit = resource.value - costData.prices[j].val;
                    var sufficient = (deficit >= 0);
                    if (!sufficient)
                    {
                        this.log.detail('Waiting on ' + resource.name);
                    }
                    else
                    {
                        this.log.trace('Sufficient quantity exists (deficit: ' + deficit + ')');
                    }
                    allSucceeded &= sufficient;
                }
            }
            this.log.unindent();
            return allSucceeded;
        },
        */
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

            this.prepare();
            timerData.interval('Preparation');

            timerData.end('Done');
/*
            this.analyze();
            timerData.interval('Analysis');

            this.operateOnPriority();
            timerData.interval('Priority Operations');

            ajk.resources.convert();
            timerData.interval('Resource Conversion');

            ajk.ui.refreshTables();
            timerData.interval('UI');

            ajk.jobs.assignFreeKittens();
            timerData.end('Job Assignment');

            ajk.misc.checkForObservationEvent();
            */
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

    testData: null,
    test: function()
    {
        // Get a test item
        var testItem = ajk.base.bonfireTab().buttons[13];
        var costData = ajk.costDataFactory.buildCostData(this.internal.cache, testItem);
        var decision = ajk.decisionTreeFactory.buildDecisionTree(this.internal.cache, costData);
        decision.update();
        ajk.log.flush();
        this.testData = [costData, decision];
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
