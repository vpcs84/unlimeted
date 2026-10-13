const express = require('express');
const { addonBuilder, getRouter } = require('stremio-addon-sdk');

const manifest = {
    id: 'org.multistream.stremio',
    version: '1.7.0',
    name: 'Multi-Stream Players',
    description: 'Player Web oficial encapsulado para Filmes e Séries via UnlimPlay, VidSrc e VidLink.',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// Manipulador de Streams do Stremio
builder.defineStreamHandler((args) => {
    const { type, id } = args;

    // Detecta automaticamente o domínio na Vercel
    const domain = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:7000';

    let streams = [];

    if (type === 'movie') {
        const cleanId = id.startsWith('tmdb:') ? id.replace('tmdb:', '') : id;

        // Fonte 1: UnlimPlay
        streams.push({
            title: '▶ UnlimPlay (Player Web Encapsulado)',
            externalUrl: `${domain}/player/unlimplay/movie/${cleanId}`
        });

        // Fonte 2: VidSrc
        streams.push({
            title: '▶ VidSrc (Player Web Encapsulado)',
            externalUrl: `${domain}/player/vidsrc/movie/${cleanId}`
        });

        // Fonte 3: VidLink
        streams.push({
            title: '▶ VidLink (Player Web Encapsulado)',
            externalUrl: `${domain}/player/vidlink/movie/${cleanId}`
        });

    } else if (type === 'series') {
        const parts = id.split(':');
        let mediaId, season, episode;

        if (id.startsWith('tmdb:')) {
            mediaId = parts[1];
            season = parts[2];
            episode = parts[3];
        } else {
            mediaId = parts[0];
            season = parts[1];
            episode = parts[2];
        }

        // Fonte 1: UnlimPlay
        streams.push({
            title: '▶ UnlimPlay (Player Web Encapsulado)',
            externalUrl: `${domain}/player/unlimplay/tv/${mediaId}/${season}/${episode}`
        });

        // Fonte 2: VidSrc
        streams.push({
            title: '▶ VidSrc (Player Web Encapsulado)',
            externalUrl: `${domain}/player/vidsrc/tv/${mediaId}/${season}/${episode}`
        });

        // Fonte 3: VidLink
        streams.push({
            title: '▶ VidLink (Player Web Encapsulado)',
            externalUrl: `${domain}/player/vidlink/tv/${mediaId}/${season}/${episode}`
        });
    }

    return Promise.resolve({ streams });
});

const app = express();

// Rota universal de player encapsulado em Iframe para diferentes provedores
app.get('/player/:provider/:type/:id/:season?/:episode?', (req, res) => {
    const { provider, type, id, season, episode } = req.params;
    let embedSrc = '';

    if (provider === 'unlimplay') {
        if (type === 'movie') {
            embedSrc = `https://unlimplay.com/f/embed/movie/${id}`;
        } else if (type === 'tv') {
            embedSrc = `https://unlimplay.com/f/embed/tv/${id}/${season}/${episode}`;
        }
    } else if (provider === 'vidsrc') {
        if (type === 'movie') {
            embedSrc = `https://vidsrc.mov/embed/movie/${id}`;
        } else if (type === 'tv') {
            embedSrc = `https://vidsrc.mov/embed/tv/${id}/${season}/${episode}`;
        }
    } else if (provider === 'vidlink') {
        if (type === 'movie') {
            embedSrc = `https://vidlink.pro/movie/${id}`;
        } else if (type === 'tv') {
            embedSrc = `https://vidlink.pro/tv/${id}/${season}/${episode}`;
        }
    }

    if (!embedSrc) {
        return res.status(400).send('Fonte ou parâmetros inválidos');
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${provider.toUpperCase()} Player</title>
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

const addonInterface = builder.getInterface();
const router = getRouter(addonInterface);

app.use('/', router);

module.exports = app;
