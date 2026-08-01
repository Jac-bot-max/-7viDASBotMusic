const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const pino = require("pino");

async function startBot() {
    // Cria a pasta 'session' para salvar a conexão
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const conn = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Desativa o QR para usar o código de número
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- LÓGICA DO PAIRING CODE ---
    if (!conn.authState.creds.registered) {
        const phoneNumber = "258865560063"; // Seu número atualizado
        
        // Aguarda 5 segundos para garantir que o sistema está pronto
        await delay(5000);
        
        try {
            let code = await conn.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n====================================\n`);
            console.log(`SEU CÓDIGO DE CONEXÃO: ${code}`);
            console.log(`\n====================================\n`);
        } catch (error) {
            console.error("Erro ao gerar código:", error);
        }
    }

    // Salva as credenciais sempre que houver atualização
    conn.ev.on('creds.update', saveCreds);

    // Gerencia a conexão
    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log("✅ BOT CONECTADO COM SUCESSO!");
        }
        if (connection === 'close') {
            console.log("❌ Conexão fechada, tentando reiniciar...");
            startBot();
        }
    });

    // Responder a mensagens (Exemplo básico)
    conn.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (text === 'oi') {
            await conn.sendMessage(msg.key.remoteJid, { text: 'Olá! Sou o Jackson AI Bot.' });
        }
    });
}

// Inicia o bot e trata erros globais
startBot().catch(err => console.log("Erro ao iniciar:", err));