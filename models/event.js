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
        'MERGE (repo:Repo { id : {repo_id}, name : {repo_name} })',
        'MERGE (org:Org { login: {org_login} })',
        'MERGE (repo_owner:User { name: {repo_owner_name} })',
        'MERGE (sender:User { name: {sender_login} })',
        'MERGE (event) -[rel1:belongs_to]-> (repo)',
        'MERGE (repo) -[rel2:belongs_to]-> (org)',
        'MERGE (repo) -[rel3:belongs_to]-> (repo_owner)',
        'MERGE (event) -[rel4:sent_by]-> (sender)',
        'SET event += { before: {before}, after: {after} }',
        'MERGE (branch:Branch { ref: {ref} })',
        'MERGE (pusher:User { name: {pusher_name} })',
        'MERGE (event) -[rel5:pushes_to]-> (branch)',
        'MERGE (branch) -[rel6:belongs_to]-> (repo)',
        'MERGE (pusher) -[rel7:pushes]-> (event)',
    ].join('\n')

/*
Lookup previous event: after points to the current head, before points to the previous head
MATCH (previous_push:Event { after: {before}})',
MERGE (push_event) -[rel:follows]-> (previous_push)
Always create new commits. Commits belong to the branch. Connect before/after.
*/

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) return callback(err);
        callback(null);
    });
};
