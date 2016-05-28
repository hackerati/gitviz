var URL = require('url');

var GithubEventFactory = require('../lib/github_events/factory');
var GithubEventNotImplementedError = require('../lib/github_events/errors');
var GithubEventNotValidError = require('../lib/github_events/errors');
var Event = require('../models/event');

exports.create = function (req, res, next) {
    if(!req.isXHub || !req.isXHubValid()){
        return res.status(403).json({ error: 'Unauthorized' });
    }

    var event_id = req.get('X-GitHub-Delivery');
    var event_type = req.get('X-GitHub-Event');

    try {
        var event = GithubEventFactory.createEvent (event_id, event_type, req.body);
        event.save (function (err) {
            if (err) {
                return res.status(502).json({ error: err });
            }
            return res.status(201).json({ success: 'Created' });
        });
    } catch (err) {
        return res.status(501).json({ error: err });
    }
};
