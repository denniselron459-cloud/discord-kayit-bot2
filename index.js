const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

/* =======================
   🔧 İSİM NORMALİZASYONU
======================= */
function normalizeIsim(str = "") {
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ");
}

/* =======================
   🔍 EN YAKIN ÜYE
======================= */
function enYakinUyeyiBul(guild, isim) {
  const hedef = normalizeIsim(isim);

  const adaylar = guild.members.cache.filter(m =>
    normalizeIsim(m.displayName).includes(hedef) ||
    normalizeIsim(m.user.username).includes(hedef)
  );

  if (!adaylar.size) return null;

  return adaylar
    .sort((a, b) => a.displayName.length - b.displayName.length)
    .first();
}

/* =======================
   🤖 CLIENT
======================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

/* =======================
   ⚙️ AYARLAR
======================= */
const YETKILI_ROL_IDS = [
  "1432722610667655362",
  "1454564464727949493"
];

const REFERANS_MESAJ_ID = "1470080051570671880";
const KILL_UCRETI = 150000;

/* =======================
   📦 GLOBAL DATA
======================= */
let aktifSonucData = [];

/* =======================
   🚀 READY
======================= */
client.once("ready", () => {
  console.log(`✅ Bot aktif: ${client.user.tag}`);
});

/* =======================
   📩 KOMUT
======================= */
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot || !message.guild) return;
    if (message.content !== "!bonushesapla") return;

    const yetkili = await message.guild.members.fetch(message.author.id);
    if (!yetkili.roles.cache.some(r => YETKILI_ROL_IDS.includes(r.id))) {
      return message.reply("❌ Bu komutu kullanamazsın.");
    }

    await message.guild.members.fetch();

    let tumMesajlar = [];
    let lastId = null;
    let bulundu = false;

    while (!bulundu) {
      const opt = { limit: 100 };
      if (lastId) opt.before = lastId;

      const fetched = await message.channel.messages.fetch(opt);
      if (!fetched.size) break;

      for (const msg of fetched.values()) {
        if (BigInt(msg.id) <= BigInt(REFERANS_MESAJ_ID)) {
          bulundu = true;
          break;
        }
        tumMesajlar.push(msg);
      }

      lastId = fetched.last().id;
    }

    const killMap = new Map();

    for (const msg of tumMesajlar) {
      if (msg.author.bot) continue;

      for (const satir of msg.content.split("\n")) {
        const temiz = satir.trim();
        if (!temiz) continue;

        const match = temiz.match(/(\d+)\s*$/);
        if (!match) continue;

        const kill = parseInt(match[1]);
        if (isNaN(kill)) continue;

        const isimParca = temiz.slice(0, match.index).trim();
        if (!isimParca) continue;

        const key = normalizeIsim(isimParca);
        killMap.set(key, (killMap.get(key) || 0) + kill);
      }
    }

    if (!killMap.size) {
      return message.reply("❌ Kill bulunamadı.");
    }

    const sirali = [...killMap.entries()].sort((a, b) => b[1] - a[1]);

    aktifSonucData = [];

    let sonucText = "🏆 **BIZZWAR WIN KILLS** 🏆\n\n";
    const rows = [];

    for (let i = 0; i < sirali.length; i++) {
      const [isim, kill] = sirali[i];
      const para = kill * KILL_UCRETI;

      const emoji =
        i === 0 ? "🥇" :
        i === 1 ? "🥈" :
        i === 2 ? "🥉" : "🔫";

      let gosterim = isim;

      let uye = message.guild.members.cache.find(m =>
        normalizeIsim(m.displayName) === isim ||
        normalizeIsim(m.user.username) === isim
      );

      if (!uye) uye = enYakinUyeyiBul(message.guild, isim);
      if (uye) gosterim = `<@${uye.id}>`;

      aktifSonucData.push({
        gosterim,
        kill,
        para,
        paid: false
      });

      sonucText += `${emoji} ${gosterim} — ${kill} kill — ${para.toLocaleString()}$ \n`;

      const button = new ButtonBuilder()
        .setCustomId(`paid_${i}`)
        .setLabel(`${i + 1}. Paid`)
        .setStyle(ButtonStyle.Success);

      rows.push(
        new ActionRowBuilder().addComponents(button)
      );
    }

    await message.channel.send({
      content: sonucText,
      components: rows
    });

  } catch (err) {
    console.error(err);
    message.reply("❌ Bir hata oluştu.");
  }
});

/* =======================
   🔘 BUTON SİSTEMİ
======================= */
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const yetkili = await interaction.guild.members.fetch(interaction.user.id);
  if (!yetkili.roles.cache.some(r => YETKILI_ROL_IDS.includes(r.id))) {
    return interaction.reply({ content: "❌ Yetkin yok.", ephemeral: true });
  }

  const index = parseInt(interaction.customId.split("_")[1]);
  const data = aktifSonucData[index];

  if (!data) return;

  if (data.paid) {
    return interaction.reply({ content: "⚠️ Zaten paid edilmiş.", ephemeral: true });
  }

  data.paid = true;

  let yeniText = "🏆 **BIZZWAR WIN KILLS** 🏆\n\n";

  aktifSonucData.forEach((u, i) => {
    const emoji =
      i === 0 ? "🥇" :
      i === 1 ? "🥈" :
      i === 2 ? "🥉" : "🔫";

    yeniText += `${emoji} ${u.gosterim} — ${u.kill} kill — ${u.para.toLocaleString()}$ ${u.paid ? "✅" : ""}\n`;
  });

  await interaction.update({
    content: yeniText,
    components: interaction.message.components
  });
});

/* =======================
   🔑 LOGIN
======================= */
client.login(process.env.DISCORD_TOKEN);
