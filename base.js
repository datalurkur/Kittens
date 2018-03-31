'use strict';

var ajk = {
    base:
    {
        simulate:    false,
        previousTab: null,

        // Data Accessors
        // Tabs
        bonfireTab:       function()              { return gamePage.tabs[0];                                             },
        scienceTab:       function()              { return gamePage.tabs[2];                                             },
        workshopTab:      function()              { return gamePage.tabs[3];                                             },
        religionTab:      function()              { return gamePage.tabs[5];                                             },
        spaceTab:         function()              { return gamePage.tabs[6];                                             },

        // Resources
        getAllResources:  function()              { return gamePage.resPool.resources;                                   },
        getResource:      function(resName)       { return gamePage.resPool.get(resName);                                },
        getEnergyDelta:   function()              { return gamePage.resPool.getEnergyDelta();                            },
        getProductionOf:  function(resName)       { return gamePage.getResourcePerTick(resName);                         },
        getConsumptionOf: function(resName)       { return gamePage.getResourcePerTickConvertion(resName);               },

        // Village stuff
        getFreeWorkers:   function()              { return gamePage.village.getFreeKittens();                            },
        getJob:           function(jobName)       { return gamePage.village.getJob(jobName);                             },
        getHunterRatio:   function()              { return gamePage.getEffect('hunterRatio') + 1;                        },

        // Trade stuff
        getExploreItem:   function()              { return gamePage.diplomacy.exploreBtn;                                },
        getAllRaces: function()                   { return gamePage.diplomacy.races;                                     },
        getRace: function(raceName)               { return gamePage.diplomacy.getRace(raceName);                         },
        getTradeRatio: function()                 { return gamePage.diplomacy.getTradeRatio() + 1;                       },
        getTradeAllAmount: function(raceName)     { return gamePage.diplomacy.getMaxTradeAmount(this.getRace(raceName)); },

        // Science stuf
        getScience: function(scienceName)         { return gamePage.science.get(scienceName);                            },

        // Workshop stuff
        getCraft:         function(craftName)     { return gamePage.workshop.getCraft(craftName);                        },
        getCraftRatio:    function()              { return 1 + gamePage.getCraftRatio();                                 },
        getCraftAllAmount: function(craftname)    { return gamePage.workshop.getCraftAllCount(craftName);                },

        // Religion stuff
        getReligionUpgrade: function(upgradeName) { return gamePage.religion.getRU(upgradeName);                         },
        getZigguratUpgrade: function(upgradeName) { return gamePage.religion.getZU(upgradeName);                         },

        // Misc stuff
        getSeason: function()                     { return gamePage.calendar.season;                                     },
        getObserveButton:    function()           { return gamePage.calendar.observeBtn;                                 },
        getYear: function()                       { return gamePage.calendar.year;                                       },
        getPerk: function(perkName)               { return gamePage.prestige.getPerk(perkName);                          },

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
        assignJob: function(jobName)
        {
            if (this.simulate) { return; }
            gamePage.village.assignJob(this.getJob(job));
        },
        hunt: function(hunts)
        {
            if (this.simulate) { return; }
            gamePage.village.huntMultiple(hunts);
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
        trade: function(raceName, amount)
        {
            if (this.simulate) { return; }
            gamePage.diplomacy.trade(this.getRace(raceName), amount);
        },
        tradeAll: function(raceName)
        {
            if (this.simulate) { return; }
            gamePage.diplomacy.trade(this.getRace(raceName));
        }
    },
};

ajk.log = {
    detailedLogsOnSuccess: false,
    detailedLogsOnError: true,

    logLevel: 5,

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

        logMultiple(messages, level, channel)
        {
            for (var i = 0; i < messages.length; ++i)
            {
                this.logQueue.push(['  '.repeat(this.indentLevel) + messages[i], level, channel]);
            }
        },

        logInternal: function(message, level, channel)
        {
            var messages = message.split('\n');
            this.logMultiple(messages, level, channel);
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
                if (ajk.log.detailedLogsOnError)
                {
                    ajk.core.shouldTick(false);
                    ajk.log.flush(true);
                }
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