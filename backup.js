'use strict';

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