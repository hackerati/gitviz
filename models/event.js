var neo4j = require('neo4j');

var db = new neo4j.GraphDatabase({
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
        'http://neo4j:neo4j@localhost:7474',
    auth: process.env['NEO4J_AUTH'],
});

var Event = module.exports = function Event(_node) {
    // All we'll really store is the node; the rest of our properties will be
    // derivable or just pass-through properties (see below).
    this._node = _node;
}

// Creates the user and persists (saves) it to the db, incl. indexing it:
Event.create = function (params, callback) {
    db.cypher({
        query: 'CREATE (event:Event { id : {id}, timestamp : {timestamp}, event_type: {event_type}, payload: {payload} }) RETURN event',
        params: params,
    }, function (err, results) {
        if (err) return callback(err);
        var event = new Event(results[0]['event']);
        callback(null, event);
    });
};
