const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const yts = require('yt-search');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// --- PÁGINA PARA MANTER O BOT ACORDADO ---
app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif; text-align:center; background:#111; color:white; padding:50px;">
            <h1>🤖 Jackson Beatz Bot On-line</h1>
            <p>Bot gerenciando grupos e produção musical.</p>
            <form action="/getcode" method="POST">
                <input type="text" name="number" placeholder="25884..." required style="padding:10px; border-radius:5px;">
                <button type="submit" style="padding:10px; background:green; color:white; border:none; border-radius:5px;">Novo Código</button>
            </form>
        </body>
    `);
});

const dicas = [
    "🎧 *Dica:* Use um filtro High-Pass em tudo que não for Bumbo ou Baixo para limpar a mixagem.",
    "🎹 *Dica:* No FL Studio, use 'Alt+R' no piano roll para humanizar as notas.",
    "🎙️ *Dica:* Grave vozes com o microfone levemente inclinado para evitar 'pufs' de ar.",
    "🔥 *Dica:* Use Soft Clipper no Master para ganhar volume sem distorcer.",
    "🎚️ *Dica:* Mixagem é equilíbrio. Se algo não aparece, talvez outra coisa precise baixar o volume."
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

    // --- 1. BOAS-VINDAS (QUEM ENTRA NO GRUPO) ---
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            const user = anu.participants[0];
            await sock.sendMessage(anu.id, { 
                text: `Olá @${user.split('@')[0]}, bem-vindo ao grupo *Jackson Beatz*! 🎹🔥\nDigite *!menu* para ver o que eu faço.`,
                mentions: [user]
            });
        }
    });

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect, qr } = u;
        if (connection === 'open') console.log('✅ BOT JACKSON BEATZ ONLINE!');
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        }
    });

    // --- PAREAMENTO WEB ---
    if (!sock.authState.creds.registered && numberToPair) {
        await delay(5000);
        try {
            const code = await sock.requestPairingCode(numberToPair);
            res.send(`<h1>CÓDIGO: <span style="color:green;">${code}</span></h1><p>Cole no WhatsApp.</p>`);
        } catch (e) { res.send("Erro. Tente em 1 minuto."); }
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
                         `👉 *!ban* - Banir membro (Responda a ele)\n` +
                         `👉 *!ping* - Testar bot\n\n` +
                         `🚫 *Anti-Link Ativo*`;
            await sock.sendMessage(chat, { text: menu }, { quoted: msg });
        }

        // 3. COMANDO DICA
        if (texto === '!dica') {
            const d = dicas[Math.floor(Math.random() * dicas.length)];
            await sock.sendMessage(chat, { text: d }, { quoted: msg });
        }

        // 4. BUSCAR FOTO YOUTUBE (!foto)
        if (texto.startsWith('!foto')) {
            const busca = texto.replace('!foto', '').trim();
            if (!busca) return sock.sendMessage(chat, { text: 'Diga o nome da música!' });
            const r = await yts(busca);
            const vid = r.videos[0];
            if (vid) {
                await sock.sendMessage(chat, { image: { url: vid.thumbnail }, caption: `🎬 *${vid.title}*\n⏱️ ${vid.timestamp}` });
            }
        }

        // 5. BANIR MEMBRO (Responda a alguém com !ban)
        if (texto === '!ban' && isGroup) {
            const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!citado) return sock.sendMessage(chat, { text: 'Responda a alguém para banir!' });
            await sock.groupParticipantsUpdate(chat, [citado], 'remove');
            await sock.sendMessage(chat, { text: '👤 Usuário removido!' });
        }

        // 6. ANTI-LINK (REMOVER LINKS DE GRUPOS)
        if (isGroup && texto.includes('chat.whatsapp.com/')) {
            await sock.sendMessage(chat, { delete: msg.key });
            await sock.sendMessage(chat, { text: "🚫 *Links de outros grupos são proibidos!*" });
        }

        // 7. PING
        if (texto === '!ping') {
            await sock.sendMessage(chat, { text: "🏓 Pong! Estou vivo no Render!" });
        }
    });
}

app.post('/getcode', (req, res) => {
    const num = req.body.number.replace(/\D/g, '');
    startBot(num, res);
});

app.listen(port, () => console.log(`Porta ${port}`));
startBot();
