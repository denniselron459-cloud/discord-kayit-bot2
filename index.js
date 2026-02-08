const { Client, GatewayIntentBits } = require("discord.js");

/* =========================
   🔧 İSİM NORMALİZASYONU
========================= */
function normalizeIsim(str) {
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ");
}

/* =========================
   🔍 EN YAKIN ÜYE BULMA
========================= */
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

/* =========================
   🤖 BOT
========================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

/* =========================
   🔐 YETKİ
========================= */
const YETKILI_ROL_IDS = [
  "1432722610667655362",
  "1454564464727949493"
];

/* =========================
   🏛️ STATE CONTROL
========================= */
const STATE_REFERANS_MESAJ_ID = "1467301119867879454";
const STATE_KATILIM_UCRETI = 70000;
const STATE_KILL_UCRETI = 40000;

client.once("ready", () => {
  console.log(`✅ Bot aktif: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot || !message.guild) return;
    if (message.content !== "!statehesapla") return;

    const member = await message.guild.members.fetch(message.author.id);
    const yetkiliMi = member.roles.cache.some(r =>
      YETKILI_ROL_IDS.includes(r.id)
    );
    if (!yetkiliMi) return message.reply("❌ Yetkin yok.");

    await message.guild.members.fetch();

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

      if (fetched.has(STATE_REFERANS_MESAJ_ID)) break;
    }

    const referans = tumMesajlar.find(m => m.id === STATE_REFERANS_MESAJ_ID);
    if (!referans) return message.reply("❌ Referans mesaj yok.");

    const katilimMap = new Map(); // isim -> katılım sayısı
    const killMap = new Map();    // isim -> kill

    for (const mesaj of tumMesajlar) {
      if (mesaj.createdTimestamp <= referans.createdTimestamp) continue;
      if (mesaj.author.bot) continue;

      let isim =
        normalizeIsim(mesaj.member?.displayName || mesaj.author.username);

      // katılım +1
      katilimMap.set(isim, (katilimMap.get(isim) || 0) + 1);

      for (const satir of mesaj.content.split("\n")) {
        const match = satir.match(/(.+?)\s+(\d+)$/);
        if (!match) continue;

        const hedefIsim = normalizeIsim(match[1]);
        const kill = parseInt(match[2]);
        if (isNaN(kill)) continue;

        killMap.set(hedefIsim, (killMap.get(hedefIsim) || 0) + kill);
      }
    }

    let sonuc = "🏛️ **STATE CONTROL SONUÇLARI** 🏛️\n\n";
    let i = 1;

    for (const [isim, katilim] of katilimMap.entries()) {
      const kill = killMap.get(isim) || 0;
      const toplam =
        katilim * STATE_KATILIM_UCRETI +
        kill * STATE_KILL_UCRETI;

      let uye =
        message.guild.members.cache.find(m =>
          normalizeIsim(m.displayName) === isim ||
          normalizeIsim(m.user.username) === isim
        ) || enYakinUyeyiBul(message.guild, isim);

      sonuc += `🔹 **${i}.** ${uye ? `<@${uye.id}>` : isim} → `;
      sonuc += `**${katilim} katılım | ${kill} öldürme : ${toplam.toLocaleString()}$**\n`;
      i++;
    }

    await message.channel.send(sonuc);

  } catch (err) {
    console.error(err);
    message.reply("❌ Hata oluştu.");
  }
});

client.login(process.env.DISCORD_TOKEN);
