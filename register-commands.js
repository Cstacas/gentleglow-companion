import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
  // 1. Introduction and About
  new SlashCommandBuilder()
    .setName('about')
    .setDescription('Learn about GentleGlow, its features, and important safety details.'),

  new SlashCommandBuilder()
    .setName('crisis')
    .setDescription('Provides immediate guidance, crisis helplines, and text services.'),

  // 2. Administrative Setup
  new SlashCommandBuilder()
    .setName('checkin-setup')
    .setDescription('Posts the daily emotional check-in message with reaction emojis and buttons.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('set-checkin-channel')
    .setDescription('Sets the public channel where daily check-ins should be posted.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The text channel for daily check-ins')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('set-affirmation-channel')
    .setDescription('Sets the text channel where daily positive affirmations will be posted.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The text channel for daily affirmations')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('set-selfcare-channel')
    .setDescription('Sets the text channel where daily self-care tips/messages will be posted.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The text channel for daily self-care tips')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('set-admin-channel')
    .setDescription('Sets the private channel where user support alerts will be posted.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The text channel for support alerts')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  // 3. Main Dashboard Commands (Optionless Root Commands)
  new SlashCommandBuilder()
    .setName('buddy')
    .setDescription('Open the buddy opt-in matching pool and match status dashboard.'),

  new SlashCommandBuilder()
    .setName('breathe')
    .setDescription('Open guided breathing exercises with visual timing guides.'),

  new SlashCommandBuilder()
    .setName('burnout')
    .setDescription('Open a private self-reflection checklist to evaluate symptoms of burnout.'),

  new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Open the custom self-care reminders manager (medication, water, breaks).'),

  new SlashCommandBuilder()
    .setName('calendar')
    .setDescription('Open the community care calendar of wellness events.'),

  new SlashCommandBuilder()
    .setName('routine')
    .setDescription('Open your morning, evening, school, work, or recovery routine checklists.'),

  new SlashCommandBuilder()
    .setName('plant')
    .setDescription('Open and check in on your private virtual check-in plant.'),

  new SlashCommandBuilder()
    .setName('pet')
    .setDescription('Open and check in on your virtual companion pet.'),

  new SlashCommandBuilder()
    .setName('rename-pet')
    .setDescription('Rename your virtual companion pet.')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The new name for your companion')
        .setMaxLength(20)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('selfcare')
    .setDescription('Open the core self-care routines guide and hydration/meal check-ins.'),

  new SlashCommandBuilder()
    .setName('something-good')
    .setDescription('Displays a wholesome news story, a positive quote, or a cute animal/nature image link.'),

  new SlashCommandBuilder()
    .setName('coping')
    .setDescription('Provides coping ideas, journaling prompts, or a distraction reset.'),

  new SlashCommandBuilder()
    .setName('journal')
    .setDescription('Opens a private form to write a journal entry and track your mood.'),

  new SlashCommandBuilder()
    .setName('mood-history')
    .setDescription('Generates a private, Unicode progress chart of your logged moods.'),

  new SlashCommandBuilder()
    .setName('coping-plan')
    .setDescription('Creates or views your personal crisis safety and coping plan.'),

  new SlashCommandBuilder()
    .setName('resources')
    .setDescription('Shows verified mental health support lines by country.'),

  new SlashCommandBuilder()
    .setName('learn')
    .setDescription('Explore helpful educational topics on mental health.'),

  new SlashCommandBuilder()
    .setName('templates')
    .setDescription('Displays copy-paste communication templates for support or boundaries.'),

  new SlashCommandBuilder()
    .setName('sitwithme')
    .setDescription('Launches a quiet DM session with periodic calming company texts.')
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration in minutes (5 to 60)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('energy-tasks')
    .setDescription('Task suggestions matching your current energy level.')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
  try {
    const clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    if (!clientId || !process.env.DISCORD_TOKEN) {
      console.error('❌ Error: CLIENT_ID and DISCORD_TOKEN must be specified in the .env file.');
      process.exit(1);
    }

    if (guildId) {
      console.log(`🤖 Registering guild-level slash commands for Guild: ${guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log('✅ Guild commands registered successfully (instant update).');
    } else {
      console.log('🤖 Querying existing global commands...');
      const existingCommands = await rest.get(Routes.applicationCommands(clientId));
      const entryPointCmd = existingCommands.find(cmd => cmd.type === 4);
      if (entryPointCmd) {
        console.log(`🤖 Found app entry point command: "${entryPointCmd.name}" (Type 4). Preserving in bulk update.`);
        commands.push({
          name: entryPointCmd.name,
          description: entryPointCmd.description,
          type: entryPointCmd.type,
          integration_types: entryPointCmd.integration_types,
          contexts: entryPointCmd.contexts
        });
      }

      console.log('🤖 Registering global slash commands...');
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log('✅ Global commands registered successfully (takes up to 1 hour to propagate).');
    }
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
}

registerCommands();
