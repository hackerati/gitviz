'use strict'

var moment = require('moment')
const _ = require('lodash')

var GithubUser = require('./user')
var Event = require('../../models/event')

module.exports = class GithubEvent {
    constructor (event_id, event_type, payload) {
        this._event_params = {
            event_id: event_id,
            event_type: event_type,
            timestamp: moment().format(),
            repo_name: payload.repository.full_name,
            org_login: payload.organization.login,
            sender_login: payload.sender.login,
        }
        this._queries = new Array ()
    }

    // 
    // save ():
    //
    // Transform params object into Neo4J Cypher query. This should only be used by
    // subclasses. Could really use protected methods.
    //
    save (callback) {
        var queries = new Array ()

        // create the base event, repo, and org
        queries.push ({ query: buildBaseEventQuery (this._event_params) })

        // create the user
        var user = new GithubUser (this._event_params.sender_login,
                                   this._event_params.sender_email)
        queries = _.concat (queries, user.getCreateQueries ())

        // connect the user to the event
        queries.push ({ query: buildConnectSenderToEventQuery (this._event_params) })
        
        // prepend the base query to the query array so that it runs first and save to
        // the database
        Event.runQuery (_.concat (queries, this._queries), callback)
    }
}

//
// Private functions (build Neo4j Cypher queries)
//
function buildBaseEventQuery (params) {
    var query = [
        `MERGE (ev:Event { event_id : '${params.event_id}' })`,
        `ON CREATE SET ev.event_type = '${params.event_type}', ev.timestamp = '${params.timestamp}'`, 
        `ON MATCH SET ev.redelivered_on = '${params.timestamp}'`, 
        `MERGE (repo:Repo { name : '${params.repo_name}' })`,
        `MERGE (org:Org { login : '${params.org_login}' })`,
        `MERGE (ev) -[rel1:belongs_to]-> (repo)`,
	`MERGE (repo) -[rel2:belongs_to]-> (org)`,
    ].join('\n')
    return (query)
}

function buildConnectSenderToEventQuery (params) {
    var query = [
        `MATCH (sender:User { login : '${params.sender_login}' })`,
        `MATCH (ev:Event { event_id : '${params.event_id}' })`,
	`MERGE (sender) -[rel:sends]-> (ev)`,
    ].join('\n')
    return (query)
}

