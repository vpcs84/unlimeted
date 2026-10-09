const express = require('express');
const axios = require('axios');
const { addonBuilder, getRouter } = require('stremio-addon-sdk');

const manifest = {
    id: 'org.unlimplay.stremio',
    version: '1.1.0',
    name: 'UnlimPlay Streams',
    description: 'Reprodução nativa de Filmes e Séries via UnlimPlay.',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// Função responsável por fazer a extração do link .m3u8
async function extractM3u8(embedUrl) {
    try {
        const response = await axios.get(embedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://unlimplay.com/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 6000
        });

        const html = response.data;

        // Expressão regular para capturar URLs terminadas em .m3u8 no código-fonte
        const m3u8Regex = /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i;
        const match = html.match(m3u8Regex);

        if (match && match[1]) {
            return match[1];
        }

        return null;
    } catch (error) {
        console.error('Erro ao extrair m3u8 do UnlimPlay:', error.message);
        return null;
    }
}

// Manipulador de Streams do Stremio
builder.defineStreamHandler(async (args) => {
    const { type, id } = args;
    let embedUrl = null;

    if (type === 'movie') {
        let cleanId = id.startsWith('tmdb:') ? id.replace('tmdb:', '') : id;
        embedUrl = `https://unlimplay.com/f/embed/movie/${cleanId}`;
    } else if (type === 'series') {
        const parts = id.split(':');
        if (id.startsWith('tmdb:')) {
            embedUrl = `https://unlimplay.com/f/embed/tv/${parts[1]}/${parts[2]}/${parts[3]}`;
        } else {
            embedUrl = `https://unlimplay.com/f/embed/tv/${parts[0]}/${parts[1]}/${parts[2]}`;
        }
    }

    if (!embedUrl) {
        return { streams: [] };
    }

    // Tenta extrair a URL do arquivo de vídeo direto (.m3u8)
    const directM3u8Url = await extractM3u8(embedUrl);

    if (directM3u8Url) {
        return {
            streams: [
                {
                    title: '▶ UnlimPlay (Player Nativo Stremio - 1080p)',
                    url: directM3u8Url,
                    behaviorHints: {
                        notSupported: false,
                        requestHeaders: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Referer': 'https://unlimplay.com/'
                        }
                    }
                }
            ]
        };
    }

    // Fallback: se o scraping falhar ou o link estiver obfustado, abre no navegador
    return {
        streams: [
            {
                title: '▶ UnlimPlay (Abrir no Navegador / Embed)',
                externalUrl: embedUrl
            }
        ]
    };
});

const app = express();
const addonInterface = builder.getInterface();
const router = getRouter(addonInterface);

app.use('/', router);

module.exports = app;
