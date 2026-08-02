import cron from 'node-cron';
import fs from 'fs';
import { 
  dbGetAllReminders, 
  dbUpdateReminderLastTriggered, 
  dbGetAllGuildSettings
} from '../database/db.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

let selfcareMethods = [];
try {
  selfcareMethods = JSON.parse(fs.readFileSync('./data/selfcare_methods.json', 'utf8'));
} catch (err) {
  console.error("Failed to read selfcare_methods.json:", err);
}

export function getRandomSelfcareMethod() {
  if (selfcareMethods.length === 0) {
    return { title: "🧘 Physical Check-In", tip: "Take a quick moment to drop your shoulders away from your ears." };
  }
  return selfcareMethods[Math.floor(Math.random() * selfcareMethods.length)];
}

let affirmations = {};
try {
  affirmations = JSON.parse(fs.readFileSync('./data/affirmations.json', 'utf8'));
} catch (err) {
  console.error("Failed to read affirmations.json:", err);
}

// Function to fetch a random affirmation based on category
export function getRandomAffirmation(theme = 'all') {
  let list = [];
  if (theme === 'all' || !affirmations[theme]) {
    list = Object.values(affirmations).flat();
  } else {
    list = affirmations[theme];
  }
  
  if (!list || list.length === 0) {
    return "You do not need to solve everything today."; // Fallback
  }
  
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

// Initialize cron scheduler
export function initScheduler(client) {
  // Run once every minute
  cron.schedule('* * * * *', async () => {
    try {
      const nowMs = Date.now();
      
      // 1. Process Custom Reminders
      const reminders = dbGetAllReminders();
      for (const reminder of reminders) {
        const diffMinutes = (nowMs - reminder.last_triggered) / (1000 * 60);
        if (diffMinutes >= reminder.interval_minutes) {
          try {
            const user = await client.users.fetch(reminder.user_id);
            if (user) {
              await user.send(`🌸 **GentleGlow Care Reminder**: ${reminder.reminder_text}`);
            }
          } catch (err) {
            console.error(`Failed to trigger reminder DM to user ${reminder.user_id}:`, err.message);
          }
          // Update trigger timestamp even if send fails to prevent spam loops
          dbUpdateReminderLastTriggered(reminder.id, nowMs);
        }
      }

      // Get current date time objects
      const now = new Date();

      // 2. Process Daily Automations at exactly 6:00 AM CST (America/Chicago timezone)
      const timeString = now.toLocaleTimeString('en-US', {
        timeZone: 'America/Chicago',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      if (timeString === '06:00') {
        const allGuilds = dbGetAllGuildSettings();
        for (const config of allGuilds) {
          // A. Send Daily Check-In Board
          if (config.checkin_channel_id) {
            try {
              const guild = await client.guilds.fetch(config.guild_id).catch(() => null);
              if (guild) {
                const channel = await guild.channels.fetch(config.checkin_channel_id).catch(() => null);
                if (channel && channel.isTextBased()) {
                  const embed = new EmbedBuilder()
                    .setTitle('🌟 Daily Emotional Check-In')
                    .setDescription(
                      `How are you doing today? You can react with the emojis below to check in publicly, or use the buttons for private support and resources.\n\n` +
                      `**Reactions:**\n` +
                      `🟢 Doing well\n` +
                      `🔵 Okay\n` +
                      `🟡 Struggling a little\n` +
                      `🟠 Having a hard day\n` +
                      `🥱 Tired\n` +
                      `🔋 Well-Rested\n` +
                      `🤒 Not Well\n` +
                      `✨ Amazing\n` +
                      `👑 On Top of the World\n` +
                      `🧘 At Peace\n` +
                      `😎 Vibing`
                    )
                    .setColor('#4caf50')
                    .setFooter({ text: 'GentleGlow Community Support' })
                    .setTimestamp();

                  const buttonsRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_private_checkin').setLabel('Check In Privately').setStyle(ButtonStyle.Primary).setEmoji('🔒'),
                    new ButtonBuilder().setCustomId('btn_need_support').setLabel('Need Support').setStyle(ButtonStyle.Danger).setEmoji('📞'),
                    new ButtonBuilder().setCustomId('btn_resources').setLabel('Show Resources').setStyle(ButtonStyle.Secondary).setEmoji('🏥')
                  );

                  const emojis = ['🟢', '🔵', '🟡', '🟠', '🥱', '🔋', '🤒', '✨', '👑', '🧘', '😎'];
                  const message = await channel.send({ embeds: [embed], components: [buttonsRow] });
                  
                  // Add reactions asynchronously
                  (async () => {
                    for (const emoji of emojis) {
                      await message.react(emoji).catch(() => null);
                    }
                  })();
                }
              }
            } catch (err) {
              console.error(`Failed sending daily check-in to guild ${config.guild_id}:`, err.message);
            }
          }

          // B. Send Daily Positive Affirmation
          if (config.affirmation_channel_id) {
            try {
              const guild = await client.guilds.fetch(config.guild_id).catch(() => null);
              if (guild) {
                const channel = await guild.channels.fetch(config.affirmation_channel_id).catch(() => null);
                if (channel && channel.isTextBased()) {
                  const affText = getRandomAffirmation('all');
                  
                  const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                      .setCustomId('btn_affirmation_another')
                      .setLabel('Show Another')
                      .setStyle(ButtonStyle.Secondary)
                      .setEmoji('✨')
                  );

                  await channel.send({
                    content: `☀️ **Daily Positive Affirmation**\n\n> *"${affText}"*\n\nHave a peaceful day!`,
                    components: [row]
                  });
                }
              }
            } catch (err) {
              console.error(`Failed sending daily affirmation to guild ${config.guild_id}:`, err.message);
            }
          }

          // C. Send Daily Self-Care Tip
          if (config.selfcare_channel_id) {
            try {
              const guild = await client.guilds.fetch(config.guild_id).catch(() => null);
              if (guild) {
                const channel = await guild.channels.fetch(config.selfcare_channel_id).catch(() => null);
                if (channel && channel.isTextBased()) {
                  const method = getRandomSelfcareMethod();
                  
                  const embed = new EmbedBuilder()
                    .setTitle(method.title)
                    .setDescription(method.tip)
                    .setColor('#00bcd4')
                    .setFooter({ text: 'GentleGlow Daily Self-Care Reminder' })
                    .setTimestamp();

                  await channel.send({
                    content: `🌸 **Daily Self-Care Check-In**`,
                    embeds: [embed]
                  });
                }
              }
            } catch (err) {
              console.error(`Failed sending daily selfcare to guild ${config.guild_id}:`, err.message);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error running scheduler checks:', error);
    }
  });

  console.log('⏰ Affirmation and reminder scheduler loaded.');
}
