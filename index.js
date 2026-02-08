const { Client, GatewayIntentBits } = require("discord.js");

// 🔧 İSİM NORMALİZASYONU
function normalizeIsim(str) {
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ");
}

// 🔍 EN YAKIN ÜYE BUL
function enYakinUyeyiBul(guild, isim) {
  const hedef = normalizeIsim(isim);

  const adaylar = guild.members.cache.filter(m => {
    const dn = normalizeIsim(m.displayName);
    const un = normalizeIsim(m.user.username);
    return dn.includes(hedef) || un.includes(hedef);
  });

  if (!adaylar.size) return null;

  return adaylar
    .sort((a, b) => a.displayName.length - b.displayName.length)
    .first();
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const YETKILI_ROL_IDS = [
  "1432722610667655362",
  "1454564464727949493"
];

const REFERANS_MESAJ_ID = "1467301119867879454";
const KATILIM_UCRETI = 70000;
const KILL_UCRETI = 40000;

client.once("ready", () => {
  console.log(`✅ Bot aktif: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (
      message.author.bot ||
      !message.guild ||
      message.content !== "!bonushesapla"
    ) return;

    const member = await message.guild.members.fetch(message.author.id);
    if (!member.roles.cache.some(r => YETKILI_ROL_IDS.includes(r.id))) {
      return message.reply("❌ Bu komutu kullanamazsın.");
    }

    await message.guild.members.fetch();

    // 🔥 GÜVENLİ MESAJ ÇEKME (100 LIMIT FIX)
    let tumMesajlar = [];
    let lastId = null;
    let bulundu = false;

    while (!bulundu) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const fetched = await message.channel.messages.fetch(options);
      if (!fetched.size) break;

      for (const msg of fetched.values()) {
        tumMesajlar.push(msg);
        if (msg.id === REFERANS_MESAJ_ID) {
          bulundu = true;
          break;
        }
      }

      lastId = fetched.last().id;
    }

    const referansMesaj = tumMesajlar.find(m => m.id === REFERANS_MESAJ_ID);
    if (!referansMesaj) {
      return message.reply("❌ Referans mesaj bulunamadı.");
    }

    // 🧠 DATA
    const data = new Map();

    for (const mesaj of tumMesajlar) {
      if (
        mesaj.createdTimestamp <= referansMesaj.createdTimestamp ||
        mesaj.author.bot
      ) continue;

      const yazarIsim = normalizeIsim(mesaj.author.username);

      if (!data.has(yazarIsim)) {
        data.set(yazarIsim, { katilim: 0, kill: 0 });
      }

      // ✅ KATILIM
      data.get(yazarIsim).katilim += 1;

      const satirlar = mesaj.content.split("\n");

      for (const satir of satirlar) {
        const temiz = satir.trim();
        if (!temiz) continue;

        // 🔥 KILL ALGILAMA (2k / 2 kill / 2 kills)
        const match = temiz.match(
          /^(.+?)[\s:.-]+(\d+)\s*(k|kill|kills)?$/i
        );
        if (!match) continue;

        const isim = normalizeIsim(match[1]);
        const kill = parseInt(match[2]);
        if (isNaN(kill)) continue;

        if (!data.has(isim)) {
          data.set(isim, { katilim: 0, kill: 0 });
        }

        data.get(isim).kill += kill;
      }
    }

    if (!data.size) {
      return message.reply("❌ Veri bulunamadı.");
    }

    // 💰 PARA HESABI
    const sonucList = [];

    for (const [isim, d] of data.entries()) {
      const para =
        d.katilim * KATILIM_UCRETI +
        d.kill * KILL_UCRETI;

      sonucList.push({ isim, ...d, para });
    }

    // 🥇 EN ÇOK PARA ALAN ÜSTE
    sonucList.sort((a, b) => b.para - a.para);

    let sonuc = "🏆 **STATE CONTROL BONUS** 🏆\n\n";

    sonucList.forEach((u, i) => {
      const emoji =
        i === 0 ? "🥇" :
        i === 1 ? "🥈" :
        i === 2 ? "🥉" : "🔫";

      let uye = message.guild.members.cache.find(m =>
        normalizeIsim(m.displayName) === u.isim ||
        normalizeIsim(m.user.username) === u.isim
      );

      if (!uye) uye = enYakinUyeyiBul(message.guild, u.isim);

      const gosterim = uye ? `<@${uye.id}>` : u.isim;

      sonuc += `${emoji} **${i + 1}.** ${gosterim} → **${u.katilim} katılım ${u.kill} öldürme : ${u.para.toLocaleString()}$**\n`;
    });

    await message.channel.send(sonuc);

  } catch (err) {
    console.error("❌ HATA:", err);
    message.reply("❌ Bir hata oluştu.");
  }
});

client.login(process.env.DISCORD_TOKEN);
