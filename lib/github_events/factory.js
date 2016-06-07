'use strict'

var GithubEventNotImplementedError = require('./errors')
var GithubEventNotValidError = require('./errors')
var GithubPushEvent = require('./push')
var GithubCreateEvent = require('./create')

//
// Define Github webhook event types. Internal - not used outside of this module.
// 
// See docs for details: https://developer.github.com/v3/activity/events/types/
//
const GITHUB_COMMIT_COMMENT = "commit_comment"
const GITHUB_CREATE = "create"
const GITHUB_DELETE = "delete"
const GITHUB_DEPLOYMENT = "deployment"
const GITHUB_DEPLOYMENT_STATUS = "deployment_status"
const GITHUB_FORK = "fork"
const GITHUB_GOLLUM = "gollum"
const GITHUB_ISSUE_COMMENT = "issue_comment"
const GITHUB_ISSUES = "issues"
const GITHUB_MEMBER = "member"
const GITHUB_MEMBERSHIP = "membership"
const GITHUB_PAGE_BUILD = "page_build"
const GITHUB_PUBLIC = "public"
const GITHUB_PULL_REQUEST_COMMENT = "pull_request_review_comment"
const GITHUB_PULL_REQUEST = "pull_request"
const GITHUB_PUSH = "push"
const GITHUB_REPOSITORY = "repository"
const GITHUB_RELEASE = "release"
const GITHUB_STATUS = "status"
const GITHUB_TEAM_ADD = "team_add"
const GITHUB_WATCH = "watch"

module.exports = class GithubEventFactory {
    // 
    // static createEvent ():
    //
    // Create a new GithubEvent of the right type.
    //
    // @param event_id - The ID of the event
    // @param event_type - What type of event we want to create.
    // @param payload - the Github event JSON payload
    // @returns {GithubEvent} - The created event object.
    //
    static createEvent (event_id, event_type, payload) {
        switch (event_type) {
            case GITHUB_PUSH:
                // Any Git push to a Repository, including editing tags or
                // branches. Commits via API actions that update references are
                // also counted. This is the default event.
                return new GithubPushEvent (event_id, event_type, payload)
            case GITHUB_CREATE:
                // Any time a Branch or Tag is created.
                return new GithubCreateEvent (event_id, event_type, payload)

                // ********** ALL REMAINING EVENTS ARE NOT IMPLEMENTED **********
            case GITHUB_COMMIT_COMMENT:
                // Any time a Commit is commented on.
            case GITHUB_DELETE:
                // Any time a Branch or Tag is deleted.
            case GITHUB_DEPLOYMENT:
                // Any time a Repository has a new deployment created from the API
            case GITHUB_DEPLOYMENT_STATUS:
                // Any time a deployment for a Repository has a status update
                // from the API.
            case GITHUB_FORK:
                // Any time a Repository is forked.
            case GITHUB_GOLLUM:
                // Any time a Wiki page is updated.
            case GITHUB_ISSUE_COMMENT:
                // Any time a comment on an issue is created, edited, or deleted.
            case GITHUB_ISSUES:
                // Any time an Issue is assigned, unassigned, labeled, unlabeled,
                // opened, edited, closed, or reopened.
            case GITHUB_MEMBER:
                // Any time a User is added as a collaborator to a non-
                // Organization Repository.
            case GITHUB_MEMBERSHIP:
                // Any time a User is added or removed from a team. Organization
                // hooks only.
            case GITHUB_PAGE_BUILD:
                // Any time a Pages site is built or results in a failed build.
            case GITHUB_PUBLIC:
                // Any time a Repository changes from private to public.
            case GITHUB_PULL_REQUEST_COMMENT:
                // Any time a comment on a Pull Request's unified diff is created,
                // edited, or deleted (in the Files Changed tab).
            case GITHUB_PULL_REQUEST:
                // Any time a Pull Request is assigned, unassigned, labeled,
                // unlabeled, opened, edited, closed, reopened, or synchronized
                // (updated due to a new push in the branch that the pull request
                // is tracking).
            case GITHUB_REPOSITORY:
                // Any time a Repository is created, deleted, made public, or
                // made private.
            case GITHUB_RELEASE:
                // Any time a Release is published in a Repository.
            case GITHUB_STATUS:
                // Any time a Repository has a status update from the API
            case GITHUB_TEAM_ADD:
                // Any time a team is added or modified on a Repository.
            case GITHUB_WATCH:
                // Any time a User stars a Repository.
                throw new GithubEventNotImplementedError(event_type)
            default:
                throw new GithubEventNotValidError(event_type)
        }
    }
}
