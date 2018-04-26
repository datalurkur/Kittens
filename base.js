'use strict';

var ajk = {
    base:
    {
        simulate:    false,
        previousTab: null,

        // Data Accessors
        // Tabs
        bonfireTab:         function()            { return gamePage.tabs[0];                                               },
        scienceTab:         function()            { return gamePage.tabs[2];                                               },
        workshopTab:        function()            { return gamePage.tabs[3];                                               },
        diplomacyTab:       function()            { return gamePage.tabs[4];                                               },
        religionTab:        function()            { return gamePage.tabs[5];                                               },
        spaceTab:           function()            { return gamePage.tabs[6];                                               },

        // Resources
        getAllResources:    function()            { return gamePage.resPool.resources;                                     },
        getResource:        function(resName)     { return gamePage.resPool.get(resName);                                  },
        getEnergyProd:      function()            { return gamePage.resPool.energyProd;                                    },
        getEnergyCons:      function()            { return gamePage.resPool.energyCons;                                    },
        getProductionOf:    function(resName)     { return gamePage.getResourcePerTick(resName);                           },
        getConsumptionOf:   function(resName)     { return gamePage.getResourcePerTickConvertion(resName);                 },

        // Village stuff
        getFreeWorkers:     function()            { return gamePage.village.getFreeKittens();                              },
        getJob:             function(jobName)     { return gamePage.village.getJob(jobName);                               },
        getAllJobs:         function(jobName)     { return gamePage.village.jobs;                                          },
        getHunterRatio:     function()            { return gamePage.getEffect('hunterRatio') + 1;                          },
        censusAvailable:    function()            { return gamePage.science.get('civil').researched;                       },
        getLeader:          function()            { return gamePage.village.leader;                                        },
        getKittenInfo:      function()            { return gamePage.village.sim.kittens;                                   },
        getHappiness:       function()            { return gamePage.village.happiness;                                     },

        // Trade stuff
        getAllRaces:        function()            { return gamePage.diplomacy.races;                                       },
        getRace:            function(raceName)    { return gamePage.diplomacy.get(raceName);                               },
        getTradeRatio:      function()            { return gamePage.diplomacy.getTradeRatio() + 1;                         },
        getTradeAllAmount:  function(raceName)    { return gamePage.diplomacy.getMaxTradeAmt(this.getRace(raceName)) || 0; },

        // Science stuf
        getScience:         function(scienceName) { return gamePage.science.get(scienceName);                              },

        // Workshop stuff
        getAllCrafts:       function()            { return gamePage.workshop.crafts;                                       },
        getCraft:           function(craftName)   { return gamePage.workshop.getCraft(craftName);                          },
        getCraftRatio:      function()            { return 1 + gamePage.getCraftRatio();                                   },
        getCraftAllAmount:  function(craftName)   { return gamePage.workshop.getCraftAllCount(craftName);                  },
        getWorkshopUpgrade: function(upgradeName) { return gamePage.workshop.get(upgradeName);                             },

        // Religion stuff
        getFaith:           function()            { return gamePage.religion.faith;                                        },
        getReligionUpgrade: function(upgradeName) { return gamePage.religion.getRU(upgradeName);                           },
        getZigguratUpgrade: function(upgradeName) { return gamePage.religion.getZU(upgradeName);                           },

        // Misc stuff
        getBuilding:        function(bldName)     { return gamePage.bld.get(bldName);                                      },
        getSeason:          function()            { return gamePage.calendar.season;                                       },
        getObserveButton:   function()            { return gamePage.calendar.observeBtn;                                   },
        getDay:             function()            { return gamePage.calendar.day;                                          },
        getYear:            function()            { return gamePage.calendar.year;                                         },
        getPerk:            function(perkName)    { return gamePage.prestige.getPerk(perkName);                            },
        getEffect:          function(effectName)  { return gamePage.getEffect(effectName);                                 },
        getVoidStats:       function()            { return gamePage.resPool.getVoidQuantityStatistically();                },

        // Special hackery
        // This is used for determining resource production vectors for kittens
        // (without having to duplicate all the fucking effect stacks in the kittens code)
        getAccurateResPerTick: function(resource)
        {
            return gamePage.calcResourcePerTick(resource) + gamePage.getResourcePerTickConvertion(resource);
        },

        // Operations
        switchToTab: function(tab)
        {
            var tabName = (tab == null) ? null : tab.tabId;

            // This is expensive - avoid doing this wherever possible
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
                return;
            }

            if (tabName == gamePage.ui.activeTabId) { return; }

            gamePage.ui.activeTabId = tabName;
            gamePage.render();
        },

        // Various job hacks
        clearJobs: function()
        {
            if (this.simulate) { return; }
            gamePage.village.clearJobs(true);
        },
        assignJobs: function(job, number)
        {
            if (this.simulate) { return true; }
            if (number + job.value > gamePage.village.getJobLimit(job.name)) { return false; }
            var numAssigned = 0;
            var allKittens = gamePage.village.sim.kittens;
            for (var i = 0; i < allKittens.length; ++i)
            {
                if (allKittens[i].job == null)
                {
                    allKittens[i].job = job.name;
                    job.value += 1;
                    numAssigned += 1;
                }
                if (numAssigned >= number) { break; }
            }
            return (numAssigned == number);
        },
        removeJobs: function(job, number)
        {
            if (this.simulate) { return true; }
            var numRemoved = 0;
            var allKittens = gamePage.village.sim.kittens;
            for (var i = 0; i < allKittens.length; ++i)
            {
                if (allKittens[i].job == job.name)
                {
                    allKittens[i].job = null;
                    job.value -= 1;
                    numRemoved += 1;
                }
                if (numRemoved >= number) { break; }
            }
            return (numRemoved == number);
        },
        updateVillageResourceProduction: function()
        {
            if (this.simulate) { return; }
            gamePage.village.updateResourceProduction();
        },
        makeLeader: function(kitten)
        {
            if (this.simulate) { return; }
            // Copied from the kittens code to avoid doing a tab switch
            if (gamePage.village.leader)
            {
                gamePage.village.leader.isLeader = false;
            }
            kitten.isLeader = true;
            gamePage.village.leader = kitten;
        },
        optimizeJobs: function()
        {
            if (this.simulate) { return; }
            gamePage.village.optimizeJobs();
        },
        promote: function()
        {
            if (this.simulate) { return; }
            gamePage.village.promoteKittens();
        },
        hunt: function(hunts)
        {
            if (this.simulate) { return; }
            if (ajk.config.useAccurateHunting)
            {
                return this.huntHack(hunts);
            }
            else
            {
                gamePage.village.huntMultiple(hunts);
                return {};
            }
        },
        huntHack: function(squads)
        {
            var village = gamePage.village;

            // This is copied directly from the kittens code's village module
            // With this behavior copied, we can directly return the results of hunting for easy analysis
            // In the kittens code, village == this
            // ----------------------------------------------------------------------------------------
            var mpower = village.game.resPool.get("manpower");
            squads = Math.min(squads, Math.floor(mpower.value / 100));

            if (squads < 1) { return; }

            village.game.resPool.addResEvent("manpower", -(squads * 100));

            var totalYield = null;

            for (var i = squads - 1; i >= 0; i--)
            {
                totalYield = village.sendHuntersInternal(totalYield);
            }
            village.gainHuntRes(totalYield, squads);
            // ----------------------------------------------------------------------------------------

            return totalYield;
        },
        praise: function()
        {
            if (this.simulate) { return; }
            gamePage.religion.praise();
        },
        craft: function(resName, amount)
        {
            if (this.simulate) { return true; }
            return gamePage.workshop.craft(resName, amount);
        },
        craftAll: function(resName)
        {
            if (this.simulate) { return; }
            gamePage.workshop.craftAll(resName);
        },
        trade: function(race, amount)
        {
            if (this.simulate) { return {}; }
            if (ajk.config.useAccurateTrading)
            {
                return this.tradeHack(race, amount);
            }
            else
            {
                gamePage.diplomacy.trade(race, amount);
                return {};
            }
        },
        tradeHack: function(race, amt)
        {
            var diplo = gamePage.diplomacy;

            // This is copied directly from the kittens code's diplomacy module
            // With this behavior copied, we can directly return the results of trade for easy analysis
            // In the kittens code, diplo == this
            // ----------------------------------------------------------------------------------------
            if (!diplo.hasMultipleResources(race, amt))
            {
                // Modified this to account for expected return value
                return {};
            }

            diplo.game.resPool.addResEvent("manpower", -50 * amt);
            diplo.game.resPool.addResEvent("gold", -15 * amt);
            diplo.game.resPool.addResEvent(race.buys[0].name, -race.buys[0].val * amt);

            var yieldResTotal = null;
            for (var i = 0; i < amt; i++)
            {
                yieldResTotal = diplo.tradeInternal(race, true, yieldResTotal);  //suppress msg
            }

            diplo.gainTradeRes(yieldResTotal, amt);
            // ----------------------------------------------------------------------------------------

            return yieldResTotal || {};
        },
        readyForPurchase: function(item)
        {
            item.update();
            return item.controller.hasResources(item.model);
        },
        purchaseItem: function(item)
        {
            if (this.simulate) { return true; }
            var success = false;
            item.controller.buyItem(item.model, {}, function(result) {
                success |= result;
            });
            return success;
        },
    },
};

