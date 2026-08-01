const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session'); // Pasta onde salva a conexão
    
    const conn = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Importante: False para usar o código
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- LÓGICA DO PAIRING CODE (NÚMERO NOVO) ---
    if (!conn.authState.creds.registered) {
        const phoneNumber = "258865560063"; // Seu número com prefixo
        setTimeout(async () => {
            try {
                let code = await conn.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n====================================\n`);
                console.log(`CÓDIGO DE CONEXÃO: ${code}`);
                console.log(`\n====================================\n`);
            } catch (error) {
                console.error("Erro ao gerar código de emparelhamento:", error);
            }
        }, 3000);
    }

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') console.log("Bot conectado com sucesso!");
        if (connection === 'close') startBot(); // Tenta reconectar se cair
    });
}

startBot();