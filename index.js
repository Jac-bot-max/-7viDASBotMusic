const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const mongoose = require("mongoose");
const pino = require("pino");

// --- COLOQUE SEU LINK ABAIXO ---
// Exemplo: "mongodb+srv://Jackson:SuaSenhaAqui@cluster0.qrdsoog.mongodb.net/?appName=Cluster0"
const mongoURL = "mongodb+srv://Jackson:COLOQUE_SUA_SENHA_AQUI@cluster0.qrdsoog.mongodb.net/?appName=Cluster0";

async function startBot() {
    try {
        // Conecta ao MongoDB
        await mongoose.connect(mongoURL);
        console.log("✅ Conectado ao MongoDB com sucesso!");

        const { state, saveCreds } = await useMultiFileAuthState('session');

        const conn = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ["Jackson AI", "Chrome", "1.0.0"]
        });

        // Pede o código de conexão se não estiver logado
        if (!conn.authState.creds.registered) {
            const phoneNumber = "258865560063";
            await delay(5000);
            try {
                const code = await conn.requestPairingCode(phoneNumber);
                console.log(`\n====================================`);
                console.log(`SEU CÓDIGO DE CONEXÃO: ${code}`);
                console.log(`====================================\n`);
            } catch (err) {
                console.log("Erro ao pedir código. Tente reiniciar o bot.");
            }
        }

        conn.ev.on('creds.update', saveCreds);

        conn.ev.on('connection.update', (update) => {
            const { connection } = update;
            if (connection === 'open') console.log("✅ BOT ONLINE!");
            if (connection === 'close') {
                console.log("Conexão fechada, reiniciando...");
                startBot();
            }
        });

    } catch (error) {
        console.error("❌ Erro fatal ao iniciar:", error);
    }
}

startBot();