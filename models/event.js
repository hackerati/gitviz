var neo4j = require('neo4j');
var _ = require('lodash');

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
    // and users, which are either created or updated. Assume sender and
    // pusher are always the same and construct a User from the sender's login
    // and the pusher's email. We'll need email to connect Commits to Users.
    var query = [
        'CREATE (event:Event { event_id : {event_id}, timestamp : {timestamp}, type: {event_type} })',
        'MERGE (repo:Repo { name : {repo_name} })',
        'MERGE (org:Org { login: {org_login} })',
        'MERGE (sender:User { login: {sender_login}, email: {pusher_email}})',
        'MERGE (event) -[rel1:belongs_to]-> (repo)',
        'MERGE (repo) -[rel2:belongs_to]-> (org)',
        'MERGE (sender) -[rel4:sends]-> (event)',
        'SET event += { before: {before}, after: {after} }',
        'MERGE (branch:Branch { ref: {ref} })',
        'MERGE (event) -[rel5:pushes_to]-> (branch)',
        'MERGE (branch) -[rel6:belongs_to]-> (repo)',
    ].join('\n');

    // Always create new commits. Commits belong to the branch and exist in a
    // fixed sequence within the event. Simplest solution for seqence is to
    // obtain the commit sequence by sorting commits by timestamp.
    _.map (params.commits, function(commit, index) {
        query += `\nCREATE (commit${index}:Commit { commit_id : '${commit.id}', timestamp: '${commit.timestamp}', message: '${commit.message}', author_email: '${commit.author.email}' })`;
        query += `\nMERGE (event) -[relc${index}1:pushes]-> (commit${index})`;
        query += `\nMERGE (commit${index}) -[relc${index}2:belongs_to]-> (branch)`;
    });

    // transaction

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
