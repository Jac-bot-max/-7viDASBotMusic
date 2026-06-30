const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

// SERVIDOR WEB (IGUAL AO SEU PRINT 1)
app.get("/", (req, res) => {
    res.send("✅ BOT JACKSON BEATZ ONLINE!");
});

async function startJacksonBot() {
    // 1. LÓGICA DE SESSÃO (IGUAL AO SEU PRINT 3)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // Recupera a SESSION_DATA se ela estiver no Render
    if (process.env.SESSION_DATA && !state.creds.registered) {
        try {
            state.creds = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
            console.log("📥 Sessão recuperada da SESSION_DATA!");
        } catch (e) { console.log("Erro ao carregar SESSION_DATA"); }
    }

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // ESTE NAVEGADOR É O QUE ENVIA A NOTIFICAÇÃO (MAC OS)
        browser: ["Mac OS", "Chrome", "10.15.7"],
        printQRInTerminal: false,
        syncFullHistory: false
    });

    // ROTA PARA O PAREAMENTO (IGUAL AO QUE VOCÊ TINHA)
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        if (!nh) return res.json({ error: "Número faltando" });
        try {
            await delay(2000); // Espera 2 segundos para o zap não bloquear
            let code = await sock.requestPairingCode(nh);
            res.json({ code: code });
        } catch (e) {
            res.json({ error: true });
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        const { connection } = u;
        if (connection === "close") startJacksonBot();
        if (connection === "open") {
            // LOGS IGUAIS AOS SEUS PRINTS (ESTRUTURA ////)
            console.log("\n////////////////////////////////////////////////////\n");
            console.log("✅ BOT JACKSON BEATZ ONLINE!");
            console.log("\n////////////////////////////////////////////////////\n");
            
            // GERA O BLOCO GIGANTE (KEY) PARA VOCÊ COPIAR
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log(sessionStr);
            console.log("\n////////////////////////////////////////////////////\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";

        if (body === "!ping") await sock.sendMessage(from, { text: "🏓 Pong! V3 Online e Blindada." });
    });
}

app.listen(process.env.PORT || 10000, () => {
    console.log("Servidor de Pareamento Online!");
});

startJacksonBot();
