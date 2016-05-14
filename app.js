var express = require('express');
var bodyParser = require('body-parser');
var xhub = require('express-x-hub');
var routes = require('./routes')

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
