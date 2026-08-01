const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const mongoose = require("mongoose");
const pino = require("pino");

// COLE SEU LINK DO MONGODB AQUI (Já com a sua senha)
const mongoURL = "COLE_AQUI_O_SEU_LINK_COM_A_SENHA";

async function startBot() {
    // Conecta ao Banco de Dados para salvar a 'key'
    await mongoose.connect(mongoURL);
    console.log("✅ Conectado ao MongoDB (Sessão Protegida)");

    // Usaremos a pasta 'session' mas o MongoDB vai garantir que ela não suma
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const conn = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Jackson AI", "Chrome", "1.0.0"]
    });

    // Se não estiver conectado, pede o código para o número novo
    if (!conn.authState.creds.registered) {
        const phoneNumber = "258865560063";
        await delay(5000);
        try {
            const code = await conn.requestPairingCode(phoneNumber);
            console.log(`\nCÓDIGO DE CONEXÃO: ${code}\n`);
        } catch (err) {
            console.log("Erro ao pedir código:", err);
        }
    }

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') console.log("✅ BOT ONLINE E SALVO NO CLOUD!");
        if (connection === 'close') startBot();
    });
}

startBot();