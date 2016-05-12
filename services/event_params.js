var moment = require('moment');

// Constructor
function EventParams () {
  // always initialize all instance properties
}

/*
 * Define Github webhook event types. See docs for details:
 *
 * https://developer.github.com/v3/activity/events/types/
 */
EventParams.GITHUB_COMMIT_COMMENT = "commit_comment";
EventParams.GITHUB_CREATE = "create";
EventParams.GITHUB_DELETE = "delete";
EventParams.GITHUB_DEPLOYMENT = "deployment";
EventParams.GITHUB_DEPLOYMENT_STATUS = "deployment_status";
EventParams.GITHUB_FORK = "fork";
EventParams.GITHUB_EVENT_GOLLUM = "gollum";
EventParams.GITHUB_ISSUE_COMMENT = "issue_comment";
EventParams.GITHUB_ISSUES = "issues";
EventParams.GITHUB_MEMBER = "member";
EventParams.GITHUB_MEMBERSHIP = "membership";
EventParams.GITHUB_PAGE_BUILD = "page_build";
EventParams.GITHUB_PUBLIC = "public";
EventParams.GITHUB_PULL_REQUEST_COMMENT = "pull_request_review_comment";
EventParams.GITHUB_PULL_REQUEST = "pull_request";
EventParams.GITHUB_PUSH = "push";
EventParams.GITHUB_REPOSITORY = "repository";
EventParams.GITHUB_RELEASE = "release";
EventParams.GITHUB_STATUS = "status";
EventParams.GITHUB_TEAM_ADD = "team_add";
EventParams.GITHUB_WATCH = "watch";

// private functions
function getCommonEventParams (event_id, event_type, payload, callback) {
    // Collect common event parameters
    var event_params = {
        event_id: event_id,
        event_type: event_type,
        timestamp: moment().format(),
        repo_name: payload.repository.name,
        org_login: payload.organization.login,
        sender_login: payload.sender.login,
    };

    callback (null, event_params);
};

// class methods
EventParams.getPush = function (event_id, payload, callback) {
    getCommonEventParams (event_id, EventParams.GITHUB_PUSH, payload,
                          function (err, event_params) {

        // add Push event specific properties
        event_params.before = payload.before;
        event_params.after = payload.after;

        // add branch
        event_params.ref = payload.ref;

        // assume pusher and sender are always the same

/*
        // commits array
        // commit head - sames as last commit in the commits array
        console.log(payload.head_commit.id);
        console.log(payload.head_commit.tree_id);
        console.log(payload.head_commit.message);
        console.log(payload.head_commit.timestamp);

        console.log(payload.head_commit.author.name);
        console.log(payload.head_commit.author.email);

        console.log(payload.head_commit.committer.name);
        console.log(payload.head_commit.committer.email);

        // head_commit added array
        // head_commit removed array
        // head_commit modified array
*/

        callback (null, event_params);
    });
};

// export the class
module.exports = EventParams;
