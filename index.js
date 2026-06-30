const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const express = require("express");
const app = express();

const port = process.env.PORT || 10000;

// --- INTERFACE DO SITE ---
app.get("/", (req, res) => {
    res.send(`
        <html>
            <body style="font-family:sans-serif; text-align:center; background:#111; color:white; padding:50px;">
                <h2 style="color:#00ff00;">🎵 JACKSON BEATZ V3 🎵</h2>
                <input type="number" id="num" placeholder="DDI + Número" style="padding:15px; width:250px;">
                <button onclick="gerar()" style="padding:15px; cursor:pointer; background:#00ff00; font-weight:bold;">GERAR CÓDIGO</button>
                <h1 id="res" style="color:#ffff00; font-size:40px;"></h1>
                <script>
                    function gerar() {
                        const n = document.getElementById('num').value;
                        fetch('/pairing?nh=' + n).then(r => r.json()).then(d => {
                            document.getElementById('res').innerText = d.code || 'Erro';
                        });
                    }
                </script>
            </body>
        </html>
    `);
});

// --- LÓGICA DO BOT ---
async function startJacksonBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        // --- ISSO AQUI EVITA O ERRO ERR_OUT_OF_RANGE ---
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        try {
            let code = await sock.requestPairingCode(nh);
            res.json({ code: code });
        } catch (e) { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "close") {
            console.log("🔄 Reiniciando...");
            startJacksonBot();
        } else if (connection === "open") {
            console.log("🚀 CONECTADO!");
            // GERA A STRING PARA BLINDAGEM
            const str = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE PARA SESSION_DATA ---\n" + str + "\n----------------------------\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        if (m.message.conversation === "!ping") {
            await sock.sendMessage(m.key.remoteJid, { text: "🏓 Pong!" });
        }
    });
}

app.listen(port, () => console.log("Servidor rodando..."));
startJacksonBot();
