'use strict';

var _ = require('lodash');

var GithubEvent = require('./event');

module.exports = class GithubPushEvent extends GithubEvent {
    constructor (event_id, event_type, payload) {

        // call the superclass constructor
        super (event_id, event_type, payload);

        // git hash of commit heads from previous and current push events
        this._event_params.before = payload.before;
        this._event_params.after = payload.after;

        // branch
        this._event_params.branch = payload.ref;

        // assume pusher and sender are always the same and grab pusher email. use this
        // to associate commits to sender. will this always be true?
        this._event_params.sender_email = payload.pusher.email;

        // commits array
        var commits = new Array ();
        _.map (payload.commits, function(commit) {
              // pick the commit properties that we need
              var new_commit = _.pick(commit, ['id', 'timestamp', 'message', 'author',
                                               'added', 'removed', 'modified']);
              commits.push (new_commit);
        });
        this._event_params.commits = commits;
    }
};
