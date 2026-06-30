const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const yts = require('yt-search');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// PÁGINA WEB (MANTER VIVO E GERAR CÓDIGO)
app.get('/', (req, res) => {
    res.send(`<body style="font-family:sans-serif;text-align:center;background:#111;color:white;padding:50px;">
        <h1>🤖 Jackson Beatz Bot On-line</h1>
        <p>Bot gerenciando grupos e produção musical.</p>
        <form action="/getcode" method="POST">
            <input type="text" name="number" placeholder="25884..." required style="padding:10px;border-radius:5px;">
            <button type="submit" style="padding:10px;background:green;color:white;border:none;border-radius:5px;">Novo Código</button>
        </form>
    </body>`);
});

const dicas = [
    "🎧 *Dica:* Use um filtro High-Pass em tudo que não for Bumbo ou Baixo para limpar a mixagem.",
    "🎹 *Dica:* No FL Studio, use 'Alt+R' no piano roll para humanizar as notas.",
    "🎙️ *Dica:* Grave vozes com o microfone levemente inclinado para evitar 'pufs' de ar.",
    "🔥 *Dica:* Use Soft Clipper no Master para ganhar volume sem distorcer.",
    "🎚️ *Dica:* Mixagem é equilíbrio. Se algo não aparece, talvez outra coisa precise baixar o volume."
];

async function startBot(numberToPair, res) {
    if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');

    // Recupera a sessão da variável do Render
    if (process.env.SESSION_DATA && !fs.existsSync('./session_data/creds.json')) {
        try {
            const decoded = Buffer.from(process.env.SESSION_DATA, 'base64').toString();
            fs.writeFileSync('./session_data/creds.json', decoded);
        } catch (e) { console.log("Erro ao carregar SESSION_DATA"); }
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Android", "Chrome", "20.0.04"],
        syncFullHistory: false,            // LEVE: não trava o Render
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 60000,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        // Loga a string atualizada para você salvar no Render se quiser
        const creds = fs.readFileSync('./session_data/creds.json');
        console.log("\n--- SESSION ATUALIZADA (SALVE NO RENDER SE DESLOGAR) ---\n" + Buffer.from(creds).toString('base64') + "\n--------------------\n");
    });

    // --- 1. BOAS-VINDAS ---
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            const user = anu.participants[0];
            await sock.sendMessage(anu.id, { 
                text: `Olá @${user.split('@')[0]}, bem-vindo ao grupo *Jackson Beatz*! 🎹🔥\nDigite *!menu* para ver meus comandos.`,
                mentions: [user]
            });
        }
    });

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') console.log('✅ BOT JACKSON BEATZ ONLINE!');
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    if (!sock.authState.creds.registered && numberToPair) {
        await delay(5000);
        try {
            const code = await sock.requestPairingCode(numberToPair);
            if (res) res.send(`<h1>CÓDIGO: ${code}</h1>`);
        } catch (e) { if (res) res.send("Erro. Tente em 1 minuto."); }
    }

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const chat = msg.key.remoteJid;
        const isGroup = chat.endsWith('@g.us');
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // 2. COMANDO MENU
        if (texto === '!menu') {
            const menu = `🤖 *JACKSON BEATZ MENU*\n\n` +
                         `👉 *!dica* - Dica de Produção\n` +
                         `👉 *!foto [nome]* - Capa de música\n` +
                         `👉 *!ping* - Testar velocidade\n\n` +
                         `🚫 *Anti-Link Ativo*`;
            await sock.sendMessage(chat, { text: menu }, { quoted: msg });
        }

        // 3. COMANDO DICA
        if (texto === '!dica') {
            const d = dicas[Math.floor(Math.random() * dicas.length)];
            await sock.sendMessage(chat, { text: `🔥 *DICA:* ${d}` }, { quoted: msg });
        }

        // 4. BUSCAR FOTO YOUTUBE
        if (texto.startsWith('!foto')) {
            const busca = texto.replace('!foto', '').trim();
            if (!busca) return sock.sendMessage(chat, { text: 'Diga o nome da música!' });
            const r = await yts(busca);
            const vid = r.videos[0];
            if (vid) {
                await sock.sendMessage(chat, { image: { url: vid.thumbnail }, caption: `🎬 *${vid.title}*\n⏱️ ${vid.timestamp}` });
            }
        }

        // 5. PING
        if (texto === '!ping') await sock.sendMessage(chat, { text: "🏓 Pong! Jackson Beatz na nuvem!" });

        // 6. ANTI-LINK
        if (isGroup && texto.includes('chat.whatsapp.com/')) {
            await sock.sendMessage(chat, { delete: msg.key });
            await sock.sendMessage(chat, { text: "🚫 *Links de outros grupos são proibidos aqui!*" });
        }
    });
}

app.post('/getcode', (req, res) => {
    startBot(req.body.number.replace(/\D/g, ''), res);
});

app.listen(port, () => console.log(`Porta ${port}`));
startBot();
