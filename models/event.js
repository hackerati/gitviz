var neo4j = require('neo4j');
var moment = require('moment');

var db = new neo4j.GraphDatabase({
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
        'http://neo4j:neo4j@localhost:7474',
    auth: process.env['NEO4J_AUTH'],
});

var Event = module.exports = function Event(_node) {
    this._node = _node;
}

/*
 * Define Github webhook event types. See docs for details:
 *
 * https://developer.github.com/v3/activity/events/types/
 */
Event.GITHUB_COMMIT_COMMENT = "commit_comment";
Event.GITHUB_CREATE = "create";
Event.GITHUB_DELETE = "delete";
Event.GITHUB_DEPLOYMENT = "deployment";
Event.GITHUB_DEPLOYMENT_STATUS = "deployment_status";
Event.GITHUB_FORK = "fork";
Event.GITHUB_EVENT_GOLLUM = "gollum";
Event.GITHUB_ISSUE_COMMENT = "issue_comment";
Event.GITHUB_ISSUES = "issues";
Event.GITHUB_MEMBER = "member";
Event.GITHUB_MEMBERSHIP = "membership";
Event.GITHUB_PAGE_BUILD = "page_build";
Event.GITHUB_PUBLIC = "public";
Event.GITHUB_PULL_REQUEST_COMMENT = "pull_request_review_comment";
Event.GITHUB_PULL_REQUEST = "pull_request";
Event.GITHUB_PUSH = "push";
Event.GITHUB_REPOSITORY = "repository";
Event.GITHUB_RELEASE = "release";
Event.GITHUB_STATUS = "status";
Event.GITHUB_TEAM_ADD = "team_add";
Event.GITHUB_WATCH = "watch";

Event.createPush = function (event_id, event_payload, callback) {
    db.cypher({
        query: 'CREATE (event:Event { id : {id}, timestamp : {timestamp}, event_type: {event_type}, payload: {payload} }) RETURN event',
        params: {
            id: event_id,
            timestamp: moment().format(),
            event_type: Event.GITHUB_PUSH,
            payload: JSON.stringify(event_payload, null, 2)
        },
    }, function (err, results) {
        if (err) return callback(err);
        var event = new Event(results[0]['event']);
        callback(null, event);
    });
};
