'use strict';

var chai = require('chai');

var expect = chai.expect; // we are using the "expect" style of Chai

var GithubEvent = require('./../../../lib/github_events/event');

describe ('GithubEvent', function() {
    it ('toParams() should return a valid params object', function() {
        var id = 'my_id';
        var type = 'my_type';
        var payload = {
            repository : { full_name : 'test name' },
            organization : { login : 'test org' },
            sender : { login : 'test user' },
        };

        var event = new GithubEvent (id, type, payload);
        var params = event.toParams(); 

        expect(params.event_id).to.equal(id);
        expect(params.event_type).to.equal(type);
        expect(params.repo_name).to.equal(payload.repository.full_name);
        expect(params.org_login).to.equal(payload.organization.login);
        expect(params.sender_login).to.equal(payload.sender.login);
    });
});
