'use strict'

var chai = require('chai')
var expect = chai.expect
var sinon = require('sinon')
var _ = require('lodash')

var utils = require('./utils')

var GithubPushEvent = require('../../../lib/github_events/push')
var Event = require('../../../models/event')

describe ('GithubPushEvent', () => {
    const id = 'my_id'
    const type = 'my_type'
    const payload = {
            repository : { full_name : 'my_repo' },
            organization : { login : 'my_org' },
            sender : { login : 'my_login' },
            before : 'before_hash',
            after : 'after_hash',
            ref : 'my_branch',
            pusher : { email : 'my_email' },
    }
    const expected_event_query = 'MERGE (ev:Event { event_id : \'my_id\' })\nON CREATE SET ev.event_type = \'my_type\', ev.timestamp = \'2016-01-01T00:00:00-04:00\'\nON MATCH SET ev.redelivered_on = \'2016-01-01T00:00:00-04:00\'\nMERGE (repo:Repo { name : \'my_repo\' })\nMERGE (org:Org { login : \'my_org\' })\nMERGE (ev) -[rel1:belongs_to]-> (repo)\nMERGE (repo) -[rel2:belongs_to]-> (org)'
    const expected_user_query_1 = 'START first=node(*), second=node(*)\nWHERE has(first.login) and not(has(first.email)) and has(second.email) and not(has(second.login))\nWITH first, second\nWHERE first.login = \'my_login\' AND second.email = \'my_email\'\nSET first.email = \'my_email\'\nDELETE second'
    const expected_user_query_2 = 'MATCH (user:User)\nWHERE user.email = \'my_email\' OR user.login = \'my_login\'\nSET user.login = \'my_login\'\nSET user.email = \'my_email\''
    const expected_user_query_3 = 'MERGE (user:User { login : \'my_login\', email : \'my_email\' })'
    const expected_user_query_4 = 'MERGE (user:User { login : \'my_login\' })'
    const expected_user_query_5 = 'MERGE (user:User { email : \'my_email\' })'
    const expected_connect_user_to_event_query = 'MATCH (sender:User { login : \'my_login\' })\nMATCH (ev:Event { event_id : \'my_id\' })\nMERGE (sender) -[rel:sends]-> (ev)'
    const expected_push_event_query = 'MATCH (ev:Event { event_id: \'my_id\' })\nMATCH (repo:Repo { name: \'my_repo\' })\nSET ev += { before: \'before_hash\', after: \'after_hash\' }\nMERGE (branch:Branch { ref: \'my_branch\' })\nMERGE (ev) -[rel5:pushes_to]-> (branch)\nMERGE (branch) -[rel6:belongs_to]-> (repo)'
    const expected_connect_to_previous_push_event_query = 'MATCH (this_push:Event { event_id: \'my_id\' } )\nMATCH (previous_push:Event { after: \'before_hash\' } )\nMERGE (this_push) -[rel:follows]-> (previous_push)'
    const expected_commit_query = 'MATCH (event:Event { event_id: \'my_id\' } )\nMATCH (branch:Branch { ref: \'my_branch\' })\nMERGE (commit:Commit { commit_id : \'commit_id\', timestamp: \'my_timestamp\' })\nMERGE (event) -[rel1:pushes]-> (commit)\nMERGE (commit) -[rel2:belongs_to]-> (branch)'
    const expected_file_added_query = 'MATCH (commit:Commit { commit_id : \'commit_id\' } )\nWITH commit\nMERGE (file:File { name : \'my_repo/my_branch/file.txt\' })\nMERGE (commit) -[rel:adds]-> (file)'
    const expected_file_modified_query = 'MATCH (commit:Commit { commit_id : \'commit_id\' } )\nWITH commit\nMERGE (file:File { name : \'my_repo/my_branch/file.txt\' })\nMERGE (commit) -[rel:modifies]-> (file)'
    const expected_file_removed_query = 'MATCH (commit:Commit { commit_id : \'commit_id\' } )\nWITH commit\nMERGE (file:File { name : \'my_repo/my_branch/file.txt\' })\nMERGE (commit) -[rel:removes]-> (file)'
    const expected_connect_commit_to_author_query = 'MATCH (commit:Commit { commit_id : \'commit_id\' } )\nMATCH (author:User { login : \'my_login\' })\nMERGE (author) -[r:authors]-> (commit)'
    const expected_connect_commit_to_author_using_email_query = 'MATCH (commit:Commit { commit_id : \'commit_id\' } )\nMATCH (author:User { email : \'my_email\' })\nMERGE (author) -[r:authors]-> (commit)'
    const expected_connect_commit_to_committer_query = 'MATCH (commit:Commit { commit_id : \'commit_id\' } )\nMATCH (committer:User { login : \'my_login\' })\nMERGE (committer) -[r:commits]-> (commit)'
    const expected_connect_commit_to_committer_using_email_query = 'MATCH (commit:Commit { commit_id : \'commit_id\' } )\nMATCH (committer:User { email : \'my_email\' })\nMERGE (committer) -[r:commits]-> (commit)'

    it ('should save an event without commits', () => {
        var stub = sinon.stub(Event, "runQuery", (received_queries, callback) => {
            received_queries[0].query = utils.fixTime (received_queries[0].query)
            var expected_queries = [
                { query: expected_event_query },
                { query: expected_user_query_1 },
                { query: expected_user_query_2 },
                { query: expected_user_query_3 },
                { query: expected_connect_user_to_event_query },
                { query: expected_push_event_query },
                { query: expected_connect_to_previous_push_event_query },
            ]
            expect (received_queries.length).to.equal(expected_queries.length)
            _.map (received_queries, (received_query, index) => {
                expect (received_query.query).to.equal(expected_queries[index].query)
            })
            callback (null)
        })
        payload.commits = new Array ()
        var event = new GithubPushEvent (id, type, payload)
        event.save ((err) => {
            expect (err).to.be.null
        })
        stub.restore ()
    })

    it ('should save an event with commits and files to add', () => {
        var stub = sinon.stub(Event, "runQuery", (received_queries, callback) => {
            received_queries[0].query = utils.fixTime (received_queries[0].query)
            received_queries[8].query = fixAddedFile (received_queries[8].query)
            var expected_queries = [
                { query: expected_event_query },
                { query: expected_user_query_1 },
                { query: expected_user_query_2 },
                { query: expected_user_query_3 },
                { query: expected_connect_user_to_event_query },
                { query: expected_push_event_query },
                { query: expected_connect_to_previous_push_event_query },
                { query: expected_commit_query },
                { query: expected_file_added_query },
                { query: expected_user_query_1 },
                { query: expected_user_query_2 },
                { query: expected_user_query_3 },
                { query: expected_connect_commit_to_author_query },
                { query: expected_user_query_1 },
                { query: expected_user_query_2 },
                { query: expected_user_query_3 },
                { query: expected_connect_commit_to_committer_query },
            ]
            expect (received_queries.length).to.equal(expected_queries.length)
            _.map (received_queries, (received_query, index) => {
                expect (received_query.query).to.equal(expected_queries[index].query)
            })
            callback (null)
        })
        payload.commits = new Array ()
        payload.commits.push ({
            id: 'commit_id',
            timestamp: 'my_timestamp',
            author: { email: 'my_email', username: 'my_login' },
            committer: { email: 'my_email', username: 'my_login' },
            added: [ 'file.txt' ],
        })
        var event = new GithubPushEvent (id, type, payload)
        event.save ((err) => {
            expect (err).to.be.null
        })
        stub.restore ()
    })

    it ('should save an event with commits and files to modify', () => {
        var stub = sinon.stub(Event, "runQuery", (received_queries, callback) => {
            received_queries[0].query = utils.fixTime (received_queries[0].query)
            received_queries[8].query = fixModifiedFile (received_queries[8].query)
            var expected_queries = [
                { query: expected_event_query },
                { query: expected_user_query_1 },
                { query: expected_user_query_2 },
                { query: expected_user_query_3 },
                { query: expected_connect_user_to_event_query },
                { query: expected_push_event_query },
                { query: expected_connect_to_previous_push_event_query },
                { query: expected_commit_query },
                { query: expected_file_modified_query },
                { query: expected_user_query_1 },
                { query: expected_user_query_2 },
                { query: expected_user_query_3 },
                { query: expected_connect_commit_to_author_query },
                { query: expected_user_query_1 },
                { query: expected_user_query_2 },
                { query: expected_user_query_3 },
                { query: expected_connect_commit_to_committer_query },
            ]
            expect (received_queries.length).to.equal(expected_queries.length)
            _.map (received_queries, (received_query, index) => {
                expect (received_query.query).to.equal(expected_queries[index].query)
            })
            callback (null)
        })
        payload.commits = new Array ()
        payload.commits.push ({
            id: 'commit_id',
            timestamp: 'my_timestamp',
            author: { email: 'my_email', username: 'my_login' },
            committer: { email: 'my_email', username: 'my_login' },
            modified: [ 'file.txt' ],
        })
        var event = new GithubPushEvent (id, type, payload)
        event.save ((err) => {
            expect (err).to.be.null
        })
        stub.restore ()
    })

    it ('should save an event with commits and files to remove', () => {
        var stub = sinon.stub(Event, "runQuery", (received_queries, callback) => {
            received_queries[0].query = utils.fixTime (received_queries[0].query)
            received_queries[8].query = fixRemovedFile (received_queries[8].query)
            var expected_queries = [
                { query: expected_event_query },
                { query: expected_user_query_1 },
                { query: expected_user_query_2 },
                { query: expected_user_query_3 },
                { query: expected_connect_user_to_event_query },
                { query: expected_push_event_query },
                { query: expected_connect_to_previous_push_event_query },
                { query: expected_commit_query },
                { query: expected_file_removed_query },
                { query: expected_user_query_1 },
                { query: expected_user_query_2 },
                { query: expected_user_query_3 },
                { query: expected_connect_commit_to_author_query },
                { query: expected_user_query_1 },
                { query: expected_user_query_2 },
                { query: expected_user_query_3 },
                { query: expected_connect_commit_to_committer_query },
            ]
            expect (received_queries.length).to.equal(expected_queries.length)
            _.map (received_queries, (received_query, index) => {
                expect (received_query.query).to.equal(expected_queries[index].query)
            })
            callback (null)
        })
        payload.commits = new Array ()
        payload.commits.push ({
            id: 'commit_id',
            timestamp: 'my_timestamp',
            author: { email: 'my_email', username: 'my_login' },
            committer: { email: 'my_email', username: 'my_login' },
            removed: [ 'file.txt' ],
        })
        var event = new GithubPushEvent (id, type, payload)
        event.save ((err) => {
            expect (err).to.be.null
        })
        stub.restore ()
    })

    it ('should save an event with commits and no author/committer usernames', () => {
        var stub = sinon.stub(Event, "runQuery", (received_queries, callback) => {
            received_queries[0].query = utils.fixTime (received_queries[0].query)
            received_queries[8].query = fixAddedFile (received_queries[8].query)
            var expected_queries = [
                { query: expected_event_query },
                { query: expected_user_query_1 },
                { query: expected_user_query_2 },
                { query: expected_user_query_3 },
                { query: expected_connect_user_to_event_query },
                { query: expected_push_event_query },
                { query: expected_connect_to_previous_push_event_query },
                { query: expected_commit_query },
                { query: expected_file_added_query },
                { query: expected_user_query_5 },
                { query: expected_connect_commit_to_author_using_email_query },
                { query: expected_user_query_5 },
                { query: expected_connect_commit_to_committer_using_email_query },
            ]
            expect (received_queries.length).to.equal(expected_queries.length)
            _.map (received_queries, (received_query, index) => {
                expect (received_query.query).to.equal(expected_queries[index].query)
            })
            callback (null)
        })
        payload.commits = new Array ()
        payload.commits.push ({
            id: 'commit_id',
            timestamp: 'my_timestamp',
            author: { email: 'my_email' },
            committer: { email: 'my_email' },
            added: [ 'file.txt' ],
        })
        var event = new GithubPushEvent (id, type, payload)
        event.save ((err) => {
            expect (err).to.be.null
        })
        stub.restore ()
    })

    it ('should return an error when it fails to save to the database', () => {
        var stub = sinon.stub (Event, "runQuery", (queries, callback) => {
            // Stub the Event model to return an error to the callback, as it would if
            // it couldn't connect with the database or if the query was invalid
            var err = new Error ('my_error')
            callback (err)
        })
        payload.commits = new Array ()
        var event = new GithubPushEvent (id, type, payload)
        event.save ((err) => {
            expect (err).to.not.be.null
        })
        stub.restore ()
    })
})

// Cypher queries require unique identifiers and timestamps, which in some cases must be
// dynamically generated. To validate these queries, we need to re-write the dynamically
// generated identifiers with known values.
function fixFileId (query) {
    const id_regexp = new RegExp ('[a-zA-Z0-9]{1,8}:File')
    return (_.replace (query, id_regexp, 'file:File'))
}

function fixAddedFile (query) {
    const id_regexp = new RegExp ('-\\[[a-zA-Z0-9]{1,8}:adds\\]-> \\([a-zA-Z0-9]{1,8}\\)')
    return (_.replace (fixFileId (query), id_regexp, '-[rel:adds]-> (file)'))
}

function fixModifiedFile (query) {
    const id_regexp = new RegExp ('-\\[[a-zA-Z0-9]{1,8}:modifies\\]-> \\([a-zA-Z0-9]{1,8}\\)')
    return (_.replace (fixFileId (query), id_regexp, '-[rel:modifies]-> (file)'))
}

function fixRemovedFile (query) {
    const id_regexp = new RegExp ('-\\[[a-zA-Z0-9]{1,8}:removes\\]-> \\([a-zA-Z0-9]{1,8}\\)')
    return (_.replace (fixFileId (query), id_regexp, '-[rel:removes]-> (file)'))
}

