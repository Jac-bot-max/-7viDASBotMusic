const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const yts = require('yt-search');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// --- PÁGINA WEB DO BOT ---
app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif; text-align:center; background:#111; color:white; padding-top:50px;">
            <h1>🤖 Jackson Beatz Bot Ativo</h1>
            <p>Se o bot parar de responder, gere um novo código abaixo:</p>
            <form action="/getcode" method="POST">
                <input type="text" name="number" placeholder="25884..." required style="padding:15px; border-radius:10px; width:70%;">
                <br><br>
                <button type="submit" style="padding:15px 30px; background:#25d366; color:white; border:none; border-radius:10px; font-weight:bold;">GERAR CÓDIGO DE CONEXÃO</button>
            </form>
            <p style="color:#888; font-size:12px;">DICA: Use o Cron-job.org para o bot não dormir.</p>
        </body>
    `);
});

const dicas = [
    "🎧 *Dica:* Use um filtro High-Pass em tudo que não for Bumbo ou Baixo.",
    "🎹 *Dica:* Varie a 'velocity' das notas no piano para soar real.",
    "🎙️ *Dica:* Ajuste os volumes (Gain Staging) antes de colocar plugins.",
    "🔥 *Dica:* Use Soft Clipper no Master para ganhar volume sem distorcer."
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

    // PAREAMENTO VIA WEB
    if (!sock.authState.creds.registered && numberToPair) {
        await delay(5000);
        try {
            const code = await sock.requestPairingCode(numberToPair);
            res.send(`
                <body style="font-family:sans-serif; text-align:center; background:#111; color:white; padding-top:50px;">
                    <h1>CÓDIGO: <span style="color:#25d366;">${code}</span></h1>
                    <p>Cole no seu WhatsApp agora!</p>
                    <button onclick="location.href='/'">Voltar</button>
                </body>
            `);
        } catch (e) { res.send("Erro no servidor. Tente de novo em 1 minuto."); }
    }

    // BOAS-VINDAS
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            await sock.sendMessage(anu.id, { text: `Bem-vindo ao grupo Jackson Beatz! 🎹🔥\nDigite *!menu*` });
        }
    });

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') console.log('✅ BOT JACKSON BEATZ ONLINE!');
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const chat = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        if (texto === '!menu') {
            await sock.sendMessage(chat, { text: "🤖 *JACKSON BEATZ*\n\n!dica - Dica de Produção\n!foto [nome] - Capa de música\n!ping - Status" });
        }
        if (texto === '!dica') {
            const d = dicas[Math.floor(Math.random() * dicas.length)];
            await sock.sendMessage(chat, { text: `🔥 *DICA:* ${d}` });
        }
        if (texto === '!ping') {
            await sock.sendMessage(chat, { text: "🏓 *Pong!* Bot na nuvem ativo!" });
        }
        if (texto.startsWith('!foto')) {
            const busca = texto.replace('!foto', '').trim();
            const r = await yts(busca);
            const vid = r.videos[0];
            if (vid) {
                await sock.sendMessage(chat, { image: { url: vid.thumbnail }, caption: `🎬 *${vid.title}*` });
            }
        }
        if (texto.includes('chat.whatsapp.com/')) {
            await sock.sendMessage(chat, { delete: msg.key });
            await sock.sendMessage(chat, { text: "🚫 *Links proibidos!*" });
        }
    });
}

app.post('/getcode', (req, res) => {
    const num = req.body.number.replace(/\D/g, '');
    startBot(num, res);
});

app.listen(port, () => console.log(`Porta ${port}`));
startBot();
