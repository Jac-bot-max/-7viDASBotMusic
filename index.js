const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const yts = require('yt-search');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// PÁGINA PARA GERAR O CÓDIGO
app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif; text-align:center; background:#111; color:white; padding:50px;">
            <h1>🤖 Jackson Beatz - Sistema Anti-Sono</h1>
            <p>Se o bot deslogar, gere o código abaixo:</p>
            <form action="/getcode" method="POST">
                <input type="text" name="number" placeholder="258..." required style="padding:15px; border-radius:10px; width:70%;">
                <br><br>
                <button type="submit" style="padding:15px 30px; background:#25d366; color:white; border:none; border-radius:10px; font-weight:bold;">GERAR CONEXÃO</button>
            </form>
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
    // 1. SE EXISTIR UMA SESSION NO RENDER, ELE ESCREVE NO ARQUIVO ANTES DE LIGAR
    if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
    if (process.env.SESSION_DATA && !fs.existsSync('./session_data/creds.json')) {
        const decoded = Buffer.from(process.env.SESSION_DATA, 'base64').toString();
        fs.writeFileSync('./session_data/creds.json', decoded);
        console.log("✅ LOGIN RECUPERADO DA MEMÓRIA DO RENDER!");
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Android", "Chrome", "20.0.04"],
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    // 2. TODA VEZ QUE O LOGIN MUDA, ELE MOSTRA O CÓDIGO NOS LOGS PARA VOCÊ SALVAR
    sock.ev.on('creds.update', async () => {
        await saveCreds();
        const creds = fs.readFileSync('./session_data/creds.json');
        console.log("\n--- COPIE ESTE TEXTO PARA AS VARIÁVEIS DO RENDER ---");
        console.log(Buffer.from(creds).toString('base64'));
        console.log("---------------------------------------------------\n");
    });

    if (!sock.authState.creds.registered && numberToPair) {
        await delay(5000);
        try {
            const code = await sock.requestPairingCode(numberToPair);
            res.send(`<h1>CÓDIGO: <span style="color:green;">${code}</span></h1><p>Cole no WhatsApp e olhe os LOGS do Render depois.</p>`);
        } catch (e) { res.send("Erro. Tente em 1 minuto."); }
    }

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
            await sock.sendMessage(chat, { text: "🤖 *BOT JACKSON BEATZ*\n\n!dica - Dica de Produção\n!foto [nome] - Capa de música\n!ping - Status" }, { quoted: msg });
        }
        if (texto === '!dica') {
            const d = dicas[Math.floor(Math.random() * dicas.length)];
            await sock.sendMessage(chat, { text: `🔥 *DICA:* ${d}` });
        }
        if (texto === '!ping') await sock.sendMessage(chat, { text: "🚀 Estou vivo e rápido!" });
        if (texto.startsWith('!foto')) {
            const busca = texto.replace('!foto', '').trim();
            const r = await yts(busca);
            const vid = r.videos[0];
            if (vid) await sock.sendMessage(chat, { image: { url: vid.thumbnail }, caption: `🎬 *${vid.title}*` });
        }
    });
}

app.post('/getcode', (req, res) => {
    const num = req.body.number.replace(/\D/g, '');
    startBot(num, res);
});

app.listen(port, () => console.log(`Porta ${port}`));
startBot();
