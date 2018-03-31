'use strict';

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

    }
};