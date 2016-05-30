var chakram = require('chakram')
var expect = chakram.expect
var request = require('request')
var crypto = require('crypto')
var loader = require("fixture-loader")

// generate Github signature
function sign (payload, secret) {
    var hmac = crypto.createHmac ('sha1', secret)
    hmac.update (payload, 'utf-8')
    return `sha1=${hmac.digest('hex')}`
}

// load JSON fixture from file
function loadGithubEventFixture (filename) {
    const fixture_loader = loader.create (__dirname) // relative to location of this file
    return fixture_loader.loadParsedJson ('./', filename)
}

describe ("Gitviz Webhook Handler", () => {
    var secret
    var end_point
    var options

    before (() => {
        secret = process.env.X_HUB_SECRET
        end_point = 'http://localhost:3000/event'
        options = {
            headers: {
                'content-type': 'application/json',
                'User-Agent': 'GitHub-Hookshot/e4028f5',
                'X-GitHub-Delivery': 'k980eac00-1401-11e6-83be-63a046c0865a',
            }
        }
        chakram.setRequestDefaults (options)
    })

    it ("should handle a ping event")

    it ("should handle a repository event")

    it ("should handle a create branch/tag event")

    it ("should handle a delete branch/tag event")

    it ("should handle a push event with no commits", () => {
        var payload = loadGithubEventFixture ('./fixtures/push_no_commits')
        options.headers['X-GitHub-Event'] = 'push'
	options.headers['X-Hub-Signature'] = sign (JSON.stringify(payload), secret)
        var response = chakram.post (end_point, payload)
        return expect(response).to.have.status(201)
    })

    it ("should handle a push event with commits and files to add", () => {
        var payload = loadGithubEventFixture ('./fixtures/push_add_file')
        options.headers['X-GitHub-Event'] = 'push'
	options.headers['X-Hub-Signature'] = sign (JSON.stringify(payload), secret)
        var response = chakram.post (end_point, payload)
        return expect(response).to.have.status(201)
    })

    it ("should handle a push event with commits and files to modify", () => {
        var payload = loadGithubEventFixture ('./fixtures/push_modify_file')
        options.headers['X-GitHub-Event'] = 'push'
	options.headers['X-Hub-Signature'] = sign (JSON.stringify(payload), secret)
        var response = chakram.post (end_point, payload)
        return expect(response).to.have.status(201)
    })

    it ("should handle a push event with commits and files to remove", () => {
        var payload = loadGithubEventFixture ('./fixtures/push_remove_file')
        options.headers['X-GitHub-Event'] = 'push'
	options.headers['X-Hub-Signature'] = sign (JSON.stringify(payload), secret)
        var response = chakram.post (end_point, payload)
        return expect(response).to.have.status(201)
    })

    it ("should handle a pull request opened event")

    it ("should handle a pull request closed event")

    it ("should handle a pull request assigned event")

    it ("should handle a pull request labeled event")

    it ("should handle a pull request synchronized event")

    it ("should handle a pull request comment event")

    it ("should handle a status event")
})
