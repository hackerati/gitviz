'use strict'

var chai = require('chai')
var expect = chai.expect
var sinon = require('sinon')
var _ = require('lodash')

var utils = require('./utils')

var GithubCreateEvent = require('../../../lib/github_events/create')
var Event = require('../../../models/event')

describe ('GithubCreateEvent', () => {
    const id = 'my_id'
    const type = 'my_type'
    const payload = {
            repository : { full_name : 'my_repo' },
            organization : { login : 'my_org' },
            sender : { login : 'my_login' },
            ref : 'my_branch',
            ref_type : 'branch',
            master_branch : 'master',
    }
    const expected_event_query = 'MERGE (ev:Event { event_id : \'my_id\' })\nON CREATE SET ev.event_type = \'my_type\', ev.timestamp = \'2016-01-01T00:00:00-04:00\'\nON MATCH SET ev.redelivered_on = \'2016-01-01T00:00:00-04:00\'\nMERGE (repo:Repo { name : \'my_repo\' })\nMERGE (org:Org { login : \'my_org\' })\nMERGE (ev) -[rel1:belongs_to]-> (repo)\nMERGE (repo) -[rel2:belongs_to]-> (org)'
    const expected_user_query_4 = 'MERGE (user:User { login : \'my_login\' })'
    const expected_connect_user_to_event_query = 'MATCH (sender:User { login : \'my_login\' })\nMATCH (ev:Event { event_id : \'my_id\' })\nMERGE (sender) -[rel:sends]-> (ev)'
    const expected_create_event_query = 'MATCH (ev:Event { event_id: \'my_id\' } )\nMATCH (repo:Repo { name : \'my_repo\' })\nSET ev += { ref_type : \'branch\' }\nMERGE (branch:Branch { ref: \'refs/heads/my_branch\' })\nMERGE (ev) -[rel5:creates]-> (branch)\nMERGE (branch) -[rel6:belongs_to]-> (repo)'

    it ('should save a create event', () => {
        var stub = sinon.stub(Event, "runQuery", (received_queries, callback) => {
            received_queries[0].query = utils.fixTime (received_queries[0].query)
            var expected_queries = [
                { query: expected_event_query },
                { query: expected_user_query_4 },
                { query: expected_connect_user_to_event_query },
                { query: expected_create_event_query },
            ]

            _.map (received_queries, (received_query, index) => {
                expect (received_query.query).to.equal(expected_queries[index].query)
            })
            callback (null)
        })
        var event = new GithubCreateEvent (id, type, payload)
        event.save ((err) => {
            expect (err).to.be.null
        })
        stub.restore ()
    })
})
