const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* =======================
   🔧 AYARLAR
======================= */

const KANIT_KANAL_ID = "KANIT_KANAL_ID_HERE";
const PAID_YETKILI_ROL = "PAID_YETKILI_ROL_ID";

const EVENT_REFERANSLARI = {
  bizzwar: "1470080051570671880",
  weaponfactory: "1468000000000000000",
  foundry: "1468111111111111111"
};

const KILL_BONUS = 35000;

/* =======================
   🔧 YARDIMCI
======================= */

function formatEventName(event) {
  return event.toUpperCase().replace(/([A-Z])/g, " $1").trim();
}

/* =======================
   🧠 KOMUT
======================= */

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!bonushesapla")) return;

  const eventAdi = message.content.split(" ")[1];
  if (!EVENT_REFERANSLARI[eventAdi]) {
    return message.reply(
      "❌ Geçersiz event.\nKullanım: `!bonushesapla bizzwar | weaponfactory | foundry`"
    );
  }

  const kanal = await message.guild.channels.fetch(KANIT_KANAL_ID);
  const referansID = EVENT_REFERANSLARI[eventAdi];
  const digerReferanslar = Object.values(EVENT_REFERANSLARI).filter(
    id => id !== referansID
  );

  let mesajlar = [];
  let sonID = null;
  let basladi = false;
  let dur = false;

  while (!dur) {
    const fetched = await kanal.messages.fetch({ limit: 100, before: sonID });
    if (fetched.size === 0) break;

    for (const msg of fetched.values()) {
      if (msg.id === referansID) {
        basladi = true;
        continue;
      }

      if (!basladi) continue;

      if (digerReferanslar.includes(msg.id)) {
        dur = true;
        break;
      }

      mesajlar.push(msg);
    }

    sonID = fetched.last().id;
  }

  /* =======================
     📊 KILL HESAPLAMA
  ======================= */

  const killMap = new Map();

  for (const msg of mesajlar) {
    const eslesme = msg.content.match(/(.+?)\s*[:\-]\s*(\d+)\s*kill/i);
    if (!eslesme) continue;

    const isim = eslesme[1].trim();
    const kill = parseInt(eslesme[2]);

    killMap.set(isim, (killMap.get(isim) || 0) + kill);
  }

  if (killMap.size === 0) {
    return message.reply("⚠️ Bu event için kanıt bulunamadı.");
  }

  const sirali = [...killMap.entries()].sort((a, b) => b[1] - a[1]);

  let aciklama = sirali
    .map(([, kill], i) => {
      const para = kill * KILL_BONUS;
      return `**${i + 1}.** Kill: **${kill}** — 💰 **${para.toLocaleString()}$**`;
    })
    .join("\n");

  /* =======================
     🧾 EMBED
  ======================= */

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${formatEventName(eventAdi)} RESULTS`)
    .setColor("#ffcc00")
    .setDescription(aciklama)
    .setFooter({ text: "❌ ÖDENMEDİ" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("paid_" + eventAdi)
      .setLabel("✅ PAID OLARAK İŞARETLE")
      .setStyle(ButtonStyle.Success)
  );

  await message.channel.send({ embeds: [embed], components: [row] });
});

/* =======================
   🔘 PAID BUTONU
======================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("paid_")) return;

  if (!interaction.member.roles.cache.has(PAID_YETKILI_ROL)) {
    return interaction.reply({
      content: "❌ Bu işlem için yetkin yok.",
      ephemeral: true
    });
  }

  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor("#2ecc71")
    .setFooter({
      text: `✅ PAID | ${interaction.user.tag}`
    });

  await interaction.update({
    embeds: [embed],
    components: []
  });
});

/* =======================
   🚀 LOGIN
======================= */

client.login(process.env.DISCORD_TOKEN);
