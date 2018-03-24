if (typeof ajk !== 'undefined')
{
    ajk.shouldTick(false);
    ajk.backup.shouldPerformBackup(false);
}

ajk = {
    simulate: false,
    tickFrequency: 10,

    tickThread: null,

    backup:
    {
        gapiReady: false,
        gapiKey: null,
        gapiClientId: null,

        thread: null,
        frequency: 8,

        shouldPerformBackup: function(doBackup)
        {
            if (this.thread != null)
            {
                clearInterval(this.thread);
                this.thread = null;
            }
            if (!doBackup) { return; }
            ajk.log.info('Backing up export string every ' + this.frequncy + ' hours');
            this.thread = setInterval(function() { ajk.backup.backupExportString(); }, this.frequency * 60 * 60 * 1000);
        },

        init: function()
        {
            if (this.gapiKey == null || this.gapiClientId == null)
            {
                ajk.log.warn('Google API key and client ID must be set up before backup will occur');
                return;
            }
            var scopes = 'https://www.googleapis.com/auth/drive.file';
            if (typeof gapi !== 'undefined') { return; }
            $.getScript('https://apis.google.com/js/api.js', function()
            {
                gapi.load('client:auth2', function() {
                    // Initialize the client with API key and People API, and initialize OAuth with an
                    // OAuth 2.0 client ID and scopes (space delimited string) to request access.
                    gapi.client.init({
                        apiKey: this.gapiKey,
                        discoveryDocs: ["https://people.googleapis.com/$discovery/rest?version=v1"],
                        clientId: this.gapiClientId,
                        scope: scopes
                    }).then(function () {
                        gapi.client.load('drive', 'v3', function()
                        {
                            this.gapiReady = true;
                        });

                        // Listen for sign-in state changes.
                        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

                        // Handle the initial sign-in state.
                        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
                    });
                });
            });
        },

        updateSigninStatus: function()
        {
            gapi.client.people.people.get({
                'resourceName': 'people/me',
                'requestMask.includeField': 'person.names'
            }).then(function(response) {
                ajk.log.info('You are signed in as ' + response.result.names[0].givenName);
            }, function(reason) {});
        },

        handleSignInClick: function(event)
        {
            gapi.auth2.getAuthInstance().signIn();
        },

        handleSignOutClick: function(event)
        {
            gapi.auth2.getAuthInstance().signOut();
        },

        backupExportString: function()
        {
            if (!this.gapiReady)
            {
                this.init();
            }

            ajk.log.debug('Performing backup...');
            if (!gapi.auth2.getAuthInstance().isSignedIn.get())
            {
                ajk.log.warn('Not signed into google drive - can\'t backup export string');
                return;
            }
            if (!this.gapiReady)
            {
                ajk.log.warn('Google drive API not loaded - can\'t backup export string');
                return;
            }

            if (ajk.simulate) { return; }

            ajk.log.info('Bailing early for testing reasons');

            gamePage.saveExport();
            var exportString = $("#exportData")[0].value;
            $('#exportDiv').hide();

            if (typeof localStorage.backupFileId === 'undefined')
            {
                var fileMetadata = {
                    name: 'Kittens Game Backup',
                    mimeType: 'application/vnd.google-apps.document'
                };
                gapi.client.drive.files.create({
                    resource: fileMetadata,
                }).then(function(response) {
                    var fileId = response.result.id;
                    localStorage.backupFileId = fileId;
                    ajk.log.debug('Created backup');
                }, function(error) {
                    ajk.log.warn('Failed to create backup file');
                    return;
                });
            }
            ajk.log.debug('Updating backup file with data');
            var fileData = {
                mimeType: "text/plain",
                media: exportString
            };
            gapi.client.request({
                path: '/upload/drive/v3/files/' + localStorage.backupFileId,
                method: 'PATCH',
                params: {
                    uploadType: 'media'
                },
                body: exportString
            }).then(function(response) {
                ajk.log.debug('Updated backup file');
            }, function(error) {
                ajk.log.warn('Failed to update backup file');
            });
        }
    },

    cache:
    {
        craftDependencies: {},
        consumptionEffects: {},
        productionEffects: {},
        storageEffects: {},
        productionOutput:
        {
            'energy': function() { return gamePage.resPool.getEnergyDelta(); }
        },

        getProductionOf: function(resource)
        {
            if (this.productionOutput.hasOwnProperty(resource))
            {
                return this.productionOutput[resource]();
            }
            return gamePage.resPool.get(resource).perTickCached;
        },

        getCraftDependencies: function(resource)
        {
            if (resource == 'wood') { return []; }
            var craft = gamePage.workshop.getCraft(resource);
            if (craft == null) { return []; }

            var deps = [];
            for (var j = 0; j < craft.prices.length; ++j)
            {
                var thisDep = craft.prices[j].name;
                var depDeps = this.getCraftDependencies(thisDep);
                depDeps.push(thisDep);
                deps = deps.concat(depDeps);
            }
            return deps;
        },

        buildCraftDependencies: function()
        {
            this.craftDependencies = {};

            for (var i = 0; i < gamePage.workshop.crafts.length; ++i)
            {
                this.craftDependencies[gamePage.workshop.crafts[i].name] = this.getCraftDependencies(gamePage.workshop.crafts[i].name);
            }
        },

        addProductionEffect: function(effectName, resourceName)
        {
            if (!this.productionEffects.hasOwnProperty(resourceName))
            {
                this.productionEffects[resourceName] = [];
            }
            this.productionEffects[resourceName].push(effectName);
        },

        addStorageEffect: function(effectName, resourceName)
        {
            if (!this.storageEffects.hasOwnProperty(resourceName))
            {
                this.storageEffects[resourceName] = [];
            }
            this.storageEffects[resourceName].push(effectName);
        },

        buildEffectTables: function()
        {
            this.consumptionEffects = {};
            this.productionEffects = {};
            this.storageEffects = {};

            var productionPostfixes = [
                'PerTickAutoprod',
                'PerTickBase',
                'PerTickProd',
                'Production',
                'Ratio',
            ];
            var consumptionPostfixes = [
                'PerTick',
                'PerTickCon',
                'PerTickConsumption',
                'Consumption',
            ];
            var storagePostfixes = [
                'Max',
            ];
            for (var i = 0; i < gamePage.bld.buildingsData.length; ++i)
            {
                for (var effectName in gamePage.bld.buildingsData[i].effects)
                {
                    var matched = false;
                    for (var j = 0; j < productionPostfixes.length; ++j)
                    {
                        var index = effectName.indexOf(productionPostfixes[j]);
                        if (index != -1)
                        {
                            this.addProductionEffect(effectName, effectName.substring(0, index));
                            matched = true;
                            break;
                        }
                        if (matched) { break; }
                    }
                    if (matched) { continue; }

                    for (var j = 0; j < consumptionPostfixes.length; ++j)
                    {
                        var index = effectName.indexOf(consumptionPostfixes[j]);
                        if (index != -1)
                        {
                            this.consumptionEffects[effectName] = effectName.substring(0, index);
                            matched = true;
                            break;
                        }
                    }
                    if (matched) { continue; }

                    for (var j = 0; j < storagePostfixes.length; ++j)
                    {
                        var index = effectName.indexOf(storagePostfixes[j]);
                        if (index != -1)
                        {
                            this.addStorageEffect(effectName, effectName.substring(0, index));
                            matched = true;
                            break;
                        }
                    }
                    if (matched) { continue; }

                    ajk.log.debug('Found no matching effect definition for ' + effectName + ' in ' + gamePage.bld.buildingsData[i].name);
                }
            }
        },

        init: function()
        {
            this.buildCraftDependencies();
            this.buildEffectTables();
        }
    },

    log:
    {
        detailEnabled: false,
        debugEnabled: false,
        warnEnabled: true,
        infoEnabled: true,

        detail: function(message)
        {
            if (!this.detailEnabled) { return; }
            console.log(message);
        },
        debug: function(message)
        {
            if (!this.debugEnabled) { return; }
            console.log(message);
        },
        warn: function(message)
        {
            if (!this.warnEnabled) { return; }
            console.log(message);
        },
        info: function(message)
        {
            if (!this.infoEnabled) { return; }
            console.log(message);
        }
    },

    trade:
    {
        getTradeAmountFor: function(raceName, resourceName)
        {
            if (raceName == 'zebras' && resourceName == 'titanium')
            {
                // Special rules for this
                var numShips = gamePage.resPool.get('ship').value;
                var amount = (0.03 * numShips) + 1.5;
                var chance = ((0.35 * numShips) + 15) / 100;
                return chance * amount;
            }

            var race;
            for (var i = 0; i < gamePage.diplomacy.races.length; ++i)
            {
                if (gamePage.diplomacy.races[i].name == raceName)
                {
                    race = gamePage.diplomacy.races[i];
                    break;
                }
            }

            var saleData;
            for (var i = 0; i < race.sells.length; ++i)
            {
                if (race.sells[i].name == resourceName)
                {
                    saleData = race.sells[i];
                    break;
                }
            }

            var season = gamePage.calendar.season;
            var seasonModifier;
                 if (season == 1) { seasonModifier = saleData.seasons.spring; }
            else if (season == 2) { seasonModifier = saleData.seasons.summer; }
            else if (season == 3) { seasonModifier = saleData.seasons.autumn; }
            else                  { seasonModifier = saleData.seasons.winter; }

            return (1 + gamePage.diplomacy.getTradeRatio()) * (saleData.chance / 100) * seasonModifier;
        },

        getTradeDataFor(price)
        {
            var chosenRace = null;
            var raceAmount = null;
            for (var i = 0; i < gamePage.diplomacy.races.length; ++i)
            {
                var race = gamePage.diplomacy.races[i];
                if (!race.unlocked) { continue; }
                for (var j = 0; j < race.sells.length; ++j)
                {
                    if (race.sells[j].name == price.name)
                    {
                        var tradeAmount = this.getTradeAmountFor(race.name, price.name);
                        if (chosenRace == null || tradeAmount > raceAmount)
                        {
                            chosenRace = race;
                            raceAmount = tradeAmount;
                        }
                    }
                }
            }
            if (chosenRace == null) { return null; }

            var prices = [];
            for (var i = 0; i < chosenRace.buys.length; ++i)
            {
                prices.push({
                    name: chosenRace.buys[i].name,
                    val: chosenRace.buys[i].val
                });
            }
            var numTradesRequired = Math.ceil(raceAmount / price.val);
            prices.push({
                name: 'catpower',
                val: numTradesRequired * 50
            });
            prices.push({
                name: 'gold',
                val: numTradesRequired * 15
            });

            return {
                prices: prices,
                race: chosenRace,
                trades: numTradesRequired
            };
        },

        tradeWith: function(race, trades)
        {
            var allowedTrades = gamePage.diplomacy.getMaxTradeAmt(race);
            if (allowedTrades < trades)
            {
                ajk.log.detail('Trading as many times with ' + race.name + ' as possible (' + allowedTrades + '/' + trades + ')');
                if (!ajk.simulate)
                {
                    gamePage.diplomacy.tradeAll(race);
                }
                return false;
            }
            else
            {
                ajk.log.detail('Trading ' + trades + ' times with ' + race.name);
                if (!ajk.simulate)
                {
                    gamePage.diplomacy.tradeMultiple(race, trades);
                }
                return true;
            }
        }
    },

    workshop:
    {
        craft: function(resource, crafts)
        {
            var allowedCrafts = gamePage.workshop.getCraftAllCount(resource);
            if (allowedCrafts < crafts)
            {
                ajk.log.detail('Crafting as many ' + resource + 's as possible (' + allowedCrafts + '/' + crafts + ')');
                if (!ajk.simulate)
                {
                    gamePage.workshop.craftAll(resource);
                }
                return false;
            }
            else
            {
                ajk.log.detail('Crafting ' + crafts + ' ' + resource + 's');
                if (!ajk.simulate)
                {
                    gamePage.workshop.craft(resource, crafts);
                }
                return true;
            }
        }
    },

    resources:
    {
        catnipBufferFixed: 5000,
        catnipBufferRatio: 0.1,
        conversionRatio: 0.1,
        conversionMaxRatio: 0.97,
        conversions:
        {
            'catnip': 'wood',
            'wood': 'beam',
            'minerals': 'slab',
            'coal': 'steel',
            'iron': 'plate',
            'titanium': 'alloy',
            'oil': 'kerosene',
        },
        demand: {},

        getCraftCost: function(craft, resource)
        {
            for (var i = 0; i < craft.prices.length; ++i)
            {
                if (craft.prices[i].name == resource) { return craft.prices[i].val; }
            }
        },

        accumulateDemand: function(costData)
        {
            for (var i = 0; i < costData.prices.length; ++i)
            {
                if (costData.prices[i].hasOwnProperty('dependencies'))
                {
                    this.accumulateDemand(costData.prices[i].dependencies);
                }
                if (!this.demand.hasOwnProperty(costData.prices[i].name))
                {
                    this.demand[costData.prices[i].name] = 0;
                }
                this.demand[costData.prices[i].name] += costData.prices[i].val;
            }
        },

        hasCompetition: function(costData)
        {
            for (var i = 0; i < costData.prices.length; ++i)
            {
                if (this.demand.hasOwnProperty(costData.prices[i].name)) { return true; }
                if (costData.prices[i].hasOwnProperty('dependencies'))
                {
                    if (this.hasCompetition(costData.prices[i].dependencies)) { return true; }
                }
            }
            return false;
        },

        catnipBuffer: function()
        {
            var scaledBuffer = gamePage.resPool.get('catnip').maxValue * this.catnipBufferRatio;
            return Math.max(scaledBuffer, this.catnipBufferFixed);
        },

        convert: function()
        {
            for (var rName in this.conversions)
            {
                var resource = gamePage.resPool.get(rName);
                var conversion = gamePage.resPool.get(this.conversions[rName]);
                if (!resource.unlocked || !conversion.unlocked) { continue; }
                if (resource.value / resource.maxValue >= this.conversionMaxRatio)
                {
                    var amountToConvert = resource.maxValue * this.conversionRatio;
                    var craft = gamePage.workshop.getCraft(conversion.name);
                    var craftCost = this.getCraftCost(craft, rName);
                    var numCrafts = Math.ceil(amountToConvert / craftCost);
                    ajk.log.debug('Converting ' + amountToConvert + ' ' + rName + 's into ' + craft.name + 's');
                    if (!ajk.simulate)
                    {
                        gamePage.workshop.craft(craft.name, numCrafts);
                    }
                }
            }

            var catPower = gamePage.resPool.get('manpower');
            if (catPower.unlocked && catPower.value / catPower.maxValue >= this.conversionMaxRatio)
            {
                var numHunts = Math.ceil(catPower.maxValue * this.conversionRatio / 100);
                ajk.log.debug('Sending hunters ' + numHunts + ' times');
                if (!ajk.simulate)
                {
                    gamePage.village.huntMultiple(numHunts);
                }
            }

            var faith = gamePage.resPool.get('faith');
            if (faith.unlocked && faith.value == faith.maxValue)
            {
                ajk.log.debug('Praising the sun');
                if (!ajk.simulate)
                {
                    gamePage.religion.praise();
                }
            }

            if (!ajk.simulate)
            {
                gamePage.workshop.craftAll('parchment');
            }
            if (!ajk.simulate && !this.demand.hasOwnProperty('parchment') && !this.demand.hasOwnProperty('culture'))
            {
                gamePage.workshop.craftAll('manuscript');
            }
            if (!ajk.simulate && this.demand.hasOwnProperty('manuscript') && !this.demand.hasOwnProperty('science'))
            {
                gamePage.workshop.craftAll('compedium');
            }
        }
    },

    analysis:
    {
        capacityDemandModifier: -2,
        productionDemandModifier: -2,
        oneShotModifier: -10,

        data: {},
        capacityDemand: {},
        outputDemand: {},

        priorityList: [],
        filteredPriorityList: [],

        defaultItemWeight:
        {
            'field': -10,
            'hut': -10,
            'logHouse': -10,
        },

        reset: function()
        {
            this.data = {}
            this.capacityDemand = {};
            this.outputDemand = {};
            this.priorityList = [];
            this.filteredPriorityList = [];

            ajk.resources.demand = {};
        },

        analyzeResourceProduction: function(price)
        {
            ajk.log.detail('  Determining time cost of producing ' + price.val + ' ' + price.name + 's');
            var productionData = jQuery.extend({}, price);
            productionData.method = 'PerTick';

            var resource = gamePage.resPool.get(price.name);
            if (!resource.unlocked)
            {
                productionData.time = Infinity;
                return productionData;
            }

            var minTicks = Math.max(0, (price.val - resource.value) / resource.perTickCached);
            ajk.log.detail('    Default per-tick production will take ' + minTicks + ' ticks');
            productionData.time = minTicks;

            if (resource.craftable && resource.name != 'wood')
            {
                var numCraftsRequired = Math.ceil(price.val / (1 + gamePage.getResCraftRatio(price.name)));
                ajk.log.detail('    Craftable in ' + numCraftsRequired + ' crafts');

                var craftPrices = gamePage.workshop.getCraft(price.name).prices;
                var modifiedCraftPrices = [];
                for (var i = 0; i < craftPrices.length; ++i)
                {
                    modifiedCraftPrices.push({
                        name: craftPrices[i].name,
                        val: craftPrices[i].val * numCraftsRequired
                    });
                }

                var costData = this.analyzeCostProduction(craftPrices);
                if (costData.time < productionData.time)
                {
                    ajk.log.detail('    Crafting is more effective');
                    productionData.time = costData.time;
                    productionData.method = 'Craft';
                    productionData.craftAmount = numCraftsRequired;
                    productionData.dependencies = costData;
                }
            }
            var tradeData = ajk.trade.getTradeDataFor(price);
            if (tradeData != null)
            {
                ajk.log.detail('    Tradeable');
                var costData = this.analyzeCostProduction(tradeData.prices);
                if (costData.time < productionData.time)
                {
                    ajk.log.detail('    Trading is more effective');
                    productionData.time = costData.time;
                    productionData.method = 'Trade';
                    productionData.tradeRace = tradeData.race;
                    productionData.trades = tradeData.trades;
                    productionData.dependencies = costData;
                }
            }
            return productionData;
        },

        analyzeCostProduction: function(prices)
        {
            var costData = {
                time: 0,
                prices: []
            };
            for (var i = 0; i < prices.length; ++i)
            {
                var productionData = this.analyzeResourceProduction(prices[i]);
                if (productionData.time > costData.time)
                {
                    costData.time = productionData.time;
                }
                costData.prices.push(productionData);
            }
            return costData;
        },

        adjustItemPriceRatio: function(item)
        {
            var itemName = item.model.metadata.name;
            ajk.log.detail('Determining how to best produce ' + itemName + ' and how long it will take');
            var costData = this.analyzeCostProduction(item.controller.getPrices(item.model));
            var modifier = Math.log(costData.time + 1);
            ajk.log.debug('It will be ' + costData.time + ' ticks until there are enough resources for ' + itemName + ' (modifier ' + modifier + ')');
            this.data[itemName].weight += modifier;
            this.data[itemName].costData = costData;
        },

        analyzeItems: function(items)
        {
            for (var i = 0; i < items.length; ++i)
            {
                if (!items[i].model.hasOwnProperty('metadata')) { continue; }

                var mData = items[i].model.metadata;
                var itemName = mData.name;
                if (!mData.unlocked) { continue; }
                if (mData.hasOwnProperty('researched') && mData.researched) { continue; }

                var defaultWeight = 0;
                if (this.defaultItemWeight.hasOwnProperty(itemName))
                {
                    defaultWeight = this.defaultItemWeight[itemName];
                }

                this.data[itemName] = {
                    item: items[i],
                    weight: defaultWeight,
                    missingMaxResources: false
                };

                if (mData.hasOwnProperty('effects'))
                {
                    var overConsumption = false;
                    for (var effectKey in mData.effects)
                    {
                        if (!ajk.cache.consumptionEffects.hasOwnProperty(effectKey)) { continue; }
                        var consumedResource = ajk.cache.consumptionEffects[effectKey];
                        if (ajk.cache.getProductionOf(consumedResource) - mData.effects[effectKey] < 0)
                        {
                            overConsumption = true;
                            outputDemand[consumedResource] = true;
                        }
                    }
                    if (overConsumption)
                    {
                        outsideMaxResources.push(item);
                        continue;
                    }
                }

                this.adjustItemPriceRatio(items[i]);

                if (!mData.hasOwnProperty('val'))
                {
                    // Favor one-shots
                    ajk.log.debug('Prioritizing ' + itemName + ' as a one-shot');
                    this.data[itemName].weight += this.oneShotModifier;
                }

                var missingMaxResources = false;
                var prices = items[i].controller.getPrices(items[i].model);
                for (var j = 0; j < prices.length; ++j)
                {
                    var resource = gamePage.resPool.get(prices[j].name);
                    if (!resource.unlocked)
                    {
                        missingMaxResources = true;
                    }
                    else if (resource.maxValue != 0 && resource.maxValue < prices[j].val)
                    {
                        ajk.log.detail('Max ' + resource.name + ' lacking to produce ' + itemName);
                        missingMaxResources = true;
                        this.capacityDemand[prices[j].name] = true;
                    }
                }
                if (missingMaxResources)
                {
                    this.data[itemName].missingMaxResources = true;
                }
            }
        },

        providesStorageFor: function(item, resource)
        {
            if (!item.model.hasOwnProperty('metadata') || !item.model.metadata.hasOwnProperty('effects')) { return false; }
            if (!ajk.cache.storageEffects.hasOwnProperty(resource))
            {
                ajk.log.debug('Failed to find matching storage property for ' + resource);
                return false;
            }
            var storageEffects = ajk.cache.storageEffects[resource];
            for (var i = 0; i < storageEffects.length; ++i)
            {
                for (var effectName in item.model.metadata.effects)
                {
                    if (storageEffects[i] == effectName && item.model.metadata.effects[effectName] > 0) { return true; }
                }
            }
            return false;
        },

        providesProductionFor: function(item, resource)
        {
            if (!item.model.hasOwnProperty('metadata') || !item.model.metadata.hasOwnProperty('effects')) { return false; }
            if (!ajk.cache.productionEffects.hasOwnProperty(resource))
            {
                ajk.log.debug('Failed to find matching production property for ' + resource);
                return false;
            }
            var productionEffects = ajk.cache.productionEffects[resource];
            for (var i = 0; i < productionEffects.length; ++i)
            {
                for (var effectName in item.model.metadata.effects)
                {
                    if (productionEffects[i] == effectName && item.model.metadata.effects[effectName] > 0) { return true; }
                }
            }
            return false;
        },

        analyzeResults: function()
        {
            // For every item that increases the storage capacity of a resource that's lacking in capacity, increase its priority
            for (var itemKey in this.data)
            {
                for (var resource in this.capacityDemand)
                {
                    if (this.providesStorageFor(this.data[itemKey].item, resource))
                    {
                        ajk.log.debug('Increasing the priority of ' + itemKey + ' based on capacity demand for ' + resource);
                        this.data[itemKey].weight += this.capacityDemandModifier;

                        // Only apply the capacity demand bonus once for any given item
                        // This prevents us from overindexing on things that provide storage for a whole bunch of things, like Warehouses
                        break;
                    }
                }
            }

            // For every item that produces a resource that's lacking in output, increase its priority
            for (var resource in this.outputDemand)
            {
                for (var itemKey in this.data)
                {
                    if (this.providesProductionFor(this.data[itemKey].item, resource))
                    {
                        ajk.log.debug('Increasing the priority of ' + itemKey + ' based on output demand for ' + resource);
                        this.data[itemKey].weight += this.productionDemandModifier;
                    }
                }
            }

            // Organize the items in terms of priority
            for (var itemName in this.data)
            {
                var inserted = false;
                for (var i = 0; i < this.priorityList.length; ++i)
                {
                    if (this.data[itemName].weight < this.data[this.priorityList[i]].weight)
                    {
                        this.priorityList.splice(i, 0, itemName);
                        inserted = true;
                        break;
                    }
                }
                if (!inserted) { this.priorityList.push(itemName); }
            }

            // Filter the priority list and build up the table of resource requirements
            for (var i = 0; i < this.priorityList.length; ++i)
            {
                var costData = this.data[this.priorityList[i]].costData;
                if (!ajk.resources.hasCompetition(costData))
                {
                    ajk.log.detail('Added ' + this.priorityList[i] + ' to list of filtered items');
                    this.filteredPriorityList.push(this.priorityList[i]);
                    ajk.resources.accumulateDemand(costData);
                }
                else
                {
                    ajk.log.detail('Filtered out ' + this.priorityList[i] + ' due to resource competition');
                }
            }
        },
    },

    core:
    {
        bonfireTab: gamePage.tabs[0],
        scienceTab: gamePage.tabs[2],
        workshopTab: gamePage.tabs[3],

        init: function()
        {
            ajk.cache.init();
        },

        analyze: function()
        {
            ajk.analysis.reset();
            ajk.analysis.analyzeItems(this.bonfireTab.buttons);
            if (this.scienceTab.visible)
            {
                ajk.analysis.analyzeItems(this.scienceTab.buttons);
            }
            if (this.workshopTab.visible)
            {
                ajk.analysis.analyzeItems(this.workshopTab.buttons);
            }
            ajk.analysis.analyzeResults();
        },

        operateOnCostData: function(costData)
        {
            var allSucceeded = true;
            for (var j = costData.prices.length - 1; j >= 0; --j)
            {
                if (costData.prices[j].hasOwnProperty('dependencies'))
                {
                    allSucceeded &= this.operateOnCostData(costData.prices[j].dependencies);
                }
                var price = costData.prices[j];
                if (price.method == 'Trade')
                {
                    allSucceeded &= ajk.trade.tradeWith(price.tradeRace, price.trades);
                }
                else if (price.method == 'Craft')
                {
                    allSucceeded &= ajk.workshop.craft(price.name, price.craftAmount);
                }
                else
                {
                    var resource = gamePage.resPool.get(costData.prices[j].name);
                    var deficit = resource.value - costData.prices[j].val;
                    var sufficient = false;
                    if (resource.name == 'catnip')
                    {
                        sufficient = (deficit >= ajk.resources.catnipBuffer());
                    }
                    else
                    {
                        sufficient = (deficit >= 0);
                    }
                    if (!sufficient)
                    {
                        ajk.log.detail('Waiting on ' + resource.name);
                    }
                    allSucceeded &= sufficient;
                }
            }
            return allSucceeded;
        },

        operateOnPriority: function()
        {
            for (var i = 0; i < ajk.analysis.filteredPriorityList.length; ++i)
            {
                var priority = ajk.analysis.filteredPriorityList[i];
                ajk.log.debug('Attempting to act on ' + priority + ' (weight ' + ajk.analysis.data[priority].weight + ')');

                var costData = ajk.analysis.data[priority].costData;
                if (this.operateOnCostData(costData))
                {
                    ajk.log.detail('Cost operations succeeded, acting');
                    var item = ajk.analysis.data[priority].item;
                    if (item.controller.hasResources(item.model))
                    {
                        if (!ajk.simulate)
                        {
                            item.controller.buyItem(item.model, {}, function(result) {
                                if (result)
                                {
                                    ajk.log.info('Purchased ' + priority);
                                }
                                else
                                {
                                    ajk.log.warn('Failed to purchase ' + priority);
                                }
                            });
                        }
                    }
                    else
                    {
                        ajk.log.warn('Item has insufficient resources, even after operating on costs successfully');
                    }
                }
            }
        },

        tick: function()
        {
            var timestamp = new Date();
            ajk.log.debug('Starting tick at ' + timestamp.toUTCString());
            var t0 = performance.now();
            this.analyze();
            this.operateOnPriority();
            ajk.resources.convert();
            ajk.ui.refreshPriorityTable();
            var t1 = performance.now();
            ajk.log.debug('Tick executed in ' + (t1 - t0) + ' ms');
        }
    },

    ui:
    {
        refreshPriorityTable: function()
        {
            var container = $('#priortyTable');
            container.empty();
            for (var i = 0; i < ajk.analysis.filteredPriorityList.length; ++i)
            {
                var itemKey = ajk.analysis.filteredPriorityList[i];
                var itemWeight = ajk.analysis.data[itemKey].weight;
                container.append('<tr><td>' + itemKey + '</td><td>' + itemWeight + '</td></tr>');
            }
        }
    },

    shouldTick: function(doTick)
    {
        if (this.tickThread != null)
        {
            if (doTick)
            {
                this.log.info('Restarting tick thread');
            }
            else
            {
                this.log.info('Stopping tick thread');
            }
            clearInterval(this.tickThread);
            this.tickThread = null;
        }

        if (doTick)
        {
            this.core.init();
            this.log.info('Ticking every ' + this.tickFrequency + ' seconds');
            this.tickThread = setInterval(function() { ajk.core.tick(); }, this.tickFrequency * 1000);
        }
    }
}

