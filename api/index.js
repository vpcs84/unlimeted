const express = require('express');
const { addonBuilder, getRouter } = require('stremio-addon-sdk');

const manifest = {
    id: 'org.multistream.stremio',
    version: '1.11.1',
    name: 'Multi-Stream Players',
    description: 'Player Web oficial encapsulado para Filmes e Séries via UnlimPlay, VidSrc, VidLink e MultiEmbed.',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// Manipulador de Streams do Stremio
builder.defineStreamHandler((args) => {
    const { type, id } = args;

    const domain = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:7000';

    let streams = [];

    if (type === 'movie') {
        const isTmdb = id.startsWith('tmdb:');
        const cleanId = isTmdb ? id.replace('tmdb:', '') : id;

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

        // Fonte 4: MultiEmbed
        const multiEmbedQuery = isTmdb ? `video_id=${cleanId}&tmdb=1` : `video_id=${cleanId}`;
        streams.push({
            title: '▶ MultiEmbed (Player Web Encapsulado)',
            externalUrl: `${domain}/player/multiembed/movie?${multiEmbedQuery}`
        });

    } else if (type === 'series') {
        const parts = id.split(':');
        const isTmdb = id.startsWith('tmdb:');
        let mediaId, season, episode;

        if (isTmdb) {
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

        // Fonte 4: MultiEmbed
        const multiEmbedQuery = isTmdb 
            ? `video_id=${mediaId}&tmdb=1&s=${season}&e=${episode}` 
            : `video_id=${mediaId}&s=${season}&e=${episode}`;
        streams.push({
            title: '▶ MultiEmbed (Player Web Encapsulado)',
            externalUrl: `${domain}/player/multiembed/tv?${multiEmbedQuery}`
        });
    }

    return Promise.resolve({ streams });
});

const app = express();

// 1. Rota Principal (Página de Instalação do Addon)
app.get('/', (req, res) => {
    const host = req.headers.host || process.env.VERCEL_URL || 'localhost:7000';
    const manifestUrl = `https://${host}/manifest.json`;
    const stremioUrl = `stremio://${host}/manifest.json`;

    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${manifest.name} - Stremio Addon</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    background: #111216; 
                    color: #fff; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    min-height: 100vh;
                    padding: 20px;
                }
                .card {
                    background: #1a1c23;
                    border-radius: 12px;
                    padding: 32px;
                    max-width: 480px;
                    width: 100%;
                    text-align: center;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                    border: 1px solid #2a2d3a;
                }
                h1 { font-size: 24px; margin-bottom: 8px; color: #fff; }
                p { color: #a0a5b5; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }
                .btn {
                    display: block;
                    width: 100%;
                    padding: 14px;
                    border-radius: 8px;
                    font-weight: bold;
                    text-decoration: none;
                    margin-bottom: 12px;
                    transition: all 0.2s;
                }
                .btn-install {
                    background: #8a5cf6;
                    color: #fff;
                }
                .btn-install:hover { background: #7c3aed; }
                .btn-copy {
                    background: #2a2d3a;
                    color: #a0a5b5;
                    font-size: 13px;
                }
                .btn-copy:hover { background: #373b4d; color: #fff; }
                .version { font-size: 12px; color: #606470; margin-top: 16px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>${manifest.name}</h1>
                <p>${manifest.description}</p>
                
                <!-- Botão que abre direto no Stremio -->
                <a href="${stremioUrl}" class="btn btn-install">🚀 Instalar no Stremio</a>
                
                <!-- Botão alternativo para copiar o link do manifesto -->
                <a href="${manifestUrl}" target="_blank" class="btn btn-copy">📋 Abrir manifest.json</a>
                
                <div class="version">Versão v${manifest.version}</div>
            </div>
        </body>
        </html>
    `);
});

// 2. Rota de MultiEmbed
app.get('/player/multiembed/:type', (req, res) => {
    const { type } = req.params;
    const { video_id, tmdb, s, e } = req.query;
    let embedSrc = '';

    if (type === 'movie') {
        embedSrc = tmdb === '1'
            ? `https://multiembed.mov/?video_id=${video_id}&tmdb=1`
            : `https://multiembed.mov/?video_id=${video_id}`;
    } else if (type === 'tv') {
        embedSrc = tmdb === '1'
            ? `https://multiembed.mov/?video_id=${video_id}&tmdb=1&s=${s}&e=${e}`
            : `https://multiembed.mov/?video_id=${video_id}&s=${s}&e=${e}`;
    }

    if (!embedSrc) {
        return res.status(400).send('Parâmetros inválidos');
    }

    renderIframe(res, 'MultiEmbed', embedSrc);
});

// 3. Rota dos outros provedores
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

    renderIframe(res, provider.toUpperCase(), embedSrc);
});

function renderIframe(res, title, embedSrc) {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title} Player</title>
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
}

const addonInterface = builder.getInterface();
const router = getRouter(addonInterface);

app.use('/', router);

module.exports = app;
