const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const express = require("express");
const app = express();

const port = process.env.PORT || 10000;

// --- INTERFACE DO SITE (CAIXINHA DE NÚMERO) ---
app.get("/", (req, res) => {
    res.send(`
        <html>
            <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="font-family:sans-serif; text-align:center; background:#111; color:white; padding:50px 20px;">
                <h2 style="color:#00ff00;">🎵 JACKSON BEATZ V3 🎵</h2>
                <p>Digite seu número com DDI (Ex: 244900000000):</p>
                <input type="number" id="num" placeholder="Número com DDI" style="padding:15px; border-radius:10px; width:250px; font-size:18px;">
                <br><br>
                <button onclick="gerar()" style="padding:15px 30px; background:#00ff00; font-weight:bold; cursor:pointer; border-radius:10px;">GERAR CÓDIGO</button>
                <h1 id="res" style="color:#ffff00; font-size:40px; margin-top:30px;"></h1>
                <p id="st" style="color:#888;"></p>
                <script>
                    function gerar() {
                        const n = document.getElementById('num').value;
                        if(!n) return alert('Digite o número!');
                        document.getElementById('st').innerText = 'Solicitando...';
                        fetch('/pairing?nh=' + n).then(r => r.json()).then(d => {
                            document.getElementById('res').innerText = d.code || 'Erro';
                            document.getElementById('st').innerText = d.code ? 'CÓDIGO GERADO!' : 'Erro ao gerar';
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
    
    // Tenta carregar a sessão da variável de ambiente (Blindagem)
    if (process.env.SESSION_DATA && !state.creds.registered) {
        try {
            const sess = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
            state.creds = sess;
            console.log("✅ Sessão carregada da SESSION_DATA!");
        } catch (e) { console.log("❌ Erro na SESSION_DATA"); }
    }

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Rota que o botão do site chama
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        try {
            let code = await sock.requestPairingCode(nh);
            res.json({ code: code });
        } catch (e) { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        if (u.connection === "close") startJacksonBot();
        if (u.connection === "open") {
            console.log("🚀 CONECTADO!");
            // ISSO GERA O TEXTO PARA VOCÊ COLAR NO RENDER:
            const str = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE PARA SESSION_DATA ---\n" + str + "\n----------------------------\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
        if (body === "!ping") await sock.sendMessage(from, { text: "🏓 V3 On!" });
    });
}

app.listen(port, () => console.log("Servidor OK"));
startJacksonBot();
