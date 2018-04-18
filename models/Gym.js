'use strict';

// Parse config.
require('dotenv').config();


/* Includes. */

const db = require('../inc/db.js').pool;
const utils = require('../inc/utils.js');
const pokedex = require('../data/pokedex/pokemon.json');

const Raid = require('./Raid');
const GymMember = require('./GymMember');
const GymPokemon = require('./GymPokemon');


/* Readability references. */

const isEmpty = utils.isEmpty;
const getPokemonName = utils.pokemon.getPokemonName;
const getPokemonTypes = utils.pokemon.getPokemonTypes;


/* Settings. */

const GYM_LIMIT_PER_QUERY = parseInt(process.env.GYM_LIMIT_PER_QUERY) || 50000;


/* Helpers. */

// Make sure SQL uses proper timezone.
const FROM_UNIXTIME = "CONVERT_TZ(FROM_UNIXTIME(?), @@session.time_zone, '+00:00')";

function prepareQuery(options) {
    // Parse options.
    var swLat = options.swLat;
    var swLng = options.swLng;
    var neLat = options.neLat;
    var neLng = options.neLng;
    var oSwLat = options.oSwLat;
    var oSwLng = options.oSwLng;
    var oNeLat = options.oNeLat;
    var oNeLng = options.oNeLng;
    var timestamp = options.timestamp || false;

    // Query options.
    var query_where = [];

    // Optional viewport.
    if (!isEmpty(swLat) && !isEmpty(swLng) && !isEmpty(neLat) && !isEmpty(neLng)) {
        query_where.push(
            [
                'g.latitude >= ? AND g.latitude <= ?',
                [swLat, neLat]
            ]
        );
        query_where.push(
            [
                'g.longitude >= ? AND g.longitude <= ?',
                [swLng, neLng]
            ]
        );
    }

    if (timestamp) {
        // Change POSIX timestamp to UTC time.
        timestamp = new Date(timestamp).getTime();

        query_where.push(
            [
                'g.last_scanned > ' + FROM_UNIXTIME,
                [Math.round(timestamp / 1000)]
            ]
        );

        // Send Gyms in view but exclude those within old boundaries.
        // Don't use when timestamp is empty, it means we're intentionally trying to get
        // old gyms as well (new viewport or first request).
        if (!isEmpty(oSwLat) && !isEmpty(oSwLng) && !isEmpty(oNeLat) && !isEmpty(oNeLng)) {
            query_where.push(
                [
                    'g.latitude < ? AND g.latitude > ? AND g.longitude < ? AND g.longitude > ?',
                    [oSwLat, oNeLat, oSwLng, oNeLng]
                ]
            );
        }
    }

    // Prepare query.
    let query = ' WHERE ';
    let partials = [];
    let values = []; // Unnamed query params.

    // Add individual options.
    for (var i = 0; i < query_where.length; i++) {
        let w = query_where[i];
        // w = [ 'query ?', [opt1] ]
        partials.push(w[0]);
        values = values.concat(w[1]);
    }
    query += partials.join(' AND ');

    // Set limit.
    query += ' LIMIT ' + GYM_LIMIT_PER_QUERY;

    return [ query, values ];
}

