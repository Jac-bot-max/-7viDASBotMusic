const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const http = require("http");

// Servidor de Monitoramento
http.createServer((req, res) => res.end('Jackson AI Supreme Online')).listen(process.env.PORT || 3000);

async function startBot() {
    if (process.env.SESSION_ID && !fs.existsSync('session/creds.json')) {
        if (!fs.existsSync('session')) fs.mkdirSync('session');
        fs.writeFileSync('session/creds.json', Buffer.from(process.env.SESSION_ID, 'base64').toString('utf-8'));
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Jackson AI Pro", "MacOS", "3.0.0"],
        syncFullHistory: false,
        linkPreview: null
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const prefix = ".";

        // --- REAÇÃO AUTOMÁTICA A ÁUDIO ---
        if (type === 'audioMessage') {
            await conn.sendMessage(from, { text: '🎵 * Jackson AI Audio System* \n\nObrigado por compartilhar esta obra! Nossa equipe de engenharia sonora vai analisar o espectro deste áudio em breve. 🎧', quoted: msg });
            await conn.sendMessage(from, { react: { text: "🎧", key: msg.key } });
        }

        if (!body.startsWith(prefix)) return;
        const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);

        // Lógica de Adm
        const groupMetadata = from.endsWith('@g.us') ? await conn.groupMetadata(from) : null;
        const groupAdmins = groupMetadata ? groupMetadata.participants.filter(v => v.admin !== null).map(v => v.id) : [];
        const isSenderAdmin = groupAdmins.includes(msg.key.participant);
        const isBotAdmin = groupAdmins.includes(conn.user.id.split(':')[0] + '@s.whatsapp.net');

        // --- COMANDOS ---
        switch (command) {
            case 'menu':
            case 'help':
                const menuSupremo = `
┏━━━━━━━  『 *JACKSON AI* 』 ━━━━━━━┓
┃
┃  🚀 *ESTADO:* 24H ONLINE
┃  👑 *ENGINE:* SUPREME NEURAL V11
┃  🌐 *SERVER:* CLOUD RENDER PRO
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *MODERAÇÃO & GRUPO* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🛠️ .marcar (Tag Geral)
┃ 🛠️ .ban (Remover Infrator)
┃ 🛠️ .warn (Sistema de Aviso)
┃ 🛠️ .del (Apagar Mensagem)
┃ 🛠️ .infogrupo (Scan Geral)
┃ 🛠️ .infoadm (Hierarquia)
┃ 🛠️ .antilink (On/Off)
┃ 🛠️ .antitrava (Proteção)
┃ 🛠️ .promover (Dar Admin)
┃ 🛠️ .rebaixar (Tirar Admin)
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *ENGENHARIA DE ÁUDIO* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🎤 .mastervoz (Auto-Tune/Master)
┃ 🎚️ .masterbeat (Limiter/Punch)
┃ ✂️ .separar (Voz/Drums/Bass)
┃ 🔊 .reverb (Efeito de Sala)
┃ 📻 .delay (Correspondência)
┃ 🎹 .equalizar (EQ Profissional)
┃ 🗜️ .compressor (Voz na Cara)
┃ 🔥 .saturar (Calor Analógico)
┃ 🎧 .mixar (Glue/Cola de Voz)
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *IA & CRIATIVIDADE* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🧠 .ia (Cérebro Artificial)
┃ 🎵 .criar (Gerar Música)
┃ 📝 .letra (Compor Poesia)
┃ ✨ .sticker (Figurinhas)
┃ 🖼️ .imagem (Gerar Fotos)
┃ 🎙️ .clonar (Clone de Voz)
┃ 🔄 .transcrever (Áudio p/ Texto)
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *UTILITÁRIOS PRO* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 📡 .ping (Velocidade)
┃ 🔐 .key (Gerar Sessão ID)
┃ ⏳ .runtime (Tempo Ativo)
┃ 👤 .owner (Falar com Dono)
┃ 📊 .stats (Uso da CPU)
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *Jackson AI - O Futuro é Agora*`;
                await conn.sendMessage(from, { text: menuSupremo });
                break;

            case 'marcar':
                if (!isSenderAdmin) return;
                let aviso = `📢 *AVISO SUPREMO - JACKSON AI*\n\n${args.join(" ") || "Olá família, precisamos de mais membros! Compartilhem o grupo nas redes sociais!"}\n\n`;
                const mems = groupMetadata.participants;
                for (let p of mems) { aviso += `@${p.id.split('@')[0]} `; }
                await conn.sendMessage(from, { text: aviso, mentions: mems.map(a => a.id) });
                break;

            case 'ping':
                const start = Date.now();
                await conn.sendMessage(from, { text: "Calculando latência... ⚡" });
                const end = Date.now();
                await conn.sendMessage(from, { text: `🚀 *Velocidade de Resposta:* ${end - start}ms` });
                break;
        }
    });

    conn.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') console.log("✅ JACKSON AI: SISTEMA OPERACIONAL!");
        if (connection === 'close') startBot();
    });
}

startBot();