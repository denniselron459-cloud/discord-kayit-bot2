const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🔐 Yetkili rol ID'leri
const YETKILI_ROL_IDS = [
  "1432722610667655362",
  "1454564464727949493"
];

// 📌 Furi'nin hesaplama yaptığı REFERANS mesaj ID
const REFERANS_MESAJ_ID = "1467279907766927588";

// 💰 Kill başı para
const KILL_UCRETI = 150000;

client.once("ready", () => {
  console.log(`✅ Bot aktif: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.content !== "!bonushesapla") return;

    // 🔒 Yetki kontrolü
    const member = await message.guild.members.fetch(message.author.id);
    const yetkiliMi = member.roles.cache.some(r =>
      YETKILI_ROL_IDS.includes(r.id)
    );

    if (!yetkiliMi) {
      return message.reply("❌ Bu komutu kullanamazsın.");
    }

    // 📥 Mesajları çek
    const mesajlar = await message.channel.messages.fetch({ limit: 100});

    const referansMesaj = mesajlar.get(REFERANS_MESAJ_ID);
    if (!referansMesaj) {
      return message.reply("❌ Referans mesaj bulunamadı. ID yanlış olabilir.");
    }

    const killMap = new Map();

    for (const mesaj of mesajlar.values()) {
      if (mesaj.createdTimestamp <= referansMesaj.createdTimestamp) continue;
      if (mesaj.author.bot) continue;

      const satirlar = mesaj.content.split("\n");

      for (const satir of satirlar) {
        const eslesme = satir.match(/^(.+?)\s+(\d+)$/);
        if (!eslesme) continue;

        const isim = eslesme[1].trim().toLowerCase();
        const kill = parseInt(eslesme[2]);
        if (isNaN(kill)) continue;

        killMap.set(isim, (killMap.get(isim) || 0) + kill);
      }
    }

    if (killMap.size === 0) {
      return message.reply("❌ Hesaplanacak kill bulunamadı.");
    }

    // 🔢 Sırala
    const sirali = [...killMap.entries()].sort((a, b) => b[1] - a[1]);

    let sonuc = "🏆 **BizzWar Bonus Sonuçları** 🏆\n\n";

    sirali.forEach(([isim, kill], i) => {
      const para = kill * KILL_UCRETI;
      const emoji =
        i === 0 ? "🥇" :
        i === 1 ? "🥈" :
        i === 2 ? "🥉" : "🔫";

      // ✅ ÇÖZÜM 1: Etiket varsa etiketle, yoksa ismi yaz
      let gosterim = isim;

      const uye = message.guild.members.cache.find(m =>
        m.displayName.toLowerCase() === isim ||
        m.user.username.toLowerCase() === isim
      );

      if (uye) {
        gosterim = `<@${uye.id}>`;
      }

      sonuc += `${emoji} **${i + 1}.** ${gosterim} → **${kill} kill** | 💰 **${para.toLocaleString()}$**\n`;
    });

    message.channel.send(sonuc);

  } catch (err) {
    console.error("BONUS HESAPLAMA HATASI:", err);
    message.reply("❌ Bir hata oluştu, loglara bak.");
  }
});

client.login(process.env.DISCORD_TOKEN);
