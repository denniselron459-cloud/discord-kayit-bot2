const { Client, GatewayIntentBits } = require("discord.js");

// 🔧 İSİM NORMALİZASYONU (ASIL SORUNU ÇÖZEN KISIM)
function normalizeIsim(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N} ]/gu, "") // emoji, nokta, özel karakter sil
    .replace(/\s+/g, " ");          // fazla boşlukları teke indir
}

// 🔍 EN YAKIN ÜYE BULMA (NORMALİZE EDEREK)
function enYakinUyeyiBul(guild, isim) {
  const hedef = normalizeIsim(isim);

  const adaylar = guild.members.cache.filter(m => {
    const dn = normalizeIsim(m.displayName);
    const un = normalizeIsim(m.user.username);
    return dn.includes(hedef) || un.includes(hedef);
  });

  if (adaylar.size === 0) return null;

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

// 🔐 Yetkili roller
const YETKILI_ROL_IDS = [
  "1432722610667655362",
  "1454564464727949493"
];

// 📌 Referans mesaj
const REFERANS_MESAJ_ID = "1467279907766927588";
const KILL_UCRETI = 150000;

client.once("ready", () => {
  console.log(`✅ Bot aktif: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.content !== "!bonushesapla") return;

    const member = await message.guild.members.fetch(message.author.id);
    const yetkiliMi = member.roles.cache.some(r =>
      YETKILI_ROL_IDS.includes(r.id)
    );

    if (!yetkiliMi) {
      return message.reply("❌ Bu komutu kullanamazsın.");
    }

    // ✅ TÜM ÜYELERİ CACHE'E AL
    await message.guild.members.fetch();

    // 📥 MESAJLARI SAYFALI ÇEK
    let tumMesajlar = [];
    let lastId;

    while (true) {
      const fetched = await message.channel.messages.fetch({
        limit: 100,
        before: lastId
      });

      if (fetched.size === 0) break;

      tumMesajlar.push(...fetched.values());
      lastId = fetched.last().id;

      if (fetched.has(REFERANS_MESAJ_ID)) break;
    }

    const referansMesaj = tumMesajlar.find(m => m.id === REFERANS_MESAJ_ID);
    if (!referansMesaj) {
      return message.reply("❌ Referans mesaj bulunamadı.");
    }

    const killMap = new Map();

    for (const mesaj of tumMesajlar) {
      if (mesaj.createdTimestamp <= referansMesaj.createdTimestamp) continue;
      if (mesaj.author.bot) continue;

      for (const satir of mesaj.content.split("\n")) {
        const eslesme = satir.match(/^(.+?)\s+(\d+)$/);
        if (!eslesme) continue;

        const isim = normalizeIsim(eslesme[1]);
        const kill = parseInt(eslesme[2]);
        if (isNaN(kill)) continue;

        killMap.set(isim, (killMap.get(isim) || 0) + kill);
      }
    }

    if (killMap.size === 0) {
      return message.reply("❌ Hesaplanacak kill bulunamadı.");
    }

    const sirali = [...killMap.entries()].sort((a, b) => b[1] - a[1]);

    let sonuc = "🏆 **BIZZWAR WIN KILLS** 🏆\n\n";

    sirali.forEach(([isim, kill], i) => {
      const para = kill * KILL_UCRETI;
      const emoji =
        i === 0 ? "🥇" :
        i === 1 ? "🥈" :
        i === 2 ? "🥉" : "🔫";

      let gosterim = isim;

      // 1️⃣ birebir normalize eşleşme
      let uye = message.guild.members.cache.find(m =>
        normalizeIsim(m.displayName) === isim ||
        normalizeIsim(m.user.username) === isim
      );

      // 2️⃣ en yakın eşleşme
      if (!uye) {
        uye = enYakinUyeyiBul(message.guild, isim);
      }

      if (uye) gosterim = `<@${uye.id}>`;

      sonuc += `${emoji} **${i + 1}.** ${gosterim} → **${kill} kill** | 💰 **${para.toLocaleString()}$**\n`;
    });

    await message.channel.send(sonuc);

  } catch (err) {
    console.error("❌ BONUS HESAPLAMA HATASI:", err);
    message.reply("❌ Bir hata oluştu, loglara bak.");
  }
});

client.login(process.env.DISCORD_TOKEN);