ajk.config = {
    tickOnLoad:              true,

    ironWillMode:            false,

    // Util config and flags
    performBackup:           false,
    detailedLogsOnError:     false,
    detailedLogsOnSuccess:   false,
    alertOnError:            true,
    ticking:                 false,

    // General script loop control
    tickFrequency:           5,

    // Resource conversion controls
    catpowerConversionRatio: 0.25,
    conversionRatio:         0.1,
    conversionMaxRatio:      0.97,

    // Internal game-hack controls
    useAccurateHunting:      true, // Use copied source in order to get more data about hunting results
    useAccurateTrading:      true, // Use copied source in order to get more data about trading results

    // Utilization variables
    consumptionFalloff:      0.5,

    // Job and kitten management
    kittenFloaterRatio:      0.2, // Float this many kittens from job to job
    rebalanceFrequency:      10,  // Rebalance jobs every N updates
};

ajk.util = {
    ensureKey: function(object, key, defaultValue)
    {
        if (!object.hasOwnProperty(key)) { object[key] = defaultValue; }
        return object[key];
    },
    ensureKeyAndModify: function(object, key, defaultValue, mod)
    {
        if (!object.hasOwnProperty(key)) { object[key] = defaultValue; }
        object[key] += mod;
    },
    arrayMin: function(array)
    {
        return array.reduce((min, v) => { return (min < v) ? min : v; }, Infinity);
    },
    arrayMax: function(array)
    {
        return array.reduce((max, v) => { return (max > v) ? max : v; }, -Infinity);
    }
};