function prepareGymPromise(query, params) {
    return new Promise((resolve, reject) => {
        db.query(query, params, (err, results, fields) => {
            if (err) {
                return reject(err);
            } else {
                // If there are no gyms, let's just go. 👀
                if (results.length == 0) {
                    return resolve([]);
                }

                // Gym references.
                const gym_refs = {};


                /* Add raids. */

                // One query to rule them all.
                for (var i = 0; i < results.length; i++) {
                    let gym = results[i];

                    // Avoid timezone issues. This is a UTC timestamp.
                    gym.last_modified = gym.last_modified.replace(' ', 'T') + 'Z';
                    gym.last_scanned = gym.last_scanned.replace(' ', 'T') + 'Z';

                    // Convert datetime to UNIX timestamp.
                    gym.last_modified = Date.parse(gym.last_modified) || 0;
                    gym.last_scanned = Date.parse(gym.last_scanned) || 0;

                    // Always send data, even for empty lists. RM expects it.
                    gym.pokemon = [];

                    gym_refs['' + gym.gym_id] = gym;
                }

                // Make it easier to use.
                const gym_ids = Object.keys(gym_refs);

                // Lesgo.
                Raid.from_gym_ids(gym_ids)
                .then((raids) => {
                    // Attach raids to gyms.
                    for (var i = 0; i < raids.length; i++) {
                        const raid = raids[i];

                        // Avoid timezone issues. This is a UTC timestamp.
                        raid.spawn = raid.spawn.replace(' ', 'T') + 'Z';
                        raid.start = raid.start.replace(' ', 'T') + 'Z';
                        raid.end = raid.end.replace(' ', 'T') + 'Z';

                        // Convert datetime to UNIX timestamp.
                        raid.spawn = Date.parse(raid.spawn) || 0;
                        raid.start = Date.parse(raid.start) || 0;
                        raid.end = Date.parse(raid.end) || 0;

                        // Assign Pokémon data.
                        raid.pokemon_name = getPokemonName(pokedex, raid.pokemon_id) || '';
                        raid.pokemon_types = getPokemonTypes(pokedex, raid.pokemon_id) || [];

                        gym_refs['' + raid.gym_id].raid = raid;
                    }
                })
                .then(() => GymMember.from_gym_ids(gym_ids))
                .then((gymMembers) => {
                    // Get gym Pokémon from gym members by
                    // mapping pokemon_uid to gym member.
                    const pokemon_uids = {};

                    if (gymMembers.length > 0) {
                        for (var i = 0; i < gymMembers.length; i++) {
                            const member = gymMembers[i];
                            pokemon_uids[member.pokemon_uid] = member;
                        }

                        return GymPokemon.from_pokemon_uids_map(pokemon_uids);
                    } else {
                        return {
                            'map': pokemon_uids,
                            'pokemon': []
                        }
                    }
                })
                .then((result) => {
                    const map_obj = result.map;
                    const gymPokes = result.pokemon;

                    // Attach gym members to gyms.
                    for (var i = 0; i < gymPokes.length; i++) {
                        const poke = gymPokes[i];
                        const member = map_obj['' + poke.pokemon_uid]
                        const gym_id = member.gym_id;
                        const gym = gym_refs[gym_id];

                        // Avoid timezone issues. This is a UTC timestamp.
                        poke.last_seen = poke.last_seen.replace(' ', 'T') + 'Z';

                        // Convert datetime to UNIX timestamp.
                        poke.last_seen = Date.parse(poke.last_seen) || 0;

                        // Assign member data to the Pokémon being sent.
                        poke.cp_decayed = member.cp_decayed;
                        poke.last_scanned = member.last_scanned;
                        poke.deployment_time = member.deployment_time;

                        // Assign Pokémon data.
                        poke.pokemon_name = getPokemonName(pokedex, poke.pokemon_id) || '';
                        poke.pokemon_types = getPokemonTypes(pokedex, poke.pokemon_id) || [];

                        gym.pokemon.push(poke);
                    }

                    const values = Object.keys(gym_refs).map((k) => gym_refs[k]);

                    return resolve(values);
                })
                .catch(utils.handle_error);
            }
        });
    });
}


/* Model. */

const tablename = 'gym';
const Gym = {};

// Get active Gyms by coords or timestamp.
Gym.get_gyms = (swLat, swLng, neLat, neLng, timestamp, oSwLat, oSwLng, oNeLat, oNeLng) => {
    // Prepare query.
    const query_where = prepareQuery({
        'swLat': swLat,
        'swLng': swLng,
        'neLat': neLat,
        'neLng': neLng,
        'oSwLat': oSwLat,
        'oSwLng': oSwLng,
        'oNeLat': oNeLat,
        'oNeLng': oNeLng,
        'timestamp': timestamp
    });

    const query = 'SELECT g.*, gd.name, gd.description, gd.url FROM ' + tablename + ' g INNER JOIN gymdetails gd ON g.gym_id = gd.gym_id' + query_where[0];
    const params = query_where[1];

    // Return promise.
    return prepareGymPromise(query, params);
};

// Get single Gym + Pokémon in Gym by ID.
Gym.get_gym = (id) => {
    // This is a simple one.
    const query = 'SELECT g.*, gd.name, gd.description, gd.url FROM ' + tablename + ' g INNER JOIN gymdetails gd ON g.gym_id = gd.gym_id WHERE gym_id = ? LIMIT 1';
    const params = [ id ];

    // Return promise.
    return prepareGymPromise(query, params);
};


module.exports = Gym;
