var express = require('express');
var bodyParser = require('body-parser');
var xhub = require('express-x-hub');

var app = express();
var port = 3000;

// Middleware to validate Github X-Hub-Signature
app.use(xhub({ algorithm: 'sha1', secret: process.env.X_HUB_SECRET }));

// Middleware to parse JSON requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Github Webhook handler
app.post('/hook', function (req, res) {
    if(!req.isXHub || !req.isXHubValid()){
        return res.status(403).json({ error: 'unauthorized' });
    }

    console.log(req.body);

    return res.status(201).json({ success: 'created' });
});

app.listen(port, function (error) {
    if (error) {
        console.error (error)
    } else {
        console.info ("==> 🌎  Listening on port %s.", port)
    }
});
