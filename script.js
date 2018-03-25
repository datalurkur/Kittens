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
        errorLevel: -1,
        infoLevel:   0,
        warnLevel:   1,
        debugLevel:  2,
        detailLevel: 3,
        traceLevel:  4,

        logLevel:    1,

        detailedLogsOnSuccess: true,
        detailedLogsOnError: true,

        debugQueue: [],

        logQueue: [],

        logInternal: function(message, level)
        {
            this.logQueue.push([message, level]);
        },

        flush: function(ignoreLevel)
        {
            for (var i = 0; i < this.logQueue.length; ++i)
            {
                var message = this.logQueue[i][0];
                var level = this.logQueue[i][1];
                if (this.logLevel < level && !ignoreLevel) { continue; }
                console.log(message);
            }
            this.logQueue = [];
        },

        trace:  function(message) { this.logInternal(message, this.traceLevel);  },
        detail: function(message) { this.logInternal(message, this.detailLevel); },
        debug:  function(message) { this.logInternal(message, this.debugLevel);  },
        warn:   function(message) { this.logInternal(message, this.warnLevel);   },
        info:   function(message) { this.logInternal(message, this.infoLevel);   },
        error:  function(message)
        {
            if (this.detailedLogsOnError)
            {
                flush(true);
            }
            this.logInternal(message, this.errorLevel);
        },

        updateLevel: function()
        {
            var newValue = parseInt($('#logLevelSelect')[0].value);
            this.logLevel = newValue;
        }
    },

    cache:
    {
        internal:
        {
            consumption:
            {
                postfixes: [
                    'PerTickConsumption',
                    'PerTickCon',
                    'PerTick',
                    'Consumption',
                ],
                effectMap: {},
                resourceMap: {},
                itemMap: {}
            },
            production:
            {
                postfixes: [
                    'PerTickAutoprod',
                    'PerTickBase',
                    'PerTickProd',
                    'Production',
                    'DemandRatio',
                    'RatioGlobal',
                    'Ratio',
                ],
                effectMap: {},
                resourceMap: {},
                itemMap: {}
            },
            storage:
            {
                postfixes: [
                    'Max',
                ],
                effectMap: {},
                resourceMap: {},
                itemMap: {}
            },

            matchEffect: function(item, effect, table)
            {
                for (var i = 0; i < table.postfixes.length; ++i)
                {
                    var index = effect.indexOf(table.postfixes[i]);
                    if (index != -1)
                    {
                        var resource = effect.substring(0, index);

                        // Update effect map
                        table.effectMap[effect] = resource;

                        // Update item map
                        if (!table.itemMap.hasOwnProperty())
                        {
                            table.itemMap[resource] = [];
                        }
                        table.itemMap[resource].push(item);

                        // Update resource map
                        if (!table.resourceMap.hasOwnProperty(resource))
                        {
                            table.resourceMap[resource] = [];
                        }
                        var found = false;
                        for (var i = 0; i < table.resourceMap[resource].length; ++i)
                        {
                            if (table.resourceMap[resource][i] == effect)
                            {
                                found = true;
                                break;
                            }
                        }
                        if (!found)
                        {
                            table.resourceMap[resource].push(effect);
                        }

                        return true;
                    }
                }
                return false;
            },

            buildEffectTables: function()
            {
                this.consumption.effectMap = {};
                this.consumption.resourceMap = {};
                this.consumption.itemMap = {};

                this.production.effectMap = {};
                this.production.resourceMap = {};
                this.production.itemMap = {};

                this.storage.effectMap = {};
                this.storage.resourceMap = {};
                this.storage.itemMap = {};

                for (var i = 0; i < gamePage.bld.buildingsData.length; ++i)
                {
                    var bldData = gamePage.bld.buildingsData[i];
                    for (var effectName in bldData.effects)
                    {
                        if (bldData.effects[effectName] == 0)
                        {
                            ajk.log.detail('Ignoring effect ' + effectName + ' with zero-value for ' + bldData.name);
                        }
                        if (!this.matchEffect(bldData.name, effectName, this.production) &&
                            !this.matchEffect(bldData.name, effectName, this.consumption) &&
                            !this.matchEffect(bldData.name, effectName, this.storage))
                        {
                            ajk.log.detail('Found no matching effect definition for ' + effectName + ' in ' + bldData.name);
                        }
                    }
                }
            },
        },

        getResourceConsumedByEffect: function(effectName)
        {
            if (!this.internal.consumption.effectMap.hasOwnProperty(effectName)) { return null; }
            return this.internal.consumption.effectMap[effectName];
        },

        getResourceProducedByEffect: function(effectName)
        {
            if (!this.internal.production.effectMap.hasOwnProperty(effectName)) { return null; }
            return this.internal.production.effectMap[effectName];
        },

        getResourceStoredByEffect: function(effectName)
        {
            if (!this.internal.storage.effectMap.hasOwnProperty(effectName)) { return null; }
            return this.internal.storage.effectMap[effectName];
        },

        getProducersOfResource: function(resourceName)
        {
            if (!this.internal.production.itemMap.hasOwnProperty(resourceName)) { return []; }
            return this.internal.production.itemMap[resourceName];
        },

        getStorersOfResource: function(resourceName)
        {
            if (!this.internal.storage.itemMap.hasOwnProperty(resourceName)) { return []; }
            return this.internal.storage.itemMap[resourceName];
        },

        init: function()
        {
            this.internal.buildEffectTables();
        },
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
        explorationDemandWeight: 5,

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
                ajk.log.detail('Waiting on max catpower for race discovery');
                return ajk.cache.getStorersOfResource('manpower');
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
                        ajk.log.detail('Waiting on max culture to discover nagas');
                        return ajk.cache.getStorersOfResource('culture');
                    }
                    else if (culture.value < 1500)
                    {
                        ajk.log.detail('Waiting on culture to discover nagas');
                        ajk.resources.accumulateSimpleDemand('culture', 1500, this.explorationDemandWeight);
                        return ajk.cache.getProducersOfResource('culture');
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
                        ajk.log.detail('Waiting on max science to discover ' + race.name);
                        return ajk.cache.getStorersOfResource('science');
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

        getBottleneckFor: function(costData)
        {
            var highestCost = 0;
            for (var i = 1; i < costData.prices.length; ++i)
            {
                if (costData.prices[i].time > costData.prices[highestCost].time)
                {
                    highestCost = i;
                }
            }
            // TOOD - Finish this function
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

        accumulateSimpleDemand: function(resource, amount, weight)
        {
            if (!this.demand.hasOwnProperty(resource))
            {
                this.demand[resource] = {
                    amount: 0,
                    weights: [],
                };
            }
            this.demand[resource].amount += amount;
            this.demand[resource].weights.push([amount, weight]);
        },

        accumulateDemand: function(costData, weight)
        {
            for (var i = 0; i < costData.prices.length; ++i)
            {
                if (costData.prices[i].hasOwnProperty('dependencies'))
                {
                    this.accumulateDemand(costData.prices[i].dependencies, weight);
                }
                this.accumulateSimpleDemand(costData.prices[i].name, costData.prices[i].val, weight);
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

        getWeightedDemand: function(demand)
        {
            var weightedDemand = {};
            for (var resource in demand)
            {
                // The adjustment should take into account both the size of the demand as well as the weights of each component
                weightedDemand[resource] = 0;
                var weights = demand[resource].weights;
                ajk.log.trace('There are ' + weights.length + ' contributors to the demand for ' + resource);
                for (var i = 0; i < weights.length; ++i)
                {
                    var rawAmount = weights[i][0];
                    var rawWeight = weights[i][1];
                    var scaledAmount = Math.log(rawAmount + 1);
                    var scaledWeight = Math.max(-1, Math.min(0, (rawWeight - 10) / 20));
                    var contribution = scaledAmount * scaledWeight;
                    ajk.log.trace('Scaled raw amount and weight ' + rawAmount.toFixed(2) + ',' + rawWeight.toFixed(2) + ' to ' + contribution.toFixed(2) + '(' + scaledAmount.toFixed(2) + '*' + scaledWeight.toFixed(2) + ')');
                    weightedDemand[resource] += contribution;
                }
            }
            return weightedDemand;
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
            if (catPower.unlocked && catPower.value / catPower.maxValue >= this.conversionMaxRatio && !this.inDemand('manpower'))
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
            if (!ajk.simulate && !this.inDemand('parchment') && !this.inDemand('culture'))
            {
                gamePage.workshop.craftAll('manuscript');
            }
            if (!ajk.simulate && this.inDemand('manuscript') && !this.inDemand('science'))
            {
                gamePage.workshop.craftAll('compedium');
            }
        }
    },

    adjustment:
    {
        reinforceTopPriority:
        {
            topPriority: null,
            topModifier: -10,

            prepare: function()
            {
                ajk.log.debug('Prioritizing items based on the previous top priority');
                if (ajk.analysis.previousPriority.length == 0)
                {
                    this.topPriority = null;
                }
                else
                {
                    this.topPriority = ajk.analysis.previousPriority[0];
                }
            },
            modifyItem: function(itemKey, item)
            {
                if (itemKey == this.topPriority)
                {
                    ajk.log.debug('Increasing weight of ' + itemKey + ' to reinforce the previous top priority');
                    ajk.analysis.modifyWeight(itemKey, this.topModifier, true);
                    return;
                }

                // TODO - Reward other items based on bottlenecks and demands
            },
        },

        weightedDemandScaling:
        {
            weightedDemand: {},

            prepare: function()
            {
                ajk.log.debug('Prioritizing items based on weight-adjusted demand');
                this.weightedDemand = ajk.resources.getWeightedDemand(ajk.resources.previousDemand);
            },
            modifyItem: function(itemKey, item)
            {
            }
        }
    },

    analysis:
    {
        oneShotModifier: -10,
        explorationModifier: -5,

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

        weightAdjustments: function()
        {
            return [
                ajk.adjustment.reinforceTopPriority,
                ajk.adjustment.weightedDemandScaling,
            ];
        },

        modifyWeight: function(itemName, modifier, adjustment)
        {
            if (typeof modifier === 'undefined' || modifier == NaN)
            {
                ajk.log.error('Item weight being modified by a bad number');
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
                        var consumedResource = ajk.cache.getResourceConsumedByEffect(effectKey);
                        if (consumedResource == null) { continue; }
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

        analyzeResults: function()
        {
            // Adjust item weights
            var adjustments = this.weightAdjustments();
            for (var i = 0; i < adjustments.length; ++i)
            {
                adjustments[i].prepare();
                for (var itemKey in this.data)
                {
                    if (!this.data[itemKey].hasOwnProperty('item')) { continue; }
                    adjustments[i].modifyItem(itemKey, this.data[itemKey].item);
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
                ajk.resources.accumulateSimpleDemand('manpower', 1000, ajk.trade.explorationDemandWeight);
            }

            // TODO - Include analysis for tradepost weight based on demand for traded products

            // Filter the priority list and build up the table of resource requirements
            for (var i = 0; i < this.priorityList.length; ++i)
            {
                var itemData = this.data[this.priorityList[i]];
                if (itemData.missingMaxResources)
                {
                    ajk.log.trace('Filtered out ' + this.priorityList[i] + ' due to max resource capacity');
                    continue;
                }

                if (!ajk.resources.hasCompetition(itemData.costData))
                {
                    ajk.log.trace('Added ' + this.priorityList[i] + ' to list of filtered items');
                    this.filteredPriorityList.push(this.priorityList[i]);
                    ajk.resources.accumulateDemand(itemData.costData, itemData.weight);
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
                        ajk.log.error('Item has insufficient resources, even after operating on costs successfully');
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

            ajk.cache.init();
            this.analyze();
            this.operateOnPriority();
            ajk.resources.convert();
            ajk.ui.refreshTables();
            ajk.log.flush(this.successes > 0 && ajk.log.detailedLogsOnSuccess);

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
                container.append('<tr><td>' + resource + '</td><td style="text-align:right">' + ajk.resources.demand[resource].amount.toFixed(2) + '</td></tr>');
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