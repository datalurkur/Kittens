if (typeof ajk !== 'undefined')
{
    ajk.core.shouldTick(false);
    ajk.backup.shouldPerformBackup(false);
}

ajk = {
    simulate: false,
};

ajk.log = {
    detailedLogsOnSuccess: false,
    detailedLogsOnError: true,

    logLevel: 1,

    internal:
    {
        errorLevel: -1,
        warnLevel:   0,
        infoLevel:   1,
        debugLevel:  2,
        detailLevel: 3,
        traceLevel:  4,

        channels: {},
        channelMask: -1,
        currentChannel: 1,
        channelNameLength: 0,

        indentLevel: 0,

        debugQueue: [],
        logQueue: [],

        logInternal: function(message, level, channel)
        {
            this.logQueue.push(['  '.repeat(this.indentLevel) + message, level, channel]);
        },
    },

    toggleChannel: function(channelName, isOn)
    {
        var channelMask = this.internal.channels[channelName];
        if (isOn)
        {
            this.internal.channelMask |= channelMask;
        }
        else
        {
            this.internal.channelMask &= (~channelMask);
        }
    },

    toggleAllChannels: function(areOn)
    {
        this.internal.channelMask = (areOn) ? -1 : 0;
    },

    channelActive: function(channelName)
    {
        var mask = this.internal.channels[channelName];
        return (this.internal.channelMask & mask) != 0;
    },

    updateLevel: function()
    {
        var newValue = parseInt($('#logLevelSelect')[0].value);
        this.logLevel = newValue;
    },

    flush: function(ignoreLevel)
    {
        for (var i = 0; i < this.internal.logQueue.length; ++i)
        {
            var message = this.internal.logQueue[i][0];
            var level   = this.internal.logQueue[i][1];
            var channel = this.internal.logQueue[i][2];
            if (!ignoreLevel && this.logLevel < level) { continue; }
            if (!ignoreLevel && channel != undefined && !this.channelActive(channel)) { continue; }
            console.log('[' + channel.padStart(this.internal.channelNameLength) + ':' + level + '] ' + message);
        }
        this.internal.logQueue = [];
    },

    addChannel: function(channelName, active)
    {
        this.internal.channelNameLength = Math.max(this.internal.channelNameLength, channelName.length);
        this.internal.channels[channelName] = this.internal.currentChannel;
        if (!active)
        {
            this.internal.channelMask &= (~this.internal.currentChannel);
        }
        this.internal.currentChannel = this.internal.currentChannel << 1;

        return {
            channel: channelName,
            trace:  function(message) { ajk.log.internal.logInternal(message, ajk.log.internal.traceLevel,  this.channel); },
            detail: function(message) { ajk.log.internal.logInternal(message, ajk.log.internal.detailLevel, this.channel); },
            debug:  function(message) { ajk.log.internal.logInternal(message, ajk.log.internal.debugLevel,  this.channel); },
            warn:   function(message) { ajk.log.internal.logInternal(message, ajk.log.internal.warnLevel,   this.channel); },
            info:   function(message) { ajk.log.internal.logInternal(message, ajk.log.internal.infoLevel,   this.channel); },
            error:  function(message)
            {
                ajk.log.internal.logInternal(message, ajk.log.internal.errorLevel, this.channel);
                if (ajk.log.detailedLogsOnError)
                {
                    ajk.core.shouldTick(false);
                    ajk.log.flush(true);
                }
            },
            indent:   function() { ajk.log.internal.indentLevel += 1; },
            unindent: function() { ajk.log.internal.indentLevel -= 1; },
        };
    }
};

ajk.backup = {
    log: ajk.log.addChannel('backup', true),

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
        this.log.info('Backing up export string every ' + this.frequncy + ' hours');
        this.thread = setInterval(function() { ajk.backup.backupExportString(); }, this.frequency * 60 * 60 * 1000);
    },

    init: function()
    {
        if (this.gapiKey == null || this.gapiClientId == null)
        {
            this.log.warn('Google API key and client ID must be set up before backup will occur');
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
            this.log.info('You are signed in as ' + response.result.names[0].givenName);
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

        this.log.debug('Performing backup...');
        if (!gapi.auth2.getAuthInstance().isSignedIn.get())
        {
            this.log.warn('Not signed into google drive - can\'t backup export string');
            return;
        }
        if (!this.gapiReady)
        {
            this.log.warn('Google drive API not loaded - can\'t backup export string');
            return;
        }

        if (ajk.simulate) { return; }

        this.log.info('Bailing early for testing reasons');

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
                this.log.debug('Created backup');
            }, function(error) {
                this.log.warn('Failed to create backup file');
                return;
            });
        }
        this.log.debug('Updating backup file with data');
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
            this.log.debug('Updated backup file');
        }, function(error) {
            this.log.warn('Failed to update backup file');
        });
    }
};

ajk.timer = {
    log: ajk.log.addChannel('perf', true),

    start: function(title)
    {
        return {
            log: this.log,

            title: title,
            timestamps: [
                ['Start', performance.now()]
            ],
            longestLabel: 0,

            interval: function(label)
            {
                this.timestamps.push([label, performance.now()]);
                this.longestLabel = Math.max(this.longestLabel, label.length);
            },

            end: function(label)
            {
                this.interval(label);

                this.log.debug(this.title);
                this.log.indent();
                for (var i = 1; i < this.timestamps.length; ++i)
                {
                    var delta = this.timestamps[i][1] - this.timestamps[i - 1][1];
                    this.log.debug(this.timestamps[i][0].padEnd(this.longestLabel) + delta.toFixed(1).padStart(8) + ' ms');
                }
                this.log.unindent();
            }
        };
    },
};

ajk.cache = {
    internal:
    {
        log: ajk.log.addChannel('cache', false),
        dirty: true,
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
            if (!this.dirty) { return ;}

            this.consumption.effectMap = {};
            this.consumption.resourceMap = {};
            this.consumption.itemMap = {};

            this.production.effectMap = {};
            this.production.resourceMap = {};
            this.production.itemMap = {};

            this.storage.effectMap = {};
            this.storage.resourceMap = {};
            this.storage.itemMap = {};

            this.log.debug('Rebuilding effect tables');

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
                        this.log.detail('Ignoring effect ' + effectName + ' with zero-value for ' + bldData.name);
                        continue;
                    }
                    if (!this.matchEffect(bldData.name, effectName, this.production) &&
                        !this.matchEffect(bldData.name, effectName, this.consumption) &&
                        !this.matchEffect(bldData.name, effectName, this.storage))
                    {
                        this.log.detail('Found no matching effect definition for ' + effectName + ' in ' + bldData.name);
                    }
                }
            }

            this.dirty = false;
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

    isStorerOf: function(itemKey, resourceName)
    {
        var storers = this.getStorersOfResource(resourceName);
        for (var i = 0; i < storers.length; ++i)
        {
            if (storers[i] == itemKey)
            {
                return true;
            }
        }
        return false;
    },

    dirty: function()
    {
        this.internal.dirty = true;
    },

    init: function()
    {
        this.internal.buildEffectTables();
    },
};

ajk.customItems = {
    initialized: false,
    items: [],

    tradeShip: function()
    {
        ajk.ui.switchToTab('Workshop');

        var craftdata = gamePage.workshop.getCraft('ship');

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
                metadata:
                {
                    name: 'tradeShip_custom',
                    val: 0
                }
            },
            update: function()
            {
                this.model.metadata.val = gamePage.resPool.get('ship').value;
            }
        };
        ajk.ui.switchToTab(null);
        return itemData;
    },

    // TODO - Add barge

    cache: function()
    {
        this.items.push(this.tradeShip());
    },

    get: function()
    {
        if (!this.initialized)
        {
            this.cache();
            this.initialized = true;
        }
        for (var i = 0; i < this.items.length; ++i)
        {
            this.items[i].update();
        }
        return this.items;
    }
};

ajk.trade = {
    log: ajk.log.addChannel('trade', true),
    explorationDemandWeight: 5,

    availableViaTrade: function(resourceName)
    {
        for (var i = 0; i < gamePage.diplomacy.races.length; ++i)
        {
            var race = gamePage.diplomacy.races[i];
            if (!race.unlocked) { continue; }
            for (var j = 0; j < race.sells.length; ++j)
            {
                if (race.sells[j].name == resourceName)
                {
                    return true;
                }
            }
        }
        return false;
    },

    getTradeAmountFor: function(raceName, resourceName)
    {
        // TODO - Check the accuracy of this
        if (raceName == 'zebras' && resourceName == 'titanium')
        {
            // Special rules for this
            var numShips = gamePage.resPool.get('ship').value;
            var amount = (0.03 * numShips) + 1.5;
            var chance = ((0.35 * numShips) + 15) / 100;
            return chance * amount;
        }

        var race = gamePage.diplomacy.get(raceName);
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

        return saleData.value * (1 + gamePage.diplomacy.getTradeRatio()) * (saleData.chance / 100) * seasonModifier;
    },

    getTradeDataFor(resource)
    {
        var data = [];
        for (var i = 0; i < gamePage.diplomacy.races.length; ++i)
        {
            var race = gamePage.diplomacy.races[i];
            if (!race.unlocked) { continue; }
            for (var j = 0; j < race.sells.length; ++j)
            {
                if (race.sells[j].name == resource)
                {
                    var tradeAmount = this.getTradeAmountFor(race.name, resource);
                    this.log.trace('Expect ' + tradeAmount + ' ' + resource + ' per trade with ' + race.name);
                    data.push([race, tradeAmount]);
                }
            }
        }
        return data;
    },

    explorationRequirement: function()
    {
        if (gamePage.resPool.get('manpower').maxValue < 1000)
        {
            this.log.detail('Waiting on max catpower for race discovery');
            return ajk.cache.getStorersOfResource('manpower');
        }
        for (var i = 0; i < gamePage.diplomacy.races.length; ++i)
        {
            var race = gamePage.diplomacy.races[i];
            if (race.unlocked || race.name == 'leviathans') { continue; }
            if (race.name == 'lizards' || race.name == 'griffins' || race.name == 'sharks')
            {
                if ((gamePage.prestige.getPerk('diplomacy').researched && gamePage.calendar.year >= 1) ||
                    (gamePage.resPool.get('karma').value > 0 && gamePage.calendar.year >= 5) ||
                    (gamePage.calendar.year >= 20))
                {
                    this.log.detail(race.name + ' are available for discovery');
                    return [];
                }
                else
                {
                    this.log.detail('Waiting on time to pass to discover ' + race.name);
                    return null;
                }
            }
            else if (race.name == 'nagas')
            {
                var culture = gamePage.resPool.get('culture');
                if (culture.maxValue < 1500)
                {
                    this.log.detail('Waiting on max culture to discover nagas');
                    return ajk.cache.getStorersOfResource('culture');
                }
                else if (culture.value < 1500)
                {
                    this.log.detail('Waiting on culture to discover nagas');
                    // TODO - Fix this
                    //ajk.resources.accumulateSimpleDemand('culture', 1500, this.explorationDemandWeight);
                    return ajk.cache.getProducersOfResource('culture');
                }
                else
                {
                    this.log.detail(race.name + ' are available for discovery');
                    return [];
                }
            }
            else if (race.name == 'zebras')
            {
                if (gamePage.resPool.get('ship').value > 0)
                {
                    this.log.detail(race.name + ' are available for discovery');
                    return [];
                }
                else
                {
                    this.log.detail('Waiting on trade ships to discover ' + race.name);
                    return ['ship'];
                }
            }
            else if (race.name == 'spiders')
            {
                if (gamePage.resPool.get('ship').value < 100)
                {
                    this.log.detail('Waiting on trade ships to discover ' + race.name);
                    return ['ship'];
                }
                else if (gamePage.resPool.get('science').maxValue < 125000)
                {
                    this.log.detail('Waiting on max science to discover ' + race.name);
                    return ajk.cache.getStorersOfResource('science');
                }
                else
                {
                    this.log.detail(race.name + ' are available for discovery');
                    return [];
                }
            }
            else if (race.name == 'dragons')
            {
                if (gamePage.science.get('nuclearFission').researched)
                {
                    this.log.detail(race.name + ' are available for discovery');
                    return [];
                }
                else
                {
                    this.log.detail('Waiting on nuclear fission to discover ' + race.name);
                    return ['nuclearFission'];
                }
            }
            else if (race.name == 'leviathans')
            {
                if (gamePage.religion.getZU('blackPyramid').val == 0)
                {
                    this.log.detail('Waiting on black pyramids for the appearance of ' + race.name);
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
            this.log.detail('Trading as many times with ' + race.name + ' as possible (' + allowedTrades + '/' + trades + ')');
            if (!ajk.simulate)
            {
                gamePage.diplomacy.tradeAll(race);
            }
            return false;
        }
        else
        {
            this.log.detail('Trading ' + trades + ' times with ' + race.name);
            if (!ajk.simulate)
            {
                gamePage.diplomacy.tradeMultiple(race, trades);
            }
            return true;
        }
    }
};

ajk.workshop = {
    log: ajk.log.addChannel('workshop', true),
    craft: function(resource, crafts)
    {
        var allowedCrafts = gamePage.workshop.getCraftAllCount(resource);
        if (allowedCrafts == 0) { return false; }
        if (crafts == undefined || allowedCrafts < crafts)
        {
            this.log.detail('Crafting as many ' + resource + 's as possible (' + allowedCrafts + '/' + crafts + ')');
            if (!ajk.simulate)
            {
                gamePage.workshop.craftAll(resource);
            }
            return false;
        }
        else
        {
            this.log.detail('Crafting ' + crafts + ' ' + resource);
            if (!ajk.simulate)
            {
                if (!gamePage.workshop.craft(resource, crafts))
                {
                    this.log.warn('Failed to craft ' + crafts + ' ' + resource);
                }
            }
            return true;
        }
    }
};

ajk.costData = {
    // Cost data is a layered process
    // 1) Determine the various pathways for acquiring resources
    // 2) Determine the time cost of acquiring resources, building a table of resources used along the way (unique to a given item - does not reflect global resource usage)
    // 3) Collect a flat list of missing resources, accumulating the amount needed for each one
    // 4) Determine the total cost in time

    buildResourceCache: function()
    {
        var cache = {
            available: {},
            lacking:   {},
            waitTime:  {},
            buffer:    {},
            reset: function()
            {
                for (var resource in this.waitTime)
                {
                    this.waitTime[resource] = 0;
                    this.lacking[resource] = 0;
                }
            }
        };
        for (var i = 0; i < gamePage.resPool.resources.length; ++i)
        {
            var res = gamePage.resPool.resources[i];
            var buffer = ajk.resources.getBuffer(res.name);
            var bufferNeeded = buffer - res.value;
            var available = res.value;
            if (bufferNeeded < 0 && buffer > 0)
            {
                this.internal.log.detail('Reserving a buffer of ' + buffer + ' ' + res.name);
                bufferNeeded = 0;
                available -= buffer;
            }
            else if (buffer > 0)
            {
                this.internal.log.detail('Current quantity of ' + res.name + ' does not satisfy buffer requirements');
            }
            cache.buffer[res.name]    = bufferNeeded;
            cache.available[res.name] = Math.max(0, res.value - buffer);
            cache.lacking[res.name]   = 0;
            cache.waitTime[res.name]  = 0;
        }
        return cache;
    },

    internal:
    {
        log: ajk.log.addChannel('costdata', true),

        buildSparseData: function(resource, value)
        {
            this.log.detail('Building sparse data for ' + value + ' ' + resource);
            this.log.indent();

            var rData = gamePage.resPool.get(resource);
            var data = {
                log: this.log,

                // Basic Info
                resourceName: resource,
                price:        value,
                multiplier:   1,
                time:         Infinity,
                options:      [],
                consumed:     0,
                deficit:      0,
                decision:     null,

                fullPrice: function()
                {
                    return this.price * this.multiplier;
                },

                consume: function(cache, recursive)
                {
                    this.log.detail('Consuming resources for ' + this.resourceName);
                    this.log.indent();
                    var net = cache.available[this.resourceName] - this.fullPrice();
                    if (net < 0)
                    {
                        this.deficit = -net;
                        this.consumed = cache.available[this.resourceName];
                        cache.available[this.resourceName] = 0;
                        this.log.trace('Consumed all available ' + this.resourceName + ' (' + this.consumed.toFixed(2) + ') - ' + this.deficit.toFixed(2) + ' remains');
                    }
                    else
                    {
                        this.deficit = 0;
                        this.consumed = this.fullPrice();
                        cache.available[this.resourceName] -= this.consumed;
                        this.log.trace('Consumed ' + this.consumed.toFixed(2) + ' ' + this.resourceName);
                    }

                    if (recursive && this.decision != null)
                    {
                        this.log.trace('Consuming dependent resources');
                        this.decision.consume(cache, recursive);
                    }
                    this.log.unindent();
                },

                refund: function(cache, recursive)
                {
                    this.log.detail('Refunding resources for ' + this.resourceName);
                    this.log.indent();
                    if (recursive && this.decision != null)
                    {
                        this.log.trace('Refunding dependent resources for ' + this.resourceName);
                        this.decision.refund(cache, recursive);
                    }

                    this.log.trace('Refunded ' + this.consumed + ' ' + this.resourceName);
                    cache.available[this.resourceName] += this.consumed;
                    this.consumed = 0;
                    this.deficit  = 0;
                    this.log.unindent();
                },
            };

            if (rData.craftable)
            {
                this.log.detail('Data includes crafting option');
                var cData = gamePage.workshop.getCraft(resource);
                data.options.push(this.buildSparseDependencies('craft', gamePage.workshop.getCraft(resource).prices, [], 1 + gamePage.getCraftRatio(), null));
            }

            // Don't trade for catnip
            if (resource != 'catnip')
            {
                var tradeData = ajk.trade.getTradeDataFor(resource);
                for (var i = 0; i < tradeData.length; ++i)
                {
                    this.log.detail('Adding trade option with ' + tradeData[i][0].name);
                    data.options.push(this.buildSparseDependencies('trade', tradeData[i][0].buys, [['gold', 15], ['manpower', 50]], tradeData[i][1], tradeData[i][0]));
                }
            }

            this.log.unindent();
            return data;
        },

        buildSparseDependencies: function(method, basePrices, extraPrices, expectedMultiplier, extraData)
        {
            var priceData = [];
            for (var i = 0; i < basePrices.length; ++i)
            {
                priceData.push(this.buildSparseData(basePrices[i].name, basePrices[i].val));
            }
            for (var i = 0; i < extraPrices.length; ++i)
            {
                priceData.push(this.buildSparseData(extraPrices[i][0], extraPrices[i][1]));
            }
            return {
                method:             method,
                dependencies:       priceData,
                expectedMultiplier: expectedMultiplier,
                numRequired:        0,
                extraData:          extraData,
                consume: function(cache, recursive)
                {
                    for (var i = 0; i < this.dependencies.length; ++i)
                    {
                        this.dependencies[i].consume(cache, recursive);
                    }
                },
                refund: function(cache, recursive)
                {
                    for (var i = 0; i < this.dependencies.length; ++i)
                    {
                        this.dependencies[i].refund(cache, recursive);
                    }
                },
            };
        },

        populateTimeData: function(data, resourceCache)
        {
            this.log.detail('Populating time data for ' + data.fullPrice().toFixed(2) + ' ' + data.resourceName);
            this.log.indent();

            // Default decision is to wait and do nothing
            data.decision = null;
            data.consume(resourceCache, false);

            // If the resource needs are already met, no decision be made here
            if (data.deficit == 0)
            {
                this.log.detail('Enough resources exist to satisfy the requirement');
                data.time = 0;
                return;
            }
            else
            {
                this.log.detail('Additional ' + data.deficit + ' required');
            }

            // Determine the time for this resource to become available with no action taken
            var baseTime = data.deficit / ajk.resources.getProductionOf(data.resourceName);
            if (baseTime < 0) { baseTime = Infinity; }
            data.time = baseTime;
            this.log.detail('Base wait time is ' + baseTime);

            // Examine each option to see if it takes less time than just waiting
            for (var i = 0; i < data.options.length; ++i)
            {
                var opt = data.options[i];
                this.populateTimeDependencyData(data.deficit, opt, resourceCache);
                if (opt.time < data.time)
                {
                    this.log.detail('Selected option as the new least expensive');
                    data.time = opt.time;
                    data.decision = opt;
                }
            }

            if (data.decision != null)
            {
                data.decision.consume(resourceCache, true);
            }
            else if (data.options.length > 0)
            {
                this.log.detail('No option was selected');
            }

            this.log.unindent();
        },

        populateTimeDependencyData(deficit, option, resourceCache)
        {
            var maxTime = 0;
            option.numRequired = Math.ceil(deficit / option.expectedMultiplier);
            this.log.detail('Considering option of ' + option.method + ' with ' + option.numRequired + ' actions required');
            this.log.indent();

            for (var j = 0; j < option.dependencies.length; ++j)
            {
                var dep = option.dependencies[j];
                dep.multiplier = option.numRequired;
                this.populateTimeData(dep, resourceCache)
                maxTime = Math.max(maxTime, dep.time);
            }

            option.refund(resourceCache, true);
            option.time = maxTime;
            this.log.unindent();
        },

        populateFlatList: function(data, resourceCache)
        {
            for (var i = 0; i < data.dependencies.length; ++i)
            {
                var dep = data.dependencies[i];
                this.log.detail('Checking dependency ' + dep.resourceName + ' for resource requirements');
                this.log.indent();
                if (dep.decision != null)
                {
                    this.populateFlatList(dep.decision, resourceCache);
                }
                else if (dep.deficit > 0)
                {
                    this.log.detail('Adding ' + dep.deficit + ' ' + dep.resourceName + ' to the list of in-demand resources');
                    resourceCache.lacking[dep.resourceName] += dep.deficit;
                }
                this.log.unindent();
            }
        },

        computeResults: function(data, resourceCache)
        {
            var maxTime = 0;
            var bottlenecks = [];
            for (var resource in resourceCache.lacking)
            {
                var lacking = resourceCache.lacking[resource];
                if (lacking > 0)
                {
                    if (resourceCache.buffer[resource] > 0)
                    {
                        this.log.detail('Adding ' + resourceCache.buffer[resource] + ' to cost to account for missing ' + resource + ' buffer');
                        lacking += resourceCache.buffer[resource];
                    }
                    var resProduction = ajk.resources.getProductionOf(resource);
                    var thisTime = lacking / resProduction;
                    resourceCache.waitTime[resource] = thisTime;

                    var emplaced = false;
                    for (var i = 0; i < bottlenecks.length; ++i)
                    {
                        if (thisTime > bottlenecks[i][1])
                        {
                            bottlenecks.splice(i, 0, [resource, thisTime]);
                            emplaced = true;
                            break;
                        }
                    }
                    if (!emplaced)
                    {
                        bottlenecks.push([resource, thisTime]);
                    }

                    this.log.detail('It will take ' + thisTime.toFixed(2) + ' ticks to produce ' + lacking.toFixed(2) + ' ' + resource + ' at a rate of ' + resProduction.toFixed(2) + ' per tick');
                    maxTime = Math.max(maxTime, thisTime);
                }
            }

            data.flatTime    = maxTime;
            data.bottlenecks = bottlenecks;

            resourceCache.reset();
        },
    },

    isSlowedBy: function(data, resource, amount)
    {

    },

    build: function(item, resourceCache)
    {
        var timerData = ajk.timer.start('Cost Data Contruction');

        var data = this.internal.buildSparseDependencies('construct', item.model.prices, [], 1, item);
        timerData.interval('Build Sparse Dependencies');

        this.internal.populateTimeDependencyData(1, data, resourceCache);
        timerData.interval('Populate Time Data');

        data.consume(resourceCache, true);
        timerData.interval('Mark Resources');

        this.internal.populateFlatList(data, resourceCache);
        timerData.interval('Populate Flat List');

        this.internal.computeResults(data, resourceCache);
        timerData.end('Compute Results');
        return data;
    },
};

ajk.resources = {
    log: ajk.log.addChannel('resources', true),
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

    productionOutput:
    {
        'energy': function() { return gamePage.resPool.getEnergyDelta(); }
    },

    available: function(resourceName)
    {
        // TODO - Cache this
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
        if (ajk.trade.availableViaTrade(resourceName))
        {
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
        var base = gamePage.getResourcePerTick(resource) + gamePage.getResourcePerTickConvertion(resource);
        if (this.huntingData.expectedPerTick.hasOwnProperty(resource))
        {
            base += this.huntingData.expectedPerTick[resource];
        }
        return base;
    },

    reset: function()
    {
        this.previousDemand = jQuery.extend({}, this.demand);
        this.demand = {};

        // TODO - Solve the problem of other catpower consumers interfering with this metric
        this.huntingData.allowHunting = gamePage.village.getJob('hunter').unlocked;
        this.huntingData.expectedPerTick = {};
        var avgHuntsPerTick = this.getProductionOf('manpower') / 100;
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

    getBuffer: function(resource)
    {
        if (resource == 'catnip')
        {
            var scaledBuffer = gamePage.resPool.get('catnip').maxValue * this.catnipBufferRatio;
            return Math.max(scaledBuffer, this.catnipBufferFixed);
        }
        else
        {
            return 0;
        }
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
                this.log.debug('Converting ' + amountToConvert + ' ' + rName + 's into ' + craft.name);
                if (!ajk.simulate)
                {
                    ajk.workshop.craft(craft.name, numCrafts);
                }
            }
        }

        var catPower = gamePage.resPool.get('manpower');
        // TODO - Fix this
        /*
        if (catPower.unlocked && catPower.value / catPower.maxValue >= this.conversionMaxRatio && !this.inDemand('manpower'))
        {
            var numHunts = Math.ceil(catPower.maxValue * this.catpowerConversionRatio / 100);
            this.log.debug('Sending hunters ' + numHunts + ' times');
            if (!ajk.simulate)
            {
                gamePage.village.huntMultiple(numHunts);
            }
        }

        var faith = gamePage.resPool.get('faith');
        if (faith.unlocked && faith.value == faith.maxValue)
        {
            this.log.debug('Praising the sun');
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
        */
    }
};

ajk.jobs = {
    log: ajk.log.addChannel('jobs', true),
    assign: function(jobName)
    {
        if (!gamePage.village.getJob(jobName).unlocked) { return false; }
        if (!ajk.simulate)
        {
            this.log.debug('Kitten assigned to be a ' + jobName);
            gamePage.village.assignJob(gamePage.village.getJob(jobName));
        }
        return true;
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
        if (ajk.resources.getProductionOf('catnip'))
        {
            this.assign('farmer');
            return;
        }

        var highestPri = ajk.analysis.filteredPriorityList[0];
        if (highestPri == undefined || !ajk.analysis.data.hasOwnProperty(highestPri))
        {
            this.log.debug('Waiting to assign kitten to a job pending a clear priority');
            return;
        }

        /*
        // TODO - Fix this
        var bottlenecks = ajk.resources.getBottlenecksFor(ajk.analysis.data[highestPri].costData);
        if (bottlenecks.length == 0)
        {
            this.log.debug('Waiting to assign kitten to a job pending a clear priority');
            return;
        }

        var bottleneck = bottlenecks[0].name;
        if (bottleneck == 'minerals' && this.assign('miner')) { return; }
        if (bottleneck == 'wood' && this.assign('woodcutter')) { return; }
        if (bottleneck == 'science' && this.assign('scholar')) { return; }
        if ((bottleneck == 'manpower' || bottleneck == 'furs' || bottleneck == 'ivory' || bottleneck == 'spice') && this.assign('hunter')) { return; }
        if ((bottleneck == 'coal' || bottleneck == 'gold') && this.assign('geologist')) { return ;}
        if (this.assign('priest')) { return; }

        this.log.debug('Bottleneck ' + bottleneck + ' demands no job that is mapped');
        */
    }
};

ajk.misc = {
    checkForObservationEvent: function()
    {
        var btn = gamePage.calendar.observeBtn;
        if (btn != null) { btn.click(); }
    }
};

ajk.adjustment = {
    // Reduce churn and reinforce whatever was chosen as top priority based on resource production prioritization
    reinforceTopPriority:
    {
        log: ajk.log.addChannel('adj-toppri', true),
        topModifier: -5,
        bottleneckModifier: -2,

        topPriority: null,
        bottlenecks: null,

        prepare: function()
        {
            this.topPriority = null;
            this.bottlenecks = null;

            this.log.debug('Prioritizing items based on the previous top priority');
            if (ajk.analysis.previousPriority.length > 0)
            {
                if (ajk.analysis.data.hasOwnProperty(ajk.analysis.previousPriority[0]))
                {
                    this.topPriority = ajk.analysis.previousPriority[0];
                    /*
                    // TOOD - Fix this
                    this.bottlenecks = ajk.resources.getBottlenecksFor(ajk.analysis.data[this.topPriority].costData);
                    this.log.debug('Production of ' + this.topPriority + ' is bottlenecked on ' + this.bottlenecks.length + ' resources');
                    */
                }
                else
                {
                    this.log.debug('Previous priority was met, skipping reinforcement');
                }
            }
        },
        modifyItem: function(itemKey)
        {
            if (this.topPriority == null) { return; }
            if (itemKey == this.topPriority)
            {
                this.log.debug('Increasing weight of ' + itemKey + ' to reinforce the previous top priority');
                ajk.analysis.modifyWeight(itemKey, this.topModifier, 'previous priority');
                return;
            }

            var currentMod = this.bottleneckModifier;
            for (var i = 0; i < this.bottlenecks.length; ++i)
            {
                if (ajk.cache.isProducerOf(this.bottlenecks[i].name))
                {
                    this.log.debug('Increasing weight of ' + itemKey + ' by ' + currentMod + ' based on production of a bottlenecked resource (' + this.bottlenecks[i].name + ')');
                }
                currentMod = currentMod / 2;
            }
        },
    },

    // Reward producers of in-demand resources
    weightedDemandScaling:
    {
        log: ajk.log.addChannel('adj-wdemand', true),
        modWeight: 0.5,

        weightedDemand: {},

        prepare: function()
        {
            this.log.debug('Prioritizing items based on weight-adjusted demand');
            // TODO - Fix this
            //this.weightedDemand = ajk.resources.getWeightedDemand(ajk.resources.previousDemand);
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
                    this.log.debug('Increasing weight of ' + itemKey + ' by ' + mod + ' based on the demand for ' + resource);
                    ajk.analysis.modifyWeight(itemKey, mod, 'production of ' + resource);
                }
                else if (ajk.cache.isConsumerOf(itemKey, resource))
                {
                    this.log.debug('Decreasing weight of ' + itemKey + ' by ' + mod + ' based on the demand for ' + resource);
                    ajk.analysis.modifyWeight(itemKey, -mod, 'consumption of ' + resource);
                }
            }
        }
    },

    // Reward anything that unlocks a new tab (eventually)
    tabDiscovery:
    {
        log: ajk.log.addChannel('adj-tabdisc', true),
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
                    'theology',
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
                    this.log.debug('Priotizing ' + itemKey + ' in order to discover a new tab');
                    ajk.analysis.modifyWeight(itemKey, this.priorityWeight, 'tab discovery');
                }
            }
        }
    },

    // Penalize trading for resources slightly, but reward trade benefit producers if a lot of trade is in demand (read: titanium)
    tradingModule:
    {
        log: ajk.log.addChannel('adj-trading', true),
        tradePenalty: 1,
        tradeProductionBonusBase: -2,

        tradeBottleneckRatio: 0,
        tradeProductionBonus: 0,

        // TODO - Fix this
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
            var pp = ajk.analysis.previousOrder;
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
                if (ppData == undefined)
                {
                    continue;
                }
                // TODO - Fix this
                if (this.hasTradeBottleneck(ajk.analysis.data[pp[i]].costData))
                {
                    numTradeBottlenecks += 1;
                }
            }
            this.log.debug('Found ' + numTradeBottlenecks + ' / ' + pp.length + ' items are bottlenecked on trading');
            this.tradeBottleneckRatio = (numTradeBottlenecks / pp.length);
            this.tradeProductionBonus = this.tradeBottleneckRatio * this.tradeProductionBonusBase;
        },
        modifyItem: function(itemKey)
        {
            // TODO - Fix this
            var costData = ajk.analysis.data[itemKey].costData;

            // Apply an across-the board penalty for any item that it primarily bottlenecked by a resource that is being traded for
            if (this.hasTradeBottleneck(costData))
            {
                this.log.detail('Penalizing ' + itemKey + ' because it uses trading to fulfill its resource costs');
                ajk.analysis.modifyWeight(itemKey, this.tradePenalty, 'uses trading');
            }
            else if (ajk.cache.isProducerOf(itemKey, 'trade'))
            {
                this.log.detail('Prioritizing ' + itemKey + ' because it provides trade bonuses');
                ajk.analysis.modifyWeight(itemKey, this.tradeProductionBonus, 'boosts trade');
            }
        }
    },

    // Move more expensive items down the list
    priceRatioModule:
    {
        log: ajk.log.addChannel('adj-price', true),
        params:
        {
            min: -1,
            inflection: [9000, 2],
            rolloff: [18000, 4],

            slope: 1,
            solutionExists: false,

            a: 0,
            b: 0,
            c: 0,
        },
        prepare: function()
        {
            this.log.debug('Determining coefficients for cost adjustment functions');
            this.log.indent();
            this.log.debug('Using inflection point ' + this.params.inflection.join());
            this.log.debug('Using rolloff point ' + this.params.rolloff.join());
            this.log.debug('Minimum value ' + this.params.min);

            this.params.slope = (this.params.inflection[1] - this.params.min) / this.params.inflection[0];
            this.log.debug('Linear portion slope ' + this.params.slope);

            var t0 = -m*s + n + s*i - j;
            var t1 = m*n*s - m*s*j - n*s*i - s*i*j;

            if (t0 == 0 || t1 == 0)
            {
                this.log.warn('Parameters chosen for nonlinear portion have no solution');
                return;
            }

            this.params.solutionExists = true;

            var i = this.params.inflection[0];
            var j = this.params.inflection[1];
            var m = this.params.rolloff[0];
            var n = this.params.rolloff[1];
            var s = this.params.slope;

            var mMinusI = (m - i);
            var nMinusJ = (n - j);
            var aDenom = m*s - n - s*i + j;
            this.log.detail('Intermediates: ' + [i,j,m,n,s,mMinusI,nMinusJ,aDenom].join());

            this.params.a = -s*mMinusI*mMinusI*nMinusJ*nMinusJ / (aDenom * aDenom);
            this.params.b = (-m*n + m*s*i + m*j - s*i*i) / (-m*s + n + s*i - j);
            this.params.c = (-m*n*s + n*s*i + n*j - j*j) / (-m*s + n + s*i - j);
            this.log.debug('Params chosen: ' + [this.params.a,this.params.b,this.params.c].join());

            this.log.debug('Prices up to inflection point are scaled as ' + this.params.slope + '*x + ' + this.params.min);
            this.log.debug('Prices past the inflection point are scaled as ' + this.params.a + '*(x + ' + this.params.b + ')^(-1) + ' + this.params.c);
            this.log.unindent();
        },
        evaluate: function(costTime)
        {
            if (costTime < this.params.inflection[0] || !this.params.solutionExists)
            {
                // Scale linearly
                this.log.detail('Scaling linearly');
                return this.params.min + (costTime * this.params.slope);
            }
            else
            {
                // Scale non-linearly
                this.log.detail('Scaling non-linearly');
                return (this.params.a / (this.params.b + costTime)) + this.params.c;
            }
        },
        modifyItem: function(itemKey)
        {
            var costTime = ajk.analysis.data[itemKey].costData.time;
            var modifier = this.evaluate(costTime);
            this.log.debug('Adjusting the weight of ' + itemKey + ' by ' + modifier + ' to account for time-cost of ' + costTime);
            ajk.analysis.modifyWeight(itemKey, modifier, 'time');

        },
    },

    // If an item was prioritized heavily but lacked capacity, attempt to unblock it
    capacityUnblocking:
    {
        log: ajk.log.addChannel('adj-capacity', true),
        priorityExtent: 5,
        priorityFalloff: 0.3,
        priorityReward: -3,

        rewardMap: {},

        prepare: function()
        {
            this.log.debug('Creating bounties for items blocked by missing resource capacity');
            this.log.indent();

            this.rewardMap = {};
            var currentReward = this.priorityReward;
            for (var i = 0; i < this.priorityExtent && i < ajk.analysis.previousOrder.length; ++i)
            {
                var p = ajk.analysis.previousOrder[i];
                var data = ajk.analysis.data[p];
                if (data == undefined) { continue; }
                if (data.missingMaxResources)
                {
                    for (var j = 0; j < data.costData.prices.length; ++j)
                    {
                        var price = data.costData.prices[j];
                        var resource = gamePage.resPool.get(price.name);
                        if (ajk.resources.available(price.name) && resource.maxValue != 0 && resource.maxValue < price.val && !this.rewardMap.hasOwnProperty(price.name))
                        {
                            this.log.debug('Creating bounty for any storers of ' + price.name + ' for ' + p);
                            this.rewardMap[price.name] = currentReward;
                        }
                    }
                }
                currentReward *= this.priorityFalloff;
            }

            this.log.unindent();
        },
        modifyItem: function(itemKey)
        {
            var maxReward = 0;
            var maxResource = null;
            for (var rewardResource in this.rewardMap)
            {
                var bounty = this.rewardMap[rewardResource];
                if (ajk.cache.isStorerOf(itemKey, rewardResource) && maxReward > bounty)
                {
                    this.log.detail(itemKey + ' stores ' + rewardResource + '; potentially claiming bounty of ' + bounty);
                    maxReward = bounty;
                    maxResource = rewardResource;
                }
            }
            if (maxReward != 0)
            {
                this.log.debug('Prioritizing ' + itemKey + ' because it stores ' + maxResource);
                ajk.analysis.modifyWeight(itemKey, maxReward, 'Storage of ' + maxResource);
            }
        }
    }
};

ajk.analysis = {
    log: ajk.log.addChannel('analysis', true),
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

        'printingPress': -10,

        // Speculative
        'geodesy': -10,
        'oxidation': -5,
    },

    previousPriority: [],
    previousOrder: [],

    weightAdjustments: function()
    {
        return [
        // TODO - Fix this
        /*
            ajk.adjustment.priceRatioModule,
            ajk.adjustment.reinforceTopPriority,
            ajk.adjustment.weightedDemandScaling,
            ajk.adjustment.tabDiscovery,
            ajk.adjustment.tradingModule,
            ajk.adjustment.capacityUnblocking,
            */
        ];
    },

    modifyWeight: function(itemName, modifier, adjustment)
    {
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
        this.previousOrder = this.priorityList;
        this.previousPriority = this.filteredPriorityList;

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
                    this.log.detail('Modifying the weight of ' + explorationRequirement[i] + ' to account for exploration requirements');
                    this.modifyWeight(explorationRequirement[i], this.explorationModifier, 'exploration requirements');
                }
            }
            else
            {
                this.log.detail('New races are available for discovery');
                this.shouldExplore = true;
            }
        }
    },

    analyzeItems: function(items)
    {
        this.log.detail('Analyzing ' + items.length + ' items');
        this.log.indent();
        for (var i = 0; i < items.length; ++i)
        {
            if (!items[i].model.hasOwnProperty('metadata')) { continue; }

            var mData = items[i].model.metadata;
            var itemKey = mData.name;
            this.log.detail('Analyzing ' + itemKey);

            if (!mData.unlocked) { continue; }
            if (mData.hasOwnProperty('researched') && mData.researched) { continue; }

            var itemPrices = items[i].controller.getPrices(items[i].model);
            /*
            // TODO - Fix this
            this.log.trace('Determining how to best produce ' + itemKey + ' and how long it will take');
            var costData = ajk.resources.analyzeCostProduction(itemPrices);
            this.log.detail('It will be ' + costData.time + ' ticks until there are enough resources for ' + itemKey);
            */

            if (!this.data.hasOwnProperty(itemKey))
            {
                this.data[itemKey] = {};
            }
            this.data[itemKey].item = items[i];
            this.data[itemKey].missingMaxResources = false;
            // TODO - Fix this
            //this.data[itemKey].costData = costData;

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
                        this.log.detail('Production of ' + consumedResource + ' does not meet the requirements for another ' + itemKey);
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
                this.log.debug('Prioritizing ' + itemKey + ' as a one-shot');
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
                    this.log.detail('Max ' + resource.name + ' lacking to produce ' + itemKey);
                    missingMaxResources = true;
                    this.capacityDemand[itemPrices[j].name] = true;
                }
            }
            if (missingMaxResources)
            {
                this.data[itemKey].missingMaxResources = true;
            }
        }
        this.log.unindent();
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
            this.log.detail('Accounting for catpower demand for exploration');
            // TODO - Fix this
            //ajk.resources.accumulateSimpleDemand('manpower', 1000, ajk.trade.explorationDemandWeight);
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
                this.log.trace('Filtered out ' + this.priorityList[i] + ' due to max resource capacity');
                continue;
            }

            /*
            // TODO - Fix this
            if (!ajk.resources.hasCompetition(itemData.costData))
            {
                this.log.trace('Added ' + this.priorityList[i] + ' to list of filtered items');
                this.filteredPriorityList.push(this.priorityList[i]);
                ajk.resources.accumulateDemand(itemData.costData, itemData.weight);
            }
            else
            {
                this.log.trace('Filtered out ' + this.priorityList[i] + ' due to resource competition');
            }
            */
        }
    },
};

ajk.core = {
    bonfireTab: gamePage.tabs[0],
    scienceTab: gamePage.tabs[2],
    workshopTab: gamePage.tabs[3],
    religionTab: gamePage.tabs[5],
    spaceTab: gamePage.tabs[6],

    internal:
    {
        log: ajk.log.addChannel('core', true),

        tickFrequency: 10,
        tickThread: null,

        successes: 0,
        explorationSuccess: false,

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

            if (ajk.core.workshopTab.visible)
            {
                ajk.ui.switchToTab('Workshop');
                ajk.analysis.analyzeItems(ajk.core.workshopTab.buttons);
                timerData.interval('Workshop Analysis');
            }

            ajk.analysis.analyzeResults();
            timerData.interval('Analysis Resolution Pass');

            ajk.analysis.postAnalysisPass();
            timerData.end('Post-Analysis Pass');

            ajk.ui.switchToTab(null);
            timerData.end('Cleanup');
        },

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
                        var requirementMet = (gamePage.resPool.get(price.name).value >= price.amount);
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
                    allSucceeded &= ajk.workshop.craft(price.name, price.craftAmount);
                }
                else
                {
                    var resource = gamePage.resPool.get(costData.prices[j].name);
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

        operateOnPriority: function()
        {
            if (ajk.analysis.shouldExplore)
            {
                ajk.ui.switchToTab('Trade');
                var explore = gamePage.diplomacyTab.exploreBtn;
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

/*
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
                */
            }
        },

        unsafeTick: function()
        {
            var timerData = ajk.timer.start('Overall Tick Execution');
            this.successes = 0;

            ajk.cache.init();
            timerData.interval('Cache Initialization');

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
            ajk.log.flush(this.successes > 0 && ajk.log.detailedLogsOnSuccess);
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

        $('#tickToggle')[0].checked = doTick;
    }
};

