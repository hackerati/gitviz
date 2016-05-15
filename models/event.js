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
    db.cypher({
        queries: [{
            // Always create a new Event, associated with the appropriate
            // repo, org, and users.
            query: createEvent (params),
        }, {
            query: addPushEventProperties (params),
        }, {
            query: connectToPreviousPushEvent (params),
        }, {
            query: addCommitsAndFiles (params),
        }, {
            query: modifyAndRemoveFiles (params),
        }],
    }, function (err, results) {
        // returns array of results, which we can ignore
        if (err) return callback (err);
        callback (null);
    });
};

//
// Private functions
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

function addCommitsAndFiles (params) {
    var query = '';
    var branch = `${params.repo_name}/${params.ref}`;

    query += `\nMATCH (event:Event { event_id: '${params.event_id}' } )`,
    query += `\nMATCH (branch:Branch { ref: '${params.ref}' })`,

    // Always create new commits. Commits belong to the branch and exist in a
    // fixed sequence within the event. Simplest solution for seqence is to
    // obtain the commit sequence by sorting commits by timestamp.
    _.map (params.commits, function(commit) {
        var cstr = genId.generate();
        var rel1 = genId.generate();
        var rel2 = genId.generate();

        query += `\nCREATE (${cstr}:Commit { commit_id : '${commit.id}', timestamp: '${commit.timestamp}', message: '${commit.message}', author_email: '${commit.author.email}' })`;
        query += `\nMERGE (event) -[${rel1}:pushes]-> (${cstr})`;
        query += `\nMERGE (${cstr}) -[${rel2}:belongs_to]-> (branch)`;

        query += addFiles(commit.added, cstr, branch);
    });

    console.log (query);

    return (query);
}

function modifyAndRemoveFiles (params) {
    var query = '';
    var branch = `${params.repo_name}/${params.ref}`;

    _.map (params.commits, function(commit) {
        var cstr = genId.generate();

        query += `\nMATCH (${cstr}:Commit { commit_id: '${commit.id}' } )`,
        query += modifyFiles(commit.modified, cstr, branch);
    });

    console.log (query);

    return (query);
}


// pass array of added files and the branch to which they were added
function addFiles (files, commit, branch) {
    var query = '';

    _.map (files, function(file) {
        var fstr = genId.generate();
        var rel1 = genId.generate();
        var filename = `${branch}/${file}`; // Save full repo/branch/file

        query += `\nCREATE (${fstr}:File { name : '${filename}' })`;
        query += `\nMERGE (${commit}) -[${rel1}:adds]-> (${fstr})`;
    });

    console.log (query);

    return (query);
}

function removeFiles (files, commit, branch) {
    var query = '';

    _.map (files, function(file) {
        var fstr = genId.generate();
        var rel1 = genId.generate();
        var filename = `${branch}/${file}`; // Save full repo/branch/file

        // match the file
        query += `\nMATCH (${fstr}:File { name: '${filename}' } )`;
        query += `\nMERGE (${commit}) -[${rel1}:removes]-> (${fstr})`;
    });

    console.log (query);

    return (query);
}


function modifyFiles (files, commit, branch) {
    var query = '';

    _.map (files, function(file) {
        var fstr = genId.generate();
        var rel1 = genId.generate();
        var filename = `${branch}/${file}`; // Save full repo/branch/file

        // match the file
        query += `\nMATCH (${fstr}:File { name: '${filename}' } )`;
        query += `\nMERGE (${commit}) -[${rel1}:modifies]-> (${fstr})`;
    });

    console.log (query);

    return (query);
}
