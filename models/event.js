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
    // batch queries in a single request which is inherently transactional
    // by building an array of queries.
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
    if (hasCommits (params)) {
        queries.push ({ query: addCommitsAndFiles (params)});

        // only do this if any of the commits modify/remove files
        if (hasModifiedOrRemovedFiles (params)) {
            console.log('has modified or removed files');
            queries.push ({ query: modifyAndRemoveFiles (params)});
        }

        // connect commits to users
        queries.push ({ query: connectCommitsToUsers (params)});
    }

    // console.log(queries);

    db.cypher({
        queries: queries
    }, function (err, results) {
        // returns array of results, which we can ignore
        if (err) return callback (err);
        callback (null);
    });
};

function hasCommits (params) {
    return (!_.isEmpty (params.commits));
}

function hasModifiedOrRemovedFiles (params) {
    var result = false;
    _.map (params.commits, function(commit) {
        if (!_.isEmpty (commit.modified)) {
            result = true;
        }
        if (!_.isEmpty (commit.removed)) {
            result = true;
        }
    });
    return (result);
}

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

        if (!_.isEmpty (commit.added)) {
            query += addFiles(commit.added, cstr, branch);
        }
    });

    // console.log (query);

    return (query);
}

function modifyAndRemoveFiles (params) {
    var query = '';
    var branch = `${params.repo_name}/${params.ref}`;

    _.map (params.commits, function(commit) {
        var cstr = genId.generate();

        query += `\nMATCH (${cstr}:Commit { commit_id: '${commit.id}' } )`;
        if (!_.isEmpty (commit.modified)) {
            query += modifyFiles(commit.modified, cstr, branch);
        }
        if (!_.isEmpty (commit.removed)) {
            query += removeFiles(commit.removed, cstr, branch);
        }
    });

    // console.log (query);

    return (query);
}

function connectCommitsToUsers (params) {
    var query = [
        `MATCH (ev:Event { event_id: '${params.event_id}' } )-[:pushes]->(commit)`,
        `MATCH (user:User { email: commit.author_email })`,
        `MERGE (user) -[r:commits]-> (commit)`,
    ].join('\n');

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

    // console.log (query);

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

    // console.log (query);

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

    // console.log (query);

    return (query);
}
