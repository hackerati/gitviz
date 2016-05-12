var URL = require('url');

var EventParams = require('../services/event_params');
var Event = require('../models/event');

exports.create = function (req, res, next) {
    if(!req.isXHub || !req.isXHubValid()){
        return res.status(403).json({ error: 'Unauthorized' });
    }

    var event_id = req.get('X-GitHub-Delivery');
    var event_type = req.get('X-GitHub-Event');

    switch (event_type) {
        case EventParams.GITHUB_COMMIT_COMMENT:
            // Any time a Commit is commented on.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_CREATE:
            // Any time a Branch or Tag is created.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_DELETE:
            // Any time a Branch or Tag is deleted.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_DEPLOYMENT:
            // Any time a Repository has a new deployment created from the API
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_DEPLOYMENT_STATUS:
            // Any time a deployment for a Repository has a status update
            // from the API.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_FORK:
            // Any time a Repository is forked.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_GOLLUM:
            // Any time a Wiki page is updated.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_ISSUE_COMMENT:
            // Any time a comment on an issue is created, edited, or deleted.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_ISSUES:
            // Any time an Issue is assigned, unassigned, labeled, unlabeled,
            // opened, edited, closed, or reopened.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_MEMBER:
            // Any time a User is added as a collaborator to a non-
            // Organization Repository.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_MEMBERSHIP:
            // Any time a User is added or removed from a team. Organization
            // hooks only.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_PAGE_BUILD:
            // Any time a Pages site is built or results in a failed build.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_PUBLIC:
            // Any time a Repository changes from private to public.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_PULL_REQUEST_COMMENT:
            // Any time a comment on a Pull Request's unified diff is created,
            // edited, or deleted (in the Files Changed tab).
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_PULL_REQUEST:
            // Any time a Pull Request is assigned, unassigned, labeled,
            // unlabeled, opened, edited, closed, reopened, or synchronized
            // (updated due to a new push in the branch that the pull request
            // is tracking).
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_PUSH:
            // Any Git push to a Repository, including editing tags or
            // branches. Commits via API actions that update references are
            // also counted. This is the default event.
            EventParams.getPush (event_id, req.body, function (err, params) {
                if (err) throw err;
                Event.createPush (params, function (err) {
                    if (err) throw err;
                    return res.status(201).json({ success: 'Created' });
                });
            });
            break;
        case EventParams.GITHUB_REPOSITORY:
            // Any time a Repository is created, deleted, made public, or
            // made private.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_RELEASE:
            // Any time a Release is published in a Repository.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_STATUS:
            // Any time a Repository has a status update from the API
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_TEAM_ADD:
            // Any time a team is added or modified on a Repository.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        case EventParams.GITHUB_WATCH:
            // Any time a User stars a Repository.
            return res.status(501).json({ error:
                                          `Not Implemented: ${event_type}` });
        default:
            return res.status(400).json({ error:
                                          `Unknown Event: ${event_type}` });
    }
};
