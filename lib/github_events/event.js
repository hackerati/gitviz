'use strict';

var moment = require('moment');

module.exports = class GithubEvent {
    constructor (event_id, event_type, payload) {
        this._event_params = {
            event_id: event_id,
            event_type: event_type,
            timestamp: moment().format(),
            repo_name: payload.repository.full_name,
            org_login: payload.organization.login,
            sender_login: payload.sender.login,
        };
    }

    toParams () {
        return (this._event_params);
    }
};
