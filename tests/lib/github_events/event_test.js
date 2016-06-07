'use strict'

const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const _ = require('lodash')

const utils = require('./utils')

const GithubEvent = require('../../../lib/github_events/event')
const Event = require('../../../models/event')

describe ('GithubEvent', () => {
    const id = 'my_id'
    const type = 'my_type'
    const payload = {
        repository : { full_name : 'my_repo' },
        organization : { login : 'my_org' },
        sender : { login : 'my_login' },
    }

    it ('should save a base event with no queries from subclasses', () => {
        const expected_event_query = 'MERGE (ev:Event { event_id : \'my_id\' })\nON CREATE SET ev.event_type = \'my_type\', ev.timestamp = \'2016-01-01T00:00:00-04:00\'\nON MATCH SET ev.redelivered_on = \'2016-01-01T00:00:00-04:00\'\nMERGE (repo:Repo { name : \'my_repo\' })\nMERGE (org:Org { login : \'my_org\' })\nMERGE (ev) -[rel1:belongs_to]-> (repo)\nMERGE (repo) -[rel2:belongs_to]-> (org)'
        const expected_user_query = 'MERGE (user:User { login : \'my_login\' })'
        const expected_connect_user_to_event_query = 'MATCH (sender:User { login : \'my_login\' })\nMATCH (ev:Event { event_id : \'my_id\' })\nMERGE (sender) -[rel:sends]-> (ev)'
        const stub = sinon.stub (Event, "runQuery", (received_queries, callback) => {
            received_queries[0].query = utils.fixTime (received_queries[0].query)
            const expected_queries = [
                { query: expected_event_query },
                { query: expected_user_query },
                { query: expected_connect_user_to_event_query },
            ]
            expect (received_queries.length).to.equal(expected_queries.length)
            _.map (received_queries, (received_query, index) => {
                expect (received_query.query).to.equal(expected_queries[index].query)
            })
            callback (null)
        })
        const event = new GithubEvent (id, type, payload)
        event.save ((err) => {
            expect (err).to.be.null
        })
        stub.restore ()
    })
})
