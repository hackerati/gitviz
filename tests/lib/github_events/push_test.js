'use strict';

var chai = require('chai');

var expect = chai.expect; // we are using the "expect" style of Chai

var GithubPushEvent = require('./../../../lib/github_events/push');

describe ('GithubPushEvent', function() {
    it ('toParams() should return a valid push event params object', function() {
        var id = 'my_id';
        var type = 'my_type';
        var payload = {
            repository : { full_name : 'test name' },
            organization : { login : 'test org' },
            sender : { login : 'test user' },
            before : 'before hash',
            after : 'after hash',
            ref : 'my branch',
            pusher : { email : 'test email' },
        };

        var event = new GithubPushEvent (id, type, payload);
        var params = event.toParams(); 

        expect(params.event_id).to.equal(id);
        expect(params.event_type).to.equal(type);
        expect(params.repo_name).to.equal(payload.repository.full_name);
        expect(params.org_login).to.equal(payload.organization.login);
        expect(params.sender_login).to.equal(payload.sender.login);
    });
});
