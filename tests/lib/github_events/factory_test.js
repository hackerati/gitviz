'use strict'

var chai = require('chai')
var expect = chai.expect

var GithubEventFactory = require('../../../lib/github_events/factory')
var GithubEventNotImplementedError = require('../../../lib/github_events/errors')
var GithubEventNotValidError = require('../../../lib/github_events/errors')
var GithubPushEvent = require('../../../lib/github_events/push')

describe ('GithubEventFactory', () => {
    var id
    var payload

    before (() => {
        id = 'my_id'
        payload = {
            repository : { full_name : 'test name' },
            organization : { login : 'test org' },
            sender : { login : 'test user' },
            before : 'before hash',
            after : 'after hash',
            ref : 'my branch',
            pusher : { email : 'test email' },
        }
    })

    it ('should return a GithubPushEvent for event of type push', () => {
        try {
            var event = GithubEventFactory.createEvent (id, 'push', payload)
            expect (event).to.be.an.instanceOf (GithubPushEvent)
        } catch (err) {
            expect (true).to.be.false  // fail
        }
    })

    it ('should throw a GithubEventNotImplementedError for gollum event', () => {
        try {
            var event = GithubEventFactory.createEvent (id, 'gollum', payload)
            expect (true).to.be.false  // fail
        } catch (err) {
            expect (err).to.be.an.instanceOf (GithubEventNotImplementedError)
            expect (err.message).to.equal ('gollum')
        }
    })

    it ('should throw a GithubEventNotValidError for made up event', () => {
        try {
            var event = GithubEventFactory.createEvent (id, 'made up', payload)
            expect (true).to.be.false  // fail
        } catch (err) {
            expect (err).to.be.an.instanceOf (GithubEventNotValidError)
            expect (err.message).to.equal ('made up')
        }
    })
})

