const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore } = require("@whiskeysockets/baileys");
const mongoose = require('mongoose');
const express = require('express');
const pino = require('pino');

// 1. SERVIDOR PARA O RENDER E CRON-JOB
const app = express();
app.get('/', (req, res) => res.send('Jackson Beatz V3 Online!'));
app.listen(process.env.PORT || 10000);

// 2. CONEXÃO COM O BANCO DE DADOS (MEMÓRIA DO BOT)
const MONGO_URI = 'mongodb+srv://Jackson:Bot123@cluster0.qrdsoog.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI).then(() => console.log('✅ Banco de Dados Conectado!'));

const User = mongoose.model('User', new mongoose.Schema({
    userId: String, groupId: String, warnings: { type: Number, default: 0 }
}));

// 3. INÍCIO DO BOT
async function startJacksonBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Jackson Beatz V3", "Chrome", "1.0.0"]
    });

    // --- LÓGICA DE PAREAMENTO POR CÓDIGO ---
    // Se não estiver logado, ele vai gerar o código de 8 dígitos nos logs do Render
    if (!sock.authState.creds.registered) {
        const meuNumero = "SEU_NUMERO_AQUI"; // COLOQUE SEU NUMERO COM DDI (Ex: 2449...)
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(meuNumero);
                console.log(`\n\n🔑 SEU CÓDIGO DE PAREAMENTO É: ${code}\n\n`);
            } catch (e) { console.log("Erro ao gerar código: ", e) }
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isGroup = from.endsWith('@g.us');
        const sender = msg.key.participant || from;

        // --- COMANDO MENU ---
        if (body === "!menu") {
            await sock.sendMessage(from, { text: "🎵 *JACKSON BEATZ V3*\n\n🛡️ !status\n🔍 !drumkit\n📢 !anuncio" });
        }

        // --- COMANDO STATUS (WARN DO BANCO DE DADOS) ---
        if (body === "!status") {
            const data = await User.findOne({ userId: sender, groupId: from });
            await sock.sendMessage(from, { text: `⚠️ Advertências: ${data ? data.warnings : 0}/3` });
        }

        // --- ANTI-LINK ---
        if (isGroup && body.includes("http")) {
            await sock.sendMessage(from, { delete: msg.key });
            console.log("Link apagado.");
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'close') startJacksonBot();
        if (connection === 'open') console.log("🚀 BOT CONECTADO!");
    });
}

startJacksonBot();
