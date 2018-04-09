'use strict';

ajk.jobs = {
    internal:
    {
        log: ajk.log.addChannel('jobs', true),

        jobPriority:
        {
            'farmer':     0,
            'woodcutter': 1,
            'miner':      2,
            'hunter':     3,
            'scholar':    4,
            'geologist':  5,
            'priest':     6,
        },

        jobRatio:
        {
            'farmer':     0,
            'woodcutter': 0.2,
            'miner':      0.2,
            'hunter':     0.2,
            'scholar':    0.1,
            'geologist':  0.2,
            'priest':     0.1,
        },

        chooseLeader: function()
        {
            if (ajk.base.censusAvailable() && ajk.base.getLeader() == null)
            {
                // For now, just always pick a leader with a crafting bonus
                var kittenInfo = ajk.base.getKittenInfo();
                for (var i = 0; i < kittenInfo.length; ++i)
                {
                    if (kittenInfo[i].trait != null && kittenInfo[i].trait.name == 'engineer')
                    {
                        var k = kittenInfo[i];
                        this.log.info('Assigned ' + k.name + ' ' + k.surname + ' as the kitten leader');
                        ajk.base.makeLeader(k);
                        break;
                    }
                }
            }
        },

        getJobTable: function()
        {
            var jobs = {};
            ajk.base.getAllJobs().forEach((j) => {
                if (j.unlocked)
                {
                    jobs[j.name] = {
                        produces:  Object.keys(j.modifiers),
                        producers: j.value
                    };
                }
            });
            return jobs;
        },

        assignJobs: function(jobTable)
        {
            for (var jobName in jobTable)
            {
                for (var i = 0; i < jobTable[jobName]; ++i)
                {
                    ajk.base.assignJob(jobName);
                }
            }
            if (ajk.base.censusAvailable())
            {
                ajk.base.optimizeJobs();
            }
        },

        balanceJobs: function(utilization)
        {
            var totalKittens   = ajk.base.getKittenInfo().length;
            var jobs           = this.getJobTable();
            var jobAssignments = {};
            var resources      = {};

            // Get kitten production vectors
            for (var jobName in jobs)
            {
                job = jobs[jobName];
                job.produces.forEach((r) => {
                    resources[r] = {};
                    resources[r].currentProduction = ajk.base.getAccurateResPerTick(r);
                });
            }
            ajk.base.clearJobs();
            ajk.base.updateKittenProduction();
            for (var jobName in jobs)
            {
                var job = jobs[jobName];
                job.produces.forEach((r) => {
                    resources[r].nullProduction = ajk.base.getAccurateResPerTick(r);
                });
            }

            // Assign new jobs
            var jobPriorityOrder = Object.keys(jobs).sort((a, b) => { return this.jobPriority[a] - this.jobPriority[b]; });

            // (1) Bring production vectors to 0 in priority order
            jobPriorityOrder.forEach((jobName) => {
                var workersRequired = jobs[jobName].produces.reduce((a, r) => {
                    if (resources[r].nullProduction > 0) { return a; }

                    var productionDelta = (resources[r].currentProduction - resources[r].nullProduction);
                    var perKitten       = productionDelta / jobs[jobName].producers;
                    if (isNaN(perKitten) || perKitten <= 0)
                    {
                        this.log.detail('No data collected on per-kitten production of ' + r + ', assigning at least one kitten to compensate for non-positive resource vector');
                        return Math.max(a, 1);
                    }

                    var req = Math.max(0, Math.ceil(-resources[r].nullProduction / perKitten));
                    this.log.detail(req + ' kittens needed to reach at least 0 production for ' + r);
                    return Math.max(a, req);
                }, 0);

                var workers = Math.min(totalKittens, workersRequired);
                this.log.debug('Assigning ' + workers + ' kittens to be ' + jobName + 's to reach 0-vector');
                ajk.util.ensureKeyAndModify(jobAssignments, jobName, 0, workers);
                totalKittens -= workers;
            });

            // (2) Determine fixed / floating numbers
            var utilDenom = jobPriorityOrder.reduce((a, j) => {
                return a + jobs[j].produces.reduce((b, r) => { return b + (utilization[r] || 0); }, 0);
            }, 0);
            var floaters    = Math.floor(totalKittens * ajk.config.kittenFloaterRatio);
            var nonFloaters = totalKittens - floaters;
            if (utilDenom == 0)
            {
                this.log.debug('No utilization data available, floaters will be split with non-floaters');
                nonFloaters += floaters;
                floaters = 0;
            }
            this.log.debug(nonFloaters + ' kittens will be spread evenly across production, with ' + floaters + ' floating between jobs to satisfy utilization demands');

            // (3) Apply fixed positions according to hardcoded ratios
            var ratioDenom = jobPriorityOrder.reduce((a, j) => { return a + this.jobRatio[j]; }, 0);
            jobPriorityOrder.forEach((jobName) => {
                var workers = Math.min(totalKittens, Math.ceil(nonFloaters * this.jobRatio[jobName] / ratioDenom));
                this.log.debug('Assigning ' + workers + ' kittens to be fixed ' + jobName + 's');
                ajk.util.ensureKeyAndModify(jobAssignments, jobName, 0, workers);
                totalKittens -= workers;
            });

            // (4) Apply floating positions based on utilization
            if (floaters > 0)
            {
                jobPriorityOrder.forEach((jobName) => {
                    var jobUtilization = jobs[jobName].produces.reduce((a, r) => { return a + (utilization[r] || 0); }, 0);
                    var workers = Math.min(totalKittens, Math.ceil(floaters * jobUtilization / utilDenom));
                    this.log.debug('Assigning ' + workers + ' kittens to be floating ' + jobName + 's');
                    ajk.util.ensureKeyAndModify(jobAssignments, jobName, 0, workers);
                    totalKittens -= workers;
                });
            }

            // (5) Finish up
            if (totalKittens > 0)
            {
                this.log.warn('Unassigned kittens left - something went wrong in job assignment');
            }

            // Apply job asignments
            this.assignJobs(jobAssignments);
        },
    },

    update: function(utilization)
    {
        this.internal.chooseLeader();
        this.internal.balanceJobs(utilization);
    },
};