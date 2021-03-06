'use strict'

var _ = require('lodash')
var genId = require('gen-id')('AXXXXXXX') // neo4j ids start with a letter

var GithubUser = require('./user')
var GithubEvent = require('./event')
var Event = require('../../models/event')

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
        super (event_id, event_type, payload)

        // git hash of commit heads from previous and current push events
        this._event_params.before = payload.before
        this._event_params.after = payload.after

        // branch
        this._event_params.branch = payload.ref

        // assume pusher and sender are always the same and grab pusher email. use this
        // to associate commits to sender. will this always be true?
        this._event_params.sender_email = payload.pusher.email

        // commits array
        var commits = new Array ()
        _.map (payload.commits, (commit) => {
              // pick the commit properties that we need
              var new_commit = _.pick(commit, ['id', 'timestamp', 'author', 'committer',
                                               'added', 'removed', 'modified'])
              commits.push (new_commit)
        })
        this._event_params.commits = commits
    }

    // 
    // save ():
    //
    // Transform params object into Neo4J Cypher query and save to the database.
    //
    // @param callback (err) - 
    //
    save (callback) {
        var params = this._event_params // just a crutch
        var path = `${params.repo_name}/${params.branch}` // to build file queries

        // handle properties and relationships specific to push events
        this._queries.push ({ query: buildPushEventQuery (params) } )
        this._queries.push ({ query: buildConnectToPreviousPushEventQuery (params) } )

        // add commits... it's possible for push events to have no commits
        _.map (params.commits, (commit) => {
            // create new commit. no need to store sequence since commits can
            // be sorted by timestamp to determine sequence.
            this._queries.push ({ query: buildCommitQuery (params.event_id,
                                                           params.branch,
                                                           commit) })

            if ((!_.isEmpty (commit.added))) {
                this._queries.push ({ query: buildAddedFilesQuery (path, commit) })
            }
            if ((!_.isEmpty (commit.modified))) {
                this._queries.push ({ query: buildModifiedFilesQuery (path, commit) })
            }
            if ((!_.isEmpty (commit.removed))) {
                this._queries.push ({ query: buildRemovedFilesQuery (path, commit) })
            }

            // generate array of author queries based on username and email
            const author = new GithubUser (commit.author.username,
                                           commit.author.email)
            this._queries = _.concat (this._queries, author.getCreateQueries ())

            // connect commit to author
            this._queries.push ({ query: buildConnectCommitToAuthorQuery (commit) })

            // generate array of committer queries based on username and email
            const committer = new GithubUser (commit.committer.username,
                                              commit.committer.email)
            this._queries = _.concat (this._queries, committer.getCreateQueries ())

            // connect commit to committer
            this._queries.push ({ query: buildConnectCommitToCommitterQuery (commit) })
        })

        // superclass will prepend these queries with its own query to ensure that the
        // base event is created first
        super.save (callback)
    }
}

//
// Private functions (build Neo4j Cypher queries)
//
function buildPushEventQuery (params) {
    // we've already created/updated the sender User as part of the base query, so just 
    // add the email address here
    var query = [
        `MATCH (ev:Event { event_id: '${params.event_id}' })`,
        `MATCH (repo:Repo { name: '${params.repo_name}' })`,
        `SET ev += { before: '${params.before}', after: '${params.after}' }`,
        `MERGE (branch:Branch { ref: '${params.branch}' })`,
        `MERGE (ev) -[rel5:pushes_to]-> (branch)`,
        `MERGE (branch) -[rel6:belongs_to]-> (repo)`,
    ].join('\n')

    return (query)
}

function buildConnectToPreviousPushEventQuery (params) {
    var query = [
        `MATCH (this_push:Event { event_id: '${params.event_id}' } )`,
        `MATCH (previous_push:Event { after: '${params.before}' } )`,
        `MERGE (this_push) -[rel:follows]-> (previous_push)`,
    ].join('\n')

    return (query)
}

function buildCommitQuery (event_id, branch, commit) {
    var query = [
        `MATCH (event:Event { event_id: '${event_id}' } )`,
        `MATCH (branch:Branch { ref: '${branch}' })`,
        `MERGE (commit:Commit { commit_id : '${commit.id}', timestamp: '${commit.timestamp}' })`,
        `MERGE (event) -[rel1:pushes]-> (commit)`,
        `MERGE (commit) -[rel2:belongs_to]-> (branch)`,
    ].join('\n')

    return (query)
}

function buildAddedFilesQuery (path, commit) {
    var query = ''

    query += `MATCH (commit:Commit { commit_id : '${commit.id}' } )`

    _.map (commit.added, (file) => {
        var fstr = genId.generate()
        var rel1 = genId.generate()
        var filename = `${path}/${file}` // Save full repo/branch/file

        // always create a new file when adding
        query += `\nWITH commit`
        query += `\nMERGE (${fstr}:File { name : '${filename}' })`
        query += `\nMERGE (commit) -[${rel1}:adds]-> (${fstr})`
    })

    return (query)
}

function buildModifiedFilesQuery (path, commit) {
    var query = ''

    query += `MATCH (commit:Commit { commit_id : '${commit.id}' } )`

    _.map (commit.modified, (file) => {
        var fstr = genId.generate()
        var rel1 = genId.generate()
        var filename = `${path}/${file}` // Save full repo/branch/file

        // find existing file to modify. need to MERGE in neo4j since we don't know if
        // the the push event that created the file was actually captured.
        query += `\nWITH commit`
        query += `\nMERGE (${fstr}:File { name : '${filename}' })`
        query += `\nMERGE (commit) -[${rel1}:modifies]-> (${fstr})`
    })

    return (query)
}

function buildRemovedFilesQuery (path, commit) {
    var query = ''

    query += `MATCH (commit:Commit { commit_id : '${commit.id}' } )`

    _.map (commit.removed, (file) => {
        var fstr = genId.generate()
        var rel1 = genId.generate()
        var filename = `${path}/${file}` // Save full repo/branch/file

        // find existing file to remove
        query += `\nWITH commit`
        query += `\nMERGE (${fstr}:File { name : '${filename}' })`
        query += `\nMERGE (commit) -[${rel1}:removes]-> (${fstr})`
    })

    return (query)
}

// there are cases where commit author/committer usernames are blank. Not sure why.
function buildConnectCommitToAuthorQuery (commit) {
    var query = ''
    if (commit.author.username) {
        query = [
            `MATCH (commit:Commit { commit_id : '${commit.id}' } )`,
            `MATCH (author:User { login : '${commit.author.username}' })`,
            `MERGE (author) -[r:authors]-> (commit)`,
        ].join('\n')
    } else {
        query = [
            `MATCH (commit:Commit { commit_id : '${commit.id}' } )`,
            `MATCH (author:User { email : '${commit.author.email}' })`,
            `MERGE (author) -[r:authors]-> (commit)`,
        ].join('\n')
    }
    return (query)
}

function buildConnectCommitToCommitterQuery (commit) {
    var query = ''
    if (commit.author.username) {
        var query = [
            `MATCH (commit:Commit { commit_id : '${commit.id}' } )`,
            `MATCH (committer:User { login : '${commit.committer.username}' })`,
            `MERGE (committer) -[r:commits]-> (commit)`,
        ].join('\n')
    } else {
        query = [
            `MATCH (commit:Commit { commit_id : '${commit.id}' } )`,
            `MATCH (committer:User { email : '${commit.committer.email}' })`,
            `MERGE (committer) -[r:commits]-> (commit)`,
        ].join('\n')
    }
    return (query)
}