var ajkContainer = $("#scriptingMenu");
if (ajkContainer != null)
{
    ajkContainer.remove();
}

var ajkMenu = `
<div id="scriptingMenu" style="margin:10px; padding:10px" class="panelContainer">
    <div id="container">
        <b>AJK Script Control</b>
        <br/>
        <input id="simulateToggle" type="checkbox" onclick="ajk.simulate = $('#simulateToggle')[0].checked;">
        <label for="simulateToggle">Simulate</label>
        <br/>
        <input id="tickToggle" type="checkbox" onclick="ajk.shouldTick($('#tickToggle')[0].checked);">
        <label for="tickToggle">Ticking</label>
    </div>
    <br/>
    <input id="infoLogToggle" type="checkbox" onclick="ajk.log.infoEnabled = $('#infoLogToggle')[0].checked;">
    <label for="infoLogToggle">Info Logs</label>
    <br/>
    <input id="warnLogToggle" type="checkbox" onclick="ajk.log.warnEnabled = $('#warnLogToggle')[0].checked;">
    <label for="warnLogToggle">Warning Logs</label>
    <br/>
    <input id="debugLogToggle" type="checkbox" onclick="ajk.log.debugEnabled = $('#debugLogToggle')[0].checked;">
    <label for="debugLogToggle">Debug Logs</label>
    <br/>
    <input id="detailLogToggle" type="checkbox" onclick="ajk.log.detailEnabled = $('#detailLogToggle')[0].checked;">
    <label for="detailLogToggle">Detail Logs</label>
    <br/>
    <br/>
    <div id="container">
        <b>Google Drive Backup</b>
        <br/>
        <input id="backupToggle" type="checkbox" onclick="ajk.backup.shouldDoBackup($('#backupToggle')[0].checked);">
        <label for="backupToggle">Perform Backups</label>
        <br/>
        <input type="button" id="signin-button" value="Sign In" onclick="ajk.backup.handleSignInClick();" style="width:100px">
        <input type="button" id="signout-button" value="Sign Out" onclick="ajk.backup.handleSignOutClick();" style="width:100px">
    </div>
    <br/>
    <div id="container">
        <b>Weighted / Filtered Priorities</b>
        <br/>
        <table id="priorityTable"/>
    </div>
</div>
`;

$("#leftColumn").append(ajkMenu);
$("#simulateToggle")[0].checked = ajk.simulate;
$("#infoLogToggle")[0].checked = ajk.log.infoEnabled
$("#warnLogToggle")[0].checked = ajk.log.warnEnabled
$("#debugLogToggle")[0].checked = ajk.log.debugEnabled
$("#detailLogToggle")[0].checked = ajk.log.detailEnabled