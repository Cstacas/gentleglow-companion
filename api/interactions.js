// /api/interactions.js

import { verifyKey } from 'discord-interactions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
};

function respond(res, content, extra = {}) {
  return res.status(200).json({
    type: 4,
    data: {
      content,
      ...extra,
    },
  });
}

async function forwardAction(userId, action, options = []) {
  await supabase.from('actions').insert({
    user_id: userId,
    action,
    options,
  });
}

export default async function handler(req, res) {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];

  const rawBody = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  const isValid = verifyKey(
    rawBody,
    signature,
    timestamp,
    process.env.PUBLIC_KEY
  );

  if (!isValid) {
    return res.status(401).send('Invalid request signature');
  }

  const interaction = JSON.parse(rawBody);

  // PING
  if (interaction.type === InteractionType.PING) {
    return res.status(200).json({ type: 1 });
  }

  // Slash commands
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const command = interaction.data.name;
    const userId =
      interaction.member?.user?.id || interaction.user?.id || null;
    const guildId = interaction.guild_id;
    const options = interaction.data.options || [];

    switch (command) {
      // --- Info / static commands ---
      case 'about':
        return respond(
          res,
          'GentleGlow is your wellness companion, here to help you track care, mood, and gentle progress.'
        );

      case 'crisis':
        return respond(
          res,
          'If you are in crisis, please reach out to local emergency services or a trusted crisis line.'
        );

      // --- Pet system ---
      case 'pet':
        await forwardAction(userId, 'pet_open', options);
        // Read latest pet data if available
        {
          const { data } = await supabase
            .from('pets')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (data?.pet_data) {
            return respond(
              res,
              `Your pet is here 💕\nLevel: ${data.pet_data.level ?? '—'}\nMood: ${
                data.pet_data.mood ?? '—'
              }`
            );
          }
        }
        return respond(res, 'Opening your companion pet…');

      // --- Plant system ---
      case 'plant':
        await forwardAction(userId, 'plant_open', options);
        {
          const { data } = await supabase
            .from('plants')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (data?.plant_data) {
            return respond(
              res,
              `Your plant 🌱\nStage: ${data.plant_data.stage ?? '—'}\nHydration: ${
                data.plant_data.hydration ?? '—'
              }`
            );
          }
        }
        return respond(res, 'Checking in on your plant…');

      // --- Buddy system ---
      case 'buddy':
        await forwardAction(userId, 'buddy_open', options);
        return respond(
          res,
          'Opening the buddy system. You can opt in to be gently matched with someone.'
        );

      // --- Journal ---
      case 'journal':
        await forwardAction(userId, 'journal_open', options);
        {
          const { data } = await supabase
            .from('journal_entries')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(3);

          if (data && data.length) {
            const lines = data.map(
              (e) =>
                `• ${new Date(e.created_at).toLocaleString()}: ${
                  e.entry.slice(0, 80) + (e.entry.length > 80 ? '…' : '')
                }`
            );
            return respond(
              res,
              `Here are your latest journal entries:\n${lines.join('\n')}`
            );
          }
        }
        return respond(res, 'Opening your journal…');

      // --- Mood history ---
      case 'mood-history':
        {
          const { data } = await supabase
            .from('mood_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

          if (!data || !data.length) {
            return respond(
              res,
              'No mood history yet. You can start logging moods and I’ll track them for you.'
            );
          }

          const lines = data.map(
            (m) =>
              `${new Date(m.created_at).toLocaleDateString()}: ${m.mood}`
          );
          return respond(
            res,
            `Recent mood history:\n${lines.join('\n')}`
          );
        }

      // --- Routines ---
      case 'routine':
        {
          const { data } = await supabase
            .from('routines')
            .select('*')
            .eq('user_id', userId);

          if (!data || !data.length) {
            return respond(
              res,
              'You don’t have any routines saved yet. You can create morning, evening, or custom routines.'
            );
          }

          const lines = data.map(
            (r) => `• ${r.routine_type}: ${JSON.stringify(r.routine_data)}`
          );
          return respond(
            res,
            `Your routines:\n${lines.join('\n')}`
          );
        }

      // --- Self-care reminders ---
      case 'selfcare':
        {
          const { data } = await supabase
            .from('selfcare_reminders')
            .select('*')
            .eq('user_id', userId)
            .eq('active', true);

          if (!data || !data.length) {
            return respond(
              res,
              'You have no active self-care reminders. You can set reminders for hydration, meals, meds, and breaks.'
            );
          }

          const lines = data.map(
            (r) => `• ${r.reminder_type}: ${JSON.stringify(r.schedule)}`
          );
          return respond(
            res,
            `Your active self-care reminders:\n${lines.join('\n')}`
          );
        }

      // --- Burnout checklist ---
      case 'burnout':
        {
          const { data } = await supabase
            .from('burnout_checklist')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (!data?.symptoms) {
            return respond(
              res,
              'No burnout checklist saved yet. You can log symptoms and I’ll help you track them gently.'
            );
          }

          return respond(
            res,
            `Your burnout checklist:\n${JSON.stringify(data.symptoms, null, 2)}`
          );
        }

      // --- Buddy pool status ---
      case 'buddy-status':
        {
          const { data } = await supabase
            .from('buddy_pool')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (!data) {
            return respond(
              res,
              'You are not currently in the buddy pool. You can join to be matched gently.'
            );
          }

          return respond(
            res,
            `Buddy status: ${data.status}${
              data.partner_id ? ` (matched with ${data.partner_id})` : ''
            }`
          );
        }

      // --- SitWithMe ---
      case 'sitwithme':
        await forwardAction(userId, 'sitwithme_start', options);
        return respond(
          res,
          'Starting a quiet SitWithMe session. I’ll stay with you while you breathe and exist.'
        );

      // --- Energy tasks ---
      case 'energy-tasks':
        {
          const levelOpt = options.find((o) => o.name === 'level');
          const level = levelOpt?.value || 'low';

          const { data } = await supabase
            .from('energy_tasks')
            .select('*')
            .eq('energy_level', level)
            .limit(10);

          if (!data || !data.length) {
            return respond(
              res,
              `I don’t have tasks saved yet for ${level} energy. You can add some later.`
            );
          }

          const lines = data.map((t) => `• ${t.task}`);
          return respond(
            res,
            `Here are some ${level}-energy tasks:\n${lines.join('\n')}`
          );
        }

      // --- Admin / channel config ---
      case 'set-admin-channel':
        {
          const channelOpt = options.find((o) => o.name === 'channel');
          const channelId = channelOpt?.value;
          if (!guildId || !channelId) {
            return respond(res, 'Guild or channel missing.');
          }

          await supabase.from('admin_channels').upsert({
            guild_id: guildId,
            channel_id: channelId,
          });

          return respond(
            res,
            `Admin channel set to <#${channelId}>.`
          );
        }

      case 'set-checkin-channel':
        {
          const channelOpt = options.find((o) => o.name === 'channel');
          const channelId = channelOpt?.value;
          await supabase.from('checkin_channels').upsert({
            guild_id: guildId,
            channel_id: channelId,
          });
          return respond(
            res,
            `Daily check-in channel set to <#${channelId}>.`
          );
        }

      case 'set-affirmation-channel':
        {
          const channelOpt = options.find((o) => o.name === 'channel');
          const channelId = channelOpt?.value;
          await supabase.from('affirmation_channels').upsert({
            guild_id: guildId,
            channel_id: channelId,
          });
          return respond(
            res,
            `Affirmation channel set to <#${channelId}>.`
          );
        }

      case 'set-selfcare-channel':
        {
          const channelOpt = options.find((o) => o.name === 'channel');
          const channelId = channelOpt?.value;
          await supabase.from('selfcare_channels').upsert({
            guild_id: guildId,
            channel_id: channelId,
          });
          return respond(
            res,
            `Self-care tip channel set to <#${channelId}>.`
          );
        }

      // --- Coping plan ---
      case 'coping-plan':
        {
          const { data } = await supabase
            .from('coping_plans')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (!data?.plan_data) {
            return respond(
              res,
              'You don’t have a coping plan saved yet. You can create one and I’ll keep it ready for you.'
            );
          }

          return respond(
            res,
            `Your coping plan:\n${JSON.stringify(data.plan_data, null, 2)}`
          );
        }

      // --- Resources ---
      case 'resources':
        {
          const countryOpt = options.find((o) => o.name === 'country');
          const country = countryOpt?.value || 'US';

          const { data } = await supabase
            .from('resources')
            .select('*')
            .eq('country', country)
            .maybeSingle();

          if (!data) {
            return respond(
              res,
              `I don’t have resources saved yet for ${country}.`
            );
          }

          let msg = `Resources for ${country}:\n• Hotline: ${data.hotline}`;
          if (data.textline) msg += `\n• Textline: ${data.textline}`;
          if (data.website) msg += `\n• Website: ${data.website}`;
          return respond(res, msg);
        }

      // --- Learn ---
      case 'learn':
        {
          const { data } = await supabase
            .from('learning_topics')
            .select('*')
            .limit(10);

          if (!data || !data.length) {
            return respond(
              res,
              'No learning topics saved yet. I can teach you about anxiety, depression, burnout, and more later.'
            );
          }

          const lines = data.map((t) => `• ${t.title}`);
          return respond(
            res,
            `Available topics:\n${lines.join('\n')}`
          );
        }

      // --- Templates ---
      case 'templates':
        {
          const categoryOpt = options.find((o) => o.name === 'category');
          const category = categoryOpt?.value || 'general';

          const { data } = await supabase
            .from('templates')
            .select('*')
            .eq('category', category)
            .limit(10);

          if (!data || !data.length) {
            return respond(
              res,
              `No templates saved yet for category: ${category}.`
            );
          }

          const lines = data.map(
            (t) => `• ${t.content.slice(0, 120)}${t.content.length > 120 ? '…' : ''}`
          );
          return respond(
            res,
            `Templates for ${category}:\n${lines.join('\n')}`
          );
        }

      default:
        return respond(
          res,
          `This command (${command}) is registered but not wired yet.`
        );
    }
  }

  return res.status(400).send('Unhandled interaction type');
}
