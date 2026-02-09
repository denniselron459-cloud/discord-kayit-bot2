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

const EVENT_REFERANSLARI = {
  bizzwar: "1470080051570671880",
  weaponfactory: "1468000000000000000",
  foundry: "1469000000000000000"
};

const KILL_UCRETI = 150000;

/* =======================
   🧠 STATE
======================= */
let bonusData = new Map(); // userId => { kill, paid }
let aktifEvent = null;
let embedMesaj = null; // 👈 TEK MESAJ

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
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith("!bonushesapla")) return;

  const args = message.content.split(" ");
  const event = args[1];

  if (!event || !EVENT_REFERANSLARI[event]) {
    return message.reply(
      `❌ Geçersiz event.\nKullanım: \`!bonushesapla ${Object.keys(EVENT_REFERANSLARI).join(" | ")}\``
    );
  }

  const yetkili = await message.guild.members.fetch(message.author.id);
  if (!yetkili.roles.cache.some(r => YETKILI_ROL_IDS.includes(r.id))) {
    return message.reply("❌ Yetkin yok.");
  }

  aktifEvent = event;
  bonusData.clear();
  embedMesaj = null;

  const referansId = EVENT_REFERANSLARI[event];
  const digerReferanslar = Object.values(EVENT_REFERANSLARI).filter(id => id !== referansId);

  /* =======================
     📥 MESAJLARI ÇEK
  ======================= */
  let lastId = null;
  let dur = false;

  while (!dur) {
    const opt = { limit: 100 };
    if (lastId) opt.before = lastId;

    const fetched = await message.channel.messages.fetch(opt);
    if (!fetched.size) break;

    for (const msg of fetched.values()) {
      if (digerReferanslar.includes(msg.id)) {
        dur = true;
        break;
      }

      if (BigInt(msg.id) <= BigInt(referansId)) {
        dur = true;
        break;
      }

      if (msg.author.bot) continue;

      for (const satir of msg.content.split("\n")) {
        const match = satir.match(/<@!?(\d+)>\s+(\d+)/);
        if (!match) continue;

        const userId = match[1];
        const kill = parseInt(match[2]);

        if (!bonusData.has(userId)) {
          bonusData.set(userId, { kill: 0, paid: false });
        }
        bonusData.get(userId).kill += kill;
      }
    }

    lastId = fetched.last().id;
  }

  if (!bonusData.size) {
    return message.reply("❌ Bu event için kanıt bulunamadı.");
  }

  await embedGonder(message.channel);
});

/* =======================
   📦 EMBED (TEK MESAJ)
======================= */
async function embedGonder(channel) {
  const { embed, row } = embedOlustur();

  if (!embedMesaj) {
    embedMesaj = await channel.send({
      embeds: [embed],
      components: [row]
    });
  } else {
    await embedMesaj.edit({
      embeds: [embed],
      components: [row]
    });
  }
}

/* =======================
   🧱 EMBED BUILDER
======================= */
function embedOlustur() {
  let toplam = 0;
  let desc = "";

  const sirali = [...bonusData.entries()].sort(
    (a, b) => b[1].kill - a[1].kill
  );

  sirali.forEach(([userId, data], i) => {
    const para = data.kill * KILL_UCRETI;
    toplam += para;

    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🔫";
    const durum = data.paid ? "✅ PAID" : "❌ BEKLENİYOR";

    desc +=
      `${medal} <@${userId}>\n` +
      `Kill: **${data.kill}** | Bonus: **${para.toLocaleString()}$**\n` +
      `Durum: ${durum}\n\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${aktifEvent.toUpperCase()} SONUÇLARI`)
    .setDescription(desc)
    .setColor("#2b2d31")
    .setFooter({ text: `💰 Toplam Bonus: ${toplam.toLocaleString()}$` });

  const row = new ActionRowBuilder();

  sirali.forEach(([userId, data]) => {
    if (!data.paid) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`paid_${userId}`)
          .setLabel(`Paid`)
          .setStyle(ButtonStyle.Success)
      );
    }
  });

  return { embed, row };
}

/* =======================
   🖱️ BUTON
======================= */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const yetkili = await interaction.guild.members.fetch(interaction.user.id);
  if (!yetkili.roles.cache.some(r => YETKILI_ROL_IDS.includes(r.id))) {
    return interaction.reply({ content: "❌ Yetkin yok.", ephemeral: true });
  }

  const [, userId] = interaction.customId.split("_");
  if (!bonusData.has(userId)) return;

  bonusData.get(userId).paid = true;
  await interaction.deferUpdate();
  await embedGonder(interaction.channel);
});

/* =======================
   🔑 LOGIN
======================= */
client.login(process.env.DISCORD_TOKEN);
