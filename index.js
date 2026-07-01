const { delay } = require('@whiskeysockets/baileys');
const yts = require('yt-search'); 

const advertencias = new Map();
const respondidos = new Set();

const REGRAS_GRUPO = `📜 *REGRAS DO GRUPO (PRODUÇÃO MUSICAL)* 📜\n\n` +
                     `1️⃣ Proibido o envio de QUALQUER tipo de link não autorizado.\n` +
                     `2️⃣ Proibido fotos fora do tema do grupo (Apenas Beats/Música).\n` +
                     `3️⃣ Proibido áudios e gravações aleatórias sem relação com Beats.\n` +
                     `4️⃣ Respeite todos os produtores e artistas no grupo.\n\n` +
                     `⚠️ *O desrespeito destas regras resulta em BAN após 3 avisos!*`;

socket.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update;
    
    if (action === 'add') {
        for (const num of participants) {
            try {
                let fotoPerfil;
                try {
                    fotoPerfil = await socket.profilePictureUrl(num, 'image');
                } catch {
                    fotoPerfil = 'https://flaticon.com'; 
                }

                const mencao = `@${num.split('@')[0]}`;
                const ticketNumero = Math.floor(1000 + Math.random() * 9000);

                const textoBoasVindas = `👋 *BEM-VINDO(A) AO GRUPO DE PRODUTORES!*\n\n` +
                                        `🎧 *Membro:* ${mencao}\n` +
                                        `🎟️ *Ticket de Acesso:* #${ticketNumero}\n\n` +
                                        `${REGRAS_GRUPO}`;

                await socket.sendMessage(id, { 
                    image: { url: fotoPerfil }, 
                    caption: textoBoasVindas,
                    mentions: [num]
                });
            } catch (error) {
                console.error("Erro ao dar boas-vindas:", error);
            }
        }
    }
});

