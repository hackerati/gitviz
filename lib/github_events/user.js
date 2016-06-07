'use strict'

//
// Github users are tricky since git allows you to rewrite history. Properly creating
// users and connecting them to event properties depend on the sequence in which users
// are sent in events and the properties with which they are sent.
//
// - Event sender includes only the sender's login
// - Push event also includes a pusher property with the sender's email address. Assume
//   that the pusher and the sender always refer to the same user!
// - Push event with commits include a commit author and committer, which can match or
//   not.
// - Commit authors and committers may or may not match the event sender/pusher.
// - Commit authors and committers can be missing either or both login and email
//   address properties, depending on the user's git/Github configuration.
//
// Accordingly, it is possible for a user to be created from the sender of a non-push
// event, including only the sender's login and no email address. If a different user
// subsequently pushes the first user's commit in an event that only includes the first
// user's email address, there will be no way to match the commit author to the first
// user. The best we can do is to create another user with the email address and hope
// that we subsequently receive a push event where the first user is the pusher,
// allowing us to consolidate the user with email address only and the user with
// login only.
//
// if event has login and email (can only be a push event)
//     if db has 1 user with login only and 1 user with email only
//         combine the users into a single node with both properties
//     if db has 1 user with either matching login or matching email
//         fill in missing property
//     if db has 1 user with matching login and email or no matching users
//         create-or-update the user with login and email
// else if event has login only (can be any non-push event)
//     create-or-update the user with login
// else if event has email only (can only be from commit author or committer)
//     create-or-update the user with email
//
module.exports = class GithubUser {
    constructor (login, email) {
        this._login = login
        this._email = email
    }

    getCreateQueries () {
       return (buildUserQueryArray (this._login, this._email))
    }
}

function buildUserQueryArray (login, email) {
    var queries = new Array ()

    if ((login) && (email)) {
        // Assume the db has 1 user with login only and 1 user with email only and
        // try consolidate into a single node with both login and email. This will do
        // nothing if there are no matching users in the db or if there is only one
        // matching user with either or both login or email. It has to be run first.
        var consolidate_users_query = [
            `START first=node(*), second=node(*)`,
            `WHERE has(first.login) and not(has(first.email)) and has(second.email) and not(has(second.login))`,
            `WITH first, second`,
            `WHERE first.login = '${login}' AND second.email = '${email}'`,
            `SET first.email = '${email}'`,
            `DELETE second`,
        ].join('\n')
        queries.push ( { query: consolidate_users_query })

        // db has 1 user with matching login only or 1 user with matching email only -
        // fill in missing property. Has to be done after de-dupe to avoid having 2
        // with both email and login, which would break the de-dupe query above.
        var fill_in_property_query = [
            `MATCH (user:User)`,
            `WHERE user.email = '${email}' OR user.login = '${login}'`,
            `SET user.login = '${login}'`,
            `SET user.email = '${email}'`,
        ].join('\n')
        queries.push ( { query: fill_in_property_query })

        // db has 1 user with matching login and email or no matching users - create or
        // do nothing
        queries.push ( { query: `MERGE (user:User { login : '${login}', email : '${email}' })` })
    } else if (login) {
        queries.push ( { query: `MERGE (user:User { login : '${login}' })` })
    } else if (email) {
        queries.push ( { query: `MERGE (user:User { email : '${email}' })` })
    } 

    return (queries)
}
