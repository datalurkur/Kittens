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

        // Operating variables
        tickThread:    null,
        postResetDone: false,
        resetPending:  false,

        year:         -1,
        season:       -1,
        successes:     0,
        cache:         ajk.cache,
        itemData:      {},
        analysisData:  null,

        priorityResourceDemand: {},
        resourceCapacityDemand: {},
        purchaseDemand:         {},
        energyThrottled:        false,

        events: [],
        crafts: [],
        trades: [],

        consumption: {},
        production:  {},
        utilization: {},

        checkForObservationEvent: function()
        {
            var btn = ajk.base.getObserveButton();
            if (btn != null) { btn.click(); }
        },

        addEvent: function(item, identifier, type, significance)
        {
            this.events.push({
                name:         identifier,
                type:         type,
                significance: significance
            });
        },

        addTradeEvent: function(race, cost, result)
        {
            this.crafts.push({
                name:   race.name,
                cost:   cost,
                result: result,
            });
        },

        addCraftEvent: function(craftName, cost, result, purposeful)
        {
            this.trades.push({
                name:   craftName,
                cost:   cost,
                result: result,
            });
        },

        collectItemData: function(items, type, significance)
        {
            items.forEach((item) => {
                if (!item.model.visible) { return; }
                if (!item.model.hasOwnProperty('metadata')) { return; }
                var mData = item.model.metadata;
                if (mData.hasOwnProperty('unlocked') && !mData.unlocked) { return; }
                if (mData.hasOwnProperty('researched') && mData.researched) { return; }
                if (mData.hasOwnProperty('noStackable') && mData.noStackable && mData.val > 0) { return; }
                this.itemData[mData.name] = {
                    item:         item,
                    type:         type,
                    significance: significance,
                    costData:     null,
                    decisionTree: null,
                };
            });
        },

        buildResetItemList: function()
        {
            // TODO
        },

        rebuildItemList: function()
        {
            var bonfireTab = ajk.base.bonfireTab();
            ajk.base.switchToTab(bonfireTab);
            this.collectItemData(bonfireTab.buttons, 'structure', 1);

            var scienceTab = ajk.base.scienceTab();
            if (scienceTab.visible)
            {
                ajk.base.switchToTab(scienceTab);
                this.collectItemData(scienceTab.buttons, 'science', 5);
            }

            var workshopTab = ajk.base.workshopTab();
            if (workshopTab.visible)
            {
                ajk.base.switchToTab(workshopTab);
                this.collectItemData(workshopTab.buttons, 'workshop', 4);
            }

            var religionTab = ajk.base.religionTab();
            if (religionTab.visible)
            {
                ajk.base.switchToTab(religionTab);
                this.collectItemData(religionTab.rUpgradeButtons, 'religion', 3);
                this.collectItemData(religionTab.zgUpgradeButtons, 'unicorns', 3);
            }

            var spaceTab = ajk.base.spaceTab();
            if (spaceTab.visible)
            {
                ajk.base.switchToTab(spaceTab);
                this.collectItemData(spaceTab.GCPanel.children, 'missions', 5);
                spaceTab.planetPanels.forEach((pp) => {
                    this.collectItemData(pp.children, 'space', 2);
                });
            }
            ajk.base.switchToTab(null);
        },

        rebuildTranscendenceData: function()
        {
            if (!ajk.base.getReligionUpgrade('transcendence').on) { return; }

            var currentTLevel = ajk.base.getTLevel();
            var requiredBonus = ajk.base.getTRatio(currentTLevel + 1) - ajk.base.getTRatio(currentTLevel);

            var relTab = ajk.base.religionTab();
            ajk.base.switchToTab(relTab);
            var transcendItem = relTab.transcendBtn;
            ajk.base.switchToTab(null);

            var apocCost = [{
                name: 'apocrypha',
                val:  requiredBonus
            }];
            var costData = ajk.costDataFactory.buildCustomCostData(this.cache, 'transcend', 'mortal limits', apocCost, transcendItem);

            this.itemData['transcend'] = {
                item:         transcendItem,
                type:         'meta',
                significance: 3,
                costData:     costData,
                decisionTree: null
            };
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
                    ajk.util.ensureKey(this.purchaseDemand, costData, []).push('tradeRouteDiscovery');
                }
                else if (costType == 'storage')
                {
                    nonProductionCosts = true;
                    ajk.util.ensureKey(this.resourceCapacityDemand, costData[0], []).push(['tradeRouteDiscovery', costData[1]]);
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
                        type:         'meta',
                        significance: 5,
                        costData:     costData,
                        decisionTree: null,
                    };
                }
                else
                {
                    this.itemData['tradeRouteDiscovery'] = {
                        item:         null,
                        type:         'meta',
                        significance: 5,
                        costData:     ajk.costDataFactory.buildBlockingCostData(),
                        decisionTree: null
                    };
                }
            }
        },

        buildCostData: function()
        {
            for (var itemName in this.itemData)
            {
                var costData = ajk.costDataFactory.buildCostData(this.cache, this.itemData[itemName].item);
                this.itemData[itemName].costData = costData;
            }
        },

        prioritize: function()
        {
            this.analysisData = ajk.analysisModule.prepare(this.itemData, this.resourceCapacityDemand, this.purchaseDemand, this.energyThrottled);

            this.analysisData.eligible.forEach((itemName) => {
                var decisionTree = ajk.decisionTreeFactory.buildDecisionTree(this.cache, this.itemData[itemName].costData);
                this.itemData[itemName].decisionTree = decisionTree;
            });

            ajk.analysisModule.preprocess(this.analysisData, this.cache, this.itemData);
            ajk.analysisModule.prioritize(this.analysisData);
            ajk.analysisModule.postprocess(this.analysisData, this.cache, this.itemData);
            ajk.analysisModule.finalize(this.analysisData);
        },

        inDemand: function(resourceName) { return this.priorityResourceDemand.hasOwnProperty(resourceName) && this.priorityResourceDemand[resourceName] > 0; },

        craftUpTo: function(craftName, amount, purposeful)
        {
            var craftAllCount = ajk.base.getCraftAllAmount(craftName);
            var actualCraftCount = Math.min(craftAllCount, amount);
            if (actualCraftCount == 0) { return true; }

            var cData = ajk.base.getCraft(craftName);

            var consumesDemandedResource = false;
            cData.prices.forEach((price) => {
                if (this.inDemand(price.name))
                {
                    consumesDemandedResource = true;
                }
            });
            if (consumesDemandedResource) { return true; }

            if (ajk.base.craft(craftName, actualCraftCount))
            {
                var costAmount = cData.prices.map((k) => {
                    return {
                        name: k.name,
                        val:  k.val * actualCraftCount
                    };
                });
                var resultAmount = actualCraftCount * ajk.base.getCraftRatio();
                this.log.detail('Crafted ' + resultAmount + ' ' + craftName);
                this.addCraftEvent(craftName, costAmount, resultAmount, purposeful);
                return true;
            }
            else
            {
                this.log.error('Failed to craft ' + actualCraftCount + ' ' + craftName);
                return false;
            }
        },

        tradeUpTo: function(race, trades)
        {
            var tradeAllCount = ajk.base.getTradeAllAmount(race.name);
            var actualTradeCount = Math.min(tradeAllCount, trades);
            if (actualTradeCount == 0) { return; }

            if (this.inDemand('gold')) { return; }

            var consumesDemandedResource = false;
            race.buys.forEach((price) => {
                if (this.inDemand(price.name))
                {
                    consumesDemandedResource = true;
                }
            });
            if (consumesDemandedResource) { return; }

            var result = ajk.base.trade(race, actualTradeCount);
            if (Object.keys(result).length > 0)
            {
                this.log.detail('Traded ' + actualTradeCount + ' times with ' + race.name);
                var costs = race.buys.map((k) => {
                    return {
                        name: k.name,
                        val:  k.val * actualTradeCount
                    };
                });
                costs.push({
                    name: 'catpower',
                    val:  50 * actualTradeCount,
                });
                costs.push({
                    name: 'gold',
                    val:  15 * actualTradeCount,
                });
                this.addTradeEvent(race, costs, result);
            }
        },

        sacrificeUpTo: function(button, target, identifier)
        {
            var availableActions = button.model.prices.reduce((allowed, price) => {
                var available = Math.floor(ajk.base.getResource(price.name).value / price.val);
                return Math.min(allowed, available);
            }, Infinity);
            var actualCount = Math.min(target, availableActions);
            if (actualCount == 0) { return; }
            if (!button.controller.sacrifice(button.model, actualCount))
            {
                // FIXME - Figure out why this happens
                this.log.warn('Failed to sacrifice ' + identifier + ' ' + actualCount + ' times');
            }
            else
            {
                this.log.debug('Sacrificed ' + identifier + ' ' + actualCount + ' times');
            }
        },

        purchaseUpTo: function(button, target, method, identifier)
        {
            var current = 0;
            for (current = 0; current < target; ++current)
            {
                button.update();
                if(!button.controller.hasResources(button.model)) { break; }
                var success = false;
                button.controller.buyItem(button.model, {}, (result) => {
                    if (result) { success = true; }
                });
                if (!success)
                {
                    this.log.warn('Failed to ' + method + ' ' + identifier);
                    break;
                }
            }
            if (current == 0) { return; }
            this.log.debug(method + 'd ' + identifier + ' ' + current + ' / ' + target + ' times');
        },

        applyAmbientProductionConsumption: function()
        {
            this.cache.getAllResources().forEach((r) => {
                var res = this.cache.getResourceData(r);
                if (res.perTick > 0)
                {
                    this.log.detail('Ambient production of ' + r + ' is ' + res.perTick);
                    this.production[r] = res.perTick;
                }
                else if (res.perTick < 0)
                {
                    this.log.detail('Ambient consumption of ' + r + ' is ' + res.perTick);
                    this.consumption[r] = -res.perTick;
                }
            });
        },

        applyProjectedConsumption: function(decision, weight)
        {
            for (var resource in decision.demand)
            {
                if (decision.demand[resource] == 0) { continue; }
                var projectedPerTick = decision.demand[resource] / decision.maxTime;
                this.log.detail('Purchase of ' + decision.optionData.identifier + ' consumes a projected ' + projectedPerTick + ' ' + resource + ' (weighted ' + weight + ')');
                ajk.util.ensureKeyAndModify(this.consumption, resource, 0, projectedPerTick * weight);
            }
        },

        computeResourceUtilization: function()
        {
            // If we only have production for a resource, we're not interested in its utilization (it's 0)
            Object.keys(this.consumption).forEach((r) => {
                var c = this.consumption[r];
                var p = this.production[r] || 0;
                var u = Math.min(1, c / p);
                if (p == 0 && c == 0) { u = 0; }
                this.log.detail('Based on production of ' + p + ' and consumption of ' + c + ' for ' + r + ', it has ' + Math.ceil(u * 100) + '% utilization');
                this.utilization[r] = u;
            });
        },

        pursuePriority: function()
        {
            this.priorityResourceDemand = {};
            var itemsPurchased = 0;

            var consumptionWeight = 1;
            this.analysisData.priorityOrder.forEach((itemName) => {
                this.log.debug('Acting on priority ' + itemName);
                this.log.indent();

                var iData = this.itemData[itemName];
                var tree = iData.decisionTree;
                tree.traverse((opDecision) => {
                    this.log.debug(opDecision.identifier());
                    var method = opDecision.optionData.method;
                    if (method == 'craft')
                    {
                        this.craftUpTo(opDecision.optionData.extraData.name, opDecision.actionCount, true);
                    }
                    else if (method == 'trade')
                    {
                        var rData = this.cache.getResourceData(opDecision.parentResource.costData.resourceName);
                        var trades = opDecision.actionCount;
                        if (rData.max != Infinity)
                        {
                            var availableCapacity = rData.max - rData.available;
                            var tradesUntilFull = Math.ceil(availableCapacity / opDecision.optionData.ratio);
                            trades = Math.min(trades, tradesUntilFull);
                        }
                        this.tradeUpTo(opDecision.optionData.extraData, trades);
                    }
                    else if (method == 'sacrifice')
                    {
                        this.sacrificeUpTo(opDecision.optionData.extraData, opDecision.actionCount, opDecision.optionData.identifier);
                    }
                    else if (method == 'refine')
                    {
                        this.purchaseUpTo(opDecision.optionData.extraData, opDecision.actionCount, method, opDecision.optionData.identifier);
                    }
                    else if (method == 'reset')
                    {
                        if (opDecision.optionData.identifier == 'faith')
                        {
                            if (opDecision.maxTime == 0)
                            {
                                this.log.info('Attempting to perform faith reset');
                                opDecision.optionData.extraData.click();
                            }
                        }
                        else
                        {
                            // TODO - Other kinds of resets
                        }
                    }
                    else if (method == 'purchase' || method == 'explore')
                    {
                        var item = opDecision.optionData.extraData;
                        var zeroTime = opDecision.maxTime == 0;
                        var purchaseReady = ajk.base.readyForPurchase(item);
                        if (purchaseReady && (zeroTime || method != 'explore'))
                        {
                            if (!ajk.base.purchaseItem(item))
                            {
                                this.log.error('Failed to ' + opDecision.identifier());
                            }
                            else
                            {
                                this.log.info(method + 'd ' + opDecision.optionData.identifier);
                                this.addEvent(item, opDecision.optionData.identifier, iData.type, iData.significance);
                                itemsPurchased += 1;
                            }
                        }
                        else
                        {
                            this.log.detail('Waiting on resources to ' + method);
                            this.applyProjectedConsumption(opDecision, consumptionWeight);
                        }
                    }
                    else if (method == 'block') {} // Do nothing, waiting on external dependencies
                }, null, true);

                for (var resource in tree.demand)
                {
                    ajk.util.ensureKeyAndModify(this.priorityResourceDemand, resource, 0, tree.demand[resource]);
                }

                this.log.unindent();

                consumptionWeight *= ajk.config.consumptionFalloff;
            });

            return itemsPurchased;
        },

        shouldConvert: function(rData)
        {
            // TODO - Figure out mechanism for reset preservation
            // Kinda hacky check to see if we just reset with chronospheres and have a huge surplus of something
            if (rData.available > (rData.max * 2)) { return false; }
            if (rData.unlocked && rData.available / rData.max >= ajk.config.conversionMaxRatio) { return true; }
            return false;
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

                var consumesDemandedResource = false;
                ajk.base.getCraft(craftName).prices.forEach((price) => {
                    if (this.inDemand(price.name) && price.name != rName)
                    {
                        consumesDemandedResource = true;
                    }
                });
                if (consumesDemandedResource) { continue; }

                if (this.shouldConvert(rData))
                {
                    var amountToConvert =  rData.max * ajk.config.conversionRatio;
                    var craftPrice = this.cache.getResourceCostForCraft(rName, craftName);
                    var numCrafts = Math.ceil(amountToConvert / craftPrice);
                    this.log.debug('Converting ' + amountToConvert + ' ' + rName + 's into ' + craftName);
                    this.craftUpTo(craftName, numCrafts, false);
                }
            }
        },

        convertCatpower: function()
        {
            var catPower = this.cache.getResourceData('manpower');
            if (this.shouldConvert(catPower))
            {
                var numHunts = Math.ceil(catPower.max * ajk.config.catpowerConversionRatio / 100);
                this.log.debug('Sending hunters ' + numHunts + ' times');
                ajk.base.hunt(numHunts);
            }
        },

        convertGold: function()
        {
            var gold = this.cache.getResourceData('gold');
            if (this.shouldConvert(gold) && !this.inDemand('gold'))
            {
                this.log.debug('Promoting kittens');
                ajk.base.promote();
            }
        },

        convertFaith: function()
        {
            var faith = this.cache.getResourceData('faith');
            if (this.shouldConvert(faith) && !this.inDemand('faith'))
            {
                this.log.debug('Praising the sun');
                ajk.base.praise();
            }
        },

        convertFurs: function()
        {
            // We don't particularly care if these fail or not, for now...
            this.log.debug('Crafting all parchment');
            this.craftUpTo('parchment', Infinity, false);
            if (!this.inDemand('parchment') && !this.inDemand('culture'))
            {
                this.log.debug('Crafting all manuscripts');
                this.craftUpTo('manuscript', Infinity, false);
            }
            if (!this.inDemand('manuscript') && !this.inDemand('science'))
            {
                this.log.debug('Crafting all compendiums');
                this.craftUpTo('compedium', Infinity, false);
            }
        },

        balanceStructures: function()
        {
            this.energyThrottled = false;
            // Smelter logic
            var smelters = ajk.base.getBuilding('smelter');
            if (smelters.val == 0) { return; }
            var cons = this.cache.getResourceConsumptionForItem('smelter') || {};
            var prod = this.cache.getResourceProductionForItem('smelter') || {};
            var consImpact = Object.keys(cons).reduce((a, r) => {
                return a + ((this.utilization[r] || 0) * cons[r]);
            }, 0);
            var prodImpact = Object.keys(prod).reduce((a, r) => {
                return a + ((this.utilization[r] || 0) * prod[r]);
            }, 0);
            var ratio = prodImpact / (prodImpact + consImpact);
            if (isNaN(ratio)) { ratio = 1; }

            // Only operate on half the smelters
            var adjustedRatio = (ratio * 0.5) + 0.5;
            var targetSmelters = Math.min(Math.ceil(adjustedRatio * smelters.val), smelters.val);
            this.log.debug('Setting ' + targetSmelters + ' / ' + smelters.val + ' smelters active');
            smelters.on = targetSmelters;

            // Power logic
            var biolab = ajk.base.getBuilding('biolab');
            var ccData = ajk.base.getSpaceBuilding('containmentChamber');

            // Keep power production above zero
            var energyDelta = ajk.base.getEnergyProd() - ajk.base.getEnergyCons() - 1 +
                (biolab.on * biolab.effects.energyConsumption) +
                (ccData.on * ccData.effects.energyConsumption);

            // Activate containment chambers as needed
            var amData = this.cache.getResourceData('antimatter');
            var slData = ajk.base.getSpaceBuilding('sunlifter');
            var storagePerCC = ccData.effects.antimatterMax;

            var desiredAMStorage = amData.available + slData.val;
            var ccTargetOn = Math.min(ccData.val, Math.ceil(desiredAMStorage / storagePerCC));
            var ccAvailOn  = Math.max(0, Math.floor(energyDelta / ccData.effects.energyConsumption));
            var ccActualOn = Math.min(ccTargetOn, ccAvailOn);
            this.log.debug('Setting ' + ccActualOn + ' / ' + ccData.val + ' containment chambers active');
            ccData.on = ccActualOn;
            energyDelta -= (ccActualOn * ccData.effects.energyConsumption);
            this.energyThrottled |= (ccActualOn < ccTargetOn);

            if (biolab.effects.energyConsumption > 0)
            {
                var biolabTarget = Math.floor(energyDelta * biolab.effects.energyConsumption);
                var targetBiolabs = Math.min(Math.max(0, biolabTarget), biolab.val);
                this.log.debug('Setting ' + targetBiolabs + ' / ' + biolab.val + ' biolabs active');
                biolab.on = targetBiolabs;
                this.energyThrottled |= (targetBiolabs < biolab.val);
            }
        },

        upgradeItems: function()
        {
            for (var itemName in this.itemData)
            {
                var item = this.itemData[itemName].item;
                if (item == null) { continue; }
                var mData = item.model.metadata;
                if (typeof mData === 'undefined') { continue; }
                if (typeof mData.stage === 'undefined') { continue; }
                if (mData.stage == mData.stages.length - 1) { continue; }
                if (mData.stages[mData.stage + 1].stageUnlocked)
                {
                    this.log.info('Upgrading ' + mData.name + ' to stage ' + (mData.stage + 1));
                    item.controller.upgradeCallback(item.model, true);
                }
            }
        },

        miscHacks: function()
        {
            if (ajk.base.getScience('theology').researched && (!ajk.base.getJob('priest').unlocked || ajk.base.getFaith() == 0))
            {
                this.log.info('Praising the sun for the first time');
                ajk.base.praise();
            }

            if (ajk.base.getCraft('megalith').unlocked && ajk.base.getBuilding('ziggurat').val == 0)
            {
                this.log.debug('Attempting to craft first megalith');
                this.craftUpTo('megalith', 1, false);
            }

            var steamworks = ajk.base.getBuilding('steamworks');
            steamworks.on = steamworks.val;
        },

        resetAccumulators: function()
        {
            this.events = [];
            this.crafts = [];
            this.trades = [];

            this.resourceCapacityDemand = {};
            this.purchaseDemand = {};

            this.production  = {};
            this.consumption = {};
            this.utilization = {};

            this.successes = 0;
        },

        postResetLoop: function()
        {
            this.resetAccumulators();

            while(1)
            {
                this.itemData = {};
                this.rebuildItemList();
                this.buildCostData();
                this.cache.rebuild(this.itemData, false);
                this.prioritize();
                var itemsBuilt = this.pursuePriority();
                this.upgradeItems();
                if (itemsBuilt == 0) { break; }
                this.successes += itemsBuilt;
            }

            ajk.statistics.update(
                this.cache,
                this.events,
                this.crafts,
                this.trades,
                this.utilization
            );
        },

        preResetTick: function()
        {
            var doRebuild = this.successes > 0 ||
                            ajk.base.getYear() != this.year ||
                            ajk.base.getSeason() != this.season;

            this.year = ajk.base.getYear();
            this.season = ajk.base.getSeason();

            this.resetAccumulators();

            // TODO - Only need to do this once, move it out of here
            this.itemData = {};
            this.buildResetItemList();
            this.buildCostData();
            this.cache.rebuild(this.itemData, false);
            this.prioritize();

            this.applyAmbientProductionConsumption();

            this.successes += this.pursuePriority();

            this.convertCatpower();
            this.convertFaith();

            this.computeResourceUtilization();

            this.balanceStructures();

            ajk.jobs.update(doRebuild, this.utilization);

            ajk.statistics.update(
                this.cache,
                this.events,
                this.crafts,
                this.trades,
                this.utilization
            );

            ajk.ui.refreshAnalysis(this.itemData, this.analysisData);
            ajk.ui.refresh();
        },

        standardTick: function(forceRecompute)
        {
            var timerData = ajk.timer.start('Standard Tick Execution');

            var doRebuild = this.successes > 0 ||
                            ajk.base.getYear() != this.year ||
                            ajk.base.getSeason() != this.season ||
                            forceRecompute;

            this.year = ajk.base.getYear();
            this.season = ajk.base.getSeason();

            this.resetAccumulators();

            this.checkForObservationEvent();
            timerData.interval('Event Observation');

            // If we didn't build anything previously, we don't need to recompute priorities and such
            if (doRebuild)
            {
                this.itemData = {};
                this.rebuildItemList();
                this.buildCostData();
                this.cache.rebuild(this.itemData, true);
                this.rebuildExplorationData();
                this.rebuildTranscendenceData();
                this.prioritize();
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

            this.applyAmbientProductionConsumption();
            timerData.interval('Collect Ambient Resource Production');

            this.successes += this.pursuePriority();
            timerData.interval('Pursue Priority');

            this.miscHacks();
            timerData.interval('Miscellaneous Hacks');

            this.convertResources();
            this.convertCatpower();
            this.convertGold();
            this.convertFaith();
            this.convertFurs();
            timerData.interval('Resource Conversion');

            this.computeResourceUtilization();
            timerData.interval('Compute Utilization');

            this.balanceStructures();
            timerData.interval('Structure Management');

            ajk.jobs.update(doRebuild, this.utilization);
            timerData.interval('Kitten Management');

            this.upgradeItems();
            timerData.interval('Item Upgrades');

            ajk.statistics.update(
                this.cache,
                this.events,
                this.crafts,
                this.trades,
                this.utilization
            );
            timerData.interval('Statistics');

            ajk.ui.refreshAnalysis(this.itemData, this.analysisData);
            ajk.ui.refresh();
            timerData.end('UI Refresh');
        },

        unsafeTick: function(forceRecompute)
        {
            if (ajk.base.getYear() == 0 &&
                ajk.base.getSeason() == 0 &&
                !this.postResetDone)
            {
                this.postResetLoop();
                this.postResetDone = true;
            }
            else if (this.resetPending)
            {
                this.preResetTick();
            }
            else
            {
                this.standardTick(forceRecompute);
            }
        },

        tick: function(forceRecompute)
        {
            var timestamp = new Date();
            this.log.debug('Starting tick at ' + timestamp.toUTCString());
            try
            {
                this.unsafeTick(forceRecompute);
            }
            catch (e)
            {
                this.log.error('Error encountered during tick\n' + e.stack);
            }
            this.log.flush(this.successes > 0 && ajk.config.detailedLogsOnSuccess);
        },
    },

    simulateTick: function(forceRecompute)
    {
        this.internal.log.info('Simulating tick');
        var pSimulate = ajk.base.simulate;
        ajk.base.simulate = true;
        this.internal.tick(forceRecompute);
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
            this.internal.tickThread = setInterval(function() { ajk.core.internal.tick(false); }, ajk.config.tickFrequency * 1000);
        }

        // Yeah yeah, singletons are gross, get over it
        ajk.config.ticking = doTick;
        ajk.ui.refresh();
    }
};
