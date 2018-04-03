'use strict';

downloadSnapshot()
{
    var data = JSON.stringify(gamePage, function(k,v) {
             if (k == 'game') { return null; }
        else if (k == 'tab')  { return null; }
        else if (k == 'metaAccessor') { return null;}
        return v;
    });
    var fakeLink = document.createElement('a');
    var file = new Blob([data], {type:'text/plain'});
    fakeLink.href = URL.createObjectURL(file);
    fakeLink.download = 'snapshot.json';
    fakeLink.click();
}

var testData = {

};

var gamePage = {
    tabs:
    [
        { // Bonfire

        },
        {},
        { // Science

        },
        { // Workshop

        },
        {},
        { // Religion

        },
        { // Space

        },
    ],
    village:
    {
        getFreeKittens: function()
        {
            return 1;
        },
        getJob: function(jobName)
        {
            return { unlocked: true };
        },
        assignJob: function(job)
        {
            // no-op
        },
        huntMultiple: function(numHunts)
        {
            // no-op
        },
    },
    calendar:
    {
        season: 0,
        year: 50,
        observeBtn: null,
    },
    diplomacy:
    {
        races:
        [
        ],
        exploreBtn:
        {

        },
        getRace: function(raceName)
        {
            for (var i = 0; i < this.races.length; ++i) { if (this.races[i].name == raceName) { return this.races[i]; } }
        },
        getTradeRatio: function()
        {
            return 1.5;
        },
        getMaxTradeAmt: function(race)
        {
            return 5;
        },
        trade: function(race, numTrades)
        {
            // no-op
        },
    },
    science:
    {
        get: function(scienceName)
        {

        },
    },
    workshop:
    {
        getCraft: function(craftName)
        {

        },
        craft: function(craftName, numCrafts)
        {
            // no-op
            return true;
        },
        craftAll: function(craftName)
        {
            // no-op
        },
        getCraftRatio: function()
        {
            return 1.5;
        },
        getCraftAllCount: function(craftName)
        {
            return 5;
        },
    },
    religion:
    {
        getRU: function(upgradeName)
        {

        },
        getZU: function(upgradeName)
        {

        },
        praise()
        {
            // no-op
        },
    },
    resPool:
    {
        resources:
        {

        },
        get: function(resName)
        {

        },
        getEnergyDelta: function()
        {

        },
    },
    prestige:
    {
        getPerk: function(perkName)
        {
            return { researched: true };
        },
    },
    getEffect: function(effectName)
    {

    },
    getResourcePerTick: function(resName)
    {

    },
    getResourcePerTickConvertion: function(resName)
    {

    },
};