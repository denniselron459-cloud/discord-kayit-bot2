/*************************************************
 * DISCORD BOTU - KAYIT SİSTEMİ
 * Railway + Local uyumlu
 *************************************************/

require("dotenv").config();

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
const CHANNEL_ID = "1429871190234628146"; // SADECE ID
const MAX_KAYIT = 10;
/* ============================================= */

/* ================== TOKEN KONTROL ================== */
if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN bulunamadı!");
  process.exit(1);
}
/* =================================================== */

const db = new sqlite3.Database("./kayitlar.db");

db.run(`
CREATE TABLE IF NOT EXISTS kayitlar (
  userId TEXT PRIMARY KEY,
  username TEXT
)
`);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/* ======= KAYIT MESAJ ID ======= */
let kayitMesajId = null;

/* ======= SAAT KONTROL ======= */
let sonGonderilenSaat = null;

/* ================== KAYIT EMBED ================== */
function kayitEmbedOlustur(liste) {
  return new EmbedBuilder()
    .setTitle("📋 Informal Kayıt Sistemi")
    .setDescription(
      `İlk **${MAX_KAYIT}** kişi kayıt olabilir. Kayıt olmadan girenler cezalandırılacaktır.\n\n` +
      `**📌 Kayıtlı Kişiler:**\n${liste}`
    )
    .setColor("Green");
}

function butonlariOlustur() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("kayit")
      .setLabel("✅ Kayıt Ol")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("kayit_iptal")
      .setLabel("❌ Kayıt İptal")
      .setStyle(ButtonStyle.Danger)
  );
}

/* ================== KAYIT MESAJI GÖNDER ================== */
async function kayitMesajiGonder(channel) {
  db.run("DELETE FROM kayitlar");

  const embed = kayitEmbedOlustur("Henüz kayıt yok.");
  const row = butonlariOlustur();

  const mesaj = await channel.send({
    embeds: [embed],
    components: [row],
  });

  kayitMesajId = mesaj.id;
}

/* ================== KAYIT LİSTESİ GÜNCELLE ================== */
async function kayitListesiniGuncelle(channel) {
  db.all("SELECT userId FROM kayitlar", async (err, rows) => {
    if (err) return;

    let liste;

    if (rows.length === 0) {
      liste = "Henüz kayıt yok.";
    } else {
      liste = rows
        .map((u, i) => {
          let emoji = "";
          if (i === 0) emoji = "🥇 ";
          if (i === 1) emoji = "🥈 ";
          if (i === 2) emoji = "🥉 ";
          return `${emoji}${i + 1}. <@${u.userId}>`;
        })
        .join("\n");
    }

    try {
      const embed = kayitEmbedOlustur(liste);
      const row = butonlariOlustur();
      const mesaj = await channel.messages.fetch(kayitMesajId);
      await mesaj.edit({ embeds: [embed], components: [row] });
    } catch (e) {
      console.error("❌ Mesaj güncellenemedi:", e);
    }
  });
}

/* ================== BOT AÇILDI ================== */
client.once("ready", async () => {
  console.log(`✅ Bot giriş yaptı: ${client.user.tag}`);

  setInterval(async () => {
    const simdi = new Date();
    const saat = simdi.getHours();
    const dakika = simdi.getMinutes();

    if (dakika === 55 && sonGonderilenSaat !== saat) {
      try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        await kayitMesajiGonder(channel);
        sonGonderilenSaat = saat;
        console.log(`📋 Kayıt sistemi gönderildi: ${saat}:55`);
      } catch (err) {
        console.error("❌ Kayıt mesajı hatası:", err);
      }
    }
  }, 60 * 1000);
});

/* ================== BUTONLAR ================== */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;
  const username = interaction.user.username;

  if (!kayitMesajId) {
    return interaction.reply({
      content: "❌ Şu an aktif bir kayıt yok.",
      ephemeral: true,
    });
  }

  if (interaction.customId === "kayit") {
    db.get("SELECT COUNT(*) AS sayi FROM kayitlar", (err, row) => {
      if (row.sayi >= MAX_KAYIT) {
        return interaction.reply({
          content: "❌ Kayıt limiti doldu.",
          ephemeral: true,
        });
      }

      db.run(
        "INSERT OR IGNORE INTO kayitlar (userId, username) VALUES (?, ?)",
        [userId, username],
        async () => {
          await interaction.reply({
            content: "✅ Kayıt başarılı!",
            ephemeral: true,
          });
          await kayitListesiniGuncelle(interaction.channel);
        }
      );
    });
  }

  if (interaction.customId === "kayit_iptal") {
    db.run(
      "DELETE FROM kayitlar WHERE userId = ?",
      [userId],
      async () => {
        await interaction.reply({
          content: "❌ Kayıt iptal edildi.",
          ephemeral: true,
        });
        await kayitListesiniGuncelle(interaction.channel);
      }
    );
  }
});

/* ================== LOGIN ================== */
client.login(process.env.DISCORD_TOKEN);