ajk.log = {
    internal:
    {
        errorLevel:  0,
        warnLevel:   1,
        infoLevel:   2,
        debugLevel:  3,
        detailLevel: 4,
        traceLevel:  5,

        channels:          {},
        channelMask:      -1,
        currentChannel:    1,
        channelNameLength: 0,

        logLevel:    2,
        indentLevel: 0,

        debugQueue: [],
        logQueue:   [],

        errorCallback: null,

        logInternal: function(message, level, channel)
        {
            var messages = message.split('\n');
            this.logQueue.push({
                messages: messages,
                indent:   this.indentLevel,
                level:    level,
                channel:  channel
            });
        },

        printLogsToConsole: function(ignoreLevel)
        {
            this.logQueue.forEach((msgData) => {
                if ((ignoreLevel || this.logLevel >= msgData.level) &&
                    (msgData.channel == undefined || msgData.level == this.errorLevel || this.channelActive(msgData.channel)))
                {
                    var marker      = '[' + msgData.channel.padStart(this.channelNameLength) + '] ';
                    var emptyMarker = ' '.repeat(marker.length);
                    var padding     = '  '.repeat(msgData.indent) + '%c';
                    var color       = 'color:black';

                         if (msgData.level == this.errorLevel) { color = 'color:red';    }
                    else if (msgData.level == this.warnLevel)  { color = 'color:orange'; }

                    for (var i = 0; i < msgData.messages.length; ++i)
                    {
                        var out = ((i == 0) ? marker : emptyMarker) + padding + msgData.messages[i];
                        console.log(out, color);
                    }
                }
            });
        },

        channelActive(channelName)
        {
            var mask = this.channels[channelName];
            return (this.channelMask & mask) != 0;
        },
    },

    setErrorCallback: function(callback)
    {
        this.internal.errorCallback = callback;
    },

    toggleChannel: function(channelName)
    {
        var isOn = !this.internal.channelActive(channelName);
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

    toggleAllChannels: function(areOn) { this.internal.channelMask = (areOn) ? -1 : 0; },

    flush: function(ignoreLevel)
    {
        this.internal.printLogsToConsole(ignoreLevel);
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

            indent:   function()            { ajk.log.internal.indentLevel += 1; },
            unindent: function()            { ajk.log.internal.indentLevel -= 1; },
            flush:    function(ignoreLevel) { ajk.log.flush(ignoreLevel);        },

            trace:  function(message) { ajk.log.internal.logInternal(message, ajk.log.internal.traceLevel,  this.channel); },
            detail: function(message) { ajk.log.internal.logInternal(message, ajk.log.internal.detailLevel, this.channel); },
            debug:  function(message) { ajk.log.internal.logInternal(message, ajk.log.internal.debugLevel,  this.channel); },
            warn:   function(message) { ajk.log.internal.logInternal(message, ajk.log.internal.warnLevel,   this.channel); },
            info:   function(message) { ajk.log.internal.logInternal(message, ajk.log.internal.infoLevel,   this.channel); },
            error:  function(message)
            {
                ajk.log.internal.logInternal(message, ajk.log.internal.errorLevel, this.channel);
                if (ajk.config.alertOnError && ajk.log.internal.errorCallback != null)
                {
                    var alertMessage = 'An error occured in the Kitten Savant plugin!\nContact the developer.\nDetails:\n' + message;
                    ajk.log.internal.errorCallback(alertMessage);
                }
                ajk.core.shouldTick(false);
                ajk.log.flush(ajk.config.detailedLogsOnError);
            },
        };
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