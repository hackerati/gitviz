'use strict';

var _ = require('lodash');
var genId = require('gen-id')('AXXXXXXX') // neo4j ids start with a letter

var GithubEvent = require('./event');
var Event = require('../../models/event');

module.exports = class GithubPushEvent extends GithubEvent {
    // 
    // constructor ():
    //
    // Create a new GithubPushEvent, transforming JSON payload to params object.
    //
    // @param event_id - The ID of the event
    // @param event_type - What type of event we want to create.
    // @param payload - the Github event JSON payload
    // @returns {GithubPushEvent} - The created event object.
    //
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
              var new_commit = _.pick(commit, ['id', 'timestamp', 'author',
                                               'added', 'removed', 'modified']);
              commits.push (new_commit);
        });
        this._event_params.commits = commits;
    }

    // 
    // save ():
    //
    // Transform params object into Neo4J Cypher query and save to the database.
    //
    // @param callback (err) - 
    //
    save (callback) {
        var params = this._event_params; // just a crutch
        var queries = this._queries;
        var path = `${params.repo_name}/${params.branch}`; // to build file queries

        // always create a new Event, associated with the appropriate repo, org,
        // and user
        queries.push ({ query: buildBaseEventQuery (params) } );

        // handle properties and relationships specific to push events
        queries.push ({ query: buildPushEventQuery (params) } );
        queries.push ({ query: buildConnectToPreviousPushEventQuery (params) } );

        // add commits... it's possible for push events to have no commits
        _.map (params.commits, function(commit) {
            // create new commit. no need to store sequence since commits can
            // be sorted by timestamp to determine sequence.
            queries.push ({ query: buildCommitQuery (params.event_id,
                                                     params.branch,
                                                     commit) });

            if ((!_.isEmpty (commit.added))) {
                queries.push ({ query: buildAddedFilesQuery (path, commit) });
            }
            if ((!_.isEmpty (commit.modified))) {
                queries.push ({ query: buildModifiedFilesQuery (path, commit) });
            }
            if ((!_.isEmpty (commit.removed))) {
                queries.push ({ query: buildRemovedFilesQuery (path, commit) });
            }

            // connect commit to user
            queries.push ({ query: buildConnectCommitToUserQuery (commit) });
        });

        Event.runQuery (this._queries, callback);
    }
}

//
// Private functions (build Neo4j Cypher queries)
//
function buildBaseEventQuery (params) {
    // Assume sender and pusher are always the same and construct a User from
    // the sender's login and the pusher's email. We'll need email to connect
    // Commits to Users.
    var query = [
        `CREATE (ev:Event { event_id : '${params.event_id}', timestamp : '${params.timestamp}', type: '${params.event_type}' })`,
        `MERGE (repo:Repo { name : '${params.repo_name}' })`,
        `MERGE (org:Org { login: '${params.org_login}' })`,
        `MERGE (sender:User { login: '${params.sender_login}', email: '${params.sender_email}' })`,
        `MERGE (ev) -[rel1:belongs_to]-> (repo)`,
        `MERGE (repo) -[rel2:belongs_to]-> (org)`,
        `MERGE (sender) -[rel4:sends]-> (ev)`,
    ].join('\n');

    return (query);
}

function buildPushEventQuery (params) {
    var query = [
        `MATCH (ev:Event { event_id: '${params.event_id}' } )`,
        `MATCH (repo:Repo { name : '${params.repo_name}' })`,
        `SET ev += { before: '${params.before}', after: '${params.after}' }`,
        `MERGE (branch:Branch { ref: '${params.branch}' })`,
        `MERGE (ev) -[rel5:pushes_to]-> (branch)`,
        `MERGE (branch) -[rel6:belongs_to]-> (repo)`,
    ].join('\n');

    return (query);
}

function buildConnectToPreviousPushEventQuery (params) {
    var query = [
        `MATCH (this_push:Event { event_id: '${params.event_id}' } )`,
        `MATCH (previous_push:Event { after: '${params.before}' } )`,
        `MERGE (this_push) -[rel:follows]-> (previous_push)`,
    ].join('\n');

    return (query);
}

function buildCommitQuery (event_id, branch, commit) {
    var query = [
        `MATCH (event:Event { event_id: '${event_id}' } )`,
        `MATCH (branch:Branch { ref: '${branch}' })`,
        `CREATE (commit:Commit { commit_id : '${commit.id}', timestamp: '${commit.timestamp}', author_email: '${commit.author.email}' })`,
        `MERGE (event) -[rel1:pushes]-> (commit)`,
        `MERGE (commit) -[rel2:belongs_to]-> (branch)`,
    ].join('\n');

    return (query);
}

function buildAddedFilesQuery (path, commit) {
    var query = '';

    query += `MATCH (commit:Commit { commit_id: '${commit.id}' } )`;

    _.map (commit.added, function(file) {
        var fstr = genId.generate();
        var rel1 = genId.generate();
        var filename = `${path}/${file}`; // Save full repo/branch/file

        // always create a new file when adding
        query += `\nCREATE (${fstr}:File { name : '${filename}' })`;
        query += `\nMERGE (commit) -[${rel1}:adds]-> (${fstr})`;
    });

    return (query);
}

function buildModifiedFilesQuery (path, commit) {
    var query = '';

    query += `MATCH (commit:Commit { commit_id: '${commit.id}' } )`;

    _.map (commit.modified, function(file) {
        var fstr = genId.generate();
        var rel1 = genId.generate();
        var filename = `${path}/${file}`; // Save full repo/branch/file

        // find existing file to modify. need to MERGE in neo4j since we don't know if
        // the the push event that created the file was actually captured.
        query += `\nWITH commit`;
        query += `\nMERGE (${fstr}:File { name : '${filename}' })`;
        query += `\nMERGE (commit) -[${rel1}:modifies]-> (${fstr})`;
    });

    return (query);
}

function buildRemovedFilesQuery (path, commit) {
    var query = '';

    query += `MATCH (commit:Commit { commit_id: '${commit.id}' } )`;

    _.map (commit.removed, function(file) {
        var fstr = genId.generate();
        var rel1 = genId.generate();
        var filename = `${path}/${file}`; // Save full repo/branch/file

        // find existing file to remove
        query += `\nWITH commit`;
        query += `\nMERGE (${fstr}:File { name : '${filename}' })`;
        query += `\nMERGE (commit) -[${rel1}:removes]-> (${fstr})`;
    });

    return (query);
}

function buildConnectCommitToUserQuery (commit) {
    var query = [
        `MATCH (commit:Commit { commit_id: '${commit.id}' } )`,
        `MATCH (user:User { email: '${commit.author.email}' })`,
        `MERGE (user) -[r:commits]-> (commit)`,
    ].join('\n');

    return (query);
}
