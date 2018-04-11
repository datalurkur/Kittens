'use strict';

ajk.cache = {
    internal:
    {
        log: ajk.log.addChannel('cache', true),

        // Definitions and constants
        effectTypeData:
        [
            {
                type: 'production',
                postfixes:
                [
                    'PerTickAutoprod',
                    'PerTickBase',
                    'PerTickProd',
                    'Production',
                    'DemandRatio',
                    'RatioGlobal',
                    'Ratio',
                ],
                ignore: [],
            },
            {
                type: 'consumption',
                postfixes:
                [
                    'PerTickConsumption',
                    'PerTickCon',
                    'PerTick',
                    'Consumption',
                ],
                ignore:
                [
                    'reactorThoriumPerTick'
                ],
            },
            {
                type: 'storage',
                postfixes: [
                    'Max',
                ],
                ignore: [],
            },
        ],

        productionSpecial:
        {
            'energy': function() { return ajk.base.getEnergyProd(); },
        },
        consumptionSpecial:
        {
            'energy': function() { return -ajk.base.getEnergyCons(); },
        },

        explorationOrder:
        {
            'griffins':   0,
            'lizards':    0,
            'sharks':     0,
            'nagas':      1,
            'zebras':     2,
            'spiders':    3,
            'dragons':    4,
            'leviathans': 5,
        },

        // Cached data
        effectCache:   {},
        resourceCache: {},

        craftCache:
        {
            costToCrafts: {},
            craftData:    {},
        },

        huntingCache:
        {
            allowHunting:    false,
            avgHuntsPerTick: 0,
            expectedPerTick: {},
        },

        tradeCache:
        {
            traders:               {},
            resources:             {},
            exploration:           {},
            nextExplorationTarget: null,
        },

        resourceUnlocked: function(resourceName)
        {
            if (this.resourceCache.hasOwnProperty(resourceName)) { return this.resourceCache[resourceName].unlocked; }

            var baseResource = ajk.base.getResource(resourceName);
            if (baseResource.unlocked) { return true; }
            if (this.craftCache.craftData.hasOwnProperty(baseResource) && this.craftCache.craftData[baseResource].unlocked)
            {
                for (var resource in this.craftCache.craftData[baseResource].costs)
                {
                    if (!this.resourceUnlocked(resource)) { return false;}
                }
                return true;
            }
            if (this.tradeCache.resources.hasOwnProperty(resourceName))
            {
                return true;
            }
            return false;
        },

        getProductionOf: function(resource)
        {
            if (this.productionSpecial.hasOwnProperty(resource))
            {
                return this.productionSpecial[resource]();
            }
            return ajk.base.getProductionOf(resource);
        },

        getConsumptionOf: function(resource)
        {
            if (this.consumptionSpecial.hasOwnProperty(resource))
            {
                return this.consumptionSpecial[resource]();
            }
            return ajk.base.getConsumptionOf(resource);
        },

        matchEffect: function(item, effect, effectQuantity, typeIndex)
        {
            var typeData = this.effectTypeData[typeIndex];
            var table = this.effectCache[typeData.type];
            if (typeData.ignore.indexOf(effect) != -1) { return true; }
            for (var i = 0; i < typeData.postfixes.length; ++i)
            {
                var index = effect.indexOf(typeData.postfixes[i]);
                if (index != -1)
                {
                    var resource = effect.substring(0, index);

                    // Effect -> resource (eg 'give me the resource that oilPerTick consumes')
                    table.effectToResource[effect] = resource;

                    // Resource -> items (eg 'give me all the producers of titanium')
                    ajk.util.ensureKey(table.resourceToItems, resource, []).push(item);

                    // Item -> resource data (eg 'give me data on all the resources steamworks consumes via its effects')
                    ajk.util.ensureKey(table.itemToResourceData, item, {})[resource] = effectQuantity;

                    return true;
                }
            }
            return false;
        },

        getTradeAmountFor: function(race, saleData)
        {
            var season = ajk.base.getSeason();
            var seasonModifier;
                 if (season == 1) { seasonModifier = saleData.seasons.spring; }
            else if (season == 2) { seasonModifier = saleData.seasons.summer; }
            else if (season == 3) { seasonModifier = saleData.seasons.autumn; }
            else                  { seasonModifier = saleData.seasons.winter; }

            var amount = saleData.value * ajk.base.getTradeRatio();
            var chance = saleData.chance;

            if (race.name == 'zebras' && saleData.name == 'titanium')
            {
                // Special rules for this
                var numShips = ajk.base.getResource('ship').value;
                amount = (0.03 * numShips) + 1.5;
                chance = ((0.35 * numShips) + 15) / 100;
            }

            return amount * (chance / 100) * seasonModifier;
        },

        // Null means do nothing
        // Empty array means no costs - race discovery is ready
        // Populated array means there are blockers
        getExplorationRequirementsFor(race)
        {
            if (race.name == 'lizards' || race.name == 'griffins' || race.name == 'sharks')
            {
                var available = (
                    (ajk.base.getPerk('diplomacy').researched && ajk.base.getYear() >=  1) ||
                    (ajk.base.getResource('karma').value > 0  && ajk.base.getYear() >=  5) ||
                    (                                            ajk.base.getYear() >= 20)
                );
                return available ? [] : null;
            }
            else if (race.name == 'nagas')
            {
                var culture = ajk.base.getResource('culture');
                if (culture.maxValue < 1500)
                {
                    return ['storage', 'culture'];
                }
                else if (culture.value < 1500)
                {
                    return ['accumulate', ['culture', 1500]];
                }
                else
                {
                    return [];
                }
            }
            else if (race.name == 'zebras')
            {
                return (ajk.base.getResource('ship').value == 0) ? ['accumulate', ['ship', 1]] : [];
            }
            else if (race.name == 'spiders')
            {
                var shipDeficit = ajk.base.getResource('ship').value - 100;
                if (shipDeficit > 0)
                {
                    return ['accumulate', ['ship', shipDeficit]];
                }
                else if (ajk.base.getResource('science').maxValue < 125000)
                {
                    return ['storage', 'science'];
                }
                else
                {
                    return [];
                }
            }
            else if (race.name == 'dragons')
            {
                return (ajk.base.getScience('nuclearFission').researched) ? [] : ['purchase', 'nuclearFission'];
            }
            else if (race.name == 'leviathans')
            {
                return (ajk.base.getZigguratUpgrade('blackPyramid').val > 0) ? null : ['purchase', 'blackPyramid'];
            }
        },

        cacheCraftData: function()
        {
            this.craftCache.costToCrafts = {};
            this.craftCache.craftData    = {};

            ajk.base.getAllCrafts().forEach((craft) => {
                this.log.detail('Caching data for craft ' + craft.name);
                this.craftCache.craftData[craft.name] = {
                    unlocked: craft.unlocked,
                    costs:    {}
                };
                craft.prices.forEach((price) => {
                    this.craftCache.craftData[craft.name].costs[price.name] = price.val;
                    ajk.util.ensureKey(this.craftCache.costToCrafts, price.name, {})[craft.name] = price.val;
                });
            });
        },

        cacheResourceData: function()
        {
            this.resourceCache = {};
            ajk.base.getAllResources().forEach((res) => {
                this.log.detail('Caching data for resource ' + res.name);

                this.resourceCache[res.name] = {
                    unlocked:  this.resourceUnlocked(res.name),
                    max:       (res.maxValue == 0) ? Infinity : res.maxValue,
                };
            });
            this.resourceCache['energy'] = {
                unlocked: true,
                max:      Infinity
            };
            this.cacheResourcePoolData();
        },

        cacheResourcePoolData: function()
        {
            for (var resource in this.resourceCache)
            {
                var prod = this.getProductionOf(resource);
                var cons = this.getConsumptionOf(resource);
                var rData       = this.resourceCache[resource];
                rData.perTick   = (prod + cons);
                rData.available = ajk.base.getResource(resource).value;
            }
        },

        cacheHuntingData: function()
        {
            this.log.detail('Caching hunting data and expected spoils');
            // TODO - Solve the problem of other catpower consumers interfering with this metric
            this.huntingCache.allowHunting = ajk.base.getJob('hunter').unlocked;
            this.huntingCache.expectedPerTick = {};
            var avgHuntsPerTick = this.resourceCache['manpower'].perTick / 100;
            var hunterRatio = ajk.base.getHunterRatio();

            var expectedFursPerHunt = 39.5 + ((65 * (hunterRatio - 1)) / 2);
            this.huntingCache.expectedPerTick['furs'] = expectedFursPerHunt * avgHuntsPerTick;

            var ivoryChance = (44 + (2 * hunterRatio)) / 100;
            var ivoryAmount = 24.5 + ((40 * (hunterRatio - 1)) / 2);
            this.huntingCache.expectedPerTick['ivory'] = ivoryChance * ivoryAmount * avgHuntsPerTick;

            this.huntingCache.avgHuntsPerTick = avgHuntsPerTick;

            // Update per-tick data based on the hunting cache
            if (this.huntingCache.allowHunting)
            {
                for (var resource in this.huntingCache.expectedPerTick)
                {
                    this.resourceCache[resource].perTick += this.huntingCache.expectedPerTick[resource];
                }
            }
        },

        cacheTradeData: function()
        {
            this.tradeCache = {
                traders:               {},
                resources:             {},
                exploration:           {},
                nextExplorationTarget: null
            };

            var allRaces = ajk.base.getAllRaces();
            ajk.base.getAllRaces().forEach((race) => {
                if (race.unlocked)
                {
                    this.log.detail('Adding trade amounts for ' + race.name);
                    var saleData = {};
                    race.sells.forEach((price) => {
                        var tradeAmount = this.getTradeAmountFor(race, price);
                        saleData[price.name] = tradeAmount;
                        ajk.util.ensureKey(this.tradeCache.resources, price.name, []).push({
                            race: race,
                            tradeAmount: tradeAmount
                        });
                    });
                    this.tradeCache.traders[race.name] = {
                        sells: saleData,
                        race:  race,
                    };
                }
            });
        },

        cacheEffects: function(itemMap)
        {
            this.log.debug('Caching effects');
            this.log.indent();

            this.effectCache = {};
            this.effectTypeData.forEach((typeData) => {
                this.effectCache[typeData.type] = {
                    effectToResource:   {},
                    resourceToItems:    {},
                    itemToResourceData: {},
                };
            });

            for (var itemName in itemMap)
            {
                this.log.trace('Caching effects for ' + itemName);
                var itemData = itemMap[itemName].item.model.metadata;
                var effects = itemData.effects;
                if (itemData.hasOwnProperty('stage'))
                {
                    effects = itemData.stages[itemData.stage].effects;
                }
                for (var effectName in effects)
                {
                    if (effects[effectName] == 0)
                    {
                        this.log.detail('Ignoring effect ' + effectName + ' with zero-value for ' + itemData.name);
                        continue;
                    }
                    for (var j = 0; j < this.effectTypeData.length; ++j)
                    {
                        if (this.matchEffect(itemData.name, effectName, effects[effectName], j)) { break; }
                    }
                }
            }

            this.log.unindent();
        },

        cacheExplorationData: function()
        {
            ajk.base.getAllRaces().forEach((race) => {
                if (!race.unlocked)
                {
                    this.log.detail('Adding exploration requirements for ' + race.name);
                    this.tradeCache.exploration[race.name] = this.getExplorationRequirementsFor(race);
                }
            });

            var earliestRace = Infinity;
            for (var raceName in this.tradeCache.exploration)
            {
                if (this.explorationOrder[raceName] < earliestRace)
                {
                    this.tradeCache.nextExplorationTarget = raceName;
                    earliestRace = this.explorationOrder[raceName];
                }
            }
        },
    },

    rebuild: function(itemMap)
    {
        this.internal.log.debug('Rebuilding cache');
        this.internal.log.indent();

        // Cache trade data
        this.internal.cacheTradeData();

        // Rebuild craft cache
        this.internal.cacheCraftData();

        // Rebuild resource cache
        this.internal.cacheResourceData();

        // Rebuild hunting data
        this.internal.cacheHuntingData();

        // Rebuild effect cache
        this.internal.cacheEffects(itemMap);

        // Cache exploration data
        this.internal.cacheExplorationData();

        this.internal.log.unindent();
    },

    refresh: function()
    {
        // Refresh only raw amounts
        this.internal.cacheResourcePoolData();

        // Rebuild hunting data
        this.internal.cacheHuntingData();
    },

    getAllResources: function()
    {
        return Object.keys(this.internal.resourceCache);
    },

    getResourceData: function(resourceName)
    {
        if (!this.internal.resourceCache.hasOwnProperty(resourceName))
        {
            this.internal.log.error('No cache data for resource ' + resourceName);
        }
        return this.internal.resourceCache[resourceName];
    },

    getTradeDataForResource: function(resourceName)
    {
        return this.internal.tradeCache.resources[resourceName] || [];
    },

    getResourceConsumptionForItem: function(itemName)
    {
        return this.internal.effectCache['consumption'].itemToResourceData[itemName];
    },

    getResourceCostForCraft: function(resourceName, craftName)
    {
        return this.internal.craftCache.costToCrafts[resourceName][craftName];
    },

    isCraftUnlocked: function(craftName)
    {
        return this.internal.craftCache.craftData[craftName].unlocked;
    },

    getExplorationData: function()
    {
        if (this.internal.tradeCache.nextExplorationTarget == null) { return {}; }
        return this.internal.tradeCache.exploration[this.internal.tradeCache.nextExplorationTarget];
    },
};