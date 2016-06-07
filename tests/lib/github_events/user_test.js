'use strict'

const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const _ = require('lodash')

const GithubUser = require('../../../lib/github_events/user')

describe ('GithubUser', () => {
    const id = 'my_id'
    const type = 'my_type'
    const payload = {
        repository : { full_name : 'my_repo' },
        organization : { login : 'my_org' },
        sender : { login : 'my_login' },
    }

    it ('should get a valid user query given a login and an email address', () => {
        const sender = {
            login : 'my_login',
            email : 'my_email',
        }
        const expected_queries = [
            { query: 'START first=node(*), second=node(*)\nWHERE has(first.login) and not(has(first.email)) and has(second.email) and not(has(second.login))\nWITH first, second\nWHERE first.login = \'my_login\' AND second.email = \'my_email\'\nSET first.email = \'my_email\'\nDELETE second' },
            { query: 'MATCH (user:User)\nWHERE user.email = \'my_email\' OR user.login = \'my_login\'\nSET user.login = \'my_login\'\nSET user.email = \'my_email\'' },
            { query: 'MERGE (user:User { login : \'my_login\', email : \'my_email\' })' },
        ]
        const user = new GithubUser (sender.login, sender.email)
        const queries = user.getCreateQueries ()
        expect (queries.length).to.equal(expected_queries.length)
        _.map (queries, (query, index) => {
            expect (query.query).to.equal(expected_queries[index].query)
        })
    })

    it ('should get a valid user query given a login only', () => {
        const sender = {
            login : 'my_login',
            email : null,
        }
        const expected_queries = [
            { query: 'MERGE (user:User { login : \'my_login\' })' },
        ]
        const user = new GithubUser (sender.login, sender.email)
        const queries = user.getCreateQueries ()
        expect (queries.length).to.equal(expected_queries.length)
        _.map (queries, (query, index) => {
            expect (query.query).to.equal(expected_queries[index].query)
        })
    })

    it ('should get a valid user query given an email address only', () => {
        const sender = {
            login : null,
            email : 'my_email',
        }
        const expected_queries = [
            { query: 'MERGE (user:User { email : \'my_email\' })' },
        ]
        const user = new GithubUser (sender.login, sender.email)
        const queries = user.getCreateQueries ()
        expect (queries.length).to.equal(expected_queries.length)
        _.map (queries, (query, index) => {
            expect (query.query).to.equal(expected_queries[index].query)
        })
    })
})
