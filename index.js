 const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Servidor para manter o bot vivo no Render
app.get('/', (req, res) => res.send('Bot Jackson Beatz Online!'));
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false
    });

    // SISTEMA DE PAREAMENTO PARA UM SÓ TELEMÓVEL
    if (!sock.authState.creds.registered) {
        // Coloque seu número aqui ou ele pega da variável do Render
        const meuNumero = "258848786486"; 

        console.log("\n[ AGUARDE ] Gerando código para: " + meuNumero);
        await delay(10000); 

        try {
            const code = await sock.requestPairingCode(meuNumero);
            console.log("\n========================================");
            console.log("👉 TEU CÓDIGO DE PAREAMENTO: " + code);
            console.log("========================================");
            console.log("1. COPIE ESSE CÓDIGO AGORA!");
            console.log("2. VÁ NO WHATSAPP -> APARELHOS CONECTADOS");
            console.log("3. CONECTAR COM NÚMERO DE TELEFONE E COLE.");
        } catch (e) {
            console.log("Erro ao gerar código. Tente dar Manual Deploy.");
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') console.log('✅ BOT JACKSON BEATZ ONLINE!');
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    // Comando !menu
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        if (texto === '!menu') {
            await sock.sendMessage(msg.key.remoteJid, { text: "🤖 *BOT JACKSON BEATZ ONLINE NA NUVEM!*" });
        }
    });
}
startBot();
