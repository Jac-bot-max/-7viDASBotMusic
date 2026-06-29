 const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Jackson Beatz - Sistema de Notificação Ativo'));
app.listen(process.env.PORT || 3000);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        // ESTA IDENTIDADE ABAIXO É A QUE MAIS GERA NOTIFICAÇÕES:
        browser: ["Android", "Chrome", "11.0.0"],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0
    });

    if (!sock.authState.creds.registered) {
        const meuNumero = "258848786486"; 

        console.log("--- SOLICITANDO NOTIFICAÇÃO ---");
        // Esperamos 20 segundos para o servidor respirar
        await delay(20000); 

        try {
            const code = await sock.requestPairingCode(meuNumero);
            console.log("\n================================");
            console.log("👉 CÓDIGO GERADO: " + code);
            console.log("================================");
            console.log("A NOTIFICAÇÃO DEVE APARECER AGORA!");
        } catch (e) {
            console.log("Erro: O WhatsApp bloqueou a notificação para este IP do Render.");
        }
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') console.log('✅ BOT CONECTADO!');
        if (connection === 'close') {
            const restart = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (restart) startBot();
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        if (msg.message.conversation === '!ping') {
            await sock.sendMessage(msg.key.remoteJid, { text: "Online! 🚀" });
        }
    });
}
startBot();
