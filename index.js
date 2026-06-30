const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const mongoose = require('mongoose');
const express = require('express');
const pino = require('pino');

const app = express();
app.get('/', (req, res) => res.send('Jackson Beatz V3 Online!'));
app.listen(process.env.PORT || 10000);

const MONGO_URI = 'mongodb+srv://Jackson:Bot123@cluster0.qrdsoog.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI).then(() => console.log('✅ Banco de Dados Conectado!'));

const User = mongoose.model('User', new mongoose.Schema({
    userId: String, groupId: String, warnings: { type: Number, default: 0 }
}));

async function startJacksonBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Vamos usar Pairing Code
        mobile: false, // Deixe false para pairing code
        auth: state,
        // Navegador padrão que o WhatsApp aceita mais fácil
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- LÓGICA DE PAREAMENTO REFORÇADA ---
    if (!sock.authState.creds.registered) {
        // MUITO IMPORTANTE: O número deve ter APENAS números, com o DDI (ex: 244 para Angola)
        // EXATAMENTE ASSIM: "244900000000" (Sem o +, sem espaços)
        const meuNumero = "258848786486"; 

        if (meuNumero === "COLOQUE_SEU_NUMERO_AQUI") {
            console.log("❌ ERRO: Você esqueceu de colocar seu número no código!");
        } else {
            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(meuNumero);
                    console.log(`\n\n🔑 SEU CÓDIGO DE PAREAMENTO É: ${code}\n\n`);
                } catch (err) {
                    console.log("❌ Erro ao gerar código. Tentando novamente em 10 segundos...");
                    console.error(err);
                }
            }, 10000); // Espera 10 segundos para a conexão estabilizar
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const sender = msg.key.participant || from;

        if (body === "!ping") await sock.sendMessage(from, { text: "🏓 Pong! Jackson Beatz V3 ativo." });
        
        if (body === "!status") {
            const data = await User.findOne({ userId: sender, groupId: from });
            await sock.sendMessage(from, { text: `⚠️ Advertências: ${data ? data.warnings : 0}/3` });
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            console.log("🔄 Conexão fechada. Reiniciando...");
            startJacksonBot();
        } else if (connection === 'open') {
            console.log("🚀 BOT CONECTADO E PRONTO!");
        }
    });
}

startJacksonBot();
