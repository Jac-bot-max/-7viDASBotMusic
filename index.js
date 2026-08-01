const { default: makeWASocket, useMultiFileAuthState, delay, disconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const http = require("http");

// Servidor para o Render não dormir
http.createServer((req, res) => res.end('Jackson AI Online')).listen(process.env.PORT || 3000);

async function startBot() {
    // CRIA A SESSÃO
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const conn = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ["Jackson AI", "Chrome", "1.0.0"]
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log("✅ BOT ONLINE!");
            
            // --- GERADOR DE KEY (SESSÃO) ---
            // Isso aqui vai imprimir sua KEY no log para você salvar
            const creds = fs.readFileSync('./auth_info/creds.json');
            const sessionKey = Buffer.from(creds).toString('base64');
            console.log(`\n====================================\nSUA KEY (SALVE ISSO):\n\n${sessionKey}\n\n====================================\n`);
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== 401) startBot(); // Reconecta se não for deslogado
        }
    });

    // OUVINTE DE MENSAGENS
    conn.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // RESPOSTA SIMPLES PARA TESTAR
        if (body.startsWith('.')) {
            const command = body.slice(1).trim().toLowerCase();
            if (command === 'menu') {
                await conn.sendMessage(from, { text: "🤖 Jackson AI Ativo via Key!" });
            }
        }
        
        if (msg.message.audioMessage) {
            await conn.sendMessage(from, { text: "Obra de arte recebida! 🎵" });
        }
    });

    // PEDIR CÓDIGO SE NÃO TIVER LOGADO
    if (!conn.authState.creds.registered) {
        const phoneNumber = "258865560063";
        await delay(5000);
        const code = await conn.requestPairingCode(phoneNumber);
        console.log(`\nCÓDIGO DE PAREAMENTO: ${code}\n`);
    }
}

startBot();