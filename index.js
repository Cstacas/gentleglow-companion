import { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  ComponentType,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';

// Database Import
import {
  dbGetGuildSettings,
  dbSaveGuildSetting,
  dbGetUserSettings,
  dbSaveUserSetting,
  dbAddJournalEntry,
  dbGetUserJournals,
  dbGetCopingPlan,
  dbSaveCopingPlan,
  dbAddReminder,
  dbDeleteReminder,
  dbGetReminders,
  dbGetAllReminders,
  dbGetUserRoutine,
  dbSaveUserRoutine,
  dbGetUserPlant,
  dbInitializePlant,
  dbGrowPlant,
  dbWaterPlant,
  dbGetBuddyStatus,
  dbOptInBuddy,
  dbSetBuddyMatch,
  dbGetUnmatchedBuddies,
  dbAddMailboxMessage,
  dbGetMailboxMessage,
  dbUpdateMailboxMessageStatus,
  dbGetUserPet,
  dbInitializePet,
  dbUpdatePetLove,
  dbUpdatePetAction,
  dbAddCommunityEvent,
  dbGetCommunityEvents,
  dbDeleteCommunityEvent,
  dbSavePlantCustomization,
  dbSavePetCustomization,
  dbRenamePet,
  dbChangePetType
} from './database/db.js';

// Utilities Imports
import { breathingConfigurations, buildBreathingEmbed } from './utils/breathing.js';
import { scanMessageForHighRisk, buildModAlertEmbed } from './utils/safety.js';
import { getRandomAffirmation, initScheduler } from './utils/scheduler.js';

dotenv.config();

const COMPANION_BASE_URL = process.env.COMPANION_BASE_URL || 'https://gentleglow-companion.vercel.app';

function buildPlantUrl(userId, plant) {
  const base = `${COMPANION_BASE_URL}/?userId=${userId}&supabaseKey=${encodeURIComponent(process.env.SUPABASE_KEY || '')}`;
  return `${base}&name=${encodeURIComponent(plant.plant_type)}&type=plant&breed=${plant.plant_type}&acc=${plant.decor}&love=${plant.experience}&pot=${plant.pot_style}`;
}

function buildPetUrl(userId, pet) {
  const base = `${COMPANION_BASE_URL}/?userId=${userId}&supabaseKey=${encodeURIComponent(process.env.SUPABASE_KEY || '')}`;
  return `${base}&name=${encodeURIComponent(pet.pet_name)}&type=${pet.pet_type}&breed=${pet.breed}&acc=${pet.accessory}&love=${pet.love}`;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent // Required for high-risk text checking
  ]
});

// Load static assets
const copingSkills = JSON.parse(fs.readFileSync('./data/coping_skills.json', 'utf8'));
const countryResources = JSON.parse(fs.readFileSync('./data/resources.json', 'utf8'));
const comfortData = JSON.parse(fs.readFileSync('./data/comfort.json', 'utf8'));
const templateData = JSON.parse(fs.readFileSync('./data/templates.json', 'utf8'));
const educationData = JSON.parse(fs.readFileSync('./data/education.json', 'utf8'));

// Active Sit With Me sessions in-memory map
const activeSitSessions = new Map();

// Centralized crisis resources text block
const CRISIS_RESOURCES = `
🏥 **Crisis & Support Resources**
* **National Suicide Prevention Lifeline (US)**: Call or text **988** (Available 24/7, free, confidential)
* **The Crisis Text Line**: Text **HOME** to **741741** (Available 24/7)
* **The Trevor Project (LGBTQ Youth)**: Call **866-488-7386** or text **START** to **678-678**
* **International Resources**: Find a helpline in your country at [findahelpline.com](https://findahelpline.com/)

*Please remember: GentleGlow and server admins are not emergency services. If you are experiencing a life-threatening crisis, please contact your local emergency services (like 911 or your local equivalent) immediately.*
`;

// Grounding Exercise Steps
const groundingSteps = [
  {
    step: 1,
    title: "👀 Step 1: See",
    description: "Look around you. Slow down and acknowledge **5 things** you can see. (e.g., a pen, a picture on the wall, a window). Take your time.",
    nextLabel: "Next: Feel (Step 2)",
    nextId: "grounding_step:2"
  },
  {
    step: 2,
    title: "✋ Step 2: Feel",
    description: "Acknowledge **4 things** you can touch or physically feel around you. (e.g., the texture of your sleeves, the desk warmth, your feet pressing into the floor).",
    nextLabel: "Next: Hear (Step 3)",
    nextId: "grounding_step:3"
  },
  {
    step: 3,
    title: "👂 Step 3: Hear",
    description: "Acknowledge **3 things** you can hear. Focus on background sounds you might normally ignore. (e.g., fan motor, traffic humming, birds chirping).",
    nextLabel: "Next: Smell (Step 4)",
    nextId: "grounding_step:4"
  },
  {
    step: 4,
    title: "👃 Step 4: Smell",
    description: "Acknowledge **2 things** you can smell. (e.g., fresh soap, coffee, wood). If nothing is nearby, close your eyes and remember two of your favorite smells.",
    nextLabel: "Next: Taste (Step 5)",
    nextId: "grounding_step:5"
  },
  {
    step: 5,
    title: "👅 Step 5: Taste",
    description: "Acknowledge **1 thing** you can taste. (e.g., water, mint, toothpaste). If not, focus on how your mouth feels, or visualize a sweet taste.",
    nextLabel: "Complete Exercise",
    nextId: "grounding_step:done"
  }
];
client.once('ready', () => {
  console.log(`🤖 Bot logged in successfully as ${client.user.tag}!`);
  initScheduler(client);
});

// Message Listener: High-risk Phrase Detection and Sit With Me DMs stop command
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Handle DM messages first
  if (!message.guildId) {
    if (message.content.trim().toLowerCase() === '/sitwithme stop' || message.content.trim().toLowerCase() === 'stop') {
      if (activeSitSessions.has(message.author.id)) {
        clearInterval(activeSitSessions.get(message.author.id));
        activeSitSessions.delete(message.author.id);
        return await message.reply('🌸 **Sit With Me Session Terminated**: Take care and feel free to start another session whenever you need.');
      }
    }
  }

  // Scan guild messages for crisis words
  if (message.guildId) {
    const { isHighRisk, matchedWord } = scanMessageForHighRisk(message.content);
    if (isHighRisk) {
      try {
        const settings = dbGetGuildSettings(message.guildId);
        let logChannel = null;

        if (settings.admin_channel_id) {
          logChannel = await message.guild.channels.fetch(settings.admin_channel_id).catch(() => null);
        }
        
        if (!logChannel) {
          logChannel = message.guild.channels.cache.find(
            ch => ['gentleglow-alerts', 'support-logs', 'admin-alerts', 'moderator-only'].includes(ch.name) && ch.isTextBased()
          );
        }

        if (logChannel) {
          const alertEmbed = buildModAlertEmbed(message.author, message.channel, message.content, matchedWord);
          await logChannel.send({ embeds: [alertEmbed] });
        }

        await message.author.send(
          `🌸 **Hello from GentleGlow**\n` +
          `I noticed your message in **${message.guild.name}** and wanted to check in. Please know that you are not alone and there is support available. If you are going through a hard time, please refer to these free resources:\n\n` +
          CRISIS_RESOURCES
        ).catch(() => console.log(`Could not send support DM to user ${message.author.id} (DMs locked).`));

      } catch (err) {
        console.error('Error handling high risk message alert:', err);
      }
    }
  }
});

