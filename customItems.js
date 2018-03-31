'use strict';

ajk.customItems = {
    initialized: false,
    items: [],

    tradeShip: function()
    {
        ajk.ui.switchToTab('Workshop');

        var craftdata = ajk.base.getCraft('ship');

        var itemData = {
            controller:
            {
                getPrices: function()
                {
                    return ajk.base.getCraft('ship').prices;
                },
                hasResources: function()
                {
                    return (ajk.base.getCraftAllAmount('ship') > 0);
                },
                buyItem: function()
                {
                    ajk.base.craft('ship', 1);
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
                // TODO - Is this useful / necessary?
                this.model.metadata.val = ajk.base.getResource('ship').value;
            }
        };
        ajk.ui.switchToTab(null);
        return itemData;
    },

    // TODO - Add barge

    // TODO - Rework this whole shit
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