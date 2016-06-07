'use strict'

var _ = require('lodash')
var genId = require('gen-id')('AXXXXXXX') // neo4j ids start with a letter

var GithubEvent = require('./event')
var Event = require('../../models/event')

module.exports = class GithubCreateEvent extends GithubEvent {
    // 
    // constructor ():
    //
    // Create a new GithubCreateEvent, transforming JSON payload to params object.
    //
    // @param event_id - The ID of the event
    // @param event_type - What type of event we want to create.
    // @param payload - the Github event JSON payload
    // @returns {GithubCreateEvent} - The created event object.
    //
    constructor (event_id, event_type, payload) {
        // call the superclass constructor
        super (event_id, event_type, payload)

        this._event_params.branch = `refs/heads/${payload.ref}`
        this._event_params.ref_type = payload.ref_type
        this._event_params.master_branch = `refs/heads/${payload.master_branch}`
    }

    // 
    // save ():
    //
    // Transform params object into Neo4J Cypher query and save to the database.
    //
    // @param callback (err) - 
    //
    save (callback) {
        this._queries.push ({ query: buildCreateEventQuery (this._event_params) } )

        // superclass will prepend these queries with its own query to ensure that the
        // base event is created first
        super.save (callback)
    }
}

//
// Private functions (build Neo4j Cypher queries)
//
function buildCreateEventQuery (params) {
    var query = [
        `MATCH (ev:Event { event_id: '${params.event_id}' } )`,
        `MATCH (repo:Repo { name : '${params.repo_name}' })`,
        `SET ev += { ref_type : '${params.ref_type}' }`,
        `MERGE (branch:Branch { ref: '${params.branch}' })`,
        `MERGE (ev) -[rel5:creates]-> (branch)`,
        `MERGE (branch) -[rel6:belongs_to]-> (repo)`,
    ].join('\n')

    return (query)
}
