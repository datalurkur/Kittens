'use strict';

ajk.jobs = {
    log: ajk.log.addChannel('jobs', true),
    assign: function(jobName)
    {
        if (!ajk.base.getJob(jobName).unlocked) { return false; }
        if (!ajk.simulate)
        {
            this.log.debug('Kitten assigned to be a ' + jobName);
            ajk.base.assignJob(jobName);
        }
        return true;
    },

    reprioritize: function()
    {

    },

    assignFreeKittens: function()
    {
        // This is a stopgap until I have actual reassignment
        var free = ajk.base.getFreeKittens();
        if (free == 0) { return; }

        // If catnip production is dipping, this cat is a farmer
        if (ajk.resources.getNetProductionOf('catnip') < 0)
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