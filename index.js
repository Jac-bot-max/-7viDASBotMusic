import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, downloadContentFromMessage } from "@whiskeysockets/baileys";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// 🟢 REGIÃO 1: SERVIDOR WEB & ESTABILIDADE RENDER
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('7viDASBotMusic PRO - Elite Ativa 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

if (!global.db) global.db = { warns: new Map() };

// Configuração IA Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "FALTA_CHAVE");
const aiModel = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "Tu és o @7viDASBotMusic, assistente supremo do JACKSON@7VIDAS. Tua missão é gerir grupos de beatmakers de Moçambique e Angola. Responde de forma profissional, brilhante e educada."
});

async function startBot() {
    // =========================================================================
    // 🔵 REGIÃO 2: ANTI-BAN & SESSÃO (SESSION_ID)
    // =========================================================================
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;

    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        fs.writeFileSync('./session_data/creds.json', decoded);
    }

    const socket = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['@7viDASBotMusic', 'Chrome', '1.0.0'],
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 60000
    });

    socket.ev.on("creds.update", saveCreds);

    // =========================================================================
    // 🟠 REGIÃO 3: SISTEMA DE BOAS-VINDAS (COM FOTO FL STUDIO)
    // =========================================================================
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcome = `╔═══════ 🔵 *ＷＥＬＣＯＭＥ* 🔵 ═══════╗\n║ 👋 Olá @${jid.split('@')[0]}!\n║ Bem-vindo à União Moçambique & Angola 🇲🇿🇦🇴\n║\n║ 🍓 *TEMA:* FL Studio Mobile & PC\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║ ⚪ Digite *.menu* para começar.\n╚══════════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: welcome, mentions: [jid] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => { if (u.connection === "close") startBot(); });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const sender = msg.key.participant || msg.key.remoteJid;
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();
            const textLow = textRaw.toLowerCase();

            // =====================================================================
            // 🛡️ REGIÃO 4: XERIFE MÃO DE FERRO (STATUS / LINKS / INSULTOS)
            // =====================================================================
            if (isGroup) {
                const meta = await socket.groupMetadata(from);
                const admins = meta.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de") || textLow.includes("@ este grupo foi mencionado");
                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);
                const isInsulto = ["lixo", "fdp", "macaco", "bullying"].some(p => textLow.includes(p));

                if ((isStatus || isLink || isInsulto) && isBotAdmin && !isSenderAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(300);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA NA HORA
                    
                    let v = (global.db.warns.get(sender) || 0) + 1;
                    global.db.warns.set(sender, v);
                    
                    if (v >= 3 || isInsulto) {
                        await socket.groupParticipantsUpdate(from, [sender], "remove");
                        await socket.sendMessage(from, { text: `🔴 *BANIDO:* @${sender.split('@')[0]} removido por comportamento inadequado.`, mentions: [sender] });
                    } else {
                        await socket.sendMessage(from, { text: `⚠️ *AVISO [${v}/3]* @${sender.split('@')[0]}, respeite as regras! (Proibido Status/Links).`, mentions: [sender] });
                    }
                    return;
                }
            }

            // =====================================================================
            // 🎹 REGIÃO 5: CÉREBRO DE MÍDIA (VOZ VS BEAT VS STICKER)
            // =====================================================================
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // =====================================================================
            // 😊 REGIÃO 6: AUTO-RESPONDER (IA & SOCIAL)
            // =====================================================================
            const greets = ["oi", "olá", "ola", "kmk", "bom dia", "tudo bem"];
            if (!textRaw.startsWith('.') && (greets.includes(textLow) || !isGroup)) {
                if (process.env.GEMINI_API_KEY) {
                    await socket.sendMessage(from, { react: { text: "🧠", key: msg.key } });
                    const result = await aiModel.generateContent(textRaw);
                    await socket.sendMessage(from, { text: `🤖 *ＡＳＳＩＳＴＥＮＴＥ ＩＡ*\n\n${result.response.text()}` }, { quoted: msg });
                    return;
                }
            }

            // =====================================================================
            // 📝 REGIÃO 7: COMANDOS MANUAIS (ADMINISTRAÇÃO & GRUPO)
            // =====================================================================
            if (!textRaw.startsWith('.')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const cmd = args.shift().toLowerCase();
            const query = args.join(" ");
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;

            switch (cmd) {
                case "menu":
                    const menu = `╔═════ 🔵 *@7viDASBotMusic* 🔵 ═════╗\n║\n║ 🔴 *ＡＤＭＩＮＩＳＴＲＡＣ̧ＡＯ*\n║ ◽ .marcar | .link | .ban\n║ ◽ .promote | .demote | .unwarn\n║\n║ ⚪ *ＰＲＯＤＵＣ̧ＡＯ*\n║ ◽ .play | .yt | .drums | .vst\n║ ◽ .apps | .dicas | .sticker\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n╚══════════════════════════╝`;
                    await socket.sendMessage(from, { text: menu });
                    break;

                case "marcar": // COMANDO DE PROMOÇÃO DO GRUPO
                    const g = await socket.groupMetadata(from);
                    const members = g.participants.map(p => p.id);
                    const msgPromo = `📢 🔴 *ＡＴＥＮＣ̧Ａ̃Ｏ ＭＥＭＢＲＯＳ* 🔴\n\n🚀 Vamos promover o grupo para que tenhamos mais produtores ativos! Atualmente o nosso número de membros é menor do que o necessário. Vamos crescer juntos! 🇲🇿🇦🇴\n\n🔗 *PARTILHEM O LINK:* https://chat.whatsapp.com/${await socket.groupInviteCode(from)}`;
                    await socket.sendMessage(from, { text: msgPromo, mentions: members });
                    break;

                case "infoadm":
                    await socket.sendMessage(from, { text: `👑 *JACKSON@7VIDAS*\n🎵 Cantor & Produtor\n💻 Programador\n📞 +258 87 733 8300\n🇲🇿 MZ & AO 🇦🇴` });
                    break;

                case "sticker": case "s":
                    const isMedia = type === 'imageMessage' || type === 'videoMessage';
                    const isQuoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    const targetMsg = isQuoted ? msg.message.extendedTextMessage.contextInfo.quotedMessage : msg.message;
                    if (targetMsg.imageMessage || targetMsg.videoMessage) {
                        const stream = await downloadContentFromMessage(targetMsg.imageMessage || targetMsg.videoMessage, targetMsg.imageMessage ? 'image' : 'video');
                        let buffer = Buffer.from([]);
                        for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                        const s = new Sticker(buffer, { pack: 'Jackson Pack', author: '@7viDASBotMusic', type: StickerTypes.FULL });
                        await socket.sendMessage(from, { sticker: await s.toBuffer() });
                    }
                    break;

                case "promote":
                    if (target) await socket.groupParticipantsUpdate(from, [target], "promote");
                    break;

                case "demote":
                    if (target) await socket.groupParticipantsUpdate(from, [target], "demote");
                    break;

                case "unwarn":
                    if (target) { global.db.warns.delete(target); await socket.sendMessage(from, { text: "✅ Advertências limpas." }); }
                    break;

                case "yt": case "play": case "drums": case "vst": case "apps":
                    await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                    const s = await yts(query + (cmd === "apps" ? " download" : " production"));
                    if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO*\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
                    break;

                case "ping":
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - (msg.messageTimestamp * 1000)}ms` });
                    break;
            }
        } catch (e) { console.log(e); }
    });
}
startBot();