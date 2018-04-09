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
                        produces: Object.keys(j.modifiers)
                    };
                }
            });
            return jobs;
        },

        balanceJobs: function(utilization)
        {
            // Collect current job assignments
            var previousJobs = {};
            var currentJobs  = {};
            ajk.base.getAllJobs().forEach((j) => {
                previousJobs[j.name] = j.value;
                currentJobs[j.name]  = j.value;
            });

            var jobs = this.getJobTable();
            var resources = {};

            // Get kitten production vectors
            for (var jobName in jobs)
            {
                job = jobs[jobName];
                job.produces.forEach((r) => {
                    resources[r] = {};
                    resources[r].currentProduction = ajk.base.getAccurateResPerTick(r);
                });
                job.producers = currentJobs[jobName];
            }
            ajk.base.clearJobs();
            ajk.base.updateKittenProduction();
            for (var jobName in jobs)
            {
                var job = jobs[jobName];
                job.produces.forEach((r) => {
                    resources[r].nullProduction = ajk.base.getAccurateResPerTick(r);
                    resources[r].perKitten      = (resources[r].currentProduction - resources[r].nullProduction) / job.producers;
                });
            }

            // Clear current job assignments
            for (var jobName in currentJobs)
            {
                currentJobs[jobName] = 0;
            }

            // Assign new jobs
            var totalKittens = ajk.base.getKittenInfo().length;
            var jobPriorityOrder = Object.keys(jobs).sort((a, b) => { return this.jobPriority[a] - this.jobPriority[b]; });

            // (1) Bring production vectors to 0 in priority order
            jobPriorityOrder.forEach((jobName) => {
                var workersRequired = jobs[jobName].produces.reduce((a, r) => {
                    var req = Math.max(0, Math.ceil(-resources[r].nullProduction / resources[r].perKitten));
                    this.log.debug('Workers needed to reach 0 ' + r + ' production: ' + req);
                    return (a > req) ? a : req;
                }, 0);
                var workers = Math.min(totalKittens, workersRequired);
                this.log.debug('Assigning ' + workers + ' kittens to be ' + jobName + 's to reach 0-vector');
                currentJobs[jobName] += workers;
                totalKittens         -= workers;
            });

            // (2) Determine fixed / floating numbers
            var floaters    = Math.floor(totalKittens * ajk.config.kittenFloaterRatio);
            var nonFloaters = totalKittens - floaters;
            this.log.debug(nonFloaters + ' kittens will be spread evenly across production, with ' + floaters + ' floating between jobs to satisfy utilization demands');

            // (3) Apply fixed positions according to hardcoded ratios
            var ratioDenom = jobPriorityOrder.reduce((a, j) => { return a + this.jobRatio[j]; }, 0);
            jobPriorityOrder.forEach((jobName) => {
                var workers = Math.min(totalKittens, Math.ceil(nonFloaters * this.jobRatio[jobName] / ratioDenom));
                this.log.debug('Assigning ' + workers + ' kittens to be fixed ' + jobName + 's');
                currentJobs[jobName] += workers;
                totalKittens         -= workers;
            });

            // (4) Apply floating positions based on utilization
            var utilDenom = jobPriorityOrder.reduce((a, j) => {
                return a + jobs[j].produces.reduce((b, r) => { return b + (utilization[r] || 0); }, 0);
            }, 0);
            jobPriorityOrder.forEach((jobName) => {
                var jobUtilization = jobs[jobName].produces.reduce((a, r) => { return a + (utilization[r] || 0); }, 0);
                var workers = Math.min(totalKittens, Math.ceil(floaters * jobUtilization / utilDenom));
                this.log.debug('Assigning ' + workers + ' kittens to be floating ' + jobName + 's');
                currentJobs[jobName] += workers;
                totalKittens         -= workers;
            });

            if (totalKittens > 0)
            {
                this.log.warn('Unassigned kittens left - something went wrong in job assignment');
            }

            // Apply job asignments
            for (var jobName in currentJobs)
            {
                for (var i = 0; i < currentJobs[jobName]; ++i)
                {
                    ajk.base.assignJob(jobName);
                }
            }
            if (ajk.base.censusAvailable())
            {
                ajk.base.optimizeJobs();
            }
        },
    },

    update: function(utilization)
    {
        this.internal.chooseLeader();
        this.internal.balanceJobs(utilization);
    },
};