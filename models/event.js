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
    _.map (params.commits, function(commit, ii) {
        var cstr = `commit${ii}`
        query += `\nCREATE (${cstr}:Commit { commit_id : '${commit.id}', timestamp: '${commit.timestamp}', message: '${commit.message}', author_email: '${commit.author.email}' })`;
        query += `\nMERGE (event) -[relc${ii}1:pushes]-> (${cstr})`;
        query += `\nMERGE (${cstr}) -[relc${ii}2:belongs_to]-> (branch)`;

        _.map (commit.added, function(file, jj) {
            // Save the full file path, including branch and repo
            var filename = `${params.repo_name}/${params.ref}/${file}`;
            query += `\nCREATE (f${ii}${jj}:File { name : '${filename}' })`;
            query += `\nMERGE (${cstr}) -[a${ii}${jj}:adds]-> (f${ii}${jj})`;
        });

/*
        _.map (commit.removed, function(file, jj) {
            var filename = `${params.repo_name}/${params.ref}/${file}`;
            query += `\nMERGE (${cstr}) -[r${ii}${jj}:removes]-> (f${ii}${jj})`;
        });

        _.map (commit.modified, function(file, jj) {
            var filename = `${params.repo_name}/${params.ref}/${file}`;
            query += `\nMERGE (${cstr}) -[m${ii}${jj}:modifies]-> (f${ii}${jj})`;
        });
*/
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
