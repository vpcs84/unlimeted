const express = require('express');
const { addonBuilder, getRouter } = require('stremio-addon-sdk');

const manifest = {
    id: 'org.unlimplay.stremio',
    version: '1.0.0',
    name: 'UnlimPlay Streams',
    description: 'Servidor de reprodução de Filmes e Séries via UnlimPlay.',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler((args) => {
    const { type, id } = args;
    let streamUrl = null;

    if (type === 'movie') {
        let cleanId = id;
        if (id.startsWith('tmdb:')) {
            cleanId = id.replace('tmdb:', '');
        }
        streamUrl = `https://unlimplay.com/f/embed/movie/${cleanId}`;
    } 
    else if (type === 'series') {
        const parts = id.split(':');

        if (id.startsWith('tmdb:')) {
            const tmdbId = parts[1];
            const season = parts[2];
            const episode = parts[3];
            streamUrl = `https://unlimplay.com/f/embed/tv/${tmdbId}/${season}/${episode}`;
        } else {
            const imdbId = parts[0];
            const season = parts[1];
            const episode = parts[2];
            streamUrl = `https://unlimplay.com/f/embed/tv/${imdbId}/${season}/${episode}`;
        }
    }

    if (streamUrl) {
        return Promise.resolve({
            streams: [
                {
                    title: '▶ UnlimPlay (Player Web / Embed)',
                    externalUrl: streamUrl
                }
            ]
        });
    }

    return Promise.resolve({ streams: [] });
});

const app = express();
const addonInterface = builder.getInterface();
const router = getRouter(addonInterface);

app.use('/', router);

module.exports = app;
