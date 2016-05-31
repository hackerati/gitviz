'use strict'

var moment = require('moment')

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
    // _save ():
    //
    // Transform params object into Neo4J Cypher query, but DO NOT ACTULLY SAVE. This
    // should only be used by subclasses. Could really use protected methods.
    //
    _save () {
        this._queries.push ({ query: buildBaseEventQuery (this._event_params) } )
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
        `MERGE (org:Org { login: '${params.org_login}' })`,
        `MERGE (sender:User { login: '${params.sender_login}', email: '${params.sender_email}' })`,
        `MERGE (ev) -[rel1:belongs_to]-> (repo)`,
        `MERGE (repo) -[rel2:belongs_to]-> (org)`,
        `MERGE (sender) -[rel4:sends]-> (ev)`,
    ].join('\n')

    return (query)
}
