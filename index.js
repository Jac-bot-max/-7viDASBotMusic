const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

const port = process.env.PORT || 10000;

// INTERFACE WEB - CONFIGURADA PARA MOÇAMBIQUE
app.get("/", (req, res) => {
    res.send(`
        <html>
            <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="background:#000; color:#fff; text-align:center; padding-top:50px; font-family:sans-serif;">
                <h1 style="color:#00ff00;">JACKSON BEATZ V3 - MOÇAMBIQUE</h1>
                <p>Digite seu número com DDI 258 (Ex: 258848786486):</p>
                <input type="number" id="num" placeholder="258xxxxxxxx" style="padding:15px; border-radius:10px; width:280px; font-size:18px;">
                <br><br>
                <button onclick="gerar()" style="padding:15px 30px; background:#00ff00; font-weight:bold; cursor:pointer; border-radius:10px;">RECEBER NOTIFICAÇÃO</button>
                <h1 id="res" style="color:#ffff00; font-size:40px; margin-top:30px;"></h1>
                <p id="st" style="color:#888;"></p>
                <script>
                    function gerar() {
                        const n = document.getElementById('num').value;
                        if(!n) return alert('Por favor, digite o número!');
                        document.getElementById('st').innerText = 'A enviar notificação para Moçambique...';
                        fetch('/pairing?nh=' + n).then(r => r.json()).then(d => {
                            document.getElementById('res').innerText = d.code || 'Erro';
                            document.getElementById('st').innerText = d.code ? 'NOTIFICAÇÃO ENVIADA! Verifique o seu WhatsApp.' : 'Erro ao gerar.';
                        });
                    }
                </script>
            </body>
        </html>
    `);
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // NAVEGADOR PARA MOÇAMBIQUE (Simulando Safari no Mac - Muito estável)
        browser: ["Mac OS", "Safari", "15.0"],
        printQRInTerminal: false,
        syncFullHistory: false
    });

    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        try {
            await delay(2500); // Espera o socket estabilizar
            let code = await sock.requestPairingCode(nh);
            res.json({ code: code });
        } catch (e) { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        const { connection } = u;
        if (connection === "close") startBot();
        if (connection === "open") {
            console.log("\n🚀 BOT JACKSON BEATZ CONECTADO!");
            // GERA A STRING GIGANTE PARA BLINDAR NO RENDER
            const str = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE ESTA KEY PARA SESSION_DATA ---\n" + str + "\n----------------------------\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        if (m.message.conversation === "!ping") {
            await sock.sendMessage(m.key.remoteJid, { text: "🏓 Pong! V3 Moçambique On!" });
        }
    });
}

app.listen(port, () => console.log("Servidor Online"));
startBot();
