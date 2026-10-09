const express = require('express');
const axios = require('axios');
const { addonBuilder, getRouter } = require('stremio-addon-sdk');

// Configuração do Manifest do Addon
const manifest = {
    id: 'org.unlimplay.stremio',
    version: '1.3.0',
    name: 'UnlimPlay Streams',
    description: 'Servidor de reprodução de Filmes e Séries via UnlimPlay.',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

/**
 * Desobfustica código compactado no formato Dean Edwards packer:
 * eval(function(p,a,c,k,e,d){...}('payload', radix, count, 'keywords'.split('|'), ...))
 */
function unpackDeanEdwards(html) {
    const packerRegex = /eval\(function\(p,a,c,k,e,[rd]\)\{.*?\n?\}\((['"].*?['"])\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"].*?['"])\.split\(['"]\Vert{}['"]\)/s;
    const match = html.match(packerRegex);

    if (!match) return null;

    let payload = match[1].slice(1, -1);
    const radix = parseInt(match[2], 10);
    const keywords = match[4].slice(1, -1).split('|');

    function unbase(str, rad) {
        const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (rad <= 36) return parseInt(str, rad);
        let val = 0;
        for (let i = 0; i < str.length; i++) {
            val = val * rad + ALPHABET.indexOf(str[i]);
        }
        return val;
    }

    return payload.replace(/\b\w+\b/g, (word) => {
        const index = unbase(word, radix);
        return keywords[index] !== undefined && keywords[index] !== '' ? keywords[index] : word;
    });
}

/**
 * Executa requisições HTTP testando múltiplas estratégias contra erros 403
 */
async function fetchHtmlWithFallback(embedUrl) {
    const strategies = [
        // Estratégia 1: Identificação de Googlebot (ignora a maioria dos bloqueios de embed)
        {
            name: 'Googlebot UA',
            url: embedUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        },
        // Estratégia 2: Chrome Desktop Real + Sec-Ch-Ua
        {
            name: 'Chrome Desktop',
            url: embedUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://unlimplay.com/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"'
            }
        },
        // Estratégia 3: Proxy CORS para ocultar o IP de Datacenter do Vercel/AWS
        {
            name: 'CORS Proxy Intermediário',
            url: `https://corsproxy.io/?${encodeURIComponent(embedUrl)}`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }
    ];

    for (const strategy of strategies) {
        try {
            console.log(`[SCRAPER] Tentando estratégia: ${strategy.name}`);
            const response = await axios.get(strategy.url, {
                headers: strategy.headers,
                timeout: 5000
            });

            if (response.status === 200 && response.data) {
                console.log(`[SCRAPER] ✅ Sucesso (HTTP 200) com: ${strategy.name}`);
                return response.data;
            }
        } catch (err) {
            console.warn(`[SCRAPER] ⚠️ Falha na estratégia ${strategy.name}: ${err.message}`);
        }
    }

    return null;
}

/**
 * Scraper para extrair a URL do arquivo .m3u8
 */
async function extractM3u8(embedUrl) {
    console.log(`[SCRAPER] Iniciando requisição para: ${embedUrl}`);
    
    const html = await fetchHtmlWithFallback(embedUrl);
    if (!html) {
        console.error('[SCRAPER] ❌ Não foi possível obter o HTML do embed.');
        return null;
    }

    const m3u8Regex = /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i;

    // 1. Busca direta no código HTML
    let match = html.match(m3u8Regex);
    if (match && match[1]) {
        console.log(`[SCRAPER] ✅ .m3u8 localizado no HTML: ${match[1]}`);
        return match[1];
    }

    // 2. Busca dentro de código JS desobfustado
    console.log('[SCRAPER] Analisando e desobfustando scripts...');
    const unpackedCode = unpackDeanEdwards(html);

    if (unpackedCode) {
        match = unpackedCode.match(m3u8Regex);
        if (match && match[1]) {
            console.log(`[SCRAPER] ✅ .m3u8 localizado no script desobfustado: ${match[1]}`);
            return match[1];
        }
    }

    console.warn('[SCRAPER] ⚠️ Nenhum .m3u8 encontrado no código da página.');
    return null;
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

    const streams = [];

    // Tenta extrair a URL de vídeo .m3u8
    const directM3u8Url = await extractM3u8(embedUrl);

    if (directM3u8Url) {
        streams.push({
            title: '▶ UnlimPlay (Player Nativo Stremio)',
            url: directM3u8Url,
            behaviorHints: {
                notSupported: false,
                requestHeaders: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://unlimplay.com/'
                }
            }
        });
    }

    // Sempre disponibiliza a opção Web / ExternalUrl como Fallback
    streams.push({
        title: '🌐 UnlimPlay (Player Web / Embed)',
        externalUrl: embedUrl
    });

    return { streams };
});

const app = express();
const addonInterface = builder.getInterface();
const router = getRouter(addonInterface);

app.use('/', router);

module.exports = app;