socket.ev.on('messages.upsert', async (chatUpdate) => {
    try {
        const msg = chatUpdate.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        if (!isGroup) return;

        const textRaw = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '';
        const textoMinusculo = textRaw.toLowerCase().trim();
        const sender = msg.key.participant;

        const groupMetadata = await socket.groupMetadata(from);
        const admins = groupMetadata.participants.filter(p => p.admin !== null).map(p => p.id);
        const botJid = socket.user.id.includes(':') ? socket.user.id.split(':')[0] + '@s.whatsapp.net' : socket.user.id;
        const isBotAdmin = admins.includes(botJid);
        const isSenderAdmin = admins.includes(sender);

        if (isBotAdmin && !isSenderAdmin) {
            const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
            const isFoto = !!msg.message.imageMessage;
            const isAudioOuGravacao = !!msg.message.audioMessage; 

            let infracaoDetectada = false;
            let motivoInfracao = "";

            if (linkRegex.test(textoMinusculo)) {
                infracaoDetectada = true;
                motivoInfracao = "envio de links não autorizados";
            } else if (isFoto && !textoMinusculo.includes('beat') && !textoMinusculo.includes('vst') && !textoMinusculo.includes('musica') && !textoMinusculo.includes('produção')) {
                infracaoDetectada = true;
                motivoInfracao = "envio de fotos fora do tema de produção musical";
            } else if (isAudioOuGravacao) {
                const segundos = msg.message.audioMessage.seconds;
                if (segundos < 3) {
                    infracaoDetectada = true;
                    motivoInfracao = "envio de áudio/gravação experimental inválida";
                }
            }

            if (infracaoDetectada) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await delay(500);
                await socket.sendMessage(from, { delete: msg.key });

                let avisos = (advertencias.get(sender) || 0) + 1;
                advertencias.set(sender, avisos);

                if (avisos >= 3) {
                    await socket.groupParticipantsUpdate(from, [sender], "remove");
                    await socket.sendMessage(from, { text: `🚨 *BANIDO:* O membro @${sender.split('@')[0]} foi expulso automaticamente após atingir o limite de 3 avisos por: *${motivoInfracao}*.`, mentions: [sender] });
                    advertencias.delete(sender);
                } else {
                    await socket.sendMessage(from, { text: `⚠️ *AVISO [${avisos}/3]:* @${sender.split('@')[0]}, a sua mensagem foi apagada por *${motivoInfracao}*. Não repita ou será banido!`, mentions: [sender] });
                }
                return;
            }
        }

        if (textoMinusculo.startsWith('!vst')) {
            const termoPesquisa = textRaw.slice(5).trim();
            if (!termoPesquisa) return await socket.sendMessage(from, { text: "❌ Digite o nome do VST. Exemplo: `!vst nexus gratis`" });

            await socket.sendMessage(from, { text: `🔍 A procurar VSTs e Plugins sobre: *${termoPesquisa}* no YouTube...` });
            const resultado = await yts(termoPesquisa + " vst plugin free");
            const videos = resultado.videos.slice(0, 3);

            if (videos.length === 0) return await socket.sendMessage(from, { text: "😭 Não encontrei nenhum conteúdo sobre esse VST." });

            let respostaVst = `🎹 *PLUGINS & VSTs ENCONTRADOS* 🎹\n\n`;
            videos.forEach((v, index) => {
                respostaVst += `${index + 1}️⃣ *${v.title}*\n📺 Canal: ${v.author.name}\n🔗 Link: ${v.url}\n\n`;
            });
            return await socket.sendMessage(from, { text: respostaVst });
        }

        if (textoMinusculo.startsWith('!dicas')) {
            const termoDica = textRaw.slice(6).trim();
            if (!termoDica) return await socket.sendMessage(from, { text: "❌ Digite o que quer aprender. Exemplo: `!dicas beat no celular`" });

            await socket.sendMessage(from, { text: `💡 A buscar tutoriais e dicas para: *${termoDica}*...` });
            const resultado = await yts(termoDica + " tutorial producao musical");
            const videos = resultado.videos.slice(0, 2);

            let respostaDicas = `💡 *TUTORIAIS & DICAS SELECIONADAS* 💡\n\n`;
            videos.forEach((v) => {
                respostaDicas += `🎵 *${v.title}*\n▶️ Assista aqui: ${v.url}\n\n`;
            });
            return await socket.sendMessage(from, { text: respostaDicas });
        }

        if (textoMinusculo.startsWith('!canal')) {
            const termoCanal = textRaw.slice(7).trim();
            if (!termoCanal) return await socket.sendMessage(from, { text: "❌ Digite o nome do canal/artista." });

            await socket.sendMessage(from, { text: `🔎 A procurar o canal de: *${termoCanal}*...` });
            const resultado = await yts(termoCanal);
            const canal = resultado.channels[0];

            if (!canal) return await socket.sendMessage(from, { text: "❌ Não encontrei nenhum canal com esse nome." });

            const respostaCanal = `🎤 *CANAL DO YOUTUBE ENCONTRADO* 🎤\n\n` +
                                  `👤 *Nome:* ${canal.name}\n` +
                                  `🔗 *Link do Canal:* ${canal.url}`;
            return await socket.sendMessage(from, { text: respostaCanal });
        }

        const saudacoes = ['olá família', 'ola familia', 'como estão', 'como estao', 'oi', 'olá', 'ola'];
        if (saudacoes.some(s => textoMinusculo.includes(s))) {
            const msgId = msg.key.id;
            if (!respondidos.has(msgId)) {
                respondidos.add(msgId);
                const respostaSaudacao = `👋 Olá! Tudo bem por aqui, a focar nos Beats e nas Produções! 🎧\n\nSe precisares de ajuda com alguma coisa, digita *!menu* para ver os meus comandos de pesquisa e ajuda!`;
                await socket.sendMessage(from, { text: respostaSaudacao }, { quoted: msg });
                
                setTimeout(() => respondidos.delete(msgId), 60000);
            }
        }

    } catch (error) {
        console.error("Erro interno no processador de comandos:", error);
    }
});