// Interaction Router
client.on('interactionCreate', async (interaction) => {
  console.log(`📥 Interaction received: ${interaction.commandName || interaction.customId} from user ${interaction.user.tag} (${interaction.user.id})`);
  try {
    const { user, guildId } = interaction;

    // ==========================================
    // 1. Handle Slash Commands
    // ==========================================
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      // Command: Set admin/support alert channel
      if (commandName === 'set-admin-channel') {
        const channel = interaction.options.getChannel('channel');
        dbSaveGuildSetting(guildId, 'admin_channel_id', channel.id);
        return await interaction.reply({
          content: `✅ **Admin Alerts Channel Updated**: Private support notifications will now be routed to ${channel}.`,
          ephemeral: true
        });
      }

      // Command: Set public check-in channel
      if (commandName === 'set-checkin-channel') {
        const channel = interaction.options.getChannel('channel');
        dbSaveGuildSetting(guildId, 'checkin_channel_id', channel.id);
        return await interaction.reply({
          content: `✅ **Check-in Channel Updated**: The daily check-in posts will now be sent to ${channel}.`,
          ephemeral: true
        });
      }

      // Command: Set affirmation posting channel
      if (commandName === 'set-affirmation-channel') {
        const channel = interaction.options.getChannel('channel');
        dbSaveGuildSetting(guildId, 'affirmation_channel_id', channel.id);
        return await interaction.reply({
          content: `✅ **Affirmation Channel Updated**: Daily positive affirmations will now be posted to ${channel}.`,
          ephemeral: true
        });
      }

      // Command: Set selfcare posting channel
      if (commandName === 'set-selfcare-channel') {
        const channel = interaction.options.getChannel('channel');
        dbSaveGuildSetting(guildId, 'selfcare_channel_id', channel.id);
        return await interaction.reply({
          content: `✅ **Self-Care Channel Updated**: Daily self-care tips/messages will now be posted to ${channel}.`,
          ephemeral: true
        });
      }

      // Command: Post check-in board
      if (commandName === 'checkin-setup') {
        const settings = dbGetGuildSettings(guildId);
        const targetChannelId = settings.checkin_channel_id;
        const targetChannel = targetChannelId 
          ? await interaction.guild.channels.fetch(targetChannelId).catch(() => null) 
          : null;

        const sendChannel = targetChannel || interaction.channel;

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

        let adminWarning = '';
        if (!settings.admin_channel_id) {
          adminWarning = '\n⚠️ *Note: Support alerts channel is not configured. support request messages will default to public channels.*';
        }

        const emojis = ['🟢', '🔵', '🟡', '🟠', '🥱', '🔋', '🤒', '✨', '👑', '🧘', '😎'];

        if (sendChannel.id !== interaction.channel.id) {
          const message = await sendChannel.send({ embeds: [embed], components: [buttonsRow] });
          (async () => {
            for (const emoji of emojis) {
              await message.react(emoji).catch(() => null);
            }
          })();
          
          dbGrowPlant(user.id, 10);

          return await interaction.reply({ 
            content: `✅ **Check-In Posted**: Successfully sent the check-in board to ${targetChannel}.${adminWarning}`, 
            ephemeral: true 
          });
        } else {
          const message = await interaction.reply({ embeds: [embed], components: [buttonsRow], fetchReply: true });
          (async () => {
            for (const emoji of emojis) {
              await message.react(emoji).catch(() => null);
            }
          })();
          
          dbGrowPlant(user.id, 10);

          if (adminWarning) {
            await interaction.followUp({ content: adminWarning, ephemeral: true });
          }
        }
      }

      // Command: About
      if (commandName === 'about') {
        const embed = new EmbedBuilder()
          .setTitle('🌸 About GentleGlow')
          .setDescription(
            `GentleGlow is a text-based, low-pressure mental health companion designed to foster a safe, supportive virtual space.\n\n` +
            `**Key Features Include:**\n` +
            `* ℹ️ **About GentleGlow** (\`/about\`): Information and safety details.\n` +
            `  * 📞 **Crisis Support** (\`/crisis\`): Immediate crisis helplines and text lines.\n` +
            `* 🧘 **Mindfulness Coping**: Guided Box breathing (\`/breathe\`) and sensory grounding (\`/grounding\`).\n` +
            `* 📅 **Habits & Routines**: Dynamic routine planners (\`/routine\`) and community calendars (\`/calendar\`).\n` +
            `* 🪴 **Virtual Companions**: Raise your check-in plant (\`/plant\`) and pet friend (\`/pet\`).\n` +
            `* 🏥 **Resources Directory**: Country helplines (\`/resources\`).\n\n` +
            `⚠️ **CRITICAL DISCLAIMER & SAFETY NOTICE**\n` +
            `*GentleGlow is a wellness companion and self-care helper. **It is not a licensed therapist, medical provider, or emergency service, and does NOT replace professional medical or mental health care.** Our automated tools, checklists, and text companions are designed for self-reflection and general support only. If you are experiencing high-risk distress, self-harm thoughts, or a medical crisis, please contact emergency services immediately or search our crisis directory with \`/crisis\`.*`
          )
          .addFields(
            { name: '🛠️ Creator & Developer', value: 'Developed and maintained by **sunsetplague**', inline: true },
            { name: '🏷️ Version', value: 'v1.0.0', inline: true }
          )
          .setColor('#00bcd4')
          .setFooter({ text: 'Your well-being matters • Take things one step at a time' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('btn_resources')
            .setLabel('Run /crisis Command 📞')
            .setStyle(ButtonStyle.Danger)
        );

        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Breathe
      if (commandName === 'breathe') {
        const embed = new EmbedBuilder()
          .setTitle('🧘 Guided Breathing Exercises')
          .setDescription('Take a gentle moment to slow down. Choose one of our visual breathing techniques below:')
          .setColor('#43b581')
          .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('breathe_tech:box').setLabel('Box Breathing (4-4-4-4) 🧘').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('breathe_tech:relax').setLabel('Relaxing Breath (4-7-8) 🌬️').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('breathe_tech:slow').setLabel('Slow Breathing (5-5) 🌸').setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('breathe_tech:alternate').setLabel('Alternate Nostril (Nadi Shodhana) 👈👉').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('breathe_tech:bee').setLabel('Humming Bee (Bhramari) 🐝').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('breathe_tech:triangle').setLabel('Triangle Breathing 🔺').setStyle(ButtonStyle.Primary)
        );

        return await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
      }

      // Command: Grounding
      if (commandName === 'grounding') {
        const firstStep = groundingSteps[0];
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(firstStep.nextId).setLabel(firstStep.nextLabel).setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
          .setTitle('🧘 Guided 5-4-3-2-1 Grounding')
          .setDescription(`This exercise helps bring your awareness back to your physical environment to settle racing thoughts. \n\n### **${firstStep.title}**\n${firstStep.description}`)
          .setColor('#43b581')
          .setFooter({ text: 'Step 1 of 5' });

        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Coping (Menu select or random skill)
      if (commandName === 'coping') {
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('coping_menu_select')
            .setPlaceholder('What kind of coping tool do you need?')
            .addOptions([
              { label: 'Breathing Exercises', value: 'breathing', emoji: '💨' },
              { label: 'Grounding Exercises', value: 'grounding', emoji: '🧘' },
              { label: 'Journaling Prompts', value: 'journaling', emoji: '📝' },
              { label: 'Mind Distractions', value: 'distraction', emoji: '🎨' },
              { label: 'Sensory Resets', value: 'sensory_reset', emoji: '❄️' },
              { label: 'Reaching Out Support', value: 'reaching_out', emoji: '📞' }
            ])
        );

        return await interaction.reply({
          content: '🌸 **Calm-Down Menu**: Select a coping tool category below to receive a small, practical activity.',
          components: [row],
          ephemeral: true
        });
      }

      // Command: Crisis
      if (commandName === 'crisis') {
        return await interaction.reply({ content: CRISIS_RESOURCES, ephemeral: true });
      }

      // Command: Resources
      if (commandName === 'resources') {
        const embed = new EmbedBuilder()
          .setTitle('🏥 Mental Health Resources Directory')
          .setDescription('Select your country below to view verified support lines, text directories, and crisis services:')
          .setColor('#00bcd4')
          .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('resources_select_country')
          .setPlaceholder('Choose a country...')
          .addOptions([
            { label: 'United States 🇺🇸', value: 'us' },
            { label: 'Canada 🇨🇦', value: 'ca' },
            { label: 'United Kingdom 🇬🇧', value: 'uk' },
            { label: 'Australia 🇦🇺', value: 'au' },
            { label: 'Other / International 🌐', value: 'international' }
          ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Remind
      if (commandName === 'remind') {
        const embed = new EmbedBuilder()
          .setTitle('⏰ Custom Self-Care Reminders')
          .setDescription('Manage your automated notifications for drinking water, taking medication, stretching, or resting your eyes.')
          .setColor('#3f51b5')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('remind_dash_add').setLabel('Add Reminder ➕').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('remind_dash_list').setLabel('List Reminders 📋').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('remind_dash_delete').setLabel('Delete Reminder ❌').setStyle(ButtonStyle.Danger)
        );

        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Routine Builder
      if (commandName === 'routine') {
        const embed = new EmbedBuilder()
          .setTitle('🌸 Healthy Routine Builder')
          .setDescription('Build, edit, or check checklist items for morning, evening, school, work, or recovery routines.')
          .setColor('#4caf50')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('routine_dash_build').setLabel('Build / Edit Routine ✍️').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('routine_dash_view').setLabel('View Routine checklist 📋').setStyle(ButtonStyle.Secondary)
        );

        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Energy-based tasks
      if (commandName === 'energy-tasks') {
        const embed = new EmbedBuilder()
          .setTitle('🚀 Energy-Based Task Suggestions')
          .setDescription('How is your internal battery capacity right now? Click one of the buttons below to receive matched, non-shameful activities.')
          .setColor('#9e9e9e')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('energy_dash_low').setLabel('Low Energy ☕').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('energy_dash_medium').setLabel('Medium Energy ⚡').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('energy_dash_high').setLabel('High Energy 🚀').setStyle(ButtonStyle.Primary)
        );

        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Selfcare
      if (commandName === 'selfcare') {
        const embed = new EmbedBuilder()
          .setTitle('🧘 Daily Self-Care Utilities')
          .setDescription('Choose a check-in action or retrieve a random daily self-care tip from our mindfulness repository:')
          .setColor('#ffeb3b')
          .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('selfcare_dash:hydration').setLabel('Hydration check 💧').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('selfcare_dash:meal').setLabel('Meal check 🍲').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('selfcare_dash:movement').setLabel('Movement check 🧘').setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('selfcare_dash:screen-break').setLabel('Screen break 📵').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('selfcare_dash:daily-tip').setLabel('Daily Tip 💡').setStyle(ButtonStyle.Secondary)
        );

        return await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
      }

      // Command: Buddy Matching System
      if (commandName === 'buddy') {
        const embed = new EmbedBuilder()
          .setTitle('🌸 Buddy Matching System')
          .setDescription(
            `Match with another server member for mutual check-ins, quiet co-working, and accountability.\n\n` +
            `🔹 **Join Matching Pool**: Choose a topic preference and enter the queue.\n` +
            `🔹 **Leave Pool / Disconnect**: Remove yourself from the pool or disconnect your current active match.\n` +
            `🔹 **Check Status**: View if you are currently matched or searching.`
          )
          .setColor('#9c27b0')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('buddy_dash_join').setLabel('Join Matching Pool').setStyle(ButtonStyle.Primary).setEmoji('💬'),
          new ButtonBuilder().setCustomId('buddy_dash_leave').setLabel('Leave / Disconnect').setStyle(ButtonStyle.Danger).setEmoji('❌'),
          new ButtonBuilder().setCustomId('buddy_dash_status').setLabel('Check Status').setStyle(ButtonStyle.Secondary).setEmoji('📊')
        );

        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Communication Templates
      if (commandName === 'templates') {
        const embed = new EmbedBuilder()
          .setTitle('📝 Communication Templates')
          .setDescription('Select a script template category below to copy and customize for support or boundaries:')
          .setColor('#673ab7')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('template_dash_support').setLabel('Support Request Templates 💬').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('template_dash_boundaries').setLabel('Respectful Boundary Templates 🛡️').setStyle(ButtonStyle.Primary)
        );

        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Community care calendar
      if (commandName === 'calendar') {
        const events = dbGetCommunityEvents(guildId);
        let scheduleText = '';
        const typeNames = {
          breathing: '🧘 Group Box Breathing',
          gratitude: '✨ Weekly Gratitude Circle',
          music: '🎧 Lofi Music Listening Chat',
          coworking: '⚡ Silent Co-working & Focus',
          movie: '🎬 Low-Pressure Movie Night',
          journaling: '📝 Guided Journaling Workshop'
        };

        if (events.length === 0) {
          scheduleText = '*There are no wellness events scheduled in this server yet!*';
        } else {
          for (const ev of events) {
            const name = typeNames[ev.event_type] || ev.event_type;
            scheduleText += `🆔 \`#${ev.id}\` **${name}**\n📅 **${ev.event_day}** at **${ev.event_time}**\n📝 *${ev.description}*\n\n`;
          }
        }

        const embed = new EmbedBuilder()
          .setTitle('📅 Community Care Calendar')
          .setDescription(
            `Here are upcoming gentle, optional community events in our server:\n\n` +
            scheduleText +
            `\n*All events are optional. You can drop in and leave whenever you want. No pressure.*`
          )
          .setColor('#8bc34a')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('calendar_dash_add').setLabel('Schedule Event ➕').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('calendar_dash_delete').setLabel('Delete Event ❌').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('calendar_dash_refresh').setLabel('Refresh 🔄').setStyle(ButtonStyle.Secondary)
        );

        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Learn
      if (commandName === 'learn') {
        const embed = new EmbedBuilder()
          .setTitle('🧠 Mental Health Learning Center')
          .setDescription('Select an educational guide below to explore terminology, myths, therapy expectations, and medication preps:')
          .setColor('#009688')
          .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('learn_select_topic')
          .setPlaceholder('Choose a topic to learn...')
          .addOptions([
            { label: 'Vocabulary & Terms 🧠', value: 'vocabulary' },
            { label: 'Myths vs Facts 💡', value: 'myths' },
            { label: 'What Therapy is Like 🏥', value: 'therapy' },
            { label: 'Medication Appointment Prep 💊', value: 'prescriber' },
            { label: 'Supporting Someone Else 🤝', value: 'support-other' }
          ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Plant growing checkin system
      if (commandName === 'plant') {
        const plant = dbGetUserPlant(user.id);
        if (!plant) {
          const embed = new EmbedBuilder()
            .setTitle('🌱 Virtual Plant Check-in')
            .setDescription('You don\'t have a virtual check-in plant yet. Seed one below to start growing it!')
            .setColor('#4caf50');

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('plant_dash_seed_trigger').setLabel('Seed a Plant 🌱').setStyle(ButtonStyle.Primary)
          );

          return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        const embed = buildPlantEmbed(plant);
        const plantUrl = buildPlantUrl(user.id, plant);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('plant_dash_water').setLabel('Water Plant 💦').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('plant_dash_seed_trigger').setLabel('Re-Seed Plant 🌱').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('plant_dash_customize').setLabel('Customize 🎨').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setLabel('Open Screen 📱').setStyle(ButtonStyle.Link).setURL(plantUrl),
          new ButtonBuilder().setCustomId('plant_dash_refresh').setLabel('Refresh 🔄').setStyle(ButtonStyle.Secondary)
        );

        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Pet companion
      if (commandName === 'pet') {
        const pet = dbGetUserPet(user.id);
        if (!pet) {
          const embed = new EmbedBuilder()
            .setTitle('🐶 Virtual Pet Adoption')
            .setDescription('You don\'t have a virtual companion pet yet. Click below to adopt a cute companion!')
            .setColor('#ff9800');

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pet_dash_adopt_trigger').setLabel('Adopt Companion 🐶').setStyle(ButtonStyle.Success)
          );

          return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        const embed = buildPetEmbed(pet);
        const petUrl = buildPetUrl(user.id, pet);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('pet_dash_pet').setLabel('Pet 🐾').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('pet_dash_feed').setLabel('Feed Treats 🦴').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('pet_dash_play').setLabel('Play Fetch ⚽').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('pet_dash_customize').setLabel('Customize 🎨').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setLabel('Open Screen 📱').setStyle(ButtonStyle.Link).setURL(petUrl)
        );

        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Rename pet companion
      if (commandName === 'rename-pet') {
        const pet = dbGetUserPet(user.id);
        if (!pet) {
          return await interaction.reply({
            content: '🐾 You don\'t have a virtual companion pet yet! Adopt one first using `/pet`.',
            ephemeral: true
          });
        }
        
        const newName = interaction.options.getString('name').trim();
        if (!newName) {
          return await interaction.reply({
            content: '❌ Please provide a valid new name for your pet companion.',
            ephemeral: true
          });
        }

        dbRenamePet(user.id, newName);
        const updatedPet = dbGetUserPet(user.id);
        const embed = buildPetEmbed(updatedPet);

        return await interaction.reply({
          content: `🎉 **Pet Renamed!** Your virtual companion is now named **${newName}**!`,
          embeds: [embed],
          ephemeral: true
        });
      }

      // Command: Journal
      if (commandName === 'journal') {
        const modal = new ModalBuilder()
          .setCustomId('modal_journal')
          .setTitle('Private Journal Entry');

        const entryInput = new TextInputBuilder()
          .setCustomId('journal_entry')
          .setLabel('Write your thoughts (private to you)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('How are you feeling? What is on your mind?')
          .setRequired(true);

        const moodInput = new TextInputBuilder()
          .setCustomId('mood_score')
          .setLabel('Mood score (1 to 10)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 7')
          .setMaxLength(2)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(entryInput),
          new ActionRowBuilder().addComponents(moodInput)
        );

        return await interaction.showModal(modal);
      }

      // Command: Mood History
      if (commandName === 'mood-history') {
        const entries = dbGetUserJournals(user.id, 7);
        if (entries.length === 0) {
          return await interaction.reply({
            content: '📊 **Mood History**: You haven\'t logged any journal entries yet! Run `/journal` to create your first private entry.',
            ephemeral: true
          });
        }

        let chartText = '';
        for (const entry of entries.reverse()) {
          const dateStr = new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          const bar = '🟩'.repeat(entry.mood_score) + '░'.repeat(10 - entry.mood_score);
          chartText += `📅 **${dateStr}**: ${bar} (${entry.mood_score}/10)\n`;
        }

        const embed = new EmbedBuilder()
          .setTitle('📊 Private Mood History')
          .setDescription(`Here is your mood chart for your last 7 journal logs:\n\n${chartText}\n*Disclaimer: This is a self-reported mood tracker for reflection and is not a medical diagnosis or therapist replacement.*`)
          .setColor('#9c27b0')
          .setTimestamp();

        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Command: Coping Plan
      if (commandName === 'coping-plan') {
        const plan = dbGetCopingPlan(user.id);
        
        if (!plan) {
          const embed = new EmbedBuilder()
            .setTitle('📝 Personal Coping Plan')
            .setDescription('A personal coping plan helps you outline warning signs, safe activities, and trusted contacts *before* you experience overwhelm.\n\nYou do not have a plan saved yet. Click the button below to write one!')
            .setColor('#ff9800');

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_edit_coping_plan').setLabel('Create Coping Plan').setStyle(ButtonStyle.Primary).setEmoji('✍️'),
            new ButtonBuilder().setCustomId('btn_coping_plan_ideas').setLabel('Show Coping Suggestions').setStyle(ButtonStyle.Secondary).setEmoji('💡')
          );

          return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setTitle('📝 My Personal Coping Plan')
          .setColor('#ff9800')
          .addFields(
            { name: '🚨 Warning Signs (When I begin to feel overwhelmed)', value: plan.warning_signs || 'Not set' },
            { name: '🧘 Coping Skills (Things that help me calm down)', value: plan.coping_skills || 'Not set' },
            { name: '🎨 Comfort Activities (Things that soothe me)', value: plan.comfort_activities || 'Not set' },
            { name: '📞 Trusted Contacts (People I can reach out to)', value: plan.trusted_contacts || 'Not set' },
            { name: '❤️ Reasons to Keep Going', value: plan.reasons_to_go || 'Not set' }
          )
          .setFooter({ text: 'Private to you • Keep this updated' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_edit_coping_plan').setLabel('Edit Coping Plan').setStyle(ButtonStyle.Secondary).setEmoji('✍️'),
          new ButtonBuilder().setCustomId('btn_coping_plan_ideas').setLabel('Show Coping Suggestions').setStyle(ButtonStyle.Secondary).setEmoji('💡')
        );

        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Burnout
      if (commandName === 'burnout') {
        const q = educationData.burnout_check[0];
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('burnout_check:1:1').setLabel('Yes').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('burnout_check:1:0').setLabel('No').setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
          .setTitle('🔥 Burnout Self-Reflection Check')
          .setDescription(`This is a short, personal reflection checklist. Answer honestly. \n\n### **Question 1: ${q.question}**\n${q.text}`)
          .setColor('#ff5722')
          .setFooter({ text: 'Question 1 of 3' });

        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Command: Sit With Me
      if (commandName === 'sitwithme') {
        const duration = interaction.options.getInteger('duration') || 10;
        
        if (duration < 5 || duration > 60) {
          return await interaction.reply({ content: '⚠️ Duration must be between 5 and 60 minutes.', ephemeral: true });
        }

        if (activeSitSessions.has(user.id)) {
          return await interaction.reply({
            content: '⚠️ You already have an active "Sit With Me" session running in your DMs. Type `stop` in DMs to end it first.',
            ephemeral: true
          });
        }

        try {
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_sit_stop').setLabel('End Session').setStyle(ButtonStyle.Danger)
          );

          await user.send({
            content: `🌸 **Sit With Me Session Started**\n` +
                     `I will sit quietly with you for the next **${duration} minutes** while you study, clean, rest, or wait. ` +
                     `Every 3 minutes, I will send you a calm, quiet reminder that you aren't alone. You can end this at any time by clicking the button below or typing \`stop\`.`,
            components: [row]
          });

          // Set interval for checks
          let elapsed = 0;
          const messages = [
            "I'm still sitting here with you. Take a deep breath.",
            "You are doing just fine. No rush.",
            "Just checking in quietly. Remember to loosen your shoulders.",
            "Still here. Take a sip of water if you have some nearby.",
            "You are doing great just sitting here.",
            "Just quiet company. Keep going at your own pace."
          ];

          const timerId = setInterval(async () => {
            elapsed += 3;
            if (elapsed >= duration) {
              clearInterval(timerId);
              activeSitSessions.delete(user.id);
              return await user.send('🌸 **Sit With Me Session Finished**: Thank you for sitting with me today. Hope you have a peaceful rest of your day.');
            }

            const calmMsg = messages[Math.floor(Math.random() * messages.length)];
            await user.send(`🌸 *GentleGlow check-in:* ${calmMsg}`).catch(() => {
              clearInterval(timerId);
              activeSitSessions.delete(user.id);
            });
          }, 3 * 60 * 1000); // Check every 3 minutes

          activeSitSessions.set(user.id, timerId);

          return await interaction.reply({
            content: '✉️ **Sit With Me Started**: I have sent you a DM. Let\'s sit together.',
            ephemeral: true
          });

        } catch (err) {
          console.error(err);
          return await interaction.reply({
            content: '⚠️ **DM Blocked**: I was unable to send you a DM. Please enable DMs from server members and try again.',
            ephemeral: true
          });
        }
      }

      // Command: Something good
      if (commandName === 'something-good') {
        const types = ['quote', 'news', 'image'];
        const choice = types[Math.floor(Math.random() * types.length)];
        
        const embed = new EmbedBuilder().setColor('#ff9800').setTimestamp();

        if (choice === 'quote') {
          const quotes = comfortData.quotes;
          embed.setTitle('✨ Positive Quote')
               .setDescription(`> *"${quotes[Math.floor(Math.random() * quotes.length)]}"*`);
        } else if (choice === 'news') {
          const stories = comfortData.something_good;
          embed.setTitle('📰 Tell Me Something Good')
               .setDescription(stories[Math.floor(Math.random() * stories.length)]);
        } else {
          const images = Math.random() > 0.5 ? comfortData.nature_images : comfortData.animal_images;
          const img = images[Math.floor(Math.random() * images.length)];
          embed.setTitle(img.name)
               .setDescription('Take a moment to look at this and breathe:')
               .setImage(img.url);
        }

        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    // ==========================================
    // 2. Handle Button Interactions
    // ==========================================
    if (interaction.isButton()) {
      const { customId } = interaction;

      // --- Guided Breathing buttons ---
      if (customId.startsWith('breathe_tech:')) {
        const tech = customId.split(':')[1];
        const config = breathingConfigurations[tech];
        return await runBreathingExercise(interaction, config);
      }

      // --- Remind buttons ---
      if (customId === 'remind_dash_add') {
        const modal = new ModalBuilder()
          .setCustomId('modal_remind_add')
          .setTitle('Add Self-Care Reminder');
        const textInput = new TextInputBuilder()
          .setCustomId('remind_text')
          .setLabel('What should I remind you?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Sip water, Stretch, Relax shoulders')
          .setRequired(true);
        const intervalInput = new TextInputBuilder()
          .setCustomId('remind_interval')
          .setLabel('Interval (in minutes, min 5)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 30')
          .setRequired(true);
        modal.addComponents(
          new ActionRowBuilder().addComponents(textInput),
          new ActionRowBuilder().addComponents(intervalInput)
        );
        return await interaction.showModal(modal);
      }

      if (customId === 'remind_dash_list') {
        const list = dbGetReminders(user.id);
        if (list.length === 0) {
          return await interaction.reply({ content: '⏰ You have no active custom reminders.', ephemeral: true });
        }
        let remText = '';
        for (const rem of list) {
          remText += `🆔 **${rem.id}**: "${rem.reminder_text}" every **${rem.interval_minutes}m**\n`;
        }
        const embed = new EmbedBuilder()
          .setTitle('⏰ Active Custom Reminders')
          .setDescription(remText + `\n*To delete a reminder, use the "Delete Reminder" button.*`)
          .setColor('#3f51b5');
        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (customId === 'remind_dash_delete') {
        const list = dbGetReminders(user.id);
        if (list.length === 0) {
          return await interaction.reply({ content: '⏰ You have no active reminders to delete.', ephemeral: true });
        }
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('remind_delete_select')
          .setPlaceholder('Choose a reminder to delete...');
        for (const rem of list) {
          selectMenu.addOptions({
            label: `ID ${rem.id}: "${rem.reminder_text.substring(0, 30)}"`,
            value: rem.id.toString()
          });
        }
        const row = new ActionRowBuilder().addComponents(selectMenu);
        return await interaction.reply({ content: 'Select which reminder you want to delete:', components: [row], ephemeral: true });
      }

      // --- Routine buttons ---
      if (customId === 'routine_dash_build') {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('routine_select_build_type')
          .setPlaceholder('Choose a routine to build/edit...')
          .addOptions([
            { label: 'Morning Routine 🌅', value: 'morning' },
            { label: 'Evening Routine 🌌', value: 'evening' },
            { label: 'Work Routine 💼', value: 'work' },
            { label: 'School Routine 📚', value: 'school' },
            { label: 'Recovery Routine ❤️', value: 'recovery' }
          ]);
        const row = new ActionRowBuilder().addComponents(selectMenu);
        return await interaction.reply({ content: 'Select which routine you want to build or edit:', components: [row], ephemeral: true });
      }

      if (customId === 'routine_dash_view') {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('routine_select_view_type')
          .setPlaceholder('Choose a routine to view...')
          .addOptions([
            { label: 'Morning Routine 🌅', value: 'morning' },
            { label: 'Evening Routine 🌌', value: 'evening' },
            { label: 'Work Routine 💼', value: 'work' },
            { label: 'School Routine 📚', value: 'school' },
            { label: 'Recovery Routine ❤️', value: 'recovery' }
          ]);
        const row = new ActionRowBuilder().addComponents(selectMenu);
        return await interaction.reply({ content: 'Select which routine checklist you want to view:', components: [row], ephemeral: true });
      }

      // --- Energy-based tasks buttons ---
      if (customId.startsWith('energy_dash_')) {
        const level = customId.split('_')[2];
        let title = '';
        let desc = '';
        let color = '#9e9e9e';

        if (level === 'low') {
          title = '☕ Low Energy Task Recommendations';
          desc = 
            `Your battery is low right now, and that is completely okay. Here are some tiny, low-friction self-care tasks:\n\n` +
            `* **Breathing**: Unclench your jaw, drop your shoulders, and roll your neck.\n` +
            `* **Hydration**: Just take one single sip of water.\n` +
            `* **Tidy**: Pick up one piece of garbage near you and throw it out.\n` +
            `* **Physical**: Stretch your arms up over your head while sitting, or change position slightly.`;
          color = '#e0e0e0';
        } else if (level === 'medium') {
          title = '⚡ Medium Energy Task Recommendations';
          desc = 
            `You have some battery capacity to do things today. Here are moderate tasks you can try:\n\n` +
            `* **Environment**: Spend exactly 2 minutes tidying one small surface, like your keyboard or nightstand.\n` +
            `* **Plan**: Write down 3 tasks you want to accomplish, cross out 2, and do the easiest one first.\n` +
            `* **Nourish**: Spend 3 minutes getting fresh air or preparing a quick snack.`;
          color = '#ffeb3b';
        } else {
          title = '🚀 High Energy Task Recommendations';
          desc = 
            `Your battery is charged! If you want to use this momentum, here are some active suggestions:\n\n` +
            `* **Movement**: Go for a 15-minute walk outside or do a full-body stretch routine.\n` +
            `* **Projects**: Tackle one chore or task you've been putting off. Break it into three small parts first.\n` +
            `* **Clean**: Spend 10 minutes cleaning, organizing, or doing laundry.`;
          color = '#00e676';
        }

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(desc)
          .setColor(color)
          .setTimestamp();

        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // --- Self-care buttons ---
      if (customId.startsWith('selfcare_dash:')) {
        const action = customId.split(':')[1];
        let response = '';

        if (action === 'hydration') {
          response = '💧 **Hydration Check-In**: Water supports both your brain and body functions. There is no pressure or specific target, but if you have a glass nearby, take a gentle sip right now. You deserve care.';
          return await interaction.reply({ content: response, ephemeral: true });
        } else if (action === 'meal') {
          response = '🍲 **Meal Check-In**: Feeding yourself is a gentle act of self-care. If you haven\'t eaten in a while, maybe look for a small, comforting snack. No pressure or shame—just listen to what your body needs.';
          return await interaction.reply({ content: response, ephemeral: true });
        } else if (action === 'movement') {
          response = '🧘 **Movement Reminder**: Let\'s do a quick physical check-in:\n* Unclench your jaw.\n* Drop your shoulders down from your ears.\n* Shake out your hands.\n* Take a slow, deep breath and stretch if it feels good.';
          return await interaction.reply({ content: response, ephemeral: true });
        } else if (action === 'screen-break') {
          response = '📵 **Digital Screen Break**: Scrolling can sometimes drain our minds. Try setting your screen down for just 5 minutes. Rest your eyes, look out a window, or take a gentle stretch. You can always pick it back up whenever you are ready.';
          return await interaction.reply({ content: response, ephemeral: true });
        } else if (action === 'daily-tip') {
          try {
            const selfcareMethods = JSON.parse(fs.readFileSync('./data/selfcare_methods.json', 'utf8'));
            const method = selfcareMethods[Math.floor(Math.random() * selfcareMethods.length)];
            const embed = new EmbedBuilder()
              .setTitle(method.title)
              .setDescription(method.tip)
              .setColor('#00bcd4')
              .setFooter({ text: 'GentleGlow Daily Self-Care Tip' })
              .setTimestamp();
            return await interaction.reply({ embeds: [embed], ephemeral: true });
          } catch (err) {
            return await interaction.reply({ content: '💡 Take a slow deep breath and stretch if it feels good.', ephemeral: true });
          }
        }
      }

      // --- Buddy matching buttons ---
      if (customId === 'buddy_dash_join') {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('buddy_select_topic')
          .setPlaceholder('Select your support focus/preference...')
          .addOptions([
            { label: 'Casual Check-ins & Chat 💬', value: 'casual' },
            { label: 'Study, Focus & Work ⚡', value: 'productivity' },
            { label: 'Anxiety, Stress & Coping 🧘', value: 'coping' },
            { label: 'Routine & Habit Building 📅', value: 'routine' },
            { label: 'Silent Co-working Presence 🤫', value: 'silent' }
          ]);
        const row = new ActionRowBuilder().addComponents(selectMenu);
        return await interaction.reply({ content: 'Select a topic preference below to join the matching pool:', components: [row], ephemeral: true });
      }

      if (customId === 'buddy_dash_leave') {
        const status = dbGetBuddyStatus(user.id);
        if (status && status.match_user_id) {
          const partner = status.match_user_id;
          dbOptInBuddy(user.id, false, null);
          dbOptInBuddy(partner, false, null);
          try {
            const partnerUser = await client.users.fetch(partner);
            if (partnerUser) {
              await partnerUser.send('🌸 **Buddy System Notice**: Your current buddy match has been disconnected. You can opt-in to the matching pool again at any time.');
            }
          } catch {}
        } else {
          dbOptInBuddy(user.id, false, null);
        }
        return await interaction.reply({ content: '✅ You have opted out of the buddy matching system. Any active matches have been cleared.', ephemeral: true });
      }

      if (customId === 'buddy_dash_status') {
        const status = dbGetBuddyStatus(user.id);
        if (!status || status.opt_in === 0) {
          return await interaction.reply({ content: '📊 **Buddy Match Status**: You are currently **Opted Out**.', ephemeral: true });
        }
        if (status.match_user_id) {
          return await interaction.reply({ content: `📊 **Buddy Match Status**: You are currently **Matched** with <@${status.match_user_id}>!`, ephemeral: true });
        }
        return await interaction.reply({ content: '📊 **Buddy Match Status**: You are **Opted In** and searching for a buddy.', ephemeral: true });
      }

      // --- Communication Templates buttons ---
      if (customId === 'template_dash_support' || customId === 'template_dash_boundaries') {
        const type = customId === 'template_dash_support' ? 'support' : 'boundaries';
        const list = templateData[type];
        let text = '';
        for (const item of list) {
          text += `📝 **${item.title}**\n\`\`\`${item.text}\`\`\`\n`;
        }
        const embed = new EmbedBuilder()
          .setTitle(type === 'support' ? '💬 Support Request Templates' : '🛡️ Respectful Boundary Templates')
          .setDescription(`Feel free to copy and modify these communication scripts for your own use:\n\n` + text)
          .setColor('#673ab7')
          .setTimestamp();
        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // --- Calendar buttons ---
      if (customId === 'calendar_dash_add') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return await interaction.reply({
            content: '⚠️ **Access Denied**: Only administrators or moderators can schedule events.',
            ephemeral: true
          });
        }
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('calendar_select_type')
          .setPlaceholder('Choose a wellness event type to schedule...')
          .addOptions([
            { label: 'Group Box Breathing 🧘', value: 'breathing' },
            { label: 'Weekly Gratitude Circle ✨', value: 'gratitude' },
            { label: 'Lofi Music Listening Chat 🎧', value: 'music' },
            { label: 'Silent Co-working & Focus ⚡', value: 'coworking' },
            { label: 'Low-Pressure Movie Night 🎬', value: 'movie' },
            { label: 'Guided Journaling Workshop 📝', value: 'journaling' }
          ]);
        const row = new ActionRowBuilder().addComponents(selectMenu);
        return await interaction.reply({ content: 'Select what type of community care event to schedule:', components: [row], ephemeral: true });
      }

      if (customId === 'calendar_dash_delete') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return await interaction.reply({
            content: '⚠️ **Access Denied**: Only administrators or moderators can manage events.',
            ephemeral: true
          });
        }
        const events = dbGetCommunityEvents(guildId);
        if (events.length === 0) {
          return await interaction.reply({ content: '📅 There are no community events to delete.', ephemeral: true });
        }
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('calendar_delete_select')
          .setPlaceholder('Choose an event to delete...');
        for (const ev of events) {
          selectMenu.addOptions({
            label: `#${ev.id}: ${ev.event_type} (${ev.event_day})`,
            value: ev.id.toString()
          });
        }
        const row = new ActionRowBuilder().addComponents(selectMenu);
        return await interaction.reply({ content: 'Select which community event to delete:', components: [row], ephemeral: true });
      }

      if (customId === 'calendar_dash_refresh') {
        const events = dbGetCommunityEvents(guildId);
        let scheduleText = '';
        const typeNames = {
          breathing: '🧘 Group Box Breathing',
          gratitude: '✨ Weekly Gratitude Circle',
          music: '🎧 Lofi Music Listening Chat',
          coworking: '⚡ Silent Co-working & Focus',
          movie: '🎬 Low-Pressure Movie Night',
          journaling: '📝 Guided Journaling Workshop'
        };
        if (events.length === 0) {
          scheduleText = '*There are no wellness events scheduled in this server yet!*';
        } else {
          for (const ev of events) {
            const name = typeNames[ev.event_type] || ev.event_type;
            scheduleText += `🆔 \`#${ev.id}\` **${name}**\n📅 **${ev.event_day}** at **${ev.event_time}**\n📝 *${ev.description}*\n\n`;
          }
        }
        const embed = new EmbedBuilder()
          .setTitle('📅 Community Care Calendar')
          .setDescription(
            `Here are upcoming gentle, optional community events in our server:\n\n` +
            scheduleText +
            `\n*All events are optional. You can drop in and leave whenever you want. No pressure.*`
          )
          .setColor('#8bc34a')
          .setTimestamp();
        return await interaction.update({ embeds: [embed] });
      }

      // --- Plant buttons ---
      if (customId === 'plant_dash_water') {
        const plant = dbGetUserPlant(user.id);
        if (!plant) return await interaction.reply({ content: '🌱 Seed a plant first!', ephemeral: true });
        const hoursElapsed = (Date.now() - plant.last_watered) / (1000 * 60 * 60);
        if (hoursElapsed < 12) {
          return await interaction.reply({
            content: `💧 Your plant is already watered! Try again in **${Math.ceil(12 - hoursElapsed)} hours**.`,
            ephemeral: true
          });
        }
        dbWaterPlant(user.id);
        const growth = dbGrowPlant(user.id, 25);
        let responseText = `💧 **Watered**: You watered your plant! It gained **25 EXP**!`;
        if (plant.pot_style === 'terracotta') {
          responseText += `\n🪵 *The water quickly soaks into the rustic terracotta clay.*`;
        } else if (plant.pot_style === 'cup') {
          responseText += `\n☕ *The ceramic mug fills with clean water, keeping the roots cozy.*`;
        } else if (plant.pot_style === 'crystal') {
          responseText += `\n💎 *Droplets run down the sides of the shining crystal vase, catching the light.*`;
        } else if (plant.pot_style === 'wooden') {
          responseText += `\n📦 *The rich soil inside the rustic wooden planter dampens thoroughly.*`;
        }

        if (plant.decor === 'ladybug') {
          responseText += `\n🐞 *The friendly little Ladybug climbs up a leaf to stay dry!*`;
        } else if (plant.decor === 'fairy') {
          responseText += `\n✨ *The warm Fairy Lights glow softly through the water droplets!*`;
        } else if (plant.decor === 'mushrooms') {
          responseText += `\n🍄 *The tiny glow-in-the-dark mushrooms soak up the moisture happily!*`;
        } else if (plant.decor === 'pebbles') {
          responseText += `\n🪨 *The polished river pebbles glisten in the damp soil.*`;
        }
        if (growth && growth.stage > plant.stage) {
          responseText += `\n\n🎉 **Stage Up!** Your plant has grown to **Stage ${growth.stage}**!`;
        }
        const updatedPlant = dbGetUserPlant(user.id);
        const embed = buildPlantEmbed(updatedPlant, 'water');
        const plantUrl = buildPlantUrl(user.id, updatedPlant);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('plant_dash_water').setLabel('Water Plant 💦').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('plant_dash_seed_trigger').setLabel('Re-Seed Plant 🌱').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('plant_dash_customize').setLabel('Customize 🎨').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setLabel('Open Screen 📱').setStyle(ButtonStyle.Link).setURL(plantUrl),
          new ButtonBuilder().setCustomId('plant_dash_refresh').setLabel('Refresh 🔄').setStyle(ButtonStyle.Secondary)
        );
        return await interaction.update({ content: responseText, embeds: [embed], components: [row] });
      }

      if (customId === 'plant_dash_seed_trigger') {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('plant_seed_select')
          .setPlaceholder('Choose a seed type to plant...')
          .addOptions([
            { label: 'Cozy Fern 🌿', value: 'fern' },
            { label: 'Mini Succulent 🌵', value: 'succulent' },
            { label: 'Cheerful Sunflower 🌻', value: 'sunflower' },
            { label: 'Lucky Bamboo 🎋', value: 'bamboo' },
            { label: 'Bonsai Tree 🌳', value: 'bonsai' },
            { label: 'Peace Lily 💮', value: 'lily' },
            { label: 'Sweet Orchid 🌸', value: 'orchid' },
            { label: 'Tiny Cactus 🌵', value: 'cactus' }
          ]);
        const row = new ActionRowBuilder().addComponents(selectMenu);
        return await interaction.reply({ content: 'Choose which seed type you want to plant:', components: [row], ephemeral: true });
      }

      if (customId === 'plant_dash_refresh') {
        const plant = dbGetUserPlant(user.id);
        if (!plant) return await interaction.reply({ content: '🌱 Seed a plant first!', ephemeral: true });
        const embed = buildPlantEmbed(plant);
        const plantUrl = buildPlantUrl(user.id, plant);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('plant_dash_water').setLabel('Water Plant 💦').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('plant_dash_seed_trigger').setLabel('Re-Seed Plant 🌱').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('plant_dash_customize').setLabel('Customize 🎨').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setLabel('Open Screen 📱').setStyle(ButtonStyle.Link).setURL(plantUrl),
          new ButtonBuilder().setCustomId('plant_dash_refresh').setLabel('Refresh 🔄').setStyle(ButtonStyle.Secondary)
        );
        return await interaction.update({ embeds: [embed], components: [row] });
      }

      if (customId === 'plant_dash_customize') {
        const plant = dbGetUserPlant(user.id);
        if (!plant) return await interaction.reply({ content: '🌱 Seed a plant first!', ephemeral: true });

        const potMenu = new StringSelectMenuBuilder()
          .setCustomId('plant_custom_pot')
          .setPlaceholder('Choose a pot style...')
          .addOptions([
            { label: 'Classic Terracotta Pot 🪵', value: 'terracotta' },
            { label: 'Cozy Ceramic Mug ☕', value: 'cup' },
            { label: 'Shining Crystal Vase 💎', value: 'crystal' },
            { label: 'Rustic Wooden Planter 📦', value: 'wooden' }
          ]);

        const decorMenu = new StringSelectMenuBuilder()
          .setCustomId('plant_custom_decor')
          .setPlaceholder('Choose an accent decor...')
          .addOptions([
            { label: 'No accent decor (Clean)', value: 'none' },
            { label: 'Warm Fairy Lights ✨', value: 'fairy' },
            { label: 'Polished River Pebbles 🪨', value: 'pebbles' },
            { label: 'A friendly little Ladybug 🐞', value: 'ladybug' },
            { label: 'Tiny Glow-in-the-dark Mushrooms 🍄', value: 'mushrooms' }
          ]);

        const row1 = new ActionRowBuilder().addComponents(potMenu);
        const row2 = new ActionRowBuilder().addComponents(decorMenu);

        return await interaction.reply({
          content: '🎨 **Plant Customization**: Customize how your check-in plant looks below:',
          components: [row1, row2],
          ephemeral: true
        });
      }

      // --- Pet buttons ---
      if (customId === 'pet_dash_adopt_trigger') {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('pet_adopt_type')
          .setPlaceholder('Choose a companion animal type...')
          .addOptions([
            { label: 'Playful Dog 🐶', value: 'dog' },
            { label: 'Cozy Cat 🐱', value: 'cat' },
            { label: 'Fluffy Rabbit 🐰', value: 'rabbit' },
            { label: 'Clever Fox 🦊', value: 'fox' },
            { label: 'Chatty Parrot 🦜', value: 'parrot' },
            { label: 'Chilled Turtle 🐢', value: 'turtle' },
            { label: 'Gentle Panda 🐼', value: 'panda' },
            { label: 'Spooky Ghost 👻', value: 'ghost' }
          ]);
        const row = new ActionRowBuilder().addComponents(selectMenu);
        return await interaction.reply({ content: 'Select which type of virtual pet companion you want to adopt:', components: [row], ephemeral: true });
      }

      if (customId === 'pet_dash_pet' || customId === 'pet_dash_feed' || customId === 'pet_dash_play') {
        const pet = dbGetUserPet(user.id);
        if (!pet) return await interaction.reply({ content: '🐾 Adopt a pet first!', ephemeral: true });
        const action = customId.split('_')[2];
        let lastActionTime = 0;
        if (action === 'feed') lastActionTime = pet.last_fed;
        if (action === 'play') lastActionTime = pet.last_played;
        if (action === 'pet') lastActionTime = pet.last_petted;
        const hoursElapsed = (Date.now() - lastActionTime) / (1000 * 60 * 60);
        if (hoursElapsed < 4) {
          const nextTime = Math.ceil(4 - hoursElapsed);
          return await interaction.reply({
            content: `💤 **${pet.pet_name}** is resting right now. Try again in **${nextTime} hour(s)**.`,
            ephemeral: true
          });
        }
        dbUpdatePetAction(user.id, action === 'pet' ? 'petted' : action === 'feed' ? 'fed' : 'played');
        dbUpdatePetLove(user.id, pet.love + 5);
        dbGrowPlant(user.id, 10);

        const accessories = {
          none: "None",
          party: "Tiny Party Hat 🥳",
          bowtie: "Classy Bowtie 🎀",
          detective: "Sherlock Detective Hat 🕵️",
          scarf: "Cozy Winter Scarf 🧣"
        };
        const accText = pet.accessory !== 'none' ? ` wearing their ${accessories[pet.accessory]}` : '';

        let responseText = '';
        if (action === 'pet') {
          if (pet.accessory === 'party') {
            responseText = `🐾 You pet **${pet.pet_name}**. They lean against you happily, making their **Tiny Party Hat 🥳** wobble back and forth! (Friendship +5 ❤️)`;
          } else if (pet.accessory === 'bowtie') {
            responseText = `🐾 You pet **${pet.pet_name}**. They sit up straight and proud, showing off their **Classy Bowtie 🎀**! (Friendship +5 ❤️)`;
          } else if (pet.accessory === 'detective') {
            responseText = `🐾 You pet **${pet.pet_name}**. They look up at you with wise eyes from under their **Sherlock Detective Hat 🕵️**! (Friendship +5 ❤️)`;
          } else if (pet.accessory === 'scarf') {
            responseText = `🐾 You pet **${pet.pet_name}**. They nuzzle into your hand, extra warm in their **Cozy Winter Scarf 🧣**! (Friendship +5 ❤️)`;
          } else {
            responseText = `🐾 You pet **${pet.pet_name}**. They lean against you with a happy sigh and closed eyes. (Friendship +5 ❤️)`;
          }
        } else if (action === 'feed') {
          if (pet.accessory === 'bowtie') {
            responseText = `🦴 You feed **${pet.pet_name}** some treats. They eat carefully to keep their **Classy Bowtie 🎀** clean! (Friendship +5 ❤️)`;
          } else {
            responseText = `🦴 You feed **${pet.pet_name}** some tasty treats. They munch happily${accText}. (Friendship +5 ❤️)`;
          }
        } else if (action === 'play') {
          if (pet.accessory === 'party') {
            responseText = `⚽ You play fetch! **${pet.pet_name}** runs around in circles celebrating with their **Tiny Party Hat 🥳**! (Friendship +5 ❤️)`;
          } else if (pet.accessory === 'detective') {
            responseText = `⚽ You play fetch! **${pet.pet_name}** sniffs around like a detective solving a case wearing their **Sherlock Detective Hat 🕵️** before bringing the ball back! (Friendship +5 ❤️)`;
          } else if (pet.accessory === 'scarf') {
            responseText = `⚽ You play fetch! **${pet.pet_name}** bounds happily through the room, trailing their **Cozy Winter Scarf 🧣** behind them! (Friendship +5 ❤️)`;
          } else {
            responseText = `⚽ You play fetch with **${pet.pet_name}**${accText}. (Friendship +5 ❤️)`;
          }
        }
        const updatedPet = dbGetUserPet(user.id);
        const embed = buildPetEmbed(updatedPet, action);
        const petUrl = buildPetUrl(user.id, updatedPet);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('pet_dash_pet').setLabel('Pet 🐾').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('pet_dash_feed').setLabel('Feed Treats 🦴').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('pet_dash_play').setLabel('Play Fetch ⚽').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('pet_dash_customize').setLabel('Customize 🎨').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setLabel('Open Screen 📱').setStyle(ButtonStyle.Link).setURL(petUrl)
        );
        return await interaction.update({ content: responseText, embeds: [embed], components: [row] });
      }

      if (customId === 'pet_dash_customize') {
        const pet = dbGetUserPet(user.id);
        if (!pet) return await interaction.reply({ content: '🐾 Adopt a pet first!', ephemeral: true });

        let breedOptions = [];
        if (pet.pet_type === 'dog') {
          breedOptions = [
            { label: 'Golden Retriever 🐕', value: 'golden' },
            { label: 'Siberian Husky 🐺', value: 'husky' },
            { label: 'Rottweiler 🐕', value: 'rottweiler' },
            { label: 'Dalmatian 🐕', value: 'dalmatian' },
            { label: 'Cane Corso 🐕', value: 'canecorso' },
            { label: 'Dogo Argentino 🐕', value: 'dogo' },
            { label: 'Labrador Retriever 🐕', value: 'labrador' },
            { label: 'Pharaoh Hound 🐕', value: 'pharaoh' },
            { label: 'Classic Pixel Dog 🐶', value: 'pixel' }
          ];
        } else if (pet.pet_type === 'cat') {
          breedOptions = [
            { label: 'Cozy House Cat 🐱', value: 'standard' },
            { label: 'Three-Color Calico 🐈', value: 'calico' },
            { label: 'Striped Tiger Cat 🐈', value: 'tiger' },
            { label: 'Egyptian Cat 🐱', value: 'egypt' },
            { label: 'Dark Knight Cat 🐈‍⬛', value: 'batman' },
            { label: 'Astronaut Space Cat 🚀', value: 'space' },
            { label: 'Vintage Retro Cat 🐱', value: 'retro' },
            { label: 'Classic Pixel Cat 🐱', value: 'pixel' }
          ];
        } else if (pet.pet_type === 'rabbit') {
          breedOptions = [
            { label: 'Classic Pixel Bunny 🐰', value: 'bunny_32pixel' },
            { label: 'Midnight Black Bunny 🐰', value: 'bunny_black' },
            { label: 'Chestnut Brown Bunny 🐰', value: 'bunny_brown' },
            { label: 'Snowy White Bunny 🐰', value: 'bunny_white' },
            { label: 'Two-Color Brown Bunny 🐰', value: 'bunny_twocolor' },
            { label: 'Demonic Horned Bunny 😈', value: 'bunny_demonic' },
            { label: 'Panda Black & White Bunny 🐰', value: 'bunny_blackwhite' }
          ];
        } else if (pet.pet_type === 'fox') {
          breedOptions = [
            { label: 'Red Fox 🦊', value: 'default' }
          ];
        } else if (pet.pet_type === 'parrot') {
          breedOptions = [
            { label: 'Scarlet Red Parrot 🦜', value: 'red' },
            { label: 'Hyacinth Blue Parrot 🦜', value: 'blue' },
            { label: 'Amazon Green Parrot 🦜', value: 'green' },
            { label: 'Golden Yellow Parrot 🦜', value: 'yellow' },
            { label: 'Roseate Pink Parrot 🦜', value: 'pink' }
          ];
        } else if (pet.pet_type === 'turtle') {
          breedOptions = [
            { label: 'Sea Turtle 🐢', value: 'default' }
          ];
        } else if (pet.pet_type === 'panda') {
          breedOptions = [
            { label: 'Giant Panda 🐼', value: 'default' }
          ];
        } else if (pet.pet_type === 'ghost') {
          breedOptions = [
            { label: 'Floating Ghost 👻', value: 'default' }
          ];
        }

        const breedMenu = new StringSelectMenuBuilder()
          .setCustomId('pet_custom_breed')
          .setPlaceholder('Choose a breed/skin...')
          .addOptions(breedOptions);

        const accMenu = new StringSelectMenuBuilder()
          .setCustomId('pet_custom_accessory')
          .setPlaceholder('Choose an accessory...')
          .addOptions([
            { label: 'No Accessory', value: 'none' },
            { label: 'Tiny Party Hat 🥳', value: 'party' },
            { label: 'Classy Bowtie 🎀', value: 'bowtie' },
            { label: 'Sherlock Detective Hat 🕵️', value: 'detective' },
            { label: 'Cozy Winter Scarf 🧣', value: 'scarf' }
          ]);

        const changeTypeButton = new ButtonBuilder()
          .setCustomId('pet_dash_change_type_trigger')
          .setLabel('Change Pet Species 🔄')
          .setStyle(ButtonStyle.Danger);

        const row1 = new ActionRowBuilder().addComponents(breedMenu);
        const row2 = new ActionRowBuilder().addComponents(accMenu);
        const row3 = new ActionRowBuilder().addComponents(changeTypeButton);

        return await interaction.reply({
          content: `🎨 **Pet Customization**: Personalize **${pet.pet_name}**'s appearance below:`,
          components: [row1, row2, row3],
          ephemeral: true
        });
      }

      // --- Ephemeral Resources ---
      if (customId === 'btn_resources') {
        return await interaction.reply({ content: CRISIS_RESOURCES, ephemeral: true });
      }

      // --- Checkin Private selector trigger ---
      if (customId === 'btn_private_checkin') {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('private_mood_select')
          .setPlaceholder('Select how you are feeling privately...')
          .addOptions([
            { label: 'Doing well', value: 'doing_well', emoji: '🟢' },
            { label: 'Okay', value: 'okay', emoji: '🔵' },
            { label: 'Struggling a little', value: 'struggling', emoji: '🟡' },
            { label: 'Having a hard day', value: 'hard_day', emoji: '🟠' },
            { label: 'Tired', value: 'tired', emoji: '🥱' },
            { label: 'Well-Rested', value: 'well_rested', emoji: '🔋' },
            { label: 'Not Well', value: 'not_well', emoji: '🤒' },
            { label: 'Amazing', value: 'amazing', emoji: '✨' },
            { label: 'On Top of the World', value: 'on_top_world', emoji: '👑' },
            { label: 'At Peace', value: 'at_peace', emoji: '🧘' },
            { label: 'Vibing', value: 'vibing', emoji: '😎' }
          ]);

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        return await interaction.reply({
          content: '🔒 **Private Check-In**: Select how you are feeling below. This is visible only to you.',
          components: [selectRow],
          ephemeral: true
        });
      }

      // --- Public checkin support button DM trigger ---
      if (customId === 'btn_need_support') {
        if (!guildId) {
          return await interaction.reply({ content: 'This action can only be triggered inside a server.', ephemeral: true });
        }

        const dmButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`confirm_notify_yes:${guildId}`).setLabel('Yes, notify them').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('confirm_notify_resources').setLabel('No, just show me resources').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('confirm_notify_no').setLabel('No, I only wanted to check in').setStyle(ButtonStyle.Primary)
        );

        try {
          await user.send({
            content: `🌸 **GentleGlow private support check-in**\nI'm here with you. Would you like me to notify the server support team?`,
            components: [dmButtons]
          });

          return await interaction.reply({
            content: '✉️ **Private Support Request Started**: I have sent you a DM. Please check your direct messages to confirm.',
            ephemeral: true
          });
        } catch (error) {
          console.error(`Failed to send DM to ${user.tag}:`, error);
          return await interaction.reply({
            content: '⚠️ **Could not open Direct Message**: Please check your server privacy settings and allow direct messages from server members, then try again.',
            ephemeral: true
          });
        }
      }

      // --- DM confirmation of support notify ---
      if (customId.startsWith('confirm_notify_yes:')) {
        const targetGuildId = customId.split(':')[1];
        await interaction.deferUpdate();

        try {
          const guild = await client.guilds.fetch(targetGuildId);
          if (!guild) throw new Error('Guild not found');

          let logChannel = null;
          const settings = dbGetGuildSettings(targetGuildId);
          const configChannelId = settings.admin_channel_id;

          if (configChannelId) {
            logChannel = await guild.channels.fetch(configChannelId).catch(() => null);
          }

          if (!logChannel) {
            logChannel = guild.channels.cache.find(
              ch => ['gentleglow-alerts', 'support-logs', 'admin-alerts', 'moderator-only'].includes(ch.name) && ch.isTextBased()
            );
          }

          if (logChannel) {
            const alertEmbed = new EmbedBuilder()
              .setTitle('🚨 Support Check-In Alert')
              .setDescription(`A user has requested support through the GentleGlow bot.`)
              .addFields(
                { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
                { name: 'User ID', value: `\`${user.id}\``, inline: true },
                { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
              )
              .setColor('#d9534f')
              .setTimestamp();

            await logChannel.send({ embeds: [alertEmbed] });

            await interaction.editReply({
              content: `✅ **Support Team Notified**: Server administrators/moderators have been notified.\n\n` +
                       `⚠️ *Reminder: This is not an emergency service. Response times may vary. If you need urgent support, please refer to the resources below.* \n\n` +
                       CRISIS_RESOURCES,
              components: []
            });
          } else {
            await interaction.editReply({
              content: `⚠️ **Notification Issue**: I was unable to locate the support logs channel. Please contact a server admin directly.\n\n` + CRISIS_RESOURCES,
              components: []
            });
          }
        } catch (err) {
          console.error(err);
          await interaction.editReply({
            content: `⚠️ **Error**: Could not route notifications. Please reach out to an admin directly.\n\n` + CRISIS_RESOURCES,
            components: []
          });
        }
      }

      if (customId === 'confirm_notify_resources') {
        return await interaction.update({ content: `Here are mental health resources:\n\n` + CRISIS_RESOURCES, components: [] });
      }

      if (customId === 'confirm_notify_no') {
        return await interaction.update({ content: `🌸 No problem. I'm glad you checked in! Take good care of yourself.`, components: [] });
      }

      // --- Ephemeral: Show Another Affirmation ---
      if (customId.startsWith('btn_affirmation_another')) {
        const category = customId.split(':')[1] || 'all';
        const aff = getRandomAffirmation(category);
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`btn_affirmation_another:${category}`).setLabel('Show Another').setStyle(ButtonStyle.Secondary).setEmoji('✨')
        );

        return await interaction.reply({
          content: `🌸 **Affirmation**: \n\n> *"${aff}"*`,
          components: [row],
          ephemeral: true
        });
      }

      // --- Stop "Sit with me" session ---
      if (customId === 'btn_sit_stop') {
        if (activeSitSessions.has(user.id)) {
          clearInterval(activeSitSessions.get(user.id));
          activeSitSessions.delete(user.id);
          return await interaction.update({
            content: '🌸 **Sit With Me Session Terminated**: Session ended successfully.',
            components: []
          });
        }
      }

      // --- Coping Plan Ideas ---
      if (customId === 'btn_coping_plan_ideas') {
        const embed = new EmbedBuilder()
          .setTitle('💡 Personal Coping Plan Ideas & Suggestions')
          .setDescription(
            `If you're unsure what to write in your plan, here are some healthy suggestions you can use for inspiration:\n\n` +
            `🔹 **🚨 Warning Signs (Body & mind alerts before feeling overwhelmed)**\n` +
            `* *Physical*: Clenched jaw, tight shoulders, stomach ache, heavy chest.\n` +
            `* *Behavioral*: Isolating from friends, doomscrolling social media, restlessness.\n` +
            `* *Mental*: Racing thoughts, difficulty focusing, irritability, negative self-talk.\n\n` +
            `🔹 **🧘 Coping Skills (Things you can do immediately to calm down)**\n` +
            `* *Breathing*: Try the Box Breathing exercise (\`/breathe technique:box\`).\n` +
            `* *Grounding*: Run the 5-4-3-2-1 exercise (\`/grounding\`).\n` +
            `* *Sensory*: Splash cold water on your face, hold an ice cube, touch a soft texture.\n\n` +
            `🔹 **🎨 Comfort Activities (Things that soothe your spirit and distract you)**\n` +
            `* *Creative*: Drawing, writing in a journal (\`/journal\`), playing music.\n` +
            `* *Nature*: Going for a short walk outside, watching the clouds or rain.\n` +
            `* *Cozy*: Listening to a lofi playlist, cuddling a pet companion, making tea.\n\n` +
            `🔹 **📞 Trusted Contacts (People or groups you can reach out to)**\n` +
            `* *Close friends* or family members who understand you.\n` +
            `* *Server support staff* (click the "Need Support" button on check-in).\n` +
            `* *Crisis Helplines* (type \`/crisis\` or check the \`/resources\` command).\n\n` +
            `🔹 **❤️ Reasons to Keep Going (Small or big anchors that keep you here)**\n` +
            `* *Anchors*: A future movie/book release, taking care of your plants/pets.\n` +
            `* *Moments*: The warmth of sunshine, tomorrow's breakfast, stargazing.\n` +
            `* *Hope*: To see how much you will grow, to help others, to explore new places.`
          )
          .setColor('#00bcd4')
          .setFooter({ text: 'You can copy and modify these suggestions as needed.' });

        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // --- Open Coping Plan Modal ---
      if (customId === 'btn_edit_coping_plan') {
        const plan = dbGetCopingPlan(user.id) || {};

        const modal = new ModalBuilder()
          .setCustomId('modal_coping_plan')
          .setTitle('My Personal Coping Plan');

        const warningInput = new TextInputBuilder()
          .setCustomId('warning_signs')
          .setLabel('Warning signs I am becoming overwhelmed')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(plan.warning_signs || '')
          .setRequired(false);

        const skillsInput = new TextInputBuilder()
          .setCustomId('coping_skills')
          .setLabel('Coping skills that help me calm down')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(plan.coping_skills || '')
          .setRequired(false);

        const activitiesInput = new TextInputBuilder()
          .setCustomId('comfort_activities')
          .setLabel('Comforting activities I enjoy')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(plan.comfort_activities || '')
          .setRequired(false);

        const contactsInput = new TextInputBuilder()
          .setCustomId('trusted_contacts')
          .setLabel('Trusted people I can contact')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(plan.trusted_contacts || '')
          .setRequired(false);

        const reasonsInput = new TextInputBuilder()
          .setCustomId('reasons_to_go')
          .setLabel('My reasons to keep going')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(plan.reasons_to_go || '')
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(warningInput),
          new ActionRowBuilder().addComponents(skillsInput),
          new ActionRowBuilder().addComponents(activitiesInput),
          new ActionRowBuilder().addComponents(contactsInput),
          new ActionRowBuilder().addComponents(reasonsInput)
        );

        return await interaction.showModal(modal);
      }

      // --- Open Edit Routine Modal ---
      if (customId.startsWith('btn_edit_routine:')) {
        const type = customId.split(':')[1];
        const existing = dbGetUserRoutine(user.id, type);

        const modal = new ModalBuilder()
          .setCustomId(`modal_routine:${type}`)
          .setTitle(`Edit ${type} Routine`);

        const tasksInput = new TextInputBuilder()
          .setCustomId('routine_tasks')
          .setLabel('List your tasks (one per line)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(existing ? existing.tasks : '')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(tasksInput));
        return await interaction.showModal(modal);
      }

      // --- Grounding step progression ---
      if (customId.startsWith('grounding_step:')) {
        const nextStepId = customId.split(':')[1];
        
        if (nextStepId === 'done') {
          return await interaction.update({
            content: '🌸 **Grounding Exercise Complete**: Take one slow, deep breath. Focus on your heart rate settling. You are here, you are present, and you are safe.',
            embeds: [],
            components: []
          });
        }

        const nextStepIndex = parseInt(nextStepId) - 1;
        const nextStep = groundingSteps[nextStepIndex];

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(nextStep.nextId).setLabel(nextStep.nextLabel).setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
          .setTitle('🧘 Guided 5-4-3-2-1 Grounding')
          .setDescription(`Slow down and breathe. Focus entirely on the task at hand.\n\n### **${nextStep.title}**\n${nextStep.description}`)
          .setColor('#43b581')
          .setFooter({ text: `Step ${nextStep.step} of 5` });

        return await interaction.update({ embeds: [embed], components: [row] });
      }

      // --- Burnout check progression ---
      if (customId.startsWith('burnout_check:')) {
        const parts = customId.split(':');
        const nextStep = parseInt(parts[1]);
        const score = parseInt(parts[2]);

        const qList = educationData.burnout_check;

        if (nextStep >= qList.length) {
          // Finish checklist and evaluate
          let ratingText = '';
          if (score >= 2) {
            ratingText = 
              `### ⚠️ **Burnout Risk Detected**\n` +
              `Based on your responses, you are experiencing high physical and emotional fatigue. \n\n` +
              `**Recommendations:**\n` +
              `1. **Take a Break**: Set aside work or chores for a full day if possible.\n` +
              `2. **Establish Boundaries**: Practice declining extra tasks.\n` +
              `3. **Professional Support**: Consider speaking with a doctor or mental health professional.\n` +
              `*Remember: This is a self-care reflection helper, not a formal diagnosis.*`;
          } else {
            ratingText = 
              `### 🟢 **Low Burnout Risk**\n` +
              `It seems like you have some healthy resilience against burnout right now. Keep listening to your body and taking proactive breaks!`;
          }

          return await interaction.update({
            content: '🔥 **Burnout Check Complete**\n\n' + ratingText,
            embeds: [],
            components: []
          });
        }

        // Display next question
        const q = qList[nextStep];
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`burnout_check:${nextStep + 1}:${score + 1}`).setLabel('Yes').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`burnout_check:${nextStep + 1}:${score}`).setLabel('No').setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
          .setTitle('🔥 Burnout Self-Reflection Check')
          .setDescription(`Slow down and evaluate this honestly:\n\n### **Question ${nextStep + 1}: ${q.question}**\n${q.text}`)
          .setColor('#ff5722')
          .setFooter({ text: `Question ${nextStep + 1} of 3` });

        return await interaction.update({ embeds: [embed], components: [row] });
      }

      // --- Buddy matching approval ---
      if (customId.startsWith('btn_buddy_approve:')) {
        const parts = customId.split(':');
        const userA = parts[1];
        const userB = parts[2];

        dbSetBuddyMatch(userA, userB);

        try {
          const userAObj = await client.users.fetch(userA);
          const userBObj = await client.users.fetch(userB);

          if (userAObj) await userAObj.send(`✨ **Buddy Match Approved!** You have been matched with <@${userB}>! Say hello, establish check-in goals, and be gentle with each other.`);
          if (userBObj) await userBObj.send(`✨ **Buddy Match Approved!** You have been matched with <@${userA}>! Say hello, establish check-in goals, and be gentle with each other.`);
        } catch {}

        return await interaction.update({
          content: `✅ **Buddy Match Approved**: Match created between <@${userA}> and <@${userB}>.`,
          components: []
        });
      }

      if (customId.startsWith('btn_buddy_reject:')) {
        const parts = customId.split(':');
        const userA = parts[1];
        const userB = parts[2];

        return await interaction.update({
          content: `❌ **Buddy Match Rejected**: Match request between <@${userA}> and <@${userB}> was declined.`,
          components: []
        });
      }

      if (customId === 'pet_dash_change_type_trigger') {
        const pet = dbGetUserPet(user.id);
        if (!pet) {
          return await interaction.reply({ content: '🐾 Adopt a pet first!', ephemeral: true });
        }

        await interaction.deferUpdate();

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('pet_change_type_select')
          .setPlaceholder('Choose a new species...')
          .addOptions([
            { label: 'Playful Dog 🐶', value: 'dog' },
            { label: 'Cozy Cat 🐱', value: 'cat' },
            { label: 'Fluffy Rabbit 🐰', value: 'rabbit' },
            { label: 'Clever Fox 🦊', value: 'fox' },
            { label: 'Chatty Parrot 🦜', value: 'parrot' },
            { label: 'Chilled Turtle 🐢', value: 'turtle' },
            { label: 'Gentle Panda 🐼', value: 'panda' },
            { label: 'Spooky Ghost 👻', value: 'ghost' }
          ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        console.log("[DEBUG] Step 4: Editing reply");
        const res = await interaction.editReply({
          content: `🔄 **Change Pet Species**: Select a new companion species for **${pet.pet_name}** below. *(Your pet's friendship progress will be saved!)*`,
          components: [row]
        });
        console.log("[DEBUG] Step 5: Edit reply complete");
        return res;
      }
    }

    // ==========================================
    // 3. Handle Select Menu Interactions
    // ==========================================
    if (interaction.isStringSelectMenu()) {
      const { customId, values } = interaction;

      if (customId === 'private_mood_select') {
        const selectedValue = values[0];
        let responseMessage = '';

        switch (selectedValue) {
          case 'doing_well':
          case 'amazing':
          case 'on_top_world':
          case 'at_peace':
          case 'well_rested':
          case 'vibing':
            responseMessage = '✨ **GentleGlow**: I\'m so glad to hear you\'re feeling good! Thank you for checking in with yourself today. Have a beautiful day!';
            break;
          case 'okay':
          case 'tired':
            responseMessage = '🔋 **GentleGlow**: Thanks for checking in. Remember to listen to your body, take breaks when you need them, and be kind to yourself. You are doing great.';
            break;
          case 'struggling':
          case 'hard_day':
          case 'not_well':
            responseMessage = '🌸 **GentleGlow**: Thank you for sharing. It is completely okay to not be okay. Remember to be gentle with yourself. If you would like to reach out to the server support team privately, you can click the **Need Support** button on the check-in post.';
            break;
          default:
            responseMessage = '🌸 **GentleGlow**: Thank you for checking in privately! Hope you have a restful day.';
        }

        return await interaction.update({ content: responseMessage, components: [] });
      }

      if (customId === 'coping_menu_select') {
        const category = values[0];
        const items = copingSkills[category];
        const randomItem = items[Math.floor(Math.random() * items.length)];

        const embed = new EmbedBuilder()
          .setTitle(`🌸 Coping Reset: ${randomItem.title}`)
          .setDescription(randomItem.instruction)
          .setColor('#03a9f4')
          .setTimestamp();

        return await interaction.update({ content: null, embeds: [embed], components: [] });
      }

      if (customId === 'resources_select_country') {
        const country = values[0];
        const data = countryResources[country];
        const embed = new EmbedBuilder()
          .setTitle(`🏥 Mental Health Resources: ${data.country_name}`)
          .setDescription(`Here are verified support services and helplines:\n\n` + data.resources.join('\n\n'))
          .setColor('#00bcd4')
          .setFooter({ text: 'GentleGlow Mental Health Resources' })
          .setTimestamp();
        return await interaction.update({ content: null, embeds: [embed], components: [] });
      }

      if (customId === 'learn_select_topic') {
        const topic = values[0];
        const embed = new EmbedBuilder().setColor('#009688').setTimestamp();
        if (topic === 'vocabulary') {
          embed.setTitle('🧠 Mental-Health Vocabulary');
          let desc = '';
          for (const item of educationData.vocabulary) {
            desc += `🔹 **${item.term}**: ${item.definition}\n\n`;
          }
          embed.setDescription(desc);
        } else if (topic === 'myths') {
          embed.setTitle('💡 Mental-Health Myths vs Facts');
          let desc = '';
          for (const item of educationData.myths) {
            desc += `❌ **Myth**: *"${item.myth}"*\n✅ **Fact**: ${item.fact}\n\n`;
          }
          embed.setDescription(desc);
        } else if (topic === 'therapy') {
          embed.setTitle('🏥 What Therapy is Like: Guide');
          embed.setDescription(educationData.therapy_guide.join('\n\n'));
        } else if (topic === 'prescriber') {
          embed.setTitle('💊 Medication Prescriber Appointment Prep');
          embed.setDescription(educationData.medication_prep.join('\n\n'));
        } else if (topic === 'support-other') {
          embed.setTitle('🤝 Guide: How to Support Someone Else');
          embed.setDescription(educationData.support_guide.join('\n\n'));
        }
        return await interaction.update({ content: null, embeds: [embed], components: [] });
      }

      if (customId === 'remind_delete_select') {
        const id = parseInt(values[0]);
        const res = dbDeleteReminder(id, user.id);
        if (res.changes === 0) {
          return await interaction.update({ content: `⚠️ Reminder with ID **${id}** was not found.`, components: [] });
        }
        return await interaction.update({ content: `✅ Successfully deleted reminder **${id}**.`, components: [] });
      }

      if (customId === 'routine_select_build_type') {
        const type = values[0];
        const existing = dbGetUserRoutine(user.id, type);
        const modal = new ModalBuilder()
          .setCustomId(`modal_routine:${type}`)
          .setTitle(`Build ${type.charAt(0).toUpperCase() + type.slice(1)} Routine`);
        const tasksInput = new TextInputBuilder()
          .setCustomId('routine_tasks')
          .setLabel('List your tasks (one per line)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(existing ? existing.tasks : '')
          .setPlaceholder('1. Stretch\n2. Drink water\n3. Unclench jaw')
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(tasksInput));
        return await interaction.showModal(modal);
      }

      if (customId === 'routine_select_view_type') {
        const type = values[0];
        const routine = dbGetUserRoutine(user.id, type);
        if (!routine) {
          return await interaction.update({
            content: `⚠️ You haven't built a **${type}** routine yet! Open the /routine dashboard and choose "Build / Edit Routine" to create one.`,
            components: []
          });
        }
        const embed = new EmbedBuilder()
          .setTitle(`🌸 My Custom ${type.charAt(0).toUpperCase() + type.slice(1)} Routine`)
          .setDescription(
            `Here is your checklist. Take your time completing these steps:\n\n` +
            routine.tasks.split('\n').map(line => `▫️ ${line}`).join('\n')
          )
          .setColor('#4caf50')
          .setFooter({ text: 'Private to you • Low-pressure' })
          .setTimestamp();
        return await interaction.update({ content: null, embeds: [embed], components: [] });
      }

      if (customId === 'calendar_select_type') {
        const type = values[0];
        const modal = new ModalBuilder()
          .setCustomId(`modal_calendar_add:${type}`)
          .setTitle('Schedule Wellness Event');
        const dayInput = new TextInputBuilder()
          .setCustomId('event_day')
          .setLabel('Day of the week (e.g. Monday)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        const timeInput = new TextInputBuilder()
          .setCustomId('event_time')
          .setLabel('Time of the event (e.g. 7pm EST, 18:00)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        const descInput = new TextInputBuilder()
          .setCustomId('event_desc')
          .setLabel('Optional short description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);
        modal.addComponents(
          new ActionRowBuilder().addComponents(dayInput),
          new ActionRowBuilder().addComponents(timeInput),
          new ActionRowBuilder().addComponents(descInput)
        );
        return await interaction.showModal(modal);
      }

      if (customId === 'calendar_delete_select') {
        const id = parseInt(values[0]);
        const result = dbDeleteCommunityEvent(id, guildId);
        if (result.changes === 0) {
          return await interaction.update({ content: `⚠️ Could not find event with ID \`${id}\` in this server.`, components: [] });
        }
        return await interaction.update({ content: `✅ **Event Deleted**: Successfully deleted event ID \`${id}\` from the schedule.`, components: [] });
      }

      if (customId === 'plant_seed_select') {
        const type = values[0];
        dbInitializePlant(user.id, type);
        const updatedPlant = dbGetUserPlant(user.id);
        const embed = buildPlantEmbed(updatedPlant);
        return await interaction.update({
          content: `🌱 **Plant Seeded**: You have planted a **${type}** seed!`,
          embeds: [embed],
          components: []
        });
      }

      if (customId === 'pet_adopt_type') {
        const type = values[0];
        const modal = new ModalBuilder()
          .setCustomId(`modal_pet_adopt:${type}`)
          .setTitle(`Adopt ${type.charAt(0).toUpperCase() + type.slice(1)}`);
        const nameInput = new TextInputBuilder()
          .setCustomId('pet_name')
          .setLabel('Name your companion')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
        return await interaction.showModal(modal);
      }

      if (customId === 'buddy_select_topic') {
        const topicVal = values[0];
        const topicLabels = {
          casual: 'Casual Check-ins & Chat 💬',
          productivity: 'Study, Focus & Work ⚡',
          coping: 'Anxiety, Stress & Coping 🧘',
          routine: 'Routine & Habit Building 📅',
          silent: 'Silent Co-working Presence 🤫'
        };
        const topicText = topicLabels[topicVal] || topicVal;
        dbOptInBuddy(user.id, true, topicText);

        const unmatched = dbGetUnmatchedBuddies();
        const otherBuddy = unmatched.find(b => b.user_id !== user.id);

        if (otherBuddy) {
          dbOptInBuddy(user.id, true, otherBuddy.user_id);
          dbOptInBuddy(otherBuddy.user_id, true, user.id);

          try {
            const partnerUser = await client.users.fetch(otherBuddy.user_id);
            if (partnerUser) {
              await partnerUser.send(`🎉 **GentleGlow Buddy Match Found!**\nYou have been matched with <@${user.id}>! Reach out to them in direct messages.`);
              await user.send(`🎉 **GentleGlow Buddy Match Found!**\nYou have been matched with <@${otherBuddy.user_id}>! Reach out to them in direct messages.`);
            }

            const settings = dbGetGuildSettings(guildId);
            if (settings.admin_channel_id) {
              const staffChan = await client.channels.fetch(settings.admin_channel_id).catch(() => null);
              if (staffChan && staffChan.isTextBased()) {
                await staffChan.send(`👥 **Buddy System Match Notice**: User <@${user.id}> has been matched with <@${otherBuddy.user_id}> (Topic: *${topicText}*).`);
              }
            }
          } catch (err) {
            console.error('Error notifying buddy match:', err);
          }

          return await interaction.reply({ content: `🎉 **Match Found!** You have been matched with <@${otherBuddy.user_id}>! Check your DMs.`, ephemeral: true });
        }

        return await interaction.reply({
          content: '✅ **Opted-In**: You have joined the buddy matching pool. I will automatically match you as soon as another member joins!',
          ephemeral: true
        });
      }

      if (customId === 'plant_custom_pot') {
        const val = values[0];
        dbSavePlantCustomization(user.id, 'pot_style', val);
        const updatedPlant = dbGetUserPlant(user.id);
        const embed = buildPlantEmbed(updatedPlant);
        return await interaction.reply({
          content: `✅ **Pot Style Updated**: Your plant is now in a new pot style!`,
          embeds: [embed],
          ephemeral: true
        });
      }

      if (customId === 'plant_custom_decor') {
        const val = values[0];
        dbSavePlantCustomization(user.id, 'decor', val);
        const updatedPlant = dbGetUserPlant(user.id);
        const embed = buildPlantEmbed(updatedPlant);
        return await interaction.reply({
          content: `✅ **Accent Decor Updated**: Your plant's accent decoration has been updated!`,
          embeds: [embed],
          ephemeral: true
        });
      }

      if (customId === 'pet_custom_breed') {
        const val = values[0];
        dbSavePetCustomization(user.id, 'breed', val);
        const updatedPet = dbGetUserPet(user.id);
        const embed = buildPetEmbed(updatedPet);
        return await interaction.reply({
          content: `✅ **Pet Breed/Skin Updated**: Your pet's style has been updated!`,
          embeds: [embed],
          ephemeral: true
        });
      }

      if (customId === 'pet_custom_accessory') {
        const val = values[0];
        dbSavePetCustomization(user.id, 'accessory', val);
        const updatedPet = dbGetUserPet(user.id);
        const embed = buildPetEmbed(updatedPet);
        return await interaction.reply({
          content: `✅ **Pet Accessory Equipped**: Your pet has been styled!`,
          embeds: [embed],
          ephemeral: true
        });
      }



      if (customId === 'pet_change_type_select') {
        const newType = values[0];
        
        await interaction.deferUpdate(); // Instantly satisfy Discord's 3-second timeout window!

        dbChangePetType(user.id, newType);
        const updatedPet = dbGetUserPet(user.id);
        const embed = buildPetEmbed(updatedPet);
        const petUrl = buildPetUrl(user.id, updatedPet);
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('pet_dash_pet').setLabel('Pet 🐾').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('pet_dash_feed').setLabel('Feed Treats 🦴').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('pet_dash_play').setLabel('Play Fetch ⚽').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('pet_dash_customize').setLabel('Customize 🎨').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setLabel('Open Screen 📱').setStyle(ButtonStyle.Link).setURL(petUrl)
        );

        return await interaction.editReply({
          content: `🎉 **Companion Species Updated**: **${updatedPet.pet_name}** has successfully transformed into a **${newType}**!`,
          embeds: [embed],
          components: [row]
        });
      }
    }

    // ==========================================
    // 4. Handle Modal Submissions
    // ==========================================
    if (interaction.isModalSubmit()) {
      const { customId } = interaction;

      if (customId === 'modal_journal') {
        const entry = interaction.fields.getTextInputValue('journal_entry');
        const moodText = interaction.fields.getTextInputValue('mood_score');
        
        const moodScore = parseInt(moodText);
        if (isNaN(moodScore) || moodScore < 1 || moodScore > 10) {
          return await interaction.reply({
            content: '⚠️ **Invalid Entry**: Mood score must be a number between 1 and 10. Entry not saved.',
            ephemeral: true
          });
        }

        dbAddJournalEntry(user.id, entry, moodScore);
        
        // Feed the check-in plant experience!
        dbGrowPlant(user.id, 15);

        return await interaction.reply({
          content: '✅ **Private Journal Saved**: Your entry has been recorded securely. (Your virtual check-in plant gained 15 EXP!)',
          ephemeral: true
        });
      }

      if (customId === 'modal_coping_plan') {
        const warning = interaction.fields.getTextInputValue('warning_signs');
        const skills = interaction.fields.getTextInputValue('coping_skills');
        const activities = interaction.fields.getTextInputValue('comfort_activities');
        const contacts = interaction.fields.getTextInputValue('trusted_contacts');
        const reasons = interaction.fields.getTextInputValue('reasons_to_go');

        dbSaveCopingPlan(user.id, {
          warning_signs: warning,
          coping_skills: skills,
          comfort_activities: activities,
          trusted_contacts: contacts,
          reasons_to_go: reasons
        });

        return await interaction.reply({
          content: '✅ **Coping Plan Saved**: Your safety plan has been saved. Run `/coping-plan` to view it.',
          ephemeral: true
        });
      }

      if (customId.startsWith('modal_routine:')) {
        const type = customId.split(':')[1];
        const tasks = interaction.fields.getTextInputValue('routine_tasks');

        dbSaveUserRoutine(user.id, type, tasks);
        return await interaction.reply({
          content: `✅ **Routine Saved**: Your custom **${type}** routine has been saved.`,
          ephemeral: true
        });
      }

      if (customId === 'modal_remind_add') {
        const text = interaction.fields.getTextInputValue('remind_text');
        const intervalText = interaction.fields.getTextInputValue('remind_interval');
        const interval = parseInt(intervalText);
        if (isNaN(interval) || interval < 5) {
          return await interaction.reply({ content: '⚠️ **Invalid Interval**: Interval must be a number at least 5.', ephemeral: true });
        }
        dbAddReminder(user.id, text, interval);
        return await interaction.reply({
          content: `⏰ **Reminder Created**: I will DM you: *"🌸 ${text}"* every **${interval} minutes**.`,
          ephemeral: true
        });
      }

      if (customId.startsWith('modal_calendar_add:')) {
        const type = customId.split(':')[1];
        const day = interaction.fields.getTextInputValue('event_day');
        const time = interaction.fields.getTextInputValue('event_time');
        const desc = interaction.fields.getTextInputValue('event_desc') || '';

        const eventId = dbAddCommunityEvent(guildId, type, day, time, desc);
        return await interaction.reply({
          content: `✅ **Event Scheduled**: Successfully scheduled event! (ID: \`${eventId}\`)`,
          ephemeral: true
        });
      }

      if (customId.startsWith('modal_pet_adopt:')) {
        const type = customId.split(':')[1];
        const name = interaction.fields.getTextInputValue('pet_name');

        dbInitializePet(user.id, type, name);
        const pet = dbGetUserPet(user.id);
        const embed = buildPetEmbed(pet);
        return await interaction.reply({
          content: `🎉 **Pet Adopted!** You have adopted **${name}** the **${type}**!`,
          embeds: [embed],
          ephemeral: true
        });
      }
    }

  } catch (err) {
    console.error('Interaction error:', err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'There was an error while processing this request.', ephemeral: true });
      }
    } catch (msgErr) {
      console.error('Failed to send error reply:', msgErr);
    }
  }
});

// Asynchronous breathing timer loops
async function runBreathingExercise(interaction, config) {
  let cycle = 1;
  const totalCycles = config.cycles;
  
  await interaction.reply({ 
    embeds: [buildBreathingEmbed(config.name, "Prepare", 3, 3, "🧘", "#9e9e9e", () => "`[░░░░░░░░]`", cycle, totalCycles)],
    fetchReply: true,
    ephemeral: true
  });

  await new Promise(r => setTimeout(r, 3000));

  for (cycle = 1; cycle <= totalCycles; cycle++) {
    for (const step of config.steps) {
      for (let sec = step.duration; sec > 0; sec--) {
        const embed = buildBreathingEmbed(
          config.name, 
          step.action, 
          sec, 
          step.duration, 
          step.emoji, 
          step.color, 
          step.bar, 
          cycle, 
          totalCycles
        );
        
        let success = true;
        await interaction.editReply({ embeds: [embed] }).catch(() => {
          success = false;
        });
        
        if (!success) return; // session terminated or closed
        
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  const finalEmbed = {
    title: `🧘 Guided Breathing: ${config.name}`,
    description: `### **Exercise Completed**\n\n🌸 Great job. Take a moment to notice how you feel. You can start this breathing cycle again at any time.`,
    color: 0x4caf50,
    footer: { text: "GentleGlow Mental Health Support" }
  };
  
  await interaction.editReply({ embeds: [finalEmbed] }).catch(() => null);
}

function getPlantGif(plant, action = 'idle') {
  if (action === 'water') {
    return 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif'; // Watering animation
  }
  
  if (plant.stage === 0) {
    return 'https://media.giphy.com/media/3o7TKyxq2Y6SL49KPC/giphy.gif'; // Growing sprout / seed loop
  }
  
  if (plant.stage < 5) {
    return 'https://media.giphy.com/media/3o7TKyxq2Y6SL49KPC/giphy.gif';
  }
  
  const plantGifs = {
    fern: 'https://media.giphy.com/media/26vUqy6X6Z0HwGj16/giphy.gif',
    succulent: 'https://media.giphy.com/media/3o7TKyxq2Y6SL49KPC/giphy.gif',
    sunflower: 'https://media.giphy.com/media/l0HlIDU1MFTZtS3W8/giphy.gif',
    bamboo: 'https://media.giphy.com/media/l0HlJ8ElMXO74aKbK/giphy.gif',
    bonsai: 'https://media.giphy.com/media/l0HlNVhDCo8DTCq40/giphy.gif',
    lily: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
    orchid: 'https://media.giphy.com/media/l0HlIDU1MFTZtS3W8/giphy.gif',
    cactus: 'https://media.giphy.com/media/3o7TKyxq2Y6SL49KPC/giphy.gif'
  };
  
  return plantGifs[plant.plant_type] || 'https://media.giphy.com/media/3o7TKyxq2Y6SL49KPC/giphy.gif';
}

function buildPlantEmbed(plant, action = 'idle') {
  const stages = ['Seed 🌱', 'Sprout 🌿', 'Seedling 🪴', 'Growth Stage 🌴', 'Flowering Stage 🌸', 'Fully Grown 💐'];
  const ASCII_ART = [
    '[ . ] (A tiny seed in the soil)',
    '[ | ] (A small green sprout)',
    '  \\|/  \n   |    (A healthy seedling)',
    '  \\|/ \n --|-- \n   |    (Growing branches)',
    '  *|*  \n  \\|/  \n   |    (Buds and leaves)',
    ' _(_)_ \n(_)*(_) \n  \\|/  \n   |    (A blooming flower!)'
  ];

  const pots = {
    terracotta: "Terracotta Clay Pot 🪵",
    cup: "Cozy Ceramic Mug ☕",
    crystal: "Shining Crystal Vase 💎",
    wooden: "Rustic Wooden Planter 📦"
  };

  const decors = {
    none: "None",
    fairy: "Warm Fairy Lights ✨",
    pebbles: "Polished River Pebbles 🪨",
    ladybug: "A friendly little Ladybug 🐞",
    mushrooms: "Tiny Glow-in-the-dark Mushrooms 🍄"
  };

  const stageName = stages[plant.stage];
  const art = ASCII_ART[plant.stage];
  const nextStageExp = (plant.stage + 1) * 100;
  
  const potName = pots[plant.pot_style] || pots.terracotta;
  const decorName = decors[plant.decor] || decors.none;
  const gifUrl = getPlantGif(plant, action);
  
  return new EmbedBuilder()
    .setTitle(`🪴 My Virtual Check-In Plant`)
    .setDescription(
      `### **${stageName}**\n` +
      `*Type: ${plant.plant_type.charAt(0).toUpperCase() + plant.plant_type.slice(1)}*\n` +
      `*Container: **${potName}***\n` +
      `*Accent Decor: **${decorName}***\n\n` +
      `**Experience Points**: \`${plant.experience} / ${plant.stage < 5 ? nextStageExp : 'Max'}\` EXP\n\n` +
      `**Visual Status**:\n\`\`\`\n${art}\n\`\`\`\n` +
      `*Your plant grows when you water it, interact with your pet, and when you complete public check-ins!*`
    )
    .setColor('#4caf50')
    .setImage(gifUrl)
    .setTimestamp();
}

function buildPetEmbed(pet, action = 'idle') {
  const asciiArt = {
    dog: ' / \\__\n(    @\\___\n/         O\n/   (_____/\n/_____/   U',
    cat: '  /\\_/\\  \n ( o.o ) \n  > ^ <  ',
    rabbit: ' (\\___/)\n (=\'.\'=)\n (")_(")',
    fox: '  /\\   /\\\n //\\\\_//\\\\\n \\_     _/\n   / * \\'
  }[pet.pet_type] || '🐾';

  const breeds = {
    dog: {
      default: "Golden Retriever 🐕",
      golden: "Golden Retriever 🐕",
      husky: "Siberian Husky 🐺",
      rottweiler: "Rottweiler 🐕",
      dalmatian: "Dalmatian 🐕",
      canecorso: "Cane Corso 🐕",
      dogo: "Dogo Argentino 🐕",
      labrador: "Labrador Retriever 🐕",
      pharaoh: "Pharaoh Hound 🐕",
      pixel: "Classic Pixel Dog 🐶",
      corgi: "Cute Corgi 🐕",
      shiba: "Happy Shiba Inu 🐕",
      pug: "Cute Little Pug 🐶"
    },
    cat: {
      default: "Cozy House Cat 🐱",
      standard: "Cozy House Cat 🐱",
      calico: "Three-Color Calico Cat 🐈",
      tiger: "Striped Tiger Cat 🐈",
      egypt: "Egyptian Cat 🐱",
      batman: "Dark Knight Cat 🐈‍⬛",
      space: "Astronaut Space Cat 🚀",
      retro: "Vintage Retro Cat 🐱",
      pixel: "Classic Pixel Cat 🐱",
      black: "Black Cat 🐈‍⬛",
      siamese: "Siamese Cat 🐱"
    },
    rabbit: {
      default: "Classic Pixel Bunny 🐰",
      bunny_32pixel: "Classic Pixel Bunny 🐰",
      bunny_black: "Midnight Black Bunny 🐰",
      bunny_brown: "Chestnut Brown Bunny 🐰",
      bunny_white: "Snowy White Bunny 🐰",
      bunny_twocolor: "Two-Color Brown Bunny 🐰",
      bunny_demonic: "Demonic Horned Bunny 😈",
      bunny_blackwhite: "Panda Black & White Bunny 🐰",
      lop: "Lop-Eared Bunny 🐇",
      brown: "Wild Brown Rabbit 🐇"
    },
    fox: {
      default: "Red Fox 🦊",
      arctic: "Arctic White Fox ❄️",
      silver: "Rare Silver Fox 🦊"
    },
    parrot: {
      default: "Scarlet Red Parrot 🦜",
      red: "Scarlet Red Parrot 🦜",
      blue: "Hyacinth Blue Parrot 🦜",
      green: "Amazon Green Parrot 🦜",
      yellow: "Golden Yellow Parrot 🦜",
      pink: "Roseate Pink Parrot 🦜"
    },
    turtle: {
      default: "Sea Turtle 🐢"
    },
    panda: {
      default: "Giant Panda 🐼"
    },
    ghost: {
      default: "Floating Ghost 👻"
    }
  };

  const accessories = {
    none: "None",
    party: "Tiny Party Hat 🥳",
    bowtie: "Classy Bowtie 🎀",
    detective: "Sherlock Detective Hat 🕵️",
    scarf: "Cozy Winter Scarf 🧣"
  };

  const petGifs = {
    dog: {
      default: {
        idle: 'https://media.giphy.com/media/vN17EDkYW1O3S/giphy.gif',
        pet: 'https://media.giphy.com/media/mIMsHs5c3RAZ2/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      },
      husky: {
        idle: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNmNleWF2MW1pZ3FhbXp3azZkMHN5MWJ1b3B6OGx3ZWp6N2k3YWV2dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/vN17EDkYW1O3S/giphy.gif',
        pet: 'https://media.giphy.com/media/mIMsHs5c3RAZ2/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      },
      shiba: {
        idle: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        pet: 'https://media.giphy.com/media/mIMsHs5c3RAZ2/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      },
      pug: {
        idle: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        pet: 'https://media.giphy.com/media/mIMsHs5c3RAZ2/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      },
      corgi: {
        idle: 'https://media.tenor.com/17671758/tenor.gif',
        pet: 'https://media.tenor.com/5374921/tenor.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.tenor.com/27464016/tenor.gif'
      }
    },
    cat: {
      default: {
        idle: 'https://media.giphy.com/media/12PA1eI8FBqEUM/giphy.gif',
        pet: 'https://media.giphy.com/media/vFKzJWHCESvt6/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      },
      calico: {
        idle: 'https://media.giphy.com/media/12PA1eI8FBqEUM/giphy.gif',
        pet: 'https://media.giphy.com/media/vFKzJWHCESvt6/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      },
      black: {
        idle: 'https://media.giphy.com/media/12PA1eI8FBqEUM/giphy.gif',
        pet: 'https://media.giphy.com/media/vFKzJWHCESvt6/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      },
      siamese: {
        idle: 'https://media.giphy.com/media/12PA1eI8FBqEUM/giphy.gif',
        pet: 'https://media.giphy.com/media/vFKzJWHCESvt6/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      }
    },
    rabbit: {
      default: {
        idle: 'https://media.giphy.com/media/11T1ycKoYURy8M/giphy.gif',
        pet: 'https://media.giphy.com/media/11T1ycKoYURy8M/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      },
      lop: {
        idle: 'https://media.giphy.com/media/11T1ycKoYURy8M/giphy.gif',
        pet: 'https://media.giphy.com/media/11T1ycKoYURy8M/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      },
      brown: {
        idle: 'https://media.giphy.com/media/11T1ycKoYURy8M/giphy.gif',
        pet: 'https://media.giphy.com/media/11T1ycKoYURy8M/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      }
    },
    fox: {
      default: {
        idle: 'https://media.giphy.com/media/vN17EDkYW1O3S/giphy.gif',
        pet: 'https://media.giphy.com/media/vFKzJWHCESvt6/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      },
      arctic: {
        idle: 'https://media.giphy.com/media/vN17EDkYW1O3S/giphy.gif',
        pet: 'https://media.giphy.com/media/vFKzJWHCESvt6/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      },
      silver: {
        idle: 'https://media.giphy.com/media/vN17EDkYW1O3S/giphy.gif',
        pet: 'https://media.giphy.com/media/vFKzJWHCESvt6/giphy.gif',
        feed: 'https://media.giphy.com/media/3o7abKhOpu0NXS3l4I/giphy.gif',
        play: 'https://media.giphy.com/media/3o7abDq09QC5u23pG8/giphy.gif'
      }
    }
  };

  const typeBreeds = breeds[pet.pet_type] || {};
  const breedName = typeBreeds[pet.breed] || typeBreeds.default || 'Default';
  const accName = accessories[pet.accessory] || accessories.none;
  
  const breedGifs = petGifs[pet.pet_type]?.[pet.breed] || petGifs[pet.pet_type]?.default || {};
  const gifUrl = breedGifs[action] || breedGifs.idle || 'https://media.giphy.com/media/vN17EDkYW1O3S/giphy.gif';

  return new EmbedBuilder()
    .setTitle(`🐾 Companion Pet: ${pet.pet_name}`)
    .setDescription(
      `### **Friendship Level**: ❤️ \`${pet.love}\` Points\n` +
      `*Type: ${pet.pet_type.charAt(0).toUpperCase() + pet.pet_type.slice(1)}*\n` +
      `*Breed/Skin: **${breedName}***\n` +
      `*Accessory: **${accName}***\n\n` +
      `**Visual Companion**:\n\`\`\`\n${asciiArt}\n\`\`\`\n` +
      `*Show them love by petting, feeding, or playing with them!*`
    )
    .setColor('#ff9800')
    .setImage(gifUrl)
    .setTimestamp();
}

// Start client
client.login(process.env.DISCORD_TOKEN);
