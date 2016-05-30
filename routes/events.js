'use strict'

var GithubEventFactory = require('../lib/github_events/factory')
var GithubEventNotImplementedError = require('../lib/github_events/errors')
var GithubEventNotValidError = require('../lib/github_events/errors')

module.exports = class EventRouteHandlers {
    // 
    // static create ():
    //
    // POST event callback to handler
    //
    // @param req - request
    // @param res - response
    // @param next - next handler
    // @returns json - response status & json
    //
    // HTTP Status             Result
    // -----------             ------ 
    // 201 Created             Event successfully processed
    // 403 Forbidden           Missing or invalid X-Hub-Signature
    // 501 Not Implemented     Invalid X-GitHub-Event
    // 400 Bad Request         Invalid JSON Payload
    // 502 Bad Gateway         Error from neo4j API call
    // 504 Gateway Timeout     Timeout from neo4j API call
    //
    static create (req, res, next) {
        if(!req.isXHub || !req.isXHubValid()){
            return res.status(403).json({ error: 'Unauthorized' })
        }

        var event_id = req.get('X-GitHub-Delivery')
        var event_type = req.get('X-GitHub-Event')

        try {
            var event = GithubEventFactory.createEvent (event_id, event_type, req.body)
            event.save ((err) => {
                if (err) {
                    console.error (err)
                    return res.status(502).json({ error: err })
                }
                return res.status(201).json({ success: 'Created' })
            })
        } catch (err) {
	    console.error (err)
            return res.status(501).json({ error: err })
        }
    }
}
