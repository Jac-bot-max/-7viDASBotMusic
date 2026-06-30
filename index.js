const { default: makeWASocket, useMultiFileAuthState, disconnects, fetchLatestBaileysVersion, makeInMemoryStore, jidDecode } = require("@whiskeysockets/baileys");
const mongoose = require('mongoose');
const express = require('express');
const pino = require('pino');

// Servidor para o Render não dormir
const app = express();
app.get('/', (req, res) => res.send('Bot Jackson Beatz V3 Online!'));
app.listen(process.env.PORT || 10000);

// 1. BANCO DE DADOS (MONITOR DE ADVERTÊNCIAS)
const MONGO_URI = 'mongodb+srv://Jackson:Bot123@cluster0.qrdsoog.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI).then(() => console.log('✅ Banco de Dados Conectado!'));

const User = mongoose.model('User', new mongoose.Schema({
    userId: String, groupId: String, warnings: { type: Number, default: 0 }
}));

// 2. LÓGICA DE CONEXÃO (BAILEYS)
async function startJacksonBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ["Jackson Beatz", "MacOS", "3.0.0"]
    });

    // SISTEMA DE PAREAMENTO POR CÓDIGO (Caso a sessão caia)
    // Se você precisar logar de novo, o código de 8 dígitos aparecerá nos logs do Render
    if (!sock.authState.creds.registered) {
        const phoneNumber = "SEU_NUMERO_COM_DDI_AQUI"; // Ex: 5511999999999
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            console.log(`🔑 CÓDIGO DE PAREAMENTO: ${code}`);
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isGroup = from.endsWith('@g.us');
        const sender = msg.key.participant || from;

        // --- ANTI-LINK AUTOMÁTICO ---
        if (isGroup && body.includes('http')) {
            const groupMetadata = await sock.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            if (!admins.includes(sender)) {
                await sock.sendMessage(from, { delete: msg.key });
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                return;
            }
        }

        // --- COMANDOS ---
        const prefix = "!";
        if (!body.startsWith(prefix)) return;
        const command = body.split(' ')[0].toLowerCase();

        if (command === `${prefix}menu`) {
            await sock.sendMessage(from, { text: "🎵 *JACKSON BEATZ V3*\n\n!status - Ver avisos\n!anuncio - Enviar aviso global\n!dica - Dica de beat" });
        }

        if (command === `${prefix}status`) {
            const data = await User.findOne({ userId: sender, groupId: from });
            await sock.sendMessage(from, { text: `⚠️ Avisos: ${data ? data.warnings : 0}/3` });
        }
        
        // Adicione aqui os outros 10 comandos que você planejou
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            console.log("Reconectando...");
            startJacksonBot();
        } else if (connection === 'open') {
            console.log("🚀 BOT ONLINE E CONECTADO!");
        }
    });
}

startJacksonBot();