ajk.ui = {
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
            <input type="button" id="simulateButton" value="Simulate One Tick" onclick="ajk.core.simulateTick();" style="width:200px"/><br/>
            <input id="simulateToggle" type="checkbox" onclick="ajk.simulate = $('#simulateToggle')[0].checked;">
            <label for="simulateToggle">Simulating</label>
            <br/>
            <input id="tickToggle" type="checkbox" onclick="ajk.core.shouldTick($('#tickToggle')[0].checked);">
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
            <div id="logChannelContainer"/>
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

        /*
        // TODO - Fix this
        convertCostDataToIndentedTable: function(costData, indent)
        {
            indent = indent || 1;
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
        */

        refreshLogChannelToggles: function()
        {
            for (var channel in ajk.log.internal.channels)
            {
                var enabled = ajk.log.channelActive(channel);
                var toggleName = 'logChannel' + channel + 'Toggle';
                $('#' + toggleName)[0].checked = ajk.log.channelActive(channel);
            }
        },

        refreshPriorityTable: function()
        {
            var container = $('#priorityTable');
            container.empty();
            for (var i = 0; i < ajk.analysis.filteredPriorityList.length; ++i)
            {
                var itemKey = ajk.analysis.filteredPriorityList[i];
                var itemWeight = ajk.analysis.data[itemKey].weight;

                /*
                // TODO - Fix this
                var costData = ajk.analysis.data[itemKey].costData;

                var timeString = this.convertTicksToTimeString(costData.time);

                var rowId = itemKey + 'Priority';
                var containerId = rowId + 'Details';
                var rowData = '<tr><td id="' + rowId + '"/></tr>';
                container.append(rowData);

                var rowTitle = '<span>' + itemKey + '</span><span style="float:right">' + timeString + '</span>';
                var rowDetails = '<div style="color:rgb(128,128,128)">' + this.convertCostDataToIndentedTable(costData) + '</div>';

                this.createCollapsiblePanel($('#' + rowId), containerId, rowTitle, rowDetails, true, true);
                */
            }
        },

        refreshResourceDemandTable: function()
        {
            var container = $('#resourceDemandTable');
            container.empty();
            /*
            // TODO - Fix this
            for (var resource in ajk.resources.demand)
            {
                container.append('<tr><td>' + resource + '</td><td style="text-align:right">' + ajk.resources.demand[resource].amount.toFixed(2) + '</td></tr>');
            }
            */
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
        /*
        this.internal.refreshPriorityTable();
        this.internal.refreshResourceDemandTable();
        this.internal.refreshFullPriorityTable();
        */
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

        var logChannelContainer = $('#logChannelContainer');
        var logChannelTitle = '<span>Log Channels</span>';
        var logChannelContent = '';
        logChannelContent += '<input type="button" id="enableAllChannelsButton"  value="Enable"  onclick="ajk.log.toggleAllChannels(true); ajk.ui.internal.refreshLogChannelToggles();"  style="width:100px">';
        logChannelContent += '<input type="button" id="disableAllChannelsButton" value="Disable" onclick="ajk.log.toggleAllChannels(false); ajk.ui.internal.refreshLogChannelToggles();" style="width:100px">';
        logChannelContent += '<br/>';
        for (var channel in ajk.log.internal.channels)
        {
            var toggleName = 'logChannel' + channel + 'Toggle';
            logChannelContent += '<span style="display:inline-block; width: 15px"/>'
            logChannelContent += '<input id="' + toggleName + '" type="checkbox" onclick="ajk.log.toggleChannel(\'' + channel + '\', $(\'#' + toggleName + '\')[0].checked);">';
            logChannelContent += '<label for="' + toggleName + '">' + channel + '</label>';
            logChannelContent += '<br/>'
        }
        this.internal.createCollapsiblePanel(logChannelContainer, 'logChannels', logChannelTitle, logChannelContent, true, true);
        this.internal.createCollapsiblePanel(menu, 'ajkBackup', 'Google Drive Backup', this.internal.backupContent, false, true);
        this.internal.createCollapsiblePanel(menu, 'ajkPriority', 'Priority Result', '<table id="priorityTable" class="ajkTable"/>', false, false);
        this.internal.createCollapsiblePanel(menu, 'ajkResources', 'Resource Demand', '<table id="resourceDemandTable" class="ajkTable"/>', false, true);
        this.internal.createCollapsiblePanel(menu, 'ajkPriorityDetail', 'Priority Detail', '<table id="fullPriorityTable" class="ajkTable"/>', false, false);

        $("#simulateToggle")[0].checked = ajk.simulate;
        $("#detailSuccessToggle")[0].checked = ajk.log.detailedLogsOnSuccess;
        $("#detailErrorToggle")[0].checked = ajk.log.detailedLogsOnError;
        $("#logLevelSelect")[0].value = ajk.log.logLevel;

        this.internal.refreshLogChannelToggles();
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
};

//ajk.ui.createUI();
//ajk.core.simulateTick();

ajk.log.logLevel = 4;
var pp = ajk.core.workshopTab.buttons[69];
var test = ajk.costData.build(pp);
ajk.log.flush();
test;