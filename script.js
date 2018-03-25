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

    log:
    {
        infoLevel:   0,
        warnLevel:   1,
        debugLevel:  2,
        detailLevel: 3,
        traceLevel:  4,

        logLevel:    1,

        detailedLogsOnSuccess: true,

        debugQueue: [],

        logQueue: [],

        logInternal: function(message, level)
        {
            this.logQueue.push([message, level]);
        },

        flush: function()
        {
            for (var i = 0; i < this.logQueue.length; ++i)
            {
                var message = this.logQueue[i][0];
                var level = this.logQueue[i][1];
                if (this.logLevel < level) { continue; }
                console.log(message);
            }
            this.logQueue = [];
        },

        trace:  function(message) { this.logInternal(message, this.traceLevel);  },
        detail: function(message) { this.logInternal(message, this.detailLevel); },
        debug:  function(message) { this.logInternal(message, this.debugLevel);  },
        warn:   function(message) { this.logInternal(message, this.warnLevel);   },
        info:   function(message) { this.logInternal(message, this.infoLevel);   },

        updateLevel: function()
        {
            var newValue = parseInt($('#logLevelSelect')[0].value);
            this.logLevel = newValue;
        }
    },

    cache:
    {
        craftDependencies: {},
        consumptionEffects: {},
        productionEffects: {},
        storageEffects: {},
        producers: {},
        productionResources: {},
        consumptionResources: {},

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

        addProductionEffect: function(producer, effectName, resourceName)
        {
            if (!this.producers.hasOwnProperty(effectName))
            {
                this.producers[resourceName] = [];
            }
            if (!this.productionEffects.hasOwnProperty(resourceName))
            {
                this.productionEffects[resourceName] = [];
            }
            this.producers[resourceName].push(producer);
            this.productionResources[effectName] = resourceName;
            for (var i = 0; i < this.productionEffects[resourceName].length; ++i)
            {
                if (this.productionEffects[resourceName][i] == effectName) { return; }
            }
            this.productionEffects[resourceName].push(effectName);
        },

        addConsumptionEffect: function(effectName, resourceName)
        {
            this.consumptionEffects[effectName] = resourceName;
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
            this.producers = {};

            var productionPostfixes = [
                'PerTickAutoprod',
                'PerTickBase',
                'PerTickProd',
                'Production',
                'DemandRatio',
                'RatioGlobal',
                'Ratio',
            ];
            var consumptionPostfixes = [
                'PerTickConsumption',
                'PerTickCon',
                'PerTick',
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
                            this.addProductionEffect(gamePage.bld.buildingsData[i].name, effectName, effectName.substring(0, index));
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
                            this.addConsumptionEffect(effectName, effectName.substring(0, index));
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

                    ajk.log.detail('Found no matching effect definition for ' + effectName + ' in ' + gamePage.bld.buildingsData[i].name);
                }
            }
        },

        init: function()
        {
            this.buildCraftDependencies();
            this.buildEffectTables();
        }
    },

    customItems:
    {
        tradeShip: function()
        {
            ajk.ui.switchToTab('Workshop');
            var gameTS = gamePage.workshop.getCraft('ship');
            var itemData = {
                controller:
                {
                    hasResources: function()
                    {
                        return (gamePage.workshop.getCraftAllCount('ship') > 0);
                    },
                    buyItem: function()
                    {
                        if (!ajk.simulate)
                        {
                            gamePage.workshop.craft('ship', 1);
                        }
                    }
                },
                model:
                {
                    metadata: gameTS
                }
            };
            ajk.ui.switchToTab(null);
            return itemData;
        },

        get: function()
        {
            return [
                this.tradeShip()
            ];
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
                name: 'manpower',
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

        explorationRequirement: function()
        {
            if (gamePage.resPool.get('manpower').maxValue < 1000)
            {
                // TODO - Be more accurate about choosing buildings that provide max catpower
                ajk.log.detail('Waiting on max catpower for race discovery');
                return ['hut', 'logHouse'];
            }
            for (var i = 0; i < gamePage.diplomacy.races.length; ++i)
            {
                var race = gamePage.diplomacy.races[i];
                if (race.unlocked || race.name == 'leviathans') { continue; }
                if (race.name == 'lizards' || race.name == 'griffins' || race.name == 'sharks')
                {
                    // TODO - Figure out how to get at metaphysics upgrades and check for diplomacy researched (reduces year to 1)
                    if ((gamePage.resPool.get('karma').value > 0 && gamePage.calendar.year >= 5) ||
                        (gamePage.calendar.year >= 20))
                    {
                        ajk.log.detail(race.name + ' are available for discovery');
                        return [];
                    }
                    else
                    {
                        ajk.log.detail('Waiting on time to pass to discover ' + race.name);
                        return null;
                    }
                }
                else if (race.name == 'nagas')
                {
                    var culture = gamePage.resPool.get('culture');
                    if (culture.maxValue < 1500)
                    {
                        // TODO - Be more accurate about choosing buildings that provide max culture
                        ajk.log.detail('Waiting on max culture to discover nagas');
                        return ['library', 'academy', 'amphitheatre', 'chapel', 'temple'];
                    }
                    else if (culture.value < 1500)
                    {
                        // TODO - Be more accurate about choosing buildings that provide culture
                        ajk.log.detail('Waiting on culture to discover nagas');
                        ajk.resources.accumulateSimpleDemand('culture', 1500);
                        return ['amphitheatre', 'chapel', 'temple'];
                    }
                    else
                    {
                        ajk.log.detail(race.name + ' are available for discovery');
                        return [];
                    }
                }
                else if (race.name == 'zebras')
                {
                    if (gamePage.resPool.get('ship').value > 0)
                    {
                        ajk.log.detail(race.name + ' are available for discovery');
                        return [];
                    }
                    else
                    {
                        ajk.log.detail('Waiting on trade ships to discover ' + race.name);
                        return ['ship'];
                    }
                }
                else if (race.name == 'spiders')
                {
                    if (gamePage.resPool.get('ship').value < 100)
                    {
                        ajk.log.detail('Waiting on trade ships to discover ' + race.name);
                        return ['ship'];
                    }
                    else if (gamePage.resPool.get('science').maxValue < 125000)
                    {
                        // TODO - Be more accurate about choosing buildings that provide max science
                        ajk.log.detail('Waiting on max science to discover ' + race.name);
                        return ['library', 'academy', 'observatory', 'biolab'];
                    }
                    else
                    {
                        ajk.log.detail(race.name + ' are available for discovery');
                        return [];
                    }
                }
                else if (race.name == 'dragons')
                {
                    if (gamePage.science.get('nuclearFission').researched)
                    {
                        ajk.log.detail(race.name + ' are available for discovery');
                        return [];
                    }
                    else
                    {
                        ajk.log.detail('Waiting on nuclear fission to discover ' + race.name);
                        return ['nuclearFission'];
                    }
                }
                else if (race.name == 'leviathans')
                {
                    if (gamePage.religion.getZU('blackPyramid').val == 0)
                    {
                        ajk.log.detail('Waiting on black pyramids for the appearance of ' + race.name);
                        return ['blackPyramid'];
                    }
                }
            }
            return null;
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
                ajk.log.detail('Crafting ' + crafts + ' ' + resource);
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
        catpowerConversionRatio: 0.75,
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
        nontangible:
        {
            'happiness': true,
            'unhappiness': true,
            'learn': true,
            'magnetoBoost': true,
            'refine': true,
            'craft': true,
            'production': true,
            'trade': true,
            'standing': true,
            'resStatis': true
        },

        demand: {},
        previousDemand: {},

        productionOutput:
        {
            'energy': function() { return gamePage.resPool.getEnergyDelta(); }
        },

        available: function(resourceName)
        {
            var baseResource = gamePage.resPool.get(resourceName);
            if (baseResource.unlocked) { return true; }
            if (baseResource.craftable)
            {
                var craft = gamePage.workshop.getCraft(resourceName);
                for (var i = 0; i < craft.prices.length; ++i)
                {
                    if (!this.available(craft.prices[i].name)) { return false; }
                }
                return true;
            }
            return false;
        },

        getProductionOf: function(resource)
        {
            if (this.productionOutput.hasOwnProperty(resource))
            {
                return this.productionOutput[resource]();
            }
            return gamePage.resPool.get(resource).perTickCached;
        },

        reset: function()
        {
            this.previousDemand = jQuery.extend({}, this.demand);
            this.demand = {};
        },

        getCraftCost: function(craft, resource)
        {
            for (var i = 0; i < craft.prices.length; ++i)
            {
                if (craft.prices[i].name == resource) { return craft.prices[i].val; }
            }
        },

        accumulateSimpleDemand: function(resource, amount)
        {
            if (!this.demand.hasOwnProperty(resource))
            {
                this.demand[resource] = 0;
            }
            this.demand[resource] = amount;
        },

        accumulateDemand: function(costData)
        {
            for (var i = 0; i < costData.prices.length; ++i)
            {
                if (costData.prices[i].hasOwnProperty('dependencies'))
                {
                    this.accumulateDemand(costData.prices[i].dependencies);
                }
                this.accumulateSimpleDemand(costData.prices[i].name, costData.prices[i].val);
            }
        },

        complexityOfPreviousDemand: function()
        {
            return Object.keys(this.previousDemand).length;
        },

        previouslyInDemand: function(resourceName)
        {
            return this.previousDemand.hasOwnProperty(resourceName);
        },

        inDemand: function(resourceName)
        {
            return this.demand.hasOwnProperty(resourceName);
        },

        hasCompetition: function(costData)
        {
            for (var i = 0; i < costData.prices.length; ++i)
            {
                if (this.inDemand(costData.prices[i].name)) { return true; }
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
                    ajk.log.debug('Converting ' + amountToConvert + ' ' + rName + 's into ' + craft.name);
                    if (!ajk.simulate)
                    {
                        gamePage.workshop.craft(craft.name, numCrafts);
                    }
                }
            }

            var catPower = gamePage.resPool.get('manpower');
            if (catPower.unlocked && catPower.value / catPower.maxValue >= this.conversionMaxRatio && !ajk.resources.inDemand('manpower'))
            {
                var numHunts = Math.ceil(catPower.maxValue * this.catpowerConversionRatio / 100);
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
        explorationModifier: -5,
        demandModifier: -3,
        consumptionDemandModifier: 2,
        reinforcementModifier: -0.5,
        redundancyModifier: 1,

        data: {},
        capacityDemand: {},
        outputDemand: {},

        priorityList: [],
        filteredPriorityList: [],

        shouldExplore: false,

        defaultItemWeight: {
            'deepMining': -10,
            'coalFurnace': -10,

            // Speculative
            'geodesy': -5,
            'oxidation': -2,
        },

        previousPriority: [],

        modifyWeight: function(itemName, modifier, adjustment)
        {
            if (typeof modifier === 'undefined' || modifier == NaN)
            {
                ajk.log.warn('Item weight being modified by a bad number');
                return;
            }
            if (!this.data.hasOwnProperty(itemName))
            {
                this.data[itemName] = {};
            }
            if (!this.data[itemName].hasOwnProperty('weight'))
            {
                if (this.defaultItemWeight.hasOwnProperty(itemName))
                {
                    this.data[itemName].weight = this.defaultItemWeight[itemName];
                }
                else
                {
                    this.data[itemName].weight = 0;
                }
                this.data[itemName].adjustment = 0;
            }
            this.data[itemName].weight += modifier;
            if (typeof adjustment !== 'undefined' && adjustment)
            {
                this.data[itemName].adjustment += modifier;
            }
        },

        reset: function()
        {
            this.previousPriority = this.filteredPriorityList.slice(0);

            this.data = {}
            this.capacityDemand = {};
            this.outputDemand = {};
            this.priorityList = [];
            this.filteredPriorityList = [];
            this.shouldExplore = false;

            ajk.resources.reset();
        },

        preanalysis: function()
        {
            var explorationRequirement = ajk.trade.explorationRequirement();
            if (explorationRequirement != null)
            {
                if (explorationRequirement.length > 0)
                {
                    for (var i = 0; i < explorationRequirement.length; ++i)
                    {
                        ajk.log.detail('Modifying the weight of ' + explorationRequirement[i] + ' to account for exploration requirements');
                        this.modifyWeight(explorationRequirement[i], this.explorationModifier, true);
                    }
                }
                else
                {
                    ajk.log.detail('New races are available for discovery');
                    this.shouldExplore = true;
                }
            }
        },

        analyzeResourceProduction: function(price)
        {
            ajk.log.trace('  Determining time cost of producing ' + price.val + ' ' + price.name);
            var productionData = jQuery.extend({}, price);

            var resource = gamePage.resPool.get(price.name);
            if (resource.unlocked)
            {
                var minTicks = Math.max(0, (price.val - resource.value) / resource.perTickCached);
                ajk.log.trace('    Default per-tick production will take ' + minTicks + ' ticks');
                productionData.method = 'PerTick';
                productionData.time = minTicks;
            }
            else
            {
                ajk.log.trace('    ' + price.name + ' is locked, perhaps we can craft it...');
                productionData.method = 'Locked';
                productionData.time = Infinity;
            }

            if (resource.craftable && resource.name != 'wood')
            {
                var numCraftsRequired = Math.ceil(price.val / (1 + gamePage.getResCraftRatio(price.name)));
                ajk.log.trace('    Craftable in ' + numCraftsRequired + ' crafts');

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
                    ajk.log.trace('    Crafting is more effective');
                    productionData.time = costData.time;
                    productionData.method = 'Craft';
                    productionData.craftAmount = numCraftsRequired;
                    productionData.dependencies = costData;
                }
            }
            var tradeData = ajk.trade.getTradeDataFor(price);
            if (tradeData != null)
            {
                ajk.log.trace('    Tradeable');
                var costData = this.analyzeCostProduction(tradeData.prices);
                if (costData.time < productionData.time)
                {
                    ajk.log.trace('    Trading is more effective');
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
            ajk.log.trace('Determining how to best produce ' + itemName + ' and how long it will take');
            var costData = this.analyzeCostProduction(item.controller.getPrices(item.model));
            var modifier = Math.log(costData.time + 1);
            ajk.log.debug('It will be ' + costData.time + ' ticks until there are enough resources for ' + itemName + ' (modifier ' + modifier + ')');
            this.modifyWeight(itemName, modifier);
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

                if (!this.data.hasOwnProperty(itemName))
                {
                    this.data[itemName] = {};
                }
                this.data[itemName].item = items[i];
                this.data[itemName].missingMaxResources = false;

                if (mData.hasOwnProperty('effects'))
                {
                    var overConsumption = false;
                    for (var effectKey in mData.effects)
                    {
                        if (!ajk.cache.consumptionEffects.hasOwnProperty(effectKey)) { continue; }
                        var consumedResource = ajk.cache.consumptionEffects[effectKey];
                        if (ajk.resources.getProductionOf(consumedResource) - mData.effects[effectKey] <= 0)
                        {
                            ajk.log.detail('Production of ' + consumedResource + ' does not meet the requirements for another ' + itemName);
                            overConsumption = true;
                            outputDemand[consumedResource] = true;
                        }
                    }
                    if (overConsumption)
                    {
                        this.data[itemName].missingMaxResources = true;
                        continue;
                    }
                }

                this.adjustItemPriceRatio(items[i]);

                if (!mData.hasOwnProperty('val'))
                {
                    // Favor one-shots
                    ajk.log.debug('Prioritizing ' + itemName + ' as a one-shot');
                    this.modifyWeight(itemName, this.oneShotModifier, true);
                }

                var missingMaxResources = false;
                var prices = items[i].controller.getPrices(items[i].model);
                for (var j = 0; j < prices.length; ++j)
                {
                    var resource = gamePage.resPool.get(prices[j].name);
                    if (!ajk.resources.available(prices[j].name))
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

        providesUnrequestedProduction: function(item)
        {
            if (!item.model.hasOwnProperty('metadata') || !item.model.metadata.hasOwnProperty('effects')) { return null; }
            for (var effectName in item.model.metadata.effects)
            {
                if (ajk.cache.productionResources.hasOwnProperty(effectName))
                {
                    var resource = ajk.cache.productionResources[effectName];
                    if (ajk.resources.nontangible.hasOwnProperty(resource)) { continue; }
                    if (!ajk.resources.previouslyInDemand(resource))
                    {
                        // TODO - Figure out via observation what this does to energy production problems
                        return resource;
                    }
                }
            }
            return null;
        },

        consumes: function(item, resource)
        {

            if (!item.model.hasOwnProperty('metadata') || !item.model.metadata.hasOwnProperty('effects')) { return false; }
            for (var effectName in item.model.metadata.effects)
            {
                if (ajk.cache.consumptionEffects.hasOwnProperty(effectName) && ajk.cache.consumptionEffects[effectName] == resource) { return true; }
            }
            return false;
        },

        analyzeResults: function()
        {
            for (var itemKey in this.data)
            {
                // If this item increases the storage capacity of a resource that's lacking in capacity, increase its priority
                if (!this.data[itemKey].hasOwnProperty('item')) { continue; }
                var item = this.data[itemKey].item;

                var prioritized = false;

                for (var resource in this.capacityDemand)
                {
                    if (this.providesStorageFor(item, resource))
                    {
                        ajk.log.debug('Increasing the priority of ' + itemKey + ' based on capacity demand for ' + resource);
                        this.modifyWeight(itemKey, this.capacityDemandModifier, true);
                        prioritized = true;
                        break;
                    }
                }

                for (var resource in ajk.resources.previousDemand)
                {
                    if (this.providesProductionFor(item, resource))
                    {
                        // If this item produces a resource that was previously in demand, increase its priority
                        ajk.log.debug('Increasing the priority of ' + itemKey + ' based on previous demand for ' + resource);
                        this.modifyWeight(itemKey, this.demandModifier, true);
                        prioritized = true;
                        break;
                    }
                    else if (this.consumes(item, resource))
                    {
                        // If this item consumes a resource that was previously in demand, decrease its priority
                        ajk.log.debug('Decreasing the priority of ' + itemKey + ' based on previous demand for ' + resource);
                        this.modifyWeight(itemKey, this.consumptionDemandModifier, true);
                        break;
                    }
                }

                // If this item produces a resource that's lacking in output, increase its priority
                for (var resource in this.outputDemand)
                {
                    if (this.providesProductionFor(item, resource))
                    {
                        ajk.log.debug('Increasing the priority of ' + itemKey + ' based on output demand for ' + resource);
                        this.modifyWeight(itemKey, this.productionDemandModifier, true);
                        prioritized = true;
                    }
                }

                // If this item was previously prioritized, increase its priority
                for (var i = 0; i < this.previousPriority.length; ++i)
                {
                    if (itemKey == this.previousPriority[i])
                    {
                        ajk.log.debug('Increasing the priority of ' + itemKey + ' based on previous priority');
                        this.modifyWeight(itemKey, this.reinforcementModifier, true);
                        break;
                    }
                }


                if (ajk.resources.complexityOfPreviousDemand() > 0 && !prioritized)
                {
                    // If this item produces a resource that was not previously in demand, decrease its priority
                    var redundantProduction = this.providesUnrequestedProduction(item);
                    if (redundantProduction != null)
                    {
                        ajk.log.debug('Decreasing the priority of ' + itemKey + ' based on unrequested resource production of ' + redundantProduction);
                        this.modifyWeight(itemKey, this.redundancyModifier, true);
                    }
                }
            }

            // Organize the items in terms of priority
            for (var itemKey in this.data)
            {
                if (!this.data[itemKey].hasOwnProperty('item')) { continue; }

                var inserted = false;
                for (var i = 0; i < this.priorityList.length; ++i)
                {
                    if (this.data[itemKey].weight < this.data[this.priorityList[i]].weight)
                    {
                        this.priorityList.splice(i, 0, itemKey);
                        inserted = true;
                        break;
                    }
                }
                if (!inserted) { this.priorityList.push(itemKey); }
            }

            // Account for exploration costs
            if (this.shouldExplore)
            {
                ajk.log.detail('Accounting for catpower demand for exploration');
                ajk.resources.accumulateSimpleDemand('manpower', 1000);
            }

            // TODO - Include analysis for tradepost weight based on demand for traded products

            // Filter the priority list and build up the table of resource requirements
            for (var i = 0; i < this.priorityList.length; ++i)
            {
                if (this.data[this.priorityList[i]].missingMaxResources)
                {
                    ajk.log.trace('Filtered out ' + this.priorityList[i] + ' due to max resource capacity');
                    continue;
                }

                var costData = this.data[this.priorityList[i]].costData;
                if (!ajk.resources.hasCompetition(costData))
                {
                    ajk.log.trace('Added ' + this.priorityList[i] + ' to list of filtered items');
                    this.filteredPriorityList.push(this.priorityList[i]);
                    ajk.resources.accumulateDemand(costData);
                }
                else
                {
                    ajk.log.trace('Filtered out ' + this.priorityList[i] + ' due to resource competition');
                }
            }
        },
    },

    core:
    {
        bonfireTab: gamePage.tabs[0],
        scienceTab: gamePage.tabs[2],
        workshopTab: gamePage.tabs[3],

        successes: 0,

        init: function()
        {
            ajk.cache.init();
        },

        analyze: function()
        {
            ajk.analysis.reset();
            ajk.analysis.preanalysis();

            ajk.analysis.analyzeItems(ajk.customItems.get());

            ajk.ui.switchToTab('Bonfire');
            ajk.analysis.analyzeItems(this.bonfireTab.buttons);

            ajk.ui.switchToTab('Sciene');
            if (this.scienceTab.visible)
            {
                ajk.analysis.analyzeItems(this.scienceTab.buttons);
            }

            ajk.ui.switchToTab('Workshop');
            if (this.workshopTab.visible)
            {
                ajk.analysis.analyzeItems(this.workshopTab.buttons);
            }

            ajk.analysis.analyzeResults();
            ajk.ui.switchToTab(null);
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
            if (ajk.analysis.shouldExplore)
            {
                ajk.ui.switchToTab('Trade');
                var explore = gamePage.diplomacyTab.exploreBtn;
                if (explore.controller.hasResources(explore.model))
                {
                    ajk.log.debug('Attempting to discover new race');
                    if (!ajk.simulate)
                    {
                        explore.controller.buyItem(explore.model, {}, function(result) {
                            if (result)
                            {
                                ajk.log.info('Unlocked new race');
                            }
                            else
                            {
                                ajk.log.info('Failed to unlock new race');
                            }
                            // TODO - Figure out why this function is called twice with different arguments every time we try to discover a new race
                            ajk.log.debugQueue.push(result);
                        });
                    }
                }
                else
                {
                    ajk.log.debug('Waiting on catpower for exploration');
                }
                ajk.ui.switchToTab(null);
            }

            for (var i = 0; i < ajk.analysis.filteredPriorityList.length; ++i)
            {
                var priority = ajk.analysis.filteredPriorityList[i];
                ajk.log.debug('Attempting to act on ' + priority + ' (weight ' + ajk.analysis.data[priority].weight + ')');

                var costData = ajk.analysis.data[priority].costData;
                if (this.operateOnCostData(costData))
                {
                    ajk.log.detail('Cost operations succeeded, acting');
                    var itemData = ajk.analysis.data[priority];
                    if (itemData.item.controller.hasResources(itemData.item.model))
                    {
                        this.successes += 1;
                        if (!ajk.simulate)
                        {
                            itemData.item.controller.buyItem(itemData.item.model, {}, function(result) {
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
            this.successes = 0;
            this.analyze();
            this.operateOnPriority();
            ajk.resources.convert();
            ajk.ui.refreshTables();
            if (this.successes > 0 && ajk.log.detailedLogsOnSuccess)
            {
                var previousLogLevel = ajk.log.logLevel;
                ajk.log.logLevel = ajk.log.detailLevel;
                ajk.log.flush();
                ajk.log.logLevel = previousLogLevel;
            }
            else
            {
                ajk.log.flush();
            }
            var t1 = performance.now();
            ajk.log.debug('Tick executed in ' + (t1 - t0) + ' ms');
        }
    },

    jobs:
    {
        reprioritize: function()
        {

        }
    },

    ui:
    {
        previousTab: null,

        refreshPriorityTable: function()
        {
            var container = $('#priorityTable');
            container.empty();
            for (var i = 0; i < ajk.analysis.filteredPriorityList.length; ++i)
            {
                var itemKey = ajk.analysis.filteredPriorityList[i];
                var itemWeight = ajk.analysis.data[itemKey].weight;
                container.append('<tr><td>' + itemKey + '</td><td style="text-align:right">' + itemWeight.toFixed(2) + '</td></tr>');
            }
        },

        refreshResourceDemandTable: function()
        {
            var container = $('#resourceDemandTable');
            container.empty();
            for (var resource in ajk.resources.demand)
            {
                container.append('<tr><td>' + resource + '</td><td style="text-align:right">' + ajk.resources.demand[resource].toFixed(2) + '</td></tr>');
            }
        },

        refreshFullPriorityTable: function()
        {
            var container = $('#fullPriorityTable');
            container.empty();
            for (var i = 0; i < ajk.analysis.priorityList.length; ++i)
            {
                var itemKey = ajk.analysis.priorityList[i];
                var itemData = ajk.analysis.data[itemKey];

                var appendData = '<tr>';
                appendData += '<td><span class="' + (itemData.missingMaxResources ? 'limited' : '') + '">' + itemKey + '</span></td>';
                appendData += '<td style="text-align:right">' + itemData.weight.toFixed(2) + '</td>';
                if (itemData.adjustment != 0)
                {
                    appendData += '<td style="text-align:right"><span style="color:' + (itemData.adjustment > 0 ? 'red' : 'green') + '">' + itemData.adjustment + '</span></td>';
                }
                appendData += '</tr>';
                container.append(appendData);
            }
        },

        refreshTables: function()
        {
            this.refreshPriorityTable();
            this.refreshResourceDemandTable();
            this.refreshFullPriorityTable();
        },

        switchToTab: function(tabName)
        {
            if (tabName == null && this.previousTab != null)
            {
                tabName = this.previousTab;
                this.previousTab = null;
            }
            else if (this.previousTab == null && tabName != null)
            {
                this.previousTab = gamePage.ui.activeTabId;
            }
            else if (this.previousTab == null && tabName == null)
            {
                ajk.log.warn('No previous tab to switch to');
                return;
            }

            if (tabName == gamePage.ui.activeTabId) { return; }

            gamePage.ui.activeTabId = tabName;
            gamePage.render();
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
    <label for="logLevelSelect">Log Level</label>
    <select id="logLevelSelect" onchange="ajk.log.updateLevel()">
        <option value="0">Info</option>
        <option value="1">Warn</option>
        <option value="2">Debug</option>
        <option value="3">Detail</option>
        <option value="4">Trace</option>
    </select>
    <br/>
    <input id="detailSuccessToggle" type="checkbox" onclick="ajk.log.detailedLogsOnSuccess = $('#detailSuccessToggle')[0].checked;">
    <label for="detailSuccessToggle">Detailed Output On Success</label>
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
    <br/>
    <div id="container">
        <b>Resource Demand</b>
        <br/>
        <table id="resourceDemandTable"/>
    </div>
    <br/>
    <div id="container">
        <b>Full Priority List</b>
        <br/>
        <table id="fullPriorityTable"/>
    </div>
</div>
`;

$("#leftColumn").append(ajkMenu);
$("#simulateToggle")[0].checked = ajk.simulate;
$("#detailSuccessToggle")[0].checked = ajk.log.detailedLogsOnSuccess;
$("#logLevelSelect")[0].value = ajk.log.logLevel;