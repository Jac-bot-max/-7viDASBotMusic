const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const yts = require('yt-search');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// --- MANTÉM O BOT ACORDADO E GERA CÓDIGO SE PRECISAR ---
app.get('/', (req, res) => {
    res.send(`<body style="font-family:sans-serif;text-align:center;background:#111;color:white;padding-top:50px;">
        <h1>🤖 Jackson Beatz Bot Ativo</h1>
        <p>O bot está rodando na nuvem 24h.</p>
    </body>`);
});

const dicas = [
    "🎧 *Dica:* Use um filtro High-Pass em tudo que não for Bumbo ou Baixo para limpar a mixagem.",
    "🎹 *Dica:* No FL Studio, use 'Alt+R' para humanizar o volume das notas do seu piano.",
    "🎙️ *Dica:* Grave vozes com um compressor leve na entrada para capturar mais detalhes.",
    "🔥 *Dica:* Use Soft Clipper no Master para ganhar volume sem distorcer o som.",
    "🎚️ *Dica:* Ajuste os ganhos (Gain Staging) antes de começar a colocar qualquer plugin."
];

async function startBot(numberToPair, res) {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Android", "Chrome", "20.0.04"],
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    // --- MENSAGEM DE BOAS-VINDAS NO GRUPO ---
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            const user = anu.participants[0];
            await sock.sendMessage(anu.id, { 
                text: `Olá @${user.split('@')[0]}, bem-vindo ao grupo de Produção Musical do Jackson Beatz! 🎹🔥\n\nDigite *!menu* para ver meus comandos.`,
                mentions: [user]
            });
        }
    });

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') console.log('✅ BOT JACKSON BEATZ ONLINE!');
        if (connection === 'close') {
            const restart = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (restart) startBot();
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const chat = msg.key.remoteJid;
        const isGroup = chat.endsWith('@g.us');
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // COMANDO !MENU
        if (texto === '!menu') {
            const menu = `🤖 *JACKSON BEATZ BOT*\n\n` +
                         `👉 *!dica* - Dica aleatória de produção.\n` +
                         `👉 *!foto [nome]* - Capa e info de música.\n` +
                         `👉 *!ping* - Testar velocidade.\n\n` +
                         `🚫 *Anti-Link:* Ativado automático.\n` +
                         `🎧 _Produzindo o futuro._`;
            await sock.sendMessage(chat, { text: menu }, { quoted: msg });
        }

        // COMANDO !DICA
        if (texto === '!dica') {
            const d = dicas[Math.floor(Math.random() * dicas.length)];
            await sock.sendMessage(chat, { text: `🔥 *DICA DE PRODUÇÃO:*\n\n${d}` }, { quoted: msg });
        }

        // COMANDO !FOTO (BUSCA YOUTUBE)
        if (texto.startsWith('!foto')) {
            const busca = texto.replace('!foto', '').trim();
            if (!busca) return sock.sendMessage(chat, { text: 'Diga o nome da música!' });
            const r = await yts(busca);
            const vid = r.videos[0];
            if (vid) {
                const info = `🎬 *YOUTUBE INFO*\n\n📌 *Título:* ${vid.title}\n⏱️ *Duração:* ${vid.timestamp}\n👤 *Canal:* ${vid.author.name}\n🔗 *Link:* ${vid.url}`;
                await sock.sendMessage(chat, { image: { url: vid.thumbnail }, caption: info }, { quoted: msg });
            }
        }

        // COMANDO !PING
        if (texto === '!ping') {
            await sock.sendMessage(chat, { text: '🏓 *Pong!* Bot Jackson Beatz ativo na nuvem!' });
        }

        // --- ANTI-LINK (APAGA LINKS DE OUTROS GRUPOS) ---
        if (isGroup && texto.includes('chat.whatsapp.com/')) {
            await sock.sendMessage(chat, { delete: msg.key });
            await sock.sendMessage(chat, { text: '🚫 *Links não são permitidos neste grupo!*' });
        }
    });
}

// ROTA PARA GERAR CÓDIGO (Caso a sessão caia um dia)
app.post('/getcode', (req, res) => {
    const num = req.body.number.replace(/\D/g, '');
    startBot(num, res);
});

app.listen(port, () => console.log(`Rodando na porta ${port}`));
startBot();
