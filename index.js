const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, jidNormalizedUser } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const express = require("express");
const fs = require("fs");

const app = express();
app.get("/", (req, res) => res.send("Jackson Beatz V3 Online!"));
app.listen(process.env.PORT || 10000);

// 1. MONGO DB (Para as advertências)
const MONGO_URI = 'mongodb+srv://Jackson:Bot123@cluster0.qrdsoog.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI).then(() => console.log('✅ Banco de Dados Conectado!'));
const User = mongoose.model('User', new mongoose.Schema({ userId: String, groupId: String, warnings: { type: Number, default: 0 } }));

async function startJacksonBot() {
    // --- LÓGICA DE RECUPERAÇÃO DE SESSÃO ---
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // Se você já tiver a SESSION_DATA no Render, o bot vai usar ela
    if (process.env.SESSION_DATA && !state.creds.registered) {
        console.log("📥 Carregando sessão da SESSION_DATA...");
        const sessionData = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
        state.creds = sessionData;
    }

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Jackson Beatz V3", "Chrome", "1.0.0"],
    });

    // Rota para o seu Pareamento Web (Caso precise logar)
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        if (!nh) return res.json({ error: "Número faltando" });
        try {
            let code = await sock.requestPairingCode(nh);
            res.json({ code: code });
        } catch (e) { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection } = update;
        if (connection === "close") startJacksonBot();
        if (connection === "open") {
            console.log("🚀 BOT CONECTADO E BLINDADO!");
            
            // --- O SEGREDO ESTÁ AQUI: GERAR A STRING ---
            // Assim que conectar, ele gera o código para você colar no Render
            const sessionString = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE O CÓDIGO ABAIXO PARA A SESSION_DATA ---");
            console.log(sessionString);
            console.log("------------------------------------------------\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (body === "!ping") await sock.sendMessage(from, { text: "🏓 Pong! V3 Blindada." });
        
        // COMANDO PARA PEGAR A SESSÃO PELO WHATSAPP
        if (body === "!session") {
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            await sock.sendMessage(from, { text: `🛡️ *SUA SESSION ID:* \n\n${sessionStr}\n\nCopie este código e cole na variável SESSION_DATA no Render.` });
        }

        // --- ANTI-LINK ---
        if (from.endsWith('@g.us') && body.includes('http')) {
            await sock.sendMessage(from, { delete: msg.key });
        }
    });
}

startJacksonBot();
