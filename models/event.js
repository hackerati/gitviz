var neo4j = require('neo4j');
var _ = require('lodash');
var genId = require('gen-id')('AXXXXXXX') // neo4j ids start with a letter

var db = new neo4j.GraphDatabase({
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
        'http://neo4j:neo4j@localhost:7474',
    auth: process.env['NEO4J_AUTH'],
});

var Event = module.exports = function Event(_node) {
    this._node = _node;
}

Event.createPush = function (params, callback) {
    var path = `${params.repo_name}/${params.ref}`; // to build file queries

    // XXX refactor this
    var queries = [{
        // Always create a new Event, associated with the appropriate
        // repo, org, and users.
        query: createEvent (params),
    }, {
        query: addPushEventProperties (params),
    }, {
        query: connectToPreviousPushEvent (params),
    }];

    // it's possible for push events to have no commits
    _.map (params.commits, function(commit) {
        // create new commit. no need to store sequence since commits can
        // be sorted by timestamp to determine sequence.
        queries.push ({ query: buildCommitQuery (params.event_id,
                                                 params.ref,
                                                 commit) });

        if ((!_.isEmpty (commit.added))) {
            queries.push ({ query: buildAddedFilesQuery (path, commit) });
        }
        if ((!_.isEmpty (commit.modified))) {
            queries.push ({ query: buildModifiedFilesQuery (path, commit) });
        }
        if ((!_.isEmpty (commit.removed))) {
            queries.push ({ query: buildRemovedFilesQuery (path, commit) });
        }

        // connect commit to user
        queries.push ({ query: buildConnectCommitToUserQuery (commit) });
    });

    console.log(queries);

    // run the queries in a single network request, as an atomic transaction
    db.cypher({
        queries: queries
    }, function (err, results) {
        // returns array of results, which we can ignore
        if (err) return callback (err);
        callback (null);
    });
};

//
// Private functions (build Neo4j Cypher queries)
//
function createEvent (params) {
    // Assume sender and pusher are always the same and construct a User from
    // the sender's login and the pusher's email. We'll need email to connect
    // Commits to Users.
    var query = [
        `CREATE (ev:Event { event_id : '${params.event_id}', timestamp : '${params.timestamp}', type: '${params.event_type}' })`,
        `MERGE (repo:Repo { name : '${params.repo_name}' })`,
        `MERGE (org:Org { login: '${params.org_login}' })`,
        `MERGE (sender:User { login: '${params.sender_login}', email: '${params.pusher_email}' })`,
        `MERGE (ev) -[rel1:belongs_to]-> (repo)`,
        `MERGE (repo) -[rel2:belongs_to]-> (org)`,
        `MERGE (sender) -[rel4:sends]-> (ev)`,
    ].join('\n');

    // console.log (query);

    return (query);
}

function addPushEventProperties (params) {
    var query = [
        `MATCH (ev:Event { event_id: '${params.event_id}' } )`,
        `MATCH (repo:Repo { name : '${params.repo_name}' })`,
        `SET ev += { before: '${params.before}', after: '${params.after}' }`,
        `MERGE (branch:Branch { ref: '${params.ref}' })`,
        `MERGE (ev) -[rel5:pushes_to]-> (branch)`,
        `MERGE (branch) -[rel6:belongs_to]-> (repo)`,
    ].join('\n');

    // console.log (query);

    return (query);
}

function connectToPreviousPushEvent (params) {
    var query = [
        `MATCH (this_push:Event { event_id: '${params.event_id}' } )`,
        `MATCH (previous_push:Event { after: '${params.before}' } )`,
        `MERGE (this_push) -[rel:follows]-> (previous_push)`,
    ].join('\n');

    // console.log (query);

    return (query);
}

function buildCommitQuery (event_id, ref, commit) {
    var query = [
        `MATCH (event:Event { event_id: '${event_id}' } )`,
        `MATCH (branch:Branch { ref: '${ref}' })`,
        `CREATE (commit:Commit { commit_id : '${commit.id}', timestamp: '${commit.timestamp}', message: '${commit.message}', author_email: '${commit.author.email}' })`,
        `MERGE (event) -[rel1:pushes]-> (commit)`,
        `MERGE (commit) -[rel2:belongs_to]-> (branch)`,
    ].join('\n');

    // console.log (query);

    return (query);
}

function buildAddedFilesQuery (path, commit) {
    var query = '';

    query += `MATCH (commit:Commit { commit_id: '${commit.id}' } )`;

    _.map (commit.added, function(file) {
        var fstr = genId.generate();
        var rel1 = genId.generate();
        var filename = `${path}/${file}`; // Save full repo/branch/file

        // always create a new file when adding
        query += `\nCREATE (${fstr}:File { name : '${filename}' })`;
        query += `\nMERGE (commit) -[${rel1}:adds]-> (${fstr})`;
    });

    // console.log (query);

    return (query);
}

function buildModifiedFilesQuery (path, commit) {
    var query = '';

    console.log (commit);

    query += `MATCH (commit:Commit { commit_id: '${commit.id}' } )`;

    _.map (commit.modified, function(file) {
        var fstr = genId.generate();
        var rel1 = genId.generate();
        var filename = `${path}/${file}`; // Save full repo/branch/file

        // find existing file to modify
        query += `\nWITH commit`;
        query += `\nMATCH (${fstr}:File { name : '${filename}' })`;
        query += `\nMERGE (commit) -[${rel1}:modifies]-> (${fstr})`;
    });

    console.log (query);

    return (query);
}

function buildRemovedFilesQuery (path, commit) {
    var query = '';

    console.log (commit);

    query += `MATCH (commit:Commit { commit_id: '${commit.id}' } )`;

    _.map (commit.removed, function(file) {
        var fstr = genId.generate();
        var rel1 = genId.generate();
        var filename = `${path}/${file}`; // Save full repo/branch/file

        // find existing file to remove
        query += `\nWITH commit`;
        query += `\nMATCH (${fstr}:File { name : '${filename}' })`;
        query += `\nMERGE (commit) -[${rel1}:removes]-> (${fstr})`;
    });

    console.log (query);

    return (query);
}

function buildConnectCommitToUserQuery (commit) {
    var query = [
        `MATCH (commit:Commit { commit_id: '${commit.id}' } )`,
        `MATCH (user:User { email: commit.author_email })`,
        `MERGE (user) -[r:commits]-> (commit)`,
    ].join('\n');

    console.log (commit);

    console.log (query);

    return (query);
}
