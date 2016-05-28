'use strict'

var debug = require('debug')('queries')
var neo4j = require('neo4j')

module.exports = class Event {
    static setDatabaseConnection (db) {
        this._db = db
    }

    static runQuery (queries, callback) {
        debug(queries)

        // run the queries in a single network request, as an atomic transaction
        this._db.cypher ({
            queries: queries
        }, (err) => {
            if (err) return callback (err)
            callback (null)
        })
    }
}
