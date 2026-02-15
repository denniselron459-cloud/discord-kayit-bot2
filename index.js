const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const sqlite3 = require("sqlite3").verbose();

/* ================== AYARLAR ================== */
const CHANNEL_ID = "1429871190234628146";
const MAX_KAYIT = 10;
/* ============================================= */

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN bulunamadı!");
  process.exit(1);
}

/* ================== DATABASE ================== */
const db = new sqlite3.Database("./kayitlar.db");
db.run(`
CREATE TABLE IF NOT EXISTS kayitlar (
  userId TEXT PRIMARY KEY
)
`);

/* ================== CLIENT ================== */
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/* ================== GLOBAL ================== */
let kayitMesajId = null;
let sonGonderilenSaat = null;

/* ================== EMBED (TEMA) ================== */
function kayitEmbedOlustur(liste, sayi) {
  return new EmbedBuilder()
    .setTitle("Informal Registration")
    .setDescription(
      `**Current number of people signed up:** ${sayi}/${MAX_KAYIT}\n\n` +
      (liste || "*No one has signed up yet*")
    )
    .setColor(0x2B2D31);
}

/* ================== BUTONLAR ================== */
function butonlariOlustur(kilitli = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("kayit")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success)
      .setDisabled(kilitli),
    new ButtonBuilder()
      .setCustomId("kayit_iptal")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(kilitli)
  );
}

/* ================== KAYIT MESAJI ================== */
async function kayitMesajiGonder(channel) {
  db.run("DELETE FROM kayitlar");

  const embed = kayitEmbedOlustur(null, 0);
  const mesaj = await channel.send({
    embeds: [embed],
    components: [butonlariOlustur(false)],
  });

  kayitMesajId = mesaj.id;
}

/* ================== LİSTE GÜNCELLE ================== */
async function kayitListesiniGuncelle(channel) {
  db.all("SELECT userId FROM kayitlar ORDER BY rowid ASC", async (err, rows) => {
    if (err) return console.error(err);

    const liste =
      rows.length > 0
        ? rows.map((u, i) => `${i + 1}. <@${u.userId}>`).join("\n")
        : null;

    const mesaj = await channel.messages.fetch(kayitMesajId);
    await mesaj.edit({
      embeds: [kayitEmbedOlustur(liste, rows.length)],
      components: [butonlariOlustur(rows.length >= MAX_KAYIT)],
    });
  });
}

/* ================== BOT AÇILDI ================== */
client.once("ready", () => {
  console.log(`✅ Bot giriş yaptı: ${client.user.tag}`);

  setInterval(async () => {
    const now = new Date();
    const saat = now.getHours();
    const dakika = now.getMinutes();

    // ⏰ HER SAAT 30 GEÇE AÇ
    if (dakika === 30 && sonGonderilenSaat !== saat) {
      const channel = await client.channels.fetch(CHANNEL_ID);
      await kayitMesajiGonder(channel);
      sonGonderilenSaat = saat;
      console.log("📋 Kayıt açıldı");
    }

    // ⛔ 45'TE KAPAT
    if (dakika >= 45 && kayitMesajId) {
      const channel = await client.channels.fetch(CHANNEL_ID);
      const mesaj = await channel.messages.fetch(kayitMesajId);
      await mesaj.edit({ components: [butonlariOlustur(true)] });
      kayitMesajId = null;
      console.log("⛔ Kayıt kapandı");
    }
  }, 60 * 1000);
});

/* ================== BUTON EVENT ================== */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.message.id !== kayitMesajId) {
    return interaction.reply({
      content: "❌ This registration has ended.",
      ephemeral: true,
    });
  }

  const userId = interaction.user.id;

  if (interaction.customId === "kayit") {
    db.get("SELECT COUNT(*) AS sayi FROM kayitlar", (err, row) => {
      if (row.sayi >= MAX_KAYIT) {
        return interaction.reply({
          content: "❌ Registration is full.",
          ephemeral: true,
        });
      }

      db.run(
        "INSERT OR IGNORE INTO kayitlar (userId) VALUES (?)",
        [userId],
        async () => {
          await interaction.reply({
            content: "✅ Registered successfully.",
            ephemeral: true,
          });
          kayitListesiniGuncelle(interaction.channel);
        }
      );
    });
  }

  if (interaction.customId === "kayit_iptal") {
    db.run("DELETE FROM kayitlar WHERE userId = ?", [userId], async () => {
      await interaction.reply({
        content: "❌ Registration cancelled.",
        ephemeral: true,
      });
      kayitListesiniGuncelle(interaction.channel);
    });
  }
});

/* ================== LOGIN ================== */
client.login(process.env.DISCORD_TOKEN);
