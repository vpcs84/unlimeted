const express = require('express');
const { addonBuilder, getRouter } = require('stremio-addon-sdk');

const manifest = {
    id: 'org.unlimplay.stremio',
    version: '1.5.1',
    name: 'UnlimPlay Streams',
    description: 'Player Web oficial encapsulado para Filmes e Séries via UnlimPlay.',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// 1. Manipulador de Streams do Stremio
builder.defineStreamHandler((args) => {
    const { type, id } = args;

    // Detecta automaticamente o domínio na Vercel
    const domain = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:7000';

    let playerPath = null;

    if (type === 'movie') {
        const cleanId = id.startsWith('tmdb:') ? id.replace('tmdb:', '') : id;
        playerPath = `/player/movie/${cleanId}`;
    } else if (type === 'series') {
        const parts = id.split(':');
        if (id.startsWith('tmdb:')) {
            playerPath = `/player/tv/${parts[1]}/${parts[2]}/${parts[3]}`;
        } else {
            playerPath = `/player/tv/${parts[0]}/${parts[1]}/${parts[2]}`;
        }
    }

    if (playerPath) {
        return Promise.resolve({
            streams: [
                {
                    title: '▶ UnlimPlay (Player Web Encapsulado)',
                    externalUrl: `${domain}${playerPath}`
                }
            ]
        });
    }

    return Promise.resolve({ streams: [] });
});

const app = express();

// 2. Rota HTML que renderiza o Iframe sem bloqueios de token
app.get('/player/:type/:id/:season?/:episode?', (req, res) => {
    const { type, id, season, episode } = req.params;
    let embedSrc = '';

    if (type === 'movie') {
        embedSrc = `https://unlimplay.com/f/embed/movie/${id}`;
    } else if (type === 'tv') {
        embedSrc = `https://unlimplay.com/f/embed/tv/${id}/${season}/${episode}`;
    }

    if (!embedSrc) {
        return res.status(400).send('Parâmetros inválidos');
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>UnlimPlay Player</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                html, body { width: 100%; height: 100%; background-color: #000; overflow: hidden; }
                iframe { width: 100%; height: 100%; border: none; }
            </style>
        </head>
        <body>
            <iframe 
                src="${embedSrc}" 
                allowfullscreen 
                allow="autoplay; encrypted-media; picture-in-picture">
            </iframe>
        </body>
        </html>
    `);
});

// 3. Integração das rotas do Stremio
const addonInterface = builder.getInterface();
const router = getRouter(addonInterface);

app.use('/', router);

module.exports = app;
