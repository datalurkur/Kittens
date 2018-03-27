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
        warnLevel:   0,
        infoLevel:   1,
        debugLevel:  2,
        detailLevel: 3,
        traceLevel:  4,

        logLevel:    1,

        indentLevel: 0,

        detailedLogsOnSuccess: false,
        detailedLogsOnError: true,

        debugQueue: [],

        logQueue: [],

        logInternal: function(message, level)
        {
            this.logQueue.push(['  '.repeat(this.indentLevel) + message, level]);
        },

        indent: function()   { this.indentLevel += 1; },
        unindent: function() { this.indentLevel -= 1; },

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
            ajk.shouldTick(false);
            this.logInternal(message, this.errorLevel);
            if (this.detailedLogsOnError)
            {
                this.flush(true);
            }
        },

        updateLevel: function()
        {
            var newValue = parseInt($('#logLevelSelect')[0].value);
            this.logLevel = newValue;
        }
    },

    timer:
    {
        start: function(title)
        {
            return {
                title: title,
                timestamps: [
                    ['Start', performance.now()]
                ],
                longestLabel: 0
            };
        },

        interval: function(data, label)
        {
            data.timestamps.push([label, performance.now()]);
            data.longestLabel = Math.max(data.longestLabel, label.length);
        },

        end: function(data, label)
        {
            this.interval(data, label);

            ajk.log.debug(data.title);
            ajk.log.indent();
            for (var i = 1; i < data.timestamps.length; ++i)
            {
                var delta = data.timestamps[i][1] - data.timestamps[i - 1][1];
                ajk.log.debug(data.timestamps[i][0].padEnd(data.longestLabel) + delta.toFixed(1).padStart(8) + ' ms');
            }
            ajk.log.unindent();
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
                        if (!table.itemMap.hasOwnProperty(resource))
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

                ajk.log.debug('Rebuilding effect tables');

                for (var i = 0; i < gamePage.bld.buildingsData.length; ++i)
                {
                    var bldData = gamePage.bld.get(gamePage.bld.buildingsData[i].name);
                    var effects = bldData.effects;
                    if (bldData.hasOwnProperty('stage'))
                    {
                        effects = bldData.stages[bldData.stage].effects;
                    }
                    for (var effectName in effects)
                    {
                        if (effects[effectName] == 0)
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

        getConsumersOfResource: function(resourceName)
        {
            if (!this.internal.consumption.itemMap.hasOwnProperty(resourceName)) { return []; }
            return this.internal.consumption.itemMap[resourceName];
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

        isProducerOf: function(itemKey, resourceName)
        {
            var producers = this.getProducersOfResource(resourceName);
            for (var i = 0; i < producers.length; ++i)
            {
                if (producers[i] == itemKey)
                {
                    return true;
                }
            }
            return false;
        },

        isConsumerOf: function(itemKey, resourceName)
        {
            var consumers = this.getConsumersOfResource(resourceName);
            for (var i = 0; i < consumers.length; ++i)
            {
                if (consumers[i] == itemKey)
                {
                    return true;
                }
            }
            return false;
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

            var metadata = jQuery.extend({}, gamePage.workshop.getCraft('ship'));
            metadata.val = gamePage.resPool.get('ship').value;

            var itemData = {
                controller:
                {
                    getPrices: function()
                    {
                        return gamePage.workshop.getCraft('ship').prices;
                    },
                    hasResources: function()
                    {
                        return (gamePage.workshop.getCraftAllCount('ship') > 0);
                    },
                    buyItem: function()
                    {
                        if (!ajk.simulate)
                        {
                            ajk.workshop.craft('ship', 1);
                        }
                    }
                },
                model:
                {
                    metadata: metadata
                },
                update: function() {}
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

            var numTradesRequired = Math.ceil(price.val / raceAmount);
            var prices = [];
            for (var i = 0; i < chosenRace.buys.length; ++i)
            {
                prices.push({
                    name: chosenRace.buys[i].name,
                    val: chosenRace.buys[i].val * numTradesRequired
                });
            }
            var requiredManpower = numTradesRequired * 50;
            var requiredGold = numTradesRequired * 15;
            prices.push({
                name: 'manpower',
                val: requiredManpower,
            });
            prices.push({
                name: 'gold',
                val: requiredGold,
            });

            ajk.log.detail(price.name + ' can be acquired from ' + chosenRace.name + ' in ' + numTradesRequired + ' trades, at a cost of ' + requiredManpower + ' catpower and ' + requiredGold + ' gold');

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
            if (allowedCrafts == 0) { return false; }
            if (typeof crafts === 'undefined' || allowedCrafts < crafts)
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
                    if (!gamePage.workshop.craft(resource, crafts))
                    {
                        ajk.log.warn('Failed to craft ' + crafts + ' ' + resource);
                    }
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

        huntingData:
        {
            allowHunting: false,
            avgHuntsPerTick: 0,
            expectedPerTick: {},
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

        analyzeResourceProduction: function(price)
        {
            ajk.log.indent();
            ajk.log.trace('Determining time cost of producing ' + price.val + ' ' + price.name);
            var productionData = jQuery.extend({}, price);

            var resource = gamePage.resPool.get(price.name);
            if (resource.unlocked)
            {
                var minTicks = Math.max(0, (price.val - resource.value) / resource.perTickCached);
                ajk.log.trace('Default per-tick production will take ' + minTicks + ' ticks');
                productionData.method = 'PerTick';
                productionData.time = minTicks;
            }
            else
            {
                ajk.log.trace(price.name + ' is locked, perhaps we can craft it...');
                productionData.method = 'Locked';
                productionData.time = Infinity;
            }

            if (this.huntingData.allowHunting && (resource.name == 'furs' || resource.name == 'ivory'))
            {
                var perTick = this.huntingData.expectedPerTick[resource.name];
                var avgTicks = price.val / (perTick + resource.perTickCached);
                ajk.log.trace('Per-tick production augmented with expected hunting results will take ' + avgTicks + ' ticks');
                productionData.method = 'PerTickPlusHunting';
                productionData.time = avgTicks;
                var catpowerCost = {
                    time: avgTicks,
                    prices: [{
                        method: 'PerTick',
                        time: avgTicks,
                        name: 'manpower',
                        val: avgTicks / (this.huntingData.avgHuntsPerTick * 100)
                    }]
                };
                productionData.dependencies = catpowerCost;
            }

            if (resource.craftable && resource.name != 'wood')
            {
                var numCraftsRequired = Math.ceil(price.val / (1 + gamePage.getResCraftRatio(price.name)));
                ajk.log.trace('Craftable in ' + numCraftsRequired + ' crafts');

                var craftPrices = gamePage.workshop.getCraft(price.name).prices;
                var modifiedCraftPrices = [];
                for (var i = 0; i < craftPrices.length; ++i)
                {
                    modifiedCraftPrices.push({
                        name: craftPrices[i].name,
                        val: craftPrices[i].val * numCraftsRequired
                    });
                }

                var costData = this.analyzeCostProduction(modifiedCraftPrices);
                if (costData.time < productionData.time)
                {
                    ajk.log.trace('Crafting is more effective');
                    productionData.time = costData.time;
                    productionData.method = 'Craft';
                    productionData.craftAmount = numCraftsRequired;
                    productionData.dependencies = costData;
                }
            }

            if (resource.name != 'catnip')
            {
                var tradeData = ajk.trade.getTradeDataFor(price);
                if (tradeData != null)
                {
                    ajk.log.trace('Tradeable');
                    var costData = this.analyzeCostProduction(tradeData.prices);
                    if (costData.time < productionData.time)
                    {
                        ajk.log.trace('Trading is more effective');
                        productionData.time = costData.time;
                        productionData.method = 'Trade';
                        productionData.tradeRace = tradeData.race;
                        productionData.trades = tradeData.trades;
                        productionData.dependencies = costData;
                    }
                }
            }
            ajk.log.unindent();
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

        getFlatCostList: function(costData)
        {
            var prices = [];
            for (var i = 0; i < costData.prices.length; ++i)
            {
                if (costData.prices[i].hasOwnProperty('dependencies'))
                {
                    prices = prices.concat(this.getFlatCostList(costData.prices[i].dependencies));
                }
                else
                {
                    prices.push(costData.prices[i]);
                }
            }
            return prices;
        },

        getBottlenecksFor: function(costData)
        {
            var bottlenecks = [];
            var flatList = this.getFlatCostList(costData);
            for (var i = 0; i < flatList.length; ++i)
            {
                if (flatList[i].time == 0) { continue; }
                var emplaced = false;
                for (var j = 0; j < bottlenecks.length; ++j)
                {
                    if (flatList[i].time > bottlenecks[j].time)
                    {
                        bottlenecks.splice(j, 0, flatList[i]);
                        emplaced = true;
                        break;
                    }
                }
                if (!emplaced)
                {
                    bottlenecks.push(flatList[i]);
                }
            }
            return bottlenecks;
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

            this.huntingData.allowHunting = gamePage.village.getJob('hunter').unlocked;
            this.huntingData.expectedPerTick = {};
            var avgHuntsPerTick = gamePage.resPool.get('manpower').perTickCached / 100;
            var hunterRatio = gamePage.getEffect('hunterRatio') + 1;

            var expectedFursPerHunt = 39.5 + ((65 * (hunterRatio - 1)) / 2);
            this.huntingData.expectedPerTick['furs'] = expectedFursPerHunt * avgHuntsPerTick;

            var ivoryChance = (44 + (2 * hunterRatio)) / 100;
            var ivoryAmount = 24.5 + ((40 * (hunterRatio - 1)) / 2);
            this.huntingData.expectedPerTick['ivory'] = ivoryChance * ivoryAmount * avgHuntsPerTick;

            this.huntingData.avgHuntsPerTick = avgHuntsPerTick;
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
                        ajk.workshop.craft(craft.name, numCrafts);
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
                ajk.workshop.craft('parchment');
            }
            if (!ajk.simulate && !this.inDemand('parchment') && !this.inDemand('culture'))
            {
                ajk.workshop.craft('manuscript');
            }
            if (!ajk.simulate && this.inDemand('manuscript') && !this.inDemand('science'))
            {
                ajk.workshop.craft('compedium');
            }
        }
    },

    adjustment:
    {
        reinforceTopPriority:
        {
            topModifier: -5,
            bottleneckModifier: -2,

            topPriority: null,
            bottlenecks: null,

            prepare: function()
            {
                this.topPriority = null;
                this.bottlenecks = null;

                ajk.log.debug('Prioritizing items based on the previous top priority');
                if (ajk.analysis.previousPriority.length > 0)
                {
                    if (ajk.analysis.data.hasOwnProperty(ajk.analysis.previousPriority[0]))
                    {
                        this.topPriority = ajk.analysis.previousPriority[0];
                        this.bottlenecks = ajk.resources.getBottlenecksFor(ajk.analysis.data[this.topPriority].costData);
                        ajk.log.debug('Production of ' + this.topPriority + ' is bottlenecked on ' + this.bottlenecks.length + ' resources');
                    }
                    else
                    {
                        ajk.log.debug('Previous priority was met, skipping reinforcement');
                    }
                }
            },
            modifyItem: function(itemKey)
            {
                if (this.topPriority == null) { return; }
                if (itemKey == this.topPriority)
                {
                    ajk.log.debug('Increasing weight of ' + itemKey + ' to reinforce the previous top priority');
                    ajk.analysis.modifyWeight(itemKey, this.topModifier, 'previous priority');
                    return;
                }

                var currentMod = this.bottleneckModifier;
                for (var i = 0; i < this.bottlenecks.length; ++i)
                {
                    if (ajk.cache.isProducerOf(this.bottlenecks[i].name))
                    {
                        ajk.log.debug('Increasing weight of ' + itemKey + ' by ' + currentMod + ' based on production of a bottlenecked resource (' + this.bottlenecks[i].name + ')');
                    }
                    currentMod = currentMod / 2;
                }
            },
        },

        weightedDemandScaling:
        {
            modWeight: 0.5,

            weightedDemand: {},

            prepare: function()
            {
                ajk.log.debug('Prioritizing items based on weight-adjusted demand');
                this.weightedDemand = ajk.resources.getWeightedDemand(ajk.resources.previousDemand);
            },
            modifyItem: function(itemKey)
            {
                for (var resource in this.weightedDemand)
                {
                    var mod = this.weightedDemand[resource] * this.modWeight;

                    // Catnip production really shouldn't drive weights too heavily
                    if (resource == 'catnip') { mod = mod * 0.1; }

                    if (ajk.cache.isProducerOf(itemKey, resource))
                    {
                        ajk.log.debug('Increasing weight of ' + itemKey + ' by ' + mod + ' based on the demand for ' + resource);
                        ajk.analysis.modifyWeight(itemKey, mod, 'production of ' + resource);
                    }
                    else if (ajk.cache.isConsumerOf(itemKey, resource))
                    {
                        ajk.log.debug('Decreasing weight of ' + itemKey + ' by ' + mod + ' based on the demand for ' + resource);
                        ajk.analysis.modifyWeight(itemKey, -mod, 'consumption of ' + resource);
                    }
                }
            }
        },

        tabDiscovery:
        {
            priorityWeight: -5,

            priorityList: [],

            prepare: function()
            {
                if (!ajk.core.scienceTab.visible)
                {
                    this.priorityList = ['library'];
                }
                else if (!ajk.core.workshopTab.visible)
                {
                    this.priorityList = [
                        'calendar',
                        'agriculture',
                        'mining',
                        'workshop'
                    ];
                }
                else if (!ajk.core.religionTab.visible)
                {
                    this.priorityList = [
                        'archery',
                        'animal',
                        'construction',
                        'engineering',
                        'writing',
                        'philosophy',
                        'temple'
                    ];
                }
                else if (!ajk.core.spaceTab.visible)
                {
                    this.priorityList = [
                        'theology',
                        'astronomy',
                        'navigation',
                        'physics',
                        'electricity',
                        'industrialization',
                        'mechanization',
                        'electronics',
                        'rocketry'
                    ];
                }
                else
                {
                    this.priorityList = [];
                }
            },
            modifyItem: function(itemKey)
            {
                for (var i = 0; i < this.priorityList.length; ++i)
                {
                    if (itemKey == this.priorityList[i])
                    {
                        ajk.log.debug('Priotizing ' + itemKey + ' in order to discover a new tab');
                        ajk.analysis.modifyWeight(itemKey, this.priorityWeight, 'tab discovery');
                    }
                }
            }
        },

        tradingModule:
        {
            tradePenalty: 1,
            tradeProductionBonusBase: -2,

            tradeBottleneckRatio: 0,
            tradeProductionBonus: 0,

            hasTradeBottleneck: function(costData)
            {
                var mostExpensive = 0;
                for (var i = 1; i < costData.prices.length; ++i)
                {
                    if (costData.prices[i].time > costData.prices[mostExpensive])
                    {
                        mostExpensive = i;
                    }
                }
                var exp = costData.prices[mostExpensive];
                if (exp.method == 'Trade') { return true; }
                else if (exp.hasOwnProperty('dependencies'))
                {
                    return this.hasTradeBottleneck(exp.dependencies);
                }
                else
                {
                    return false;
                }
            },
            prepare: function()
            {
                var pp = ajk.analysis.previousPriority;
                if (pp.length == 0)
                {
                    this.tradeBottleneckRatio = 0;
                    this.tradeProductionBonus = 0;
                    return;
                }

                var numTradeBottlenecks = 0;
                for (var i = 0; i < pp.length; ++i)
                {
                    var ppData = ajk.analysis.data[pp[i]];
                    if (typeof ppData === 'undefined')
                    {
                        continue;
                    }
                    if (this.hasTradeBottleneck(ajk.analysis.data[pp[i]].costData))
                    {
                        numTradeBottlenecks += 1;
                    }
                }
                ajk.log.debug('Found ' + numTradeBottlenecks + ' / ' + pp.length + ' items are bottlenecked on trading');
                this.tradeBottleneckRatio = (numTradeBottlenecks / pp.length);
                this.tradeProductionBonus = this.tradeBottleneckRatio * this.tradeProductionBonusBase;
            },
            modifyItem: function(itemKey)
            {
                var costData = ajk.analysis.data[itemKey].costData;

                // Apply an across-the board penalty for any item that it primarily bottlenecked by a resource that is being traded for
                if (this.hasTradeBottleneck(costData))
                {
                    ajk.log.detail('Penalizing ' + itemKey + ' because it uses trading to fulfill its resource costs');
                    ajk.analysis.modifyWeight(itemKey, this.tradePenalty, 'uses trading');
                }
                else if (ajk.cache.isProducerOf(itemKey, 'trade'))
                {
                    ajk.log.detail('Prioritizing ' + itemKey + ' because it provides trade bonuses');
                    ajk.analysis.modifyWeight(itemKey, this.tradeProductionBonus, 'boosts trade');
                }
            }
        },

        priceRatioModule:
        {
            priceModifier: 0.5,

            // TODO - Modify this to take into account kitten job movement
            prepare: function() {},
            modifyItem: function(itemKey)
            {
                var costData = ajk.analysis.data[itemKey].costData;
                if (typeof costData === 'undefined') { ajk.log.warn('No cost data found for ' + itemKey); }
                var modifier = Math.log(ajk.analysis.data[itemKey].costData.time + 1) * this.priceModifier;
                ajk.analysis.modifyWeight(itemKey, modifier, null);

            },
        }
    },

    analysis:
    {
        oneShotModifier: -7,
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
            'geodesy': -10,
            'oxidation': -5,
        },

        previousPriority: [],

        weightAdjustments: function()
        {
            return [
                ajk.adjustment.priceRatioModule,
                ajk.adjustment.reinforceTopPriority,
                ajk.adjustment.weightedDemandScaling,
                ajk.adjustment.tabDiscovery,
                ajk.adjustment.tradingModule,
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
                this.data[itemName].adjustments = [];
            }
            this.data[itemName].weight += modifier;
            if (adjustment != null)
            {
                this.data[itemName].adjustments.push([adjustment, modifier]);
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
                        this.modifyWeight(explorationRequirement[i], this.explorationModifier, 'exploration requirements');
                    }
                }
                else
                {
                    ajk.log.detail('New races are available for discovery');
                    this.shouldExplore = true;
                }
            }
        },


        analyzeItems: function(items)
        {
            for (var i = 0; i < items.length; ++i)
            {
                if (!items[i].model.hasOwnProperty('metadata')) { continue; }

                var mData = items[i].model.metadata;
                var itemKey = mData.name;
                if (!mData.unlocked) { continue; }
                if (mData.hasOwnProperty('researched') && mData.researched) { continue; }

                var itemPrices = items[i].controller.getPrices(items[i].model);
                ajk.log.trace('Determining how to best produce ' + itemKey + ' and how long it will take');
                var costData = ajk.resources.analyzeCostProduction(itemPrices);
                ajk.log.detail('It will be ' + costData.time + ' ticks until there are enough resources for ' + itemKey);

                if (!this.data.hasOwnProperty(itemKey))
                {
                    this.data[itemKey] = {};
                }
                this.data[itemKey].item = items[i];
                this.data[itemKey].missingMaxResources = false;
                this.data[itemKey].costData = costData;

                if (mData.hasOwnProperty('effects'))
                {
                    var overConsumption = false;
                    for (var effectKey in mData.effects)
                    {
                        if (mData.effects[effectKey] == 0) { continue; }
                        var consumedResource = ajk.cache.getResourceConsumedByEffect(effectKey);
                        if (consumedResource == null) { continue; }
                        if (ajk.resources.getProductionOf(consumedResource) - mData.effects[effectKey] <= 0)
                        {
                            ajk.log.detail('Production of ' + consumedResource + ' does not meet the requirements for another ' + itemKey);
                            overConsumption = true;
                            this.outputDemand[consumedResource] = true;
                        }
                    }
                    if (overConsumption)
                    {
                        this.data[itemKey].missingMaxResources = true;
                        continue;
                    }
                }

                if (!mData.hasOwnProperty('val'))
                {
                    // Favor one-shots
                    ajk.log.debug('Prioritizing ' + itemKey + ' as a one-shot');
                    this.modifyWeight(itemKey, this.oneShotModifier, 'one-shot');
                }

                var missingMaxResources = false;
                for (var j = 0; j < itemPrices.length; ++j)
                {
                    var resource = gamePage.resPool.get(itemPrices[j].name);
                    if (!ajk.resources.available(itemPrices[j].name))
                    {
                        missingMaxResources = true;
                    }
                    else if (resource.maxValue != 0 && resource.maxValue < itemPrices[j].val)
                    {
                        ajk.log.detail('Max ' + resource.name + ' lacking to produce ' + itemKey);
                        missingMaxResources = true;
                        this.capacityDemand[itemPrices[j].name] = true;
                    }
                }
                if (missingMaxResources)
                {
                    this.data[itemKey].missingMaxResources = true;
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
        },

        postAnalysisPass: function()
        {
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
        religionTab: gamePage.tabs[5],
        spaceTab: gamePage.tabs[6],

        internal:
        {
            successes: 0,
            explorationSuccess: false,

            analyze: function()
            {
                ajk.analysis.reset();
                ajk.analysis.preanalysis();

                ajk.analysis.analyzeItems(ajk.customItems.get());

                ajk.ui.switchToTab('Bonfire');
                ajk.analysis.analyzeItems(ajk.core.bonfireTab.buttons);

                ajk.ui.switchToTab('Sciene');
                if (ajk.core.scienceTab.visible)
                {
                    ajk.analysis.analyzeItems(ajk.core.scienceTab.buttons);
                }

                ajk.ui.switchToTab('Workshop');
                if (ajk.core.workshopTab.visible)
                {
                    ajk.analysis.analyzeItems(ajk.core.workshopTab.buttons);
                }

                ajk.analysis.analyzeResults();
                ajk.analysis.postAnalysisPass();
                ajk.ui.switchToTab(null);
            },

            operateOnCostData: function(costData)
            {
                ajk.log.indent();
                var allSucceeded = true;
                for (var j = costData.prices.length - 1; j >= 0; --j)
                {
                    var price = costData.prices[j];
                    ajk.log.detail('Operating on cost data of ' + price.name);
                    if (price.hasOwnProperty('dependencies'))
                    {
                        ajk.log.trace('Diving into dependencies');
                        allSucceeded &= this.operateOnCostData(costData.prices[j].dependencies);
                    }
                    if (price.method == 'Trade')
                    {
                         if (ajk.trade.tradeWith(price.tradeRace, price.trades))
                         {
                            var requirementMet = (gamePage.resPool.get(price.name).value >= price.amount);
                            if (!requirementMet)
                            {
                                ajk.log.debug('Trading failed to satisfy expected requirements');
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
                        else
                        {
                            ajk.log.trace('Sufficient quantity exists (deficit: ' + deficit + ')');
                        }
                        allSucceeded &= sufficient;
                    }
                }
                ajk.log.unindent();
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
                                    // This is sort of a hack, but fuck if I know why this gets called twice on success with both true and false
                                    this.explorationSuccess = true;
                                }
                                else if (!this.explorationSuccess)
                                {
                                    ajk.log.error('Failed to unlock new race');
                                    this.explorationSuccess = false;
                                }
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
                                        ajk.log.info('Purchased ' + priority);
                                    }
                                    else
                                    {
                                        ajk.log.error('Failed to purchase ' + priority);
                                    }
                                });
                            }
                        }
                        else if (!ajk.simulate)
                        {
                            ajk.log.error('Item has insufficient resources, even after operating on costs successfully');
                        }
                    }
                }
            },

            unsafeTick: function()
            {
                var timerData = ajk.timer.start('Overall Tick Execution');
                this.successes = 0;

                ajk.cache.init();
                ajk.timer.interval(timerData, 'Cache Initialization');

                this.analyze();
                ajk.timer.interval(timerData, 'Analysis');

                this.operateOnPriority();
                ajk.timer.interval(timerData, 'Priority Operations');

                ajk.resources.convert();
                ajk.timer.interval(timerData, 'Resource Conversion');

                ajk.ui.refreshTables();
                ajk.timer.interval(timerData, 'UI');

                ajk.jobs.assignFreeKittens();
                ajk.timer.end(timerData, 'Job Assignment');
            },
        },

        tick: function()
        {
            var timestamp = new Date();
            ajk.log.debug('Starting tick at ' + timestamp.toUTCString());
            try
            {
                this.internal.unsafeTick();
            }
            catch (e)
            {
                ajk.log.error('Error encountered during tick\n' + e.stack);
            }
            ajk.log.flush(this.successes > 0 && ajk.log.detailedLogsOnSuccess);
        },

        simulateTick: function()
        {
            ajk.log.info('Simulating tick');
            var pSimulate = ajk.simulate;
            ajk.simulate = true;
            this.tick();
            ajk.simulate = pSimulate;
        },
    },

    jobs:
    {
        internal:
        {
            assign: function(jobName)
            {
                if (!gamePage.village.getJob(jobName).unlocked) { return false; }
                if (!ajk.simulate)
                {
                    ajk.log.debug('Kitten assigned to be a ' + jobName);
                    gamePage.village.assignJob(gamePage.village.getJob(jobName));
                }
                return true;
            }
        },

        reprioritize: function()
        {

        },

        assignFreeKittens: function()
        {
            // This is a stopgap until I have actual reassignment
            var free = gamePage.village.getFreeKittens();
            if (free == 0) { return; }

            // If catnip production is dipping, this cat is a farmer
            if (gamePage.resPool.get('catnip').perTickCached <= 0)
            {
                this.internal.assign('farmer');
                return;
            }

            var highestPri = ajk.analysis.filteredPriorityList[0];
            if (typeof highestPri === 'undefined' || !ajk.analysis.data.hasOwnProperty(highestPri))
            {
                ajk.log.debug('Waiting to assign kitten to a job pending a clear priority');
                return;
            }

            var bottlenecks = ajk.resources.getBottlenecksFor(ajk.analysis.data[highestPri].costData);
            if (bottlenecks.length == 0)
            {
                ajk.log.debug('Waiting to assign kitten to a job pending a clear priority');
                return;
            }

            var bottleneck = bottlenecks[0].name;
            if (bottleneck == 'minerals' && this.internal.assign('miner')) { return; }
            if (bottleneck == 'wood' && this.internal.assign('woodcutter')) { return; }
            if (bottleneck == 'science' && this.internal.assign('scholar')) { return; }
            if ((bottleneck == 'manpower' || bottleneck == 'furs' || bottleneck == 'ivory' || bottleneck == 'spice') && this.internal.assign('hunter')) { return; }
            if ((bottleneck == 'coal' || bottleneck == 'gold') && this.internal.assign('geologist')) { return ;}
            if (this.internal.assign('priest')) { return; }

            ajk.log.debug('Bottleneck ' + bottleneck + ' demands no job that is mapped');
        }
    },

    ui:
    {
        previousTab: null,

        internal:
        {
            style: `
                <style id="ajkStyle">
                    .accordion
                    {
                        border: none;
                        outline: none;

                        color: white;
                        background: none;

                        text-transform: capitalize;
                        text-align:left;
                        font-weight: bold;
                        font-size: 20px;
                        font-family: 'Times New Roman', Times, serif;

                        padding-top: 10px;
                    }
                    .inlineAccordion
                    {
                        border: none;
                        outline: none;

                        color: white;
                        background: none;

                        text-align:left;
                        font-family: 'Times New Roman', Times, serif;
                        font-size: 14px;

                        padding: 0px;
                        margin: 0px;
                        width: 100%;
                    }
                    .accordion:hover
                    {
                        color: red;
                    }
                    .inlineAccordion:hover
                    {
                        background-color: rgb(64, 64, 64);
                    }
                    .accordionPanel
                    {
                        padding-left: 5px;
                        font-size: 14px;
                    }
                    .ajkTable
                    {
                        font-family: 'Times New Roman', Times, serif;
                        font-size: 14px;
                        width: 100%;
                        border-spacing: 0px;
                    }
                    .ajkTable tbody tr td
                    {

                    }
                    .ajkTable tbody tr:nth-child(odd) td
                    {
                        background: rgb(16, 16, 16);
                    }
                    span.ajkAdjustment
                    {
                        margin-left: 5px;
                        margin-right: 5px;
                        width: 50px;
                        float: left;
                        text-align: right;
                    }
                    span.ajkDisabled
                    {
                        color: rgb(64, 64, 64);
                    }
                    span.ajkAdjustment.positive
                    {
                        color: rgb(64, 256, 64);
                    }
                    span.ajkAdjustment.negative
                    {
                        color: rgb(256, 64, 64);
                    }
                </style>`,

            scriptControlContent: `
                <input id="simulateToggle" type="checkbox" onclick="ajk.simulate = $('#simulateToggle')[0].checked;">
                <label for="simulateToggle">Simulate</label>
                <br/>
                <input id="tickToggle" type="checkbox" onclick="ajk.shouldTick($('#tickToggle')[0].checked);">
                <label for="tickToggle">Ticking</label>
                <br/>
                <label for="logLevelSelect">Log Level</label>
                <select id="logLevelSelect" onchange="ajk.log.updateLevel()">
                    <option value="-1">Errors Only</option>
                    <option value="0">Errors and Warnings</option>
                    <option value="1">Info</option>
                    <option value="2">Debug</option>
                    <option value="3">Detail</option>
                    <option value="4">Trace</option>
                </select>
                <br/>
                <input id="detailSuccessToggle" type="checkbox" onclick="ajk.log.detailedLogsOnSuccess = $('#detailSuccessToggle')[0].checked;">
                <label for="detailSuccessToggle">Detailed Output On Success</label>
                <br/>
                <input id="detailErrorToggle" type="checkbox" onclick="ajk.log.detailedLogsOnError = $('#detailErrorToggle')[0].checked;">
                <label for="detailErrorToggle">Detailed Output On Errors</label>
                <br/>`,

            backupContent: `
                <input id="backupToggle" type="checkbox" onclick="ajk.backup.shouldDoBackup($('#backupToggle')[0].checked);">
                <label for="backupToggle">Perform Backups</label>
                <br/>
                <input type="button" id="signin-button" value="Sign In" onclick="ajk.backup.handleSignInClick();" style="width:100px">
                <input type="button" id="signout-button" value="Sign Out" onclick="ajk.backup.handleSignOutClick();" style="width:100px">
                <br/>`,

            panelState: {},

            togglePanel: function(panel)
            {
                var collapsed = (panel.style.display == 'none');
                panel.style.display = (collapsed ? 'block' : 'none');
                this.panelState[panel.id] = !collapsed;
            },

            createCollapsiblePanel: function(parent, id, title, content, isInline, startCollapsed)
            {
                var panelId = id + 'Panel';
                if (this.panelState.hasOwnProperty(panelId))
                {
                    startCollapsed = this.panelState[panelId];;
                }
                var classHeader = (isInline ? 'inlineAccordion' : 'accordion');
                var html = '';
                html += '<button class="' + classHeader + '" id="' + id + 'Button" onclick="ajk.ui.internal.togglePanel($(\'#' + panelId + '\')[0]);">' + title + '</button><br/>';
                html += '<div class="' + classHeader + 'Panel" id="' + panelId + '" style="display:' + (startCollapsed ? 'none' : 'block') + '">';
                html += content;
                html += '</div>';
                parent.append(html);
            },

            convertTicksToTimeString: function(ticks)
            {
                if (ticks == 0) { return 'now'; }
                if (ticks == Infinity) { return 'forever'; }
                var timeLeft = Math.ceil(ticks / 5);
                var timeString = '';

                var seconds = Math.floor(timeLeft % 60);
                timeLeft = Math.floor(timeLeft / 60);
                timeString += ('0' + seconds).slice(-2) + 's';

                if (timeLeft > 0)
                {
                    var minutes = Math.floor(timeLeft % 60);
                    timeLeft = Math.floor(timeLeft / 60);
                    timeString = ('0' + minutes).slice(-2) + 'm ' + timeString;

                    if (timeLeft > 0)
                    {
                        var hours = Math.floor(timeLeft % 24);
                        timeLeft = Math.floor(timeLeft / 24);
                        timeString = ('0' + hours).slice(-2) + 'h ' + timeString;

                        if (timeLeft > 0)
                        {
                            var days = Math.floor(timeLeft);
                            timeString = ('0' + days).slice(-2) + 'd ' + timeString;
                        }
                    }
                }

                return timeString;
            },

            convertAmountToShortString: function(amount)
            {
                // kilo, mega, giga, tera, peta, exa, zetta, yotta
                var postFixes = ['', 'k', 'M', 'P', 'T', 'P', 'E', 'Z', 'Y'];
                index = 0;
                while (amount > 1000 && index < postFixes.length - 1)
                {
                    amount /= 1000;
                    index += 1;
                }
                var amountString = (index == 0) ? Math.ceil(amount) : amount.toFixed(2);
                return amountString + postFixes[index];
            },

            convertCostDataToIndentedTable: function(costData, indent)
            {
                if (typeof indent === 'undefined')
                {
                    indent = 1;
                }

                var string = '';
                for (var i = 0; i < costData.prices.length; ++i)
                {
                    var price = costData.prices[i];
                    var methodString = 'Wait for';
                    if (price.method == 'Trade')
                    {
                        methodString = 'Trade for';
                    }
                    else if (price.method == 'Craft')
                    {
                        methodString = 'Craft';
                    }
                    var amountString = this.convertAmountToShortString(price.val);
                    var firstSpanString = methodString + ' ' + amountString + ' ' + price.name;
                    var timeString = this.convertTicksToTimeString(price.time);
                    string += '<span style="text-indent:' + (indent * 10) + 'px; display:inline-block">' + firstSpanString + '</span><span style="float:right">' + timeString + '</span><br/>';
                    if (price.hasOwnProperty('dependencies'))
                    {
                        string += this.convertCostDataToIndentedTable(price.dependencies, indent + 1);
                    }
                }
                return string;
            },

            refreshPriorityTable: function()
            {
                var container = $('#priorityTable');
                container.empty();
                for (var i = 0; i < ajk.analysis.filteredPriorityList.length; ++i)
                {
                    var itemKey = ajk.analysis.filteredPriorityList[i];
                    var itemWeight = ajk.analysis.data[itemKey].weight;

                    var costData = ajk.analysis.data[itemKey].costData;

                    var timeString = this.convertTicksToTimeString(costData.time);

                    var rowId = itemKey + 'Priority';
                    var containerId = rowId + 'Details';
                    var rowData = '<tr><td id="' + rowId + '"/></tr>';
                    container.append(rowData);

                    var rowTitle = '<span>' + itemKey + '</span><span style="float:right">' + timeString + '</span>';
                    var rowDetails = '<div style="color:rgb(128,128,128)">' + this.convertCostDataToIndentedTable(costData) + '</div>';

                    this.createCollapsiblePanel($('#' + rowId), containerId, rowTitle, rowDetails, true, true);
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

                    var rowId = itemKey + 'Detail';

                    var appendData = '<tr><td id="' + rowId + '"/></tr>';
                    container.append(appendData);
                    var tableRow = $('#'+ rowId);

                    var title = '<span class="' + (itemData.missingMaxResources ? 'limited' : '') + '">' + itemKey + '</span><span style="float:right;">' + itemData.weight.toFixed(2) + '</span>';
                    var content = '';
                    if (itemData.adjustments.length > 0)
                    {
                        for (var j = 0; j < itemData.adjustments.length; ++j)
                        {
                            var spanClass = '';
                            var adjData =itemData.adjustments[j];
                            if (adjData[1] > 0)
                            {
                                spanClass = ' negative';
                            }
                            else if (adjData[1] < 0)
                            {
                                spanClass = ' positive';
                            }
                            content += '<span class="ajkAdjustment' + spanClass + '">' + itemData.adjustments[j][1].toFixed(2) + '</span>';
                            content += '<span>' + itemData.adjustments[j][0] + '</span><br/>';
                        }
                    }
                    else
                    {
                        content = '<span class="ajkAdjustment"/><span class="ajkDisabled">No Adjustments</span>';
                    }
                    var hidden = (itemData.adjustments.length == 0);
                    this.createCollapsiblePanel(tableRow, 'ajk' + itemKey + 'Detail', title, content, true, hidden);
                }
            },
        },

        refreshTables: function()
        {
            this.internal.refreshPriorityTable();
            this.internal.refreshResourceDemandTable();
            this.internal.refreshFullPriorityTable();
        },

        clearExistingUI: function()
        {
            var ajkContainer = $("#ajkMenu");
            if (ajkContainer != null) { ajkContainer.remove(); }

            var ajkStyleContainer = $('#ajkStyle');
            if (ajkStyleContainer != null) { ajkStyleContainer.remove(); }
        },

        createUI: function()
        {
            this.clearExistingUI();

            $('head').append(this.internal.style);
            $('#leftColumn').append('<div id="ajkMenu"/>');

            var menu = $('#ajkMenu');
            this.internal.createCollapsiblePanel(menu, 'ajkScriptControl', 'Script Control', this.internal.scriptControlContent, false, false);
            this.internal.createCollapsiblePanel(menu, 'ajkBackup', 'Google Drive Backup', this.internal.backupContent, false, true);
            this.internal.createCollapsiblePanel(menu, 'ajkPriority', 'Priority Result', '<table id="priorityTable" class="ajkTable"/>', false, false);
            this.internal.createCollapsiblePanel(menu, 'ajkResources', 'Resource Demand', '<table id="resourceDemandTable" class="ajkTable"/>', false, true);
            this.internal.createCollapsiblePanel(menu, 'ajkPriorityDetail', 'Priority Detail', '<table id="fullPriorityTable" class="ajkTable"/>', false, false);

            $("#simulateToggle")[0].checked = ajk.simulate;
            $("#detailSuccessToggle")[0].checked = ajk.log.detailedLogsOnSuccess;
            $("#detailErrorToggle")[0].checked = ajk.log.detailedLogsOnError;
            $("#logLevelSelect")[0].value = ajk.log.logLevel;
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
            ajk.core.simulateTick();
            this.tickThread = setInterval(function() { ajk.core.tick(); }, this.tickFrequency * 1000);
        }

        $('#tickToggle')[0].checked = doTick;
    }
}

ajk.ui.createUI();
ajk.core.simulateTick();