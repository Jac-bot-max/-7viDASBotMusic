const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } = require("@whiskeysockets/baileys");
const mongoose = require('mongoose');
const express = require('express');
const pino = require('pino');

// Servidor para o Render
const app = express();
app.get('/', (req, res) => res.send('Bot Jackson Beatz V3 - Sessão no Banco Ativa!'));
app.listen(process.env.PORT || 10000);

// 1. CONEXÃO MONGODB
const MONGO_URI = 'mongodb+srv://Jackson:Bot123@cluster0.qrdsoog.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI).then(() => console.log('✅ Banco de Dados Conectado!'));

// Modelo para guardar a SESSÃO e ADVERTÊNCIAS
const AuthSchema = new mongoose.Schema({ id: String, session: String });
const Auth = mongoose.model('Auth', AuthSchema);
const User = mongoose.model('User', new mongoose.Schema({ userId: String, groupId: String, warnings: { type: Number, default: 0 } }));

async function startJacksonBot() {
    // Lógica para recuperar a sessão do banco de dados
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Jackson Beatz V3", "Chrome", "1.0.0"]
    });

    // Se o bot pedir código novamente:
    if (!sock.authState.creds.registered) {
        const meuNumero = "SEU_NUMERO_AQUI"; // Coloque seu número
        setTimeout(async () => {
            let code = await sock.requestPairingCode(meuNumero);
            console.log(`🔑 NOVO CÓDIGO DE PAREAMENTO: ${code}`);
        }, 10000);
    }

    // Salva as credenciais sempre que houver mudança
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (body === "!ping") await sock.sendMessage(from, { text: "🏓 V3 Online com Memória!" });
        
        // Anti-link automático
        if (from.endsWith('@g.us') && body.includes('http')) {
            const groupMetadata = await sock.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            if (!admins.includes(msg.key.participant)) {
                await sock.sendMessage(from, { delete: msg.key });
            }
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'close') startJacksonBot();
        if (connection === 'open') console.log("🚀 CONECTADO COM SUCESSO!");
    });
}

startJacksonBot();
