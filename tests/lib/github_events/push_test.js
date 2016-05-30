'use strict'

var chai = require('chai')
var expect = chai.expect
var sinon = require('sinon')
var _ = require('lodash')

var GithubPushEvent = require('../../../lib/github_events/push')
var Event = require('../../../models/event')

// Cypher queries require unique identifiers and timestamps, which in some cases must be
// dynamically generated. To validate these queries, we need to re-write the dynamically
// generated identifiers with known values.
function fixTime (query) {
    const time_regexp = new RegExp ('[0-9]{1,4}-[0-9]{1,2}-[0-9]{1,2}T[0-9]{1,2}:[0-9]{1,2}:[0-9]{1,2}-[0-9]{1,2}:[0-9]{1,2}', 'g')
    return (_.replace (query, time_regexp, '2016-05-27T10:53:59-04:00'))
}

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

describe ('GithubPushEvent', () => {
    var id
    var type
    var payload
    var expected_event_query
    var expected_push_event_query
    var expected_connect_to_previous_push_event_query
    var expected_commit_query
    var expected_connect_commit_to_user_query

    beforeEach (() => {
        id = 'my_id'
        type = 'my_type'
        payload = {
            repository : { full_name : 'test repo' },
            organization : { login : 'test org' },
            sender : { login : 'test user' },
            before : 'before hash',
            after : 'after hash',
            ref : 'my branch',
            pusher : { email : 'test email' },
        }
        expected_event_query = 'MERGE (ev:Event { event_id : \'my_id\' })\nON CREATE SET ev.event_type = \'my_type\', ev.timestamp = \'2016-05-27T10:53:59-04:00\'\nON MATCH SET ev.redelivered_on = \'2016-05-27T10:53:59-04:00\'\nMERGE (repo:Repo { name : \'test repo\' })\nMERGE (org:Org { login: \'test org\' })\nMERGE (sender:User { login: \'test user\', email: \'test email\' })\nMERGE (ev) -[rel1:belongs_to]-> (repo)\nMERGE (repo) -[rel2:belongs_to]-> (org)\nMERGE (sender) -[rel4:sends]-> (ev)'
        expected_push_event_query = 'MATCH (ev:Event { event_id: \'my_id\' } )\nMATCH (repo:Repo { name : \'test repo\' })\nSET ev += { before: \'before hash\', after: \'after hash\' }\nMERGE (branch:Branch { ref: \'my branch\' })\nMERGE (ev) -[rel5:pushes_to]-> (branch)\nMERGE (branch) -[rel6:belongs_to]-> (repo)'
        expected_connect_to_previous_push_event_query = 'MATCH (this_push:Event { event_id: \'my_id\' } )\nMATCH (previous_push:Event { after: \'before hash\' } )\nMERGE (this_push) -[rel:follows]-> (previous_push)'
        expected_commit_query = 'MATCH (event:Event { event_id: \'my_id\' } )\nMATCH (branch:Branch { ref: \'my branch\' })\nMERGE (commit:Commit { commit_id : \'commit_id\', timestamp: \'my_timestamp\', author_email: \'author_email\' })\nMERGE (event) -[rel1:pushes]-> (commit)\nMERGE (commit) -[rel2:belongs_to]-> (branch)'
        expected_connect_commit_to_user_query = 'MATCH (commit:Commit { commit_id: \'commit_id\' } )\nMATCH (user:User { email: \'author_email\' })\nMERGE (user) -[r:commits]-> (commit)'
    })

    it ('should save an event without commits', () => {
        var stub = sinon.stub(Event, "runQuery", (received_queries, callback) => {
            received_queries[0].query = fixTime (received_queries[0].query)
            var expected_queries = [
                { query: expected_event_query },
                { query: expected_push_event_query },
                { query: expected_connect_to_previous_push_event_query },
            ]

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
            received_queries[0].query = fixTime (received_queries[0].query)
            received_queries[4].query = fixAddedFile (received_queries[4].query)
            var expected_queries = [
                { query: expected_event_query },
                { query: expected_push_event_query },
                { query: expected_connect_to_previous_push_event_query },
                { query: expected_commit_query },
                { query: 'MATCH (commit:Commit { commit_id: \'commit_id\' } )\nMERGE (file:File { name : \'test repo/my branch/file.txt\' })\nMERGE (commit) -[rel:adds]-> (file)' },
                { query: expected_connect_commit_to_user_query },
            ]

            _.map (received_queries, (received_query, index) => {
                expect (received_query.query).to.equal(expected_queries[index].query)
            })
            callback (null)
        })
        payload.commits = new Array ()
        payload.commits.push ({
            id: 'commit_id',
            timestamp: 'my_timestamp',
            author: { email: 'author_email' },
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
            received_queries[0].query = fixTime (received_queries[0].query)
            received_queries[4].query = fixModifiedFile (received_queries[4].query)
            var expected_queries = [
                { query: expected_event_query },
                { query: expected_push_event_query },
                { query: expected_connect_to_previous_push_event_query },
                { query: expected_commit_query },
                { query: 'MATCH (commit:Commit { commit_id: \'commit_id\' } )\nWITH commit\nMERGE (file:File { name : \'test repo/my branch/file.txt\' })\nMERGE (commit) -[rel:modifies]-> (file)' },
                { query: expected_connect_commit_to_user_query },
            ]

            _.map (received_queries, (received_query, index) => {
                expect (received_query.query).to.equal(expected_queries[index].query)
            })
            callback (null)
        })
        payload.commits = new Array ()
        payload.commits.push ({
            id: 'commit_id',
            timestamp: 'my_timestamp',
            author: { email: 'author_email' },
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
            received_queries[0].query = fixTime (received_queries[0].query)
            received_queries[4].query = fixRemovedFile (received_queries[4].query)
            var expected_queries = [
                { query: expected_event_query },
                { query: expected_push_event_query },
                { query: expected_connect_to_previous_push_event_query },
                { query: expected_commit_query },
                { query: 'MATCH (commit:Commit { commit_id: \'commit_id\' } )\nWITH commit\nMERGE (file:File { name : \'test repo/my branch/file.txt\' })\nMERGE (commit) -[rel:removes]-> (file)' },
                { query: expected_connect_commit_to_user_query },
            ]

            _.map (received_queries, (received_query, index) => {
                expect (received_query.query).to.equal(expected_queries[index].query)
            })
            callback (null)
        })
        payload.commits = new Array ()
        payload.commits.push ({
            id: 'commit_id',
            timestamp: 'my_timestamp',
            author: { email: 'author_email' },
            removed: [ 'file.txt' ],
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
