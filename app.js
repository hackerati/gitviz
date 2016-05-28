var express = require('express');
var bodyParser = require('body-parser');
var xhub = require('express-x-hub');
var neo4j = require('neo4j');
var routes = require('./routes')
var EventModel = require('./models/event')

// treat Event as a singleton; save it's database connection
var db = new neo4j.GraphDatabase({
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
        'http://neo4j:neo4j@localhost:7474',
    auth: process.env['NEO4J_AUTH'],
});

EventModel.setDatabaseConnection (db);

var app = express();
var port = 3000;

// Middleware to validate Github X-Hub-Signature
app.use(xhub({ algorithm: 'sha1', secret: process.env.X_HUB_SECRET }));

// Middleware to parse JSON requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Github Webhook handler
app.post('/event', routes.events.create);

app.listen(port, function (error) {
    if (error) {
        console.error (error)
    } else {
        console.info ("==> 🌎  Listening on port %s.", port)
    }
});
