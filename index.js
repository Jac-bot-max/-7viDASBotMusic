const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, jidDecode } = require("@whiskeysockets/baileys");
const mongoose = require('mongoose');
const express = require('express');
const pino = require('pino');
const yts = require('yt-search');

const app = express();
app.get('/', (req, res) => res.send('Bot Jackson Beatz V3 Online!'));
app.listen(process.env.PORT || 10000);

const MONGO_URI = 'mongodb+srv://Jackson:Bot123@cluster0.qrdsoog.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI).then(() => console.log('✅ Banco de Dados Conectado!'));

const User = mongoose.model('User', new mongoose.Schema({
    userId: String, groupId: String, warnings: { type: Number, default: 0 }
}));

async function startJacksonBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Jackson Beatz V3", "Chrome", "1.0.0"]
    });

    if (!sock.authState.creds.registered) {
        const meuNumero = "244XXXXXXXXX"; // COLOQUE SEU NUMERO AQUI!
        setTimeout(async () => {
            let code = await sock.requestPairingCode(meuNumero);
            console.log(`🔑 CÓDIGO DE PAREAMENTO: ${code}`);
        }, 10000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
        const sender = msg.key.participant || from;
        const pushname = msg.pushName || "Membro";

        // --- SISTEMA AUTOMÁTICO DE SEGURANÇA ---
        if (isGroup) {
            const groupMetadata = await sock.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            // 1. ANTI-LINK (Remove na hora quem não é ADM)
            if (body.includes("http") && !isSenderAdmin && isBotAdmin) {
                await sock.sendMessage(from, { delete: msg.key });
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                return;
            }

            // 2. ANTI-VÍDEO (Aviso por vídeo sem legenda de Beat)
            if (msg.message.videoMessage && !isSenderAdmin) {
                const isBeat = body.toLowerCase().includes("beat") || body.toLowerCase().includes("instrumental");
                if (!isBeat) {
                    await registrarAviso(sender, from, sock, msg);
                }
            }
        }

        // --- COMANDOS ---
        const prefix = "!";
        if (!body.startsWith(prefix)) return;
        const command = body.split(' ')[0].toLowerCase();
        const args = body.slice(command.length).trim();

        switch (command) {
            case `${prefix}menu`:
                let textoMenu = `🎵 *JACKSON BEATZ V3* 🎵\n\n` +
                                `🛡️ *GERAL:*\n` +
                                `• !status - Ver suas advertências\n` +
                                `• !dica - Receber dica de produção\n\n` +
                                `🔍 *BUSCA:*\n` +
                                `• !drumkit [nome] - Buscar kits\n\n` +
                                `⚙️ *ADM:*\n` +
                                `• !promover, !rebaixar, !kick (marque a msg)\n` +
                                `• !anuncio [texto] - Enviar global`;
                await sock.sendMessage(from, { text: textoMenu });
                break;

            case `${prefix}status`:
                const data = await User.findOne({ userId: sender, groupId: from });
                await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]}, você tem *${data ? data.warnings : 0}/3* advertências.`, mentions: [sender] });
                break;

            case `${prefix}drumkit`:
                if (!args) return sock.sendMessage(from, { text: "❌ Digite o gênero. Ex: !drumkit Trap" });
                const search = await yts(args + " drum kit download");
                let result = `🔎 *RESULTADOS PARA ${args.toUpperCase()}*\n\n`;
                for (let i = 0; i < 3; i++) {
                    result += `📦 ${search.all[i].title}\n🔗 ${search.all[i].url}\n\n`;
                }
                await sock.sendMessage(from, { text: result });
                break;

            case `${prefix}anuncio`:
                // Apenas você (Dono) pode usar
                const dono = "SEU_NUMERO@s.whatsapp.net"; 
                if (sender.includes(dono.split('@')[0])) {
                    const chats = await sock.groupFetchAllParticipating();
                    const groups = Object.values(chats).map(v => v.id);
                    for (let g of groups) {
                        await sock.sendMessage(g, { text: `📢 *ANÚNCIO JACKSON BEATZ*\n\n${args}` });
                    }
                }
                break;
        }
    });

    async function registrarAviso(userId, groupId, sock, msg) {
        let user = await User.findOne({ userId, groupId });
        if (!user) user = new User({ userId, groupId, warnings: 0 });
        user.warnings += 1;
        await user.save();

        if (user.warnings >= 3) {
            await sock.sendMessage(groupId, { text: `🚨 Limite atingido! Removendo @${userId.split('@')[0]}...`, mentions: [userId] });
            await sock.groupParticipantsUpdate(groupId, [userId], "remove");
            await User.deleteOne({ userId, groupId });
        } else {
            await sock.sendMessage(groupId, { text: `⚠️ @${userId.split('@')[0]}, vídeos só são permitidos com legenda "Beat". (${user.warnings}/3)`, mentions: [userId] });
        }
    }

    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'close') startJacksonBot();
        if (update.connection === 'open') console.log("🚀 V3 COMPLETA ATIVA!");
    });
}

startJacksonBot();
