var neo4j = require('neo4j');

var db = new neo4j.GraphDatabase({
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
        'http://neo4j:neo4j@localhost:7474',
    auth: process.env['NEO4J_AUTH'],
});

var Event = module.exports = function Event(_node) {
    this._node = _node;
}

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
