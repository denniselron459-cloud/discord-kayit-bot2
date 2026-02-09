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
  "1454564464727949493",
  "1426979504559231117"
];

const REFERANS_MESAJ_ID = "1470080051570671880";
const KILL_UCRETI = 150000;

/* =======================
   🧠 GLOBAL STATE
======================= */
let bonusData = new Map(); 
// userId => { kill, paid }

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
  if (message.content !== "!bonushesapla") return;

  const yetkili = await message.guild.members.fetch(message.author.id);
  if (!yetkili.roles.cache.some(r => YETKILI_ROL_IDS.includes(r.id))) {
    return message.reply("❌ Yetkin yok.");
  }

  /* =======================
     📥 MESAJLARI ÇEK
  ======================= */
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

  bonusData.clear();

  /* =======================
     📊 HESAPLAMA
  ======================= */
  for (const msg of tumMesajlar) {
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

  if (!bonusData.size) {
    return message.reply("❌ Kill bulunamadı.");
  }

  await guncelEmbedGonder(message.channel);
});

/* =======================
   📦 EMBED OLUŞTUR
======================= */
async function guncelEmbedGonder(channel, interaction = null) {
  let toplam = 0;
  let aciklama = "";

  const sirali = [...bonusData.entries()].sort(
    (a, b) => b[1].kill - a[1].kill
  );

  sirali.forEach(([userId, data], i) => {
    const para = data.kill * KILL_UCRETI;
    toplam += para;

    const durum = data.paid ? "✅ PAID" : "❌ BEKLENİYOR";
    const medal =
      i === 0 ? "🥇" :
      i === 1 ? "🥈" :
      i === 2 ? "🥉" : "🔫";

    aciklama +=
      `${medal} <@${userId}>\n` +
      `Kill: **${data.kill}** | Bonus: **${para.toLocaleString()}$**\n` +
      `Durum: ${durum}\n\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🏆 BIZZWAR WIN KILLS")
    .setDescription(aciklama)
    .setColor("#2b2d31")
    .setFooter({ text: `💰 Toplam Bonus: ${toplam.toLocaleString()}$` });

  const row = new ActionRowBuilder();

  sirali.forEach(([userId, data]) => {
    if (!data.paid) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`paid_${userId}`)
          .setLabel(`Paid → ${userId}`)
          .setStyle(ButtonStyle.Success)
      );
    }
  });

  if (interaction) {
    await interaction.update({ embeds: [embed], components: [row] });
  } else {
    await channel.send({ embeds: [embed], components: [row] });
  }
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
  await guncelEmbedGonder(interaction.channel, interaction);
});

/* =======================
   🔑 LOGIN
======================= */
client.login(process.env.DISCORD_TOKEN);
