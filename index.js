const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

const port = process.env.PORT || 10000;

// INTERFACE WEB (A que você gosta)
app.get("/", (req, res) => {
    res.send(`
        <html>
            <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="background:#000; color:#fff; text-align:center; padding-top:50px; font-family:sans-serif;">
                <h1 style="color:#25D366;">JACKSON BEATZ V3</h1>
                <p>Digite o número para receber a NOTIFICAÇÃO:</p>
                <input type="number" id="num" placeholder="DDI + Número" style="padding:15px; border-radius:10px; width:250px;">
                <br><br>
                <button onclick="gerar()" style="padding:15px; background:#25D366; font-weight:bold; cursor:pointer; border-radius:10px;">RECEBER NOTIFICAÇÃO</button>
                <h1 id="res" style="color:#ffff00; font-size:45px; margin-top:30px;"></h1>
                <p id="st" style="color:#888;"></p>
                <script>
                    function gerar() {
                        const n = document.getElementById('num').value;
                        if(!n) return alert('Digite o número!');
                        document.getElementById('st').innerText = 'Enviando notificação...';
                        fetch('/pairing?nh=' + n).then(r => r.json()).then(d => {
                            document.getElementById('res').innerText = d.code || 'Erro';
                            document.getElementById('st').innerText = d.code ? 'NOTIFICAÇÃO ENVIADA!' : 'Erro ao enviar.';
                        });
                    }
                </script>
            </body>
        </html>
    `);
});

async function startJacksonBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    // Tenta carregar a SESSION_DATA para blindagem
    if (process.env.SESSION_DATA && !state.creds.registered) {
        try {
            state.creds = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
            console.log("✅ SESSION_DATA CARREGADA!");
        } catch (e) {}
    }

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // ESTA LINHA ABAIXO É O QUE FAZ A NOTIFICAÇÃO CHEGAR:
        browser: ["Chrome (Linux)", "Chrome (Linux)", "1.0.0"],
        printQRInTerminal: false,
        syncFullHistory: false
    });

    // Rota de Pareamento
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        try {
            // Pequeno delay para estabilizar
            await delay(2000);
            let code = await sock.requestPairingCode(nh);
            res.json({ code: code });
        } catch (e) { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        const { connection } = u;
        if (connection === "close") startJacksonBot();
        if (connection === "open") {
            console.log("\n🚀 CONECTADO!");
            // GERA A KEY PARA VOCÊ COLAR NO RENDER
            const str = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE PARA SESSION_DATA ---\n" + str + "\n----------------------------\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        if (m.message.conversation === "!ping") {
            await sock.sendMessage(m.key.remoteJid, { text: "🏓 V3 Online!" });
        }
    });
}

app.listen(port, () => console.log("Servidor Online"));
startJacksonBot();
