const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

// 1. O SERVIDOR QUE O CRON-JOB ACESSA (Igual ao seu print)
app.get("/", (req, res) => {
    res.send("✅ BOT JACKSON BEATZ ONLINE!");
});

async function startJacksonBot() {
    // 2. Tenta ler a SESSION_DATA das variáveis do Render
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    if (process.env.SESSION_DATA && !state.creds.registered) {
        try {
            const sessData = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
            state.creds = sessData;
            console.log("📥 Sessão recuperada da SESSION_DATA!");
        } catch (e) {
            console.log("Erro ao carregar SESSION_DATA");
        }
    }

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Simula navegador para notificação
        printQRInTerminal: false
    });

    // 3. LOGICA PARA GERAR A NOTIFICAÇÃO E O CÓDIGO
    if (!sock.authState.creds.registered) {
        // COLOQUE SEU NÚMERO AQUI (Ex: 244923000000)
        const meuNumero = "SEU_NUMERO_AQUI"; 

        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(meuNumero);
                console.log(`\n\n////////////////////////////////////////////////////\n`);
                console.log(`👉 SEU CÓDIGO DE PAREAMENTO: ${code}`);
                console.log(`\n////////////////////////////////////////////////////\n`);
            } catch (err) {
                console.log("Erro ao gerar código. Verifique o número.");
            }
        }, 5000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        const { connection } = u;
        if (connection === "close") startJacksonBot();
        if (connection === "open") {
            console.log("\n////////////////////////////////////////////////////\n");
            console.log("✅ BOT JACKSON BEATZ ONLINE!");
            console.log("\n////////////////////////////////////////////////////\n");
            
            // --- GERADOR DO BLOCO DE SESSÃO (IGUAL AO SEU PRINT) ---
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE O BLOCO ABAIXO E COLE NA SESSION_DATA ---\n");
            console.log(sessionStr);
            console.log("\n----------------------------------------------------\n");
        }
    });

    // Resposta simples para teste
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        if (m.message.conversation === "!ping") {
            await sock.sendMessage(m.key.remoteJid, { text: "🏓 Pong! Bot ativo." });
        }
    });
}

app.listen(process.env.PORT || 10000, () => {
    console.log("Servidor Web Ativo!");
});

startJacksonBot();
