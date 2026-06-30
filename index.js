const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

const port = process.env.PORT || 10000;

// SERVIDOR WEB PARA O PAREAMENTO
app.get("/", (req, res) => {
    res.send(`
        <html>
            <body style="background:#000; color:#0f0; text-align:center; padding-top:50px; font-family:sans-serif;">
                <h1>Jackson Beatz V3 - Pareamento</h1>
                <p>Digite seu número com DDI (Ex: 244900000000)</p>
                <input type="text" id="num" style="padding:10px; border-radius:5px;">
                <button onclick="gerar()" style="padding:10px; cursor:pointer;">GERAR CÓDIGO</button>
                <h1 id="cod" style="color:yellow; font-size:50px;"></h1>
                <script>
                    function gerar() {
                        const n = document.getElementById('num').value;
                        fetch('/pairing?nh=' + n).then(r => r.json()).then(d => {
                            document.getElementById('cod').innerText = d.code || 'Erro';
                        });
                    }
                </script>
            </body>
        </html>
    `);
});

async function startJacksonBot() {
    // 1. LÓGICA DE SESSÃO (SESSION_DATA)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // Se você já tiver a SESSION_DATA salva no Render, o bot entra direto por aqui:
    if (process.env.SESSION_DATA && !state.creds.registered) {
        try {
            const sessData = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
            state.creds = sessData;
            console.log("📥 SESSÃO RECUPERADA DA SESSION_DATA!");
        } catch (e) { console.log("Erro ao carregar SESSION_DATA"); }
    }

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Jackson Beatz", "Chrome", "1.0.0"],
        syncFullHistory: false
    });

    // Rota para o botão do site funcionar
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        try {
            let code = await sock.requestPairingCode(nh);
            res.json({ code: code });
        } catch (e) { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        const { connection } = u;
        if (connection === "close") startJacksonBot();
        if (connection === "open") {
            console.log("\n🚀 BOT CONECTADO COM SUCESSO!");
            
            // --- AQUI ESTÁ A KEY QUE VOCÊ PRECISA COPIAR ---
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n================ SESSION_DATA (COPIE TUDO ABAIXO) ================\n");
            console.log(sessionStr);
            console.log("\n==================================================================\n");
        }
    });

    // COMANDOS BÁSICOS
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";

        if (body === "!ping") await sock.sendMessage(from, { text: "🏓 Pong! V3 Online." });
        if (body === "!menu") await sock.sendMessage(from, { text: "🎵 *JACKSON BEATZ V3*\n\nBot configurado e blindado!" });
    });
}

app.listen(port, () => console.log("Site de Pareamento Online!"));
startJacksonBot();
