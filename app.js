var express = require('express');
var bodyParser = require('body-parser');
var xhub = require('express-x-hub');
var moment = require('moment');

var neo4j = require('neo4j');

var db = new neo4j.GraphDatabase({
    // Support specifying database info via environment variables,
    // but assume Neo4j installation defaults.
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
        'http://neo4j:neo4j@localhost:7474',
    auth: process.env['NEO4J_AUTH'],
});

var app = express();
var port = 3000;

// Middleware to validate Github X-Hub-Signature
app.use(xhub({ algorithm: 'sha1', secret: process.env.X_HUB_SECRET }));

// Middleware to parse JSON requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Github Webhook handler
app.post('/event', function (req, res) {
    if(!req.isXHub || !req.isXHubValid()){
        return res.status(403).json({ error: 'unauthorized' });
    }

    db.cypher({
        query: 'CREATE (event:Event { id : {id}, timestamp : {timestamp}, event_type: {event_type}, payload: {payload} }) RETURN event',
        params: {
            id: req.get('X-GitHub-Delivery'),
            timestamp: moment().format(),
            event_type: req.get('X-GitHub-Event'),
            payload: JSON.stringify(req.body, null, 2)
        },
    }, function callback(err, results) {
        if (err) throw err;

        var event = results[0]['event'];
        console.log(event);
        res.status(201).json(event);
    });

});

app.listen(port, function (error) {
    if (error) {
        console.error (error)
    } else {
        console.info ("==> 🌎  Listening on port %s.", port)
    }
});
