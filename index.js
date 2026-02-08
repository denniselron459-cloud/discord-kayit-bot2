const { Client, GatewayIntentBits } = require("discord.js");

/* ================== AYARLAR ================== */

// Yetkili rol ID'leri
const YETKILI_ROL_IDS = [
  "1432722610667655362",
  "1454564464727949493"
];

// Furi'nin yaptığı SON hesaplama mesaj ID'si
const REFERANS_MESAJ_ID = "1467279907766927588";

// Kill başı ücret
const KILL_UCRETI = 150000;

/* ============================================= */

// 🔍 En yakın üyeyi bul (isim içerme mantığı)
function enYakinUyeyiBul(guild, isim) {
  const hedef = isim.toLowerCase();

  const adaylar = guild.members.cache.filter(m => {
    const dn = m.displayName.toLowerCase();
    const un = m.user.username.toLowerCase();
    return dn.includes(hedef) || un.includes(hedef);
  });

  if (adaylar.size === 0) return null;

  // En kısa isim = en yakın eşleşme
  return adaylar
    .sort((a, b) => a.displayName.length - b.displayName.length)
    .first();
}

/* ================== CLIENT ================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`✅ Bot aktif: ${client.user.tag}`);
});

/* ================== KOMUT ================== */

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

    // ⚠️ KRİTİK: Tüm üyeleri cache'e al (etiket sorunu çözülür)
    await message.guild.members.fetch();

    /* ====== MESAJLARI SAYFALI ÇEK ====== */
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
      return message.reply("❌ Referans mesaj bulunamadı (ID yanlış olabilir).");
    }

    /* ====== KILL HESAPLAMA ====== */
    const killMap = new Map();

    for (const mesaj of tumMesajlar) {
      if (mesaj.createdTimestamp <= referansMesaj.createdTimestamp) continue;
      if (mesaj.author.bot) continue;

      for (const satir of mesaj.content.split("\n")) {
        // 🔥 ESNEK REGEX (kill kaybı olmaz)
        const eslesme = satir.match(/^(.+?)\D+(\d+)\s*$/);
        if (!eslesme) continue;

        const isim = eslesme[1]
          .toLowerCase()
          .replace(/[^a-z0-9ğüşöçıi\s]/gi, "")
          .trim();

        const kill = parseInt(eslesme[2]);
        if (isNaN(kill)) continue;

        killMap.set(isim, (killMap.get(isim) || 0) + kill);
      }
    }

    if (killMap.size === 0) {
      return message.reply("❌ Hesaplanacak kill bulunamadı.");
    }

    /* ====== SIRALA & YAZDIR ====== */
    const sirali = [...killMap.entries()].sort((a, b) => b[1] - a[1]);

    let sonuc = "🏆 **BIZZWAR WIN KILLS** 🏆\n\n";

    sirali.forEach(([isim, kill], i) => {
      const para = kill * KILL_UCRETI;

      const emoji =
        i === 0 ? "🥇" :
        i === 1 ? "🥈" :
        i === 2 ? "🥉" : "🔫";

      // Etiketleme
      let gosterim = isim;
      let uye =
        message.guild.members.cache.find(m =>
          m.displayName.toLowerCase() === isim ||
          m.user.username.toLowerCase() === isim
        ) ||
        enYakinUyeyiBul(message.guild, isim);

      if (uye) gosterim = `<@${uye.id}>`;

      sonuc += `${emoji} **${i + 1}.** ${gosterim} → **${kill} kill** | 💰 **${para.toLocaleString()}$**\n`;
    });

    await message.channel.send(sonuc);

  } catch (err) {
    console.error("❌ BONUS HESAPLAMA HATASI:", err);
    message.reply("❌ Bir hata oluştu, loglara bak.");
  }
});

/* ================== LOGIN ================== */

client.login(process.env.DISCORD_TOKEN);
