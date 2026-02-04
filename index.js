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

// 🔒 TOKEN KONTROLÜ
if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN bulunamadı!");
  process.exit(1);
}

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
let sonGonderilenSaat = null;

/* ================== EMBED ================== */
function kayitEmbedOlustur(liste) {
  return new EmbedBuilder()
    .setTitle("📋 Informal Kayıt Sistemi")
    .setDescription(
      `İlk **${MAX_KAYIT}** kişi kayıt olabilir.\n\n` +
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

/* ================== KAYIT MESAJI ================== */
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

/* ================== LİSTE GÜNCELLE ================== */
async function kayitListesiniGuncelle(channel) {
  db.all("SELECT userId FROM kayitlar", async (err, rows) => {
    let liste = "Henüz kayıt yok.";

    if (rows.length > 0) {
      liste = rows
        .map((u, i) => {
          const emojiler = ["🥇", "🥈", "🥉"];
          return `${emojiler[i] || "▫️"} ${i + 1}. <@${u.userId}>`;
        })
        .join("\n");
    }

    const embed = kayitEmbedOlustur(liste);
    const row = butonlariOlustur();

    const mesaj = await channel.messages.fetch(kayitMesajId);
    await mesaj.edit({ embeds: [embed], components: [row] });
  });
}

/* ================== BOT AÇILDI ================== */
client.once("ready", () => {
  console.log(`✅ Bot giriş yaptı: ${client.user.tag}`);

  setInterval(async () => {
    const simdi = new Date();
    const saat = simdi.getHours();
    const dakika = simdi.getMinutes();

    if (dakika === 17 && sonGonderilenSaat !== saat) {
      try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        await kayitMesajiGonder(channel);
        sonGonderilenSaat = saat;
        console.log(`📋 Kayıt mesajı gönderildi: ${saat}:55`);
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

  if (!kayitMesajId) {
    return interaction.reply({
      content: "❌ Aktif kayıt yok.",
      ephemeral: true,
    });
  }

  if (interaction.customId === "kayit") {
    db.get("SELECT COUNT(*) AS sayi FROM kayitlar", (err, row) => {
      if (row.sayi >= MAX_KAYIT) {
        return interaction.reply({
          content: "❌ Kayıt dolu.",
          ephemeral: true,
        });
      }

      db.run(
        "INSERT OR IGNORE INTO kayitlar (userId, username) VALUES (?, ?)",
        [userId, interaction.user.username],
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
    db.run("DELETE FROM kayitlar WHERE userId = ?", [userId], async () => {
      await interaction.reply({
        content: "❌ Kayıt iptal edildi.",
        ephemeral: true,
      });
      await kayitListesiniGuncelle(interaction.channel);
    });
  }
});

/* ================== LOGIN ================== */
client.login(process.env.DISCORD_TOKEN);
