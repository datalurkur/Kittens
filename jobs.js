'use strict';

ajk.jobs = {
    internal:
    {
        log: ajk.log.addChannel('jobs', true),

        cachedJobs:         {},
        cachedResources:    {},

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
            'woodcutter': 10,
            'hunter':     8,
            'miner':      6,
            'geologist':  6,
            'priest':     6,
            'scholar':    1,
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

        updateJobTable: function()
        {
            this.cachedJobs = {};
            ajk.base.getAllJobs().forEach((j) => {
                if (j.unlocked && j.name != 'engineer')
                {
                    this.cachedJobs[j.name] = {
                        jobData:   j,
                        produces:  Object.keys(j.modifiers),
                        producers: j.value
                    };
                }
            });
        },

        computeProductionVectors: function()
        {
            var totalKittens   = ajk.base.getKittenInfo().length;
            this.updateJobTable();

            // Collect null production
            this.cachedResources = {};
            ajk.base.clearJobs();
            ajk.base.updateVillageResourceProduction();
            for (var jobName in this.cachedJobs)
            {
                var job = this.cachedJobs[jobName];
                job.produces.forEach((r) => {
                    this.cachedResources[r] = {};
                    this.cachedResources[r].nullProduction = ajk.base.getAccurateResPerTick(r);
                });
            }

            // Collect max production and approximate amount produced per kitten
            for (var jobName in this.cachedJobs)
            {
                var job = this.cachedJobs[jobName];
                ajk.base.clearJobs();
                if (!ajk.base.assignJobs(job.jobData, totalKittens))
                {
                    this.log.error('Failed to assign all kittens as ' + jobName + 's');
                    continue;
                }
                ajk.base.updateVillageResourceProduction();
                job.produces.forEach((r) => {
                    this.cachedResources[r].maxProduction = ajk.base.getAccurateResPerTick(r);

                    var delta = this.cachedResources[r].maxProduction - this.cachedResources[r].nullProduction;
                    var perProducer = delta / totalKittens;
                    this.cachedResources[r].approxPerProducer = perProducer;
                });
            }

            // Remove all workers
            ajk.base.clearJobs();
        },

        balanceJobs: function(majorUpdate, utilization)
        {
            var timer = ajk.timer.start('Job Balancing');

            var totalKittens   = ajk.base.getKittenInfo().length;
            var jobAssignments = {};

            if (majorUpdate)
            {
                timer.interval('Compute Production Vectors');
                this.computeProductionVectors();
            }

            // Collect current job data
            var currentJobData = {};
            ajk.base.getAllJobs().forEach((j) => {
                currentJobData[j.name] = j;
            });

            // Assign new jobs
            var jobPriorityOrder = Object.keys(this.cachedJobs).sort((a, b) => { return this.jobPriority[a] - this.jobPriority[b]; });

            // (1) Bring production vectors to 0 in priority order
            jobPriorityOrder.forEach((jobName) => {
                var workersRequired = this.cachedJobs[jobName].produces.reduce((a, r) => {
                    if (this.cachedResources[r].nullProduction > 0)
                    {
                        return a;
                    }
                    if (this.cachedResources[r].approxPerProducer == 0)
                    {
                        this.log.detail('No data collected on per-kitten production of ' + r + ', assigning at least one kitten to compensate for non-positive resource vector');
                        return Math.max(a, 1);
                    }

                    var req = Math.max(0, Math.ceil(-this.cachedResources[r].nullProduction / this.cachedResources[r].approxPerProducer));
                    this.log.detail(req + ' kittens needed to reach at least 0 production for ' + r);
                    return Math.max(a, req);
                }, 0);

                var workers = Math.min(totalKittens, workersRequired);
                this.log.debug('Assigning ' + workers + ' kittens to be ' + jobName + 's to reach 0-vector');
                ajk.util.ensureKeyAndModify(jobAssignments, jobName, 0, workers);
                totalKittens -= workers;
            });
            timer.interval('Normalize Production Vectors');

            // (2) Determine fixed / floating numbers
            var utilDenom = jobPriorityOrder.reduce((a, j) => {
                return a + this.cachedJobs[j].produces.reduce((b, r) => { return b + (utilization[r] || 0); }, 0);
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
            var ratioDenom = jobPriorityOrder.reduce((a, j) => { return a + (this.jobRatio[j] || 0); }, 0);
            jobPriorityOrder.forEach((jobName) => {
                var workers = Math.min(totalKittens, Math.ceil(nonFloaters * (this.jobRatio[jobName] || 0) / ratioDenom));
                this.log.debug('Assigning ' + workers + ' kittens to be fixed ' + jobName + 's');
                ajk.util.ensureKeyAndModify(jobAssignments, jobName, 0, workers);
                totalKittens -= workers;
            });
            timer.interval('Assign Fixed Roles');

            // (4) Apply floating positions based on utilization
            var floatingJobs = jobPriorityOrder.filter(j => j != 'farmer'); // We don't need floating farmers
            if (floaters > 0)
            {
                jobPriorityOrder.forEach((jobName) => {
                    var jobUtilization = this.cachedJobs[jobName].produces.reduce((a, r) => { return a + (utilization[r] || 0); }, 0);
                    var workers = Math.min(totalKittens, Math.ceil(floaters * jobUtilization / utilDenom));
                    this.log.debug('Assigning ' + workers + ' kittens to be floating ' + jobName + 's');
                    ajk.util.ensureKeyAndModify(jobAssignments, jobName, 0, workers);
                    totalKittens -= workers;
                });
            }
            timer.interval('Assign Floating Roles');

            // (5) Finish up
            if (totalKittens > 0)
            {
                this.log.warn('Unassigned kittens left - something went wrong in job assignment');
            }

            // Apply job asignments
            // Unassign surplus workers
            for (var jobName in currentJobData)
            {
                var targetWorkers = (jobAssignments[jobName] || 0);
                var delta = currentJobData[jobName].value - jobAssignments[jobName];
                if (delta > 0)
                {
                    this.log.debug('Removing ' + delta + ' surplus ' + jobName + 's');
                    if (!ajk.base.removeJobs(currentJobData[jobName], delta))
                    {
                        this.log.error('Failed to remove ' + jobName + 's');
                    }
                }
            }
            // Assign lacking workers
            for (var jobName in currentJobData)
            {
                var targetWorkers = (jobAssignments[jobName] || 0);
                var delta = jobAssignments[jobName] - currentJobData[jobName].value;
                if (delta > 0)
                {
                    this.log.debug('Assigning ' + delta + ' new ' + jobName + 's');
                    if (!ajk.base.assignJobs(currentJobData[jobName], delta))
                    {
                        this.log.error('Failed to assign ' + jobName + 's');
                    }
                }
            }
            timer.interval('Assign Jobs');

            // Balance
            if (ajk.base.censusAvailable())
            {
                ajk.base.optimizeJobs();
            }
            timer.end('Optimize Jobs');
        },
    },

    update: function(majorUpdate, utilization)
    {
        this.internal.chooseLeader();
        this.internal.balanceJobs(majorUpdate, utilization);
    },
};