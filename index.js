const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, disconnects } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const express = require("express");

// Servidor para manter o bot ativo
const app = express();
app.get("/", (req, res) => res.send("Jackson Beatz V3 Online!"));
app.listen(process.env.PORT || 10000);

// Conexão MongoDB
const MONGO_URI = 'mongodb+srv://Jackson:Bot123@cluster0.qrdsoog.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI).then(() => console.log('✅ Banco de Dados Conectado!'));

async function startJacksonBot() {
    // Usaremos uma pasta temporária, mas o segredo será a String de Sessão depois
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        browser: ["Jackson Beatz", "Chrome", "1.0.0"],
    });

    // --- PAREAMENTO POR CÓDIGO ---
    if (!sock.authState.creds.registered) {
        // COLOQUE SEU NÚMERO ABAIXO (Apenas números, com DDI)
        const meuNumero = "2449XXXXXXXX"; // <-- MUDE AQUI!

        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(meuNumero);
                console.log(`\n\n👉 SEU CÓDIGO DE PAREAMENTO: ${code}\n\n`);
            } catch (err) {
                console.log("Erro ao gerar código. Reinicie o Deploy.");
            }
        }, 10000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) startJacksonBot();
        } else if (connection === "open") {
            console.log("🚀 BOT CONECTADO E BLINDADO!");
            
            // LOG DE SEGURANÇA: Avisa que conectou
            sock.sendMessage(sock.user.id, { text: "✅ Jackson Beatz V3: Conectado com sucesso!" });
        }
    });

    // --- COMANDOS BÁSICOS ---
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (body === "!ping") {
            await sock.sendMessage(from, { text: "🏓 Pong! V3 ativa." });
        }
        
        if (body === "!menu") {
            await sock.sendMessage(from, { text: "🎵 *JACKSON BEATZ V3*\n\n🛡️ !status\n🔍 !drumkit\n📢 !anuncio" });
        }
    });
}

startJacksonBot();
