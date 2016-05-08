var URL = require('url');
var moment = require('moment');

var Event = require('../models/event');

exports.create = function (req, res, next) {
    if(!req.isXHub || !req.isXHubValid()){
        return res.status(403).json({ error: 'unauthorized' });
    }

    Event.create({
        id: req.get('X-GitHub-Delivery'),
        timestamp: moment().format(),
        event_type: req.get('X-GitHub-Event'),
        payload: JSON.stringify(req.body, null, 2)
    }, function (err, event) {
        if (err) throw err;

        console.log(event);
        res.status(201).json(event);
    });
};
