'use strict'

var express = require('express')
var bodyParser = require('body-parser')
var xhub = require('express-x-hub')
var neo4j = require('neo4j')
var EventModel = require('./models/event')
var EventRouteHandlers = require('./routes/events')

// Event is a singleton; save it's database connection
EventModel.setDatabaseConnection (new neo4j.GraphDatabase ({
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
        'http://neo4j:neo4j@localhost:7474',
    auth: process.env['NEO4J_AUTH'],
}))

var app = express ()
var port = 3000

// Middleware to validate Github X-Hub-Signature
app.use (xhub ( { algorithm: 'sha1', secret: process.env.X_HUB_SECRET } ))

// Middleware to parse JSON requests
app.use (bodyParser.json ())
app.use (bodyParser.urlencoded ( { extended: true } ))

// Github Webhook handler. EventRouteHandlers is a singleton
app.post ('/event', EventRouteHandlers.create)

app.listen (port, (error) => {
    if (error) {
        console.error (error)
    } else {
        console.info ("==> 🌎  Listening on port %s.", port)
    }
})
