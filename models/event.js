var neo4j = require('neo4j');

var db = new neo4j.GraphDatabase({
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
        'http://neo4j:neo4j@localhost:7474',
    auth: process.env['NEO4J_AUTH'],
});

var Event = module.exports = function Event(_node) {
    this._node = _node;
}

Event.createPush = function (params, callback) {
    // Always create a new Event, associated with the appropriate repo, org,
    // and users, which are either created or updated.
    var query = [
        'CREATE (event:Event { id : {event_id}, timestamp : {timestamp}, type: {event_type} })',
        'MERGE (repo:Repo { name : {repo_name} })',
        'MERGE (org:Org { login: {org_login} })',
        'MERGE (sender:User { name: {sender_login} })',
        'MERGE (event) -[rel1:belongs_to]-> (repo)',
        'MERGE (repo) -[rel2:belongs_to]-> (org)',
        'MERGE (sender) -[rel4:sends]-> (event)',
        'SET event += { before: {before}, after: {after} }',
        'MERGE (branch:Branch { ref: {ref} })',
        'MERGE (event) -[rel5:pushes_to]-> (branch)',
        'MERGE (branch) -[rel6:belongs_to]-> (repo)',
    ].join('\n');

/*
Always create new commits. Commits belong to the branch. Connect before/after.
*/

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) return callback(err);

        query = [
            'MATCH (this_push:Event { id: {event_id}})',
            'MATCH (previous_push:Event { after: {before}})',
            'MERGE (this_push) -[rel:follows]-> (previous_push)',
        ].join('\n');

        db.cypher({
            query: query,
            params: params,
        }, function (err, results) {
            if (err) return callback(err);
            callback(null);
        });
    });
};
