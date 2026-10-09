const express = require('express');
const { addonBuilder, getRouter } = require('stremio-addon-sdk');

const manifest = {
    id: 'org.unlimplay.stremio',
    version: '1.4.0',
    name: 'UnlimPlay Streams',
    description: 'Reprodução oficial de Filmes e Séries via UnlimPlay Web Player.',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler((args) => {
    const { type, id } = args;
    let embedUrl = null;

    if (type === 'movie') {
        // Suporta IDs: tt28650488 ou tmdb:1226863
        const cleanId = id.startsWith('tmdb:') ? id.replace('tmdb:', '') : id;
        embedUrl = `https://unlimplay.com/f/embed/movie/${cleanId}`;
    } else if (type === 'series') {
        // Suporta formatos:
        // IMDb: tt0903747:3:10
        // TMDB: tmdb:1396:3:10
        const parts = id.split(':');

        if (id.startsWith('tmdb:')) {
            const tmdbId = parts[1];
            const season = parts[2];
            const episode = parts[3];
            embedUrl = `https://unlimplay.com/f/embed/tv/${tmdbId}/${season}/${episode}`;
        } else {
            const imdbId = parts[0];
            const season = parts[1];
            const episode = parts[2];
            embedUrl = `https://unlimplay.com/f/embed/tv/${imdbId}/${season}/${episode}`;
        }
    }

    if (embedUrl) {
        return Promise.resolve({
            streams: [
                {
                    title: '▶ UnlimPlay (Player Web Oficial)',
                    externalUrl: embedUrl
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
