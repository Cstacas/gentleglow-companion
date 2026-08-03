import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables immediately to avoid ES6 import hoisting issues
dotenv.config();

const DB_DIR = './database';
const DB_FILE = path.join(DB_DIR, 'database.sqlite');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('🤖 Supabase Client initialized for background sync.');
} else {
  console.warn('⚠️ Supabase credentials missing. Running SQLite only.');
}

// Background sync helpers
function syncPet(userId) {
  if (!supabase) return;
  const pet = dbGetUserPet(userId);
  if (!pet) return;
  
  supabase.from('virtual_pets').upsert({
    user_id: pet.user_id,
    pet_type: pet.pet_type,
    pet_name: pet.pet_name,
    love: pet.love,
    last_fed: pet.last_fed,
    last_played: pet.last_played,
    last_petted: pet.last_petted,
    breed: pet.breed,
    accessory: pet.accessory
  }).then(({ error }) => {
    if (error) console.error('❌ Supabase virtual_pets sync error:', error.message);
  });
}

function syncPlant(userId) {
  if (!supabase) return;
  const plant = dbGetUserPlant(userId);
  if (!plant) return;
  
  supabase.from('virtual_plants').upsert({
    user_id: plant.user_id,
    plant_type: plant.plant_type,
    stage: plant.stage,
    experience: plant.experience,
    last_watered: plant.last_watered,
    pot_style: plant.pot_style,
    decor: plant.decor
  }).then(({ error }) => {
    if (error) console.error('❌ Supabase virtual_plants sync error:', error.message);
  });
}

// Create tables including new routine, plant, buddy, and mailbox models
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    admin_channel_id TEXT,
    checkin_channel_id TEXT,
    affirmation_channel_id TEXT,
    affirmation_time TEXT DEFAULT '09:00',
    affirmation_timezone TEXT DEFAULT 'UTC',
    selfcare_channel_id TEXT
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    opt_in_affirmations INTEGER DEFAULT 0,
    preferred_theme TEXT DEFAULT 'all',
    timezone TEXT DEFAULT 'UTC',
    cooldown_mode INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS private_journals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    timestamp INTEGER,
    entry TEXT,
    mood_score INTEGER
  );

  CREATE TABLE IF NOT EXISTS coping_plans (
    user_id TEXT PRIMARY KEY,
    warning_signs TEXT,
    coping_skills TEXT,
    trusted_contacts TEXT,
    comfort_activities TEXT,
    reasons_to_go TEXT
  );

  CREATE TABLE IF NOT EXISTS custom_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    reminder_text TEXT,
    interval_minutes INTEGER,
    last_triggered INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_routines (
    user_id TEXT,
    routine_type TEXT,
    tasks TEXT,
    PRIMARY KEY (user_id, routine_type)
  );

  CREATE TABLE IF NOT EXISTS virtual_plants (
    user_id TEXT PRIMARY KEY,
    plant_type TEXT,
    stage INTEGER DEFAULT 0,
    experience INTEGER DEFAULT 0,
    last_watered INTEGER DEFAULT 0,
    pot_style TEXT DEFAULT 'terracotta',
    decor TEXT DEFAULT 'none',
    water_days INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS virtual_pets (
    user_id TEXT PRIMARY KEY,
    pet_type TEXT,
    pet_name TEXT,
    love INTEGER DEFAULT 0,
    last_fed INTEGER DEFAULT 0,
    last_played INTEGER DEFAULT 0,
    last_petted INTEGER DEFAULT 0,
    breed TEXT DEFAULT 'default',
    accessory TEXT DEFAULT 'none'
  );

  CREATE TABLE IF NOT EXISTS buddy_system (
    user_id TEXT PRIMARY KEY,
    opt_in INTEGER DEFAULT 0,
    match_user_id TEXT,
    interests TEXT
  );

  CREATE TABLE IF NOT EXISTS mailbox_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT,
    recipient_id TEXT,
    message_text TEXT,
    status TEXT DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS community_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    event_type TEXT,
    event_day TEXT,
    event_time TEXT,
    description TEXT
  );
`);

// Run column migration checks for existing SQLite tables
try {
  const pragma = db.prepare("PRAGMA table_info(guild_settings)").all();
  const hasSelfcare = pragma.some(col => col.name === 'selfcare_channel_id');
  if (!hasSelfcare) {
    db.exec("ALTER TABLE guild_settings ADD COLUMN selfcare_channel_id TEXT;");
    console.log("🛠️ Migrated guild_settings table: added selfcare_channel_id column.");
  }

  const pragmaPlants = db.prepare("PRAGMA table_info(virtual_plants)").all();
  const hasPot = pragmaPlants.some(col => col.name === 'pot_style');
  if (!hasPot) {
    db.exec("ALTER TABLE virtual_plants ADD COLUMN pot_style TEXT DEFAULT 'terracotta';");
    db.exec("ALTER TABLE virtual_plants ADD COLUMN decor TEXT DEFAULT 'none';");
    console.log("🛠️ Migrated virtual_plants table: added customization columns.");
  }

  const hasWaterDays = pragmaPlants.some(col => col.name === 'water_days');
  if (!hasWaterDays) {
    db.exec("ALTER TABLE virtual_plants ADD COLUMN water_days INTEGER DEFAULT 0;");
    console.log("🛠️ Migrated virtual_plants table: added water_days column.");
  }

  const pragmaPets = db.prepare("PRAGMA table_info(virtual_pets)").all();
  const hasBreed = pragmaPets.some(col => col.name === 'breed');
  if (!hasBreed) {
    db.exec("ALTER TABLE virtual_pets ADD COLUMN breed TEXT DEFAULT 'default';");
    db.exec("ALTER TABLE virtual_pets ADD COLUMN accessory TEXT DEFAULT 'none';");
    console.log("🛠️ Migrated virtual_pets table: added customization columns.");
  }
} catch (err) {
  console.error("Migration error:", err.message);
}

console.log('✅ SQLite Database models initialized/updated successfully.');

// --- GUILD SETTINGS QUERIES ---
export function dbGetGuildSettings(guildId) {
  const stmt = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
  return stmt.get(guildId) || {};
}

export function dbSaveGuildSetting(guildId, key, value) {
  const exists = db.prepare('SELECT 1 FROM guild_settings WHERE guild_id = ?').get(guildId);
  if (!exists) {
    db.prepare('INSERT INTO guild_settings (guild_id) VALUES (?)').run(guildId);
  }
  const allowedKeys = ['admin_channel_id', 'checkin_channel_id', 'affirmation_channel_id', 'affirmation_time', 'affirmation_timezone', 'selfcare_channel_id'];
  if (!allowedKeys.includes(key)) {
    throw new Error(`Forbidden guild setting key: ${key}`);
  }
  const stmt = db.prepare(`UPDATE guild_settings SET ${key} = ? WHERE guild_id = ?`);
  return stmt.run(value, guildId);
}

// --- USER SETTINGS QUERIES ---
export function dbGetUserSettings(userId) {
  const stmt = db.prepare('SELECT * FROM user_settings WHERE user_id = ?');
  return stmt.get(userId) || {
    user_id: userId,
    opt_in_affirmations: 0,
    preferred_theme: 'all',
    timezone: 'UTC',
    cooldown_mode: 0
  };
}

export function dbSaveUserSetting(userId, key, value) {
  const exists = db.prepare('SELECT 1 FROM user_settings WHERE user_id = ?').get(userId);
  if (!exists) {
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(userId);
  }
  const allowedKeys = ['opt_in_affirmations', 'preferred_theme', 'timezone', 'cooldown_mode'];
  if (!allowedKeys.includes(key)) {
    throw new Error(`Forbidden user setting key: ${key}`);
  }
  const stmt = db.prepare(`UPDATE user_settings SET ${key} = ? WHERE user_id = ?`);
  return stmt.run(value, userId);
}

// --- PRIVATE JOURNAL QUERIES ---
export function dbAddJournalEntry(userId, entry, moodScore) {
  const stmt = db.prepare(`
    INSERT INTO private_journals (user_id, timestamp, entry, mood_score)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(userId, Date.now(), entry, moodScore);
}

export function dbGetUserJournals(userId, limit = 7) {
  const stmt = db.prepare(`
    SELECT * FROM private_journals 
    WHERE user_id = ? 
    ORDER BY timestamp DESC 
    LIMIT ?
  `);
  return stmt.all(userId, limit);
}

// --- COPING PLAN QUERIES ---
export function dbGetCopingPlan(userId) {
  const stmt = db.prepare('SELECT * FROM coping_plans WHERE user_id = ?');
  return stmt.get(userId) || null;
}

export function dbSaveCopingPlan(userId, plan) {
  const stmt = db.prepare(`
    INSERT INTO coping_plans (user_id, warning_signs, coping_skills, trusted_contacts, comfort_activities, reasons_to_go)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      warning_signs = excluded.warning_signs,
      coping_skills = excluded.coping_skills,
      trusted_contacts = excluded.trusted_contacts,
      comfort_activities = excluded.comfort_activities,
      reasons_to_go = excluded.reasons_to_go
  `);
  return stmt.run(
    userId, 
    plan.warning_signs, 
    plan.coping_skills, 
    plan.trusted_contacts, 
    plan.comfort_activities, 
    plan.reasons_to_go
  );
}

// --- CUSTOM REMINDER QUERIES ---
export function dbAddReminder(userId, text, intervalMinutes) {
  const stmt = db.prepare(`
    INSERT INTO custom_reminders (user_id, reminder_text, interval_minutes, last_triggered)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(userId, text, intervalMinutes, Date.now());
}

export function dbDeleteReminder(id, userId) {
  const stmt = db.prepare('DELETE FROM custom_reminders WHERE id = ? AND user_id = ?');
  return stmt.run(id, userId);
}

export function dbGetReminders(userId) {
  const stmt = db.prepare('SELECT * FROM custom_reminders WHERE user_id = ?');
  return stmt.all(userId);
}

export function dbGetAllReminders() {
  const stmt = db.prepare('SELECT * FROM custom_reminders');
  return stmt.all();
}

export function dbUpdateReminderLastTriggered(id, timestamp) {
  const stmt = db.prepare('UPDATE custom_reminders SET last_triggered = ? WHERE id = ?');
  return stmt.run(timestamp, id);
}

export function dbGetAllAffirmationSubscribers() {
  const stmt = db.prepare('SELECT * FROM user_settings WHERE opt_in_affirmations = 1');
  return stmt.all();
}

export function dbGetAllGuildAffirmations() {
  const stmt = db.prepare('SELECT guild_id, affirmation_channel_id, affirmation_time, affirmation_timezone FROM guild_settings WHERE affirmation_channel_id IS NOT NULL');
  return stmt.all();
}

export function dbGetAllGuildSelfcare() {
  const stmt = db.prepare('SELECT guild_id, selfcare_channel_id, affirmation_time, affirmation_timezone FROM guild_settings WHERE selfcare_channel_id IS NOT NULL');
  return stmt.all();
}

export function dbGetAllGuildSettings() {
  const stmt = db.prepare('SELECT * FROM guild_settings');
  return stmt.all();
}

// --- ROUTINE QUERIES ---
export function dbGetUserRoutine(userId, routineType) {
  const stmt = db.prepare('SELECT * FROM user_routines WHERE user_id = ? AND routine_type = ?');
  return stmt.get(userId, routineType) || null;
}

export function dbSaveUserRoutine(userId, routineType, tasksList) {
  const stmt = db.prepare(`
    INSERT INTO user_routines (user_id, routine_type, tasks)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, routine_type) DO UPDATE SET tasks = excluded.tasks
  `);
  return stmt.run(userId, routineType, tasksList);
}

// --- VIRTUAL PLANT QUERIES ---
export function dbGetUserPlant(userId) {
  const stmt = db.prepare('SELECT * FROM virtual_plants WHERE user_id = ?');
  return stmt.get(userId) || null;
}

export function dbInitializePlant(userId, plantType) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO virtual_plants (user_id, plant_type, stage, experience, last_watered)
    VALUES (?, ?, 0, 0, ?)
  `);
  const res = stmt.run(userId, plantType, Date.now());
  syncPlant(userId);
  return res;
}

export function dbGrowPlant(userId, exp) {
  const plant = dbGetUserPlant(userId);
  if (!plant) return null;
  
  let newExp = plant.experience + exp;
  
  // Growth is now determined solely by unique calendar watering days (not EXP),
  // but we still update and save experience points as general progression!
  const stmt = db.prepare('UPDATE virtual_plants SET experience = ? WHERE user_id = ?');
  stmt.run(newExp, userId);
  syncPlant(userId);
  return { stage: plant.stage, experience: newExp };
}

export function dbWaterPlant(userId) {
  const plant = dbGetUserPlant(userId);
  if (!plant) return null;
  
  // Calculate unique calendar days watered in the server's local timezone
  const lastWateredDate = plant.last_watered ? new Date(plant.last_watered).toDateString() : '';
  const todayDate = new Date().toDateString();
  
  let incrementDay = 0;
  if (lastWateredDate !== todayDate) {
    incrementDay = 1;
  }
  
  const newWaterDays = (plant.water_days || 0) + incrementDay;
  
  // Determine growth stage based on total unique watering days:
  // 0-9 days -> Stage 0 (Sprout/Seedling)
  // 10-19 days -> Stage 1 (Bud)
  // 20+ days -> Stage 2 (Bloom)
  let newStage = 0;
  if (newWaterDays >= 20) {
    newStage = 2; // Bloom
  } else if (newWaterDays >= 10) {
    newStage = 1; // Bud
  }
  
  const stmt = db.prepare('UPDATE virtual_plants SET last_watered = ?, water_days = ?, stage = ? WHERE user_id = ?');
  const res = stmt.run(Date.now(), newWaterDays, newStage, userId);
  syncPlant(userId);
  return { res, water_days: newWaterDays, stage: newStage, incrementDay };
}

// --- BUDDY SYSTEM QUERIES ---
export function dbGetBuddyStatus(userId) {
  const stmt = db.prepare('SELECT * FROM buddy_system WHERE user_id = ?');
  return stmt.get(userId) || null;
}

export function dbOptInBuddy(userId, optInStatus, interestsText) {
  const stmt = db.prepare(`
    INSERT INTO buddy_system (user_id, opt_in, interests)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET 
      opt_in = excluded.opt_in, 
      interests = excluded.interests
  `);
  return stmt.run(userId, optInStatus ? 1 : 0, interestsText);
}

export function dbSetBuddyMatch(userId, matchUserId) {
  const stmt = db.prepare('UPDATE buddy_system SET match_user_id = ? WHERE user_id = ?');
  stmt.run(matchUserId, userId);
  return stmt.run(userId, matchUserId); // Bidirectional updates
}

export function dbGetUnmatchedBuddies() {
  const stmt = db.prepare('SELECT * FROM buddy_system WHERE opt_in = 1 AND match_user_id IS NULL');
  return stmt.all();
}

// --- MAILBOX MESSAGE QUERIES ---
export function dbAddMailboxMessage(senderId, recipientId, text) {
  const stmt = db.prepare(`
    INSERT INTO mailbox_messages (sender_id, recipient_id, message_text, status)
    VALUES (?, ?, ?, 'pending')
  `);
  const info = stmt.run(senderId, recipientId, text);
  return info.lastInsertRowid;
}

export function dbGetMailboxMessage(id) {
  const stmt = db.prepare('SELECT * FROM mailbox_messages WHERE id = ?');
  return stmt.get(id) || null;
}

export function dbUpdateMailboxMessageStatus(id, status) {
  const stmt = db.prepare('UPDATE mailbox_messages SET status = ? WHERE id = ?');
  return stmt.run(status, id);
}

// --- VIRTUAL PET QUERIES ---
export function dbGetUserPet(userId) {
  const stmt = db.prepare('SELECT * FROM virtual_pets WHERE user_id = ?');
  return stmt.get(userId) || null;
}

export function dbInitializePet(userId, petType, petName) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO virtual_pets (user_id, pet_type, pet_name, love, last_fed, last_played, last_petted)
    VALUES (?, ?, ?, 0, 0, 0, 0)
  `);
  const res = stmt.run(userId, petType, petName);
  syncPet(userId);
  return res;
}

export function dbUpdatePetLove(userId, newLove) {
  const stmt = db.prepare('UPDATE virtual_pets SET love = ? WHERE user_id = ?');
  const res = stmt.run(newLove, userId);
  syncPet(userId);
  return res;
}

export function dbUpdatePetAction(userId, actionType) {
  const stmt = db.prepare(`UPDATE virtual_pets SET last_${actionType} = ? WHERE user_id = ?`);
  const res = stmt.run(Date.now(), userId);
  syncPet(userId);
  return res;
}

// --- COMMUNITY EVENTS QUERIES ---
export function dbAddCommunityEvent(guildId, eventType, eventDay, eventTime, description) {
  const stmt = db.prepare(`
    INSERT INTO community_events (guild_id, event_type, event_day, event_time, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(guildId, eventType, eventDay, eventTime, description);
  return info.lastInsertRowid;
}

export function dbGetCommunityEvents(guildId) {
  const stmt = db.prepare('SELECT * FROM community_events WHERE guild_id = ? ORDER BY id ASC');
  return stmt.all(guildId);
}

export function dbDeleteCommunityEvent(id, guildId) {
  const stmt = db.prepare('DELETE FROM community_events WHERE id = ? AND guild_id = ?');
  return stmt.run(id, guildId);
}

export function dbSavePlantCustomization(userId, key, value) {
  const allowedKeys = ['pot_style', 'decor'];
  if (!allowedKeys.includes(key)) throw new Error('Invalid plant customization key');
  const stmt = db.prepare(`UPDATE virtual_plants SET ${key} = ? WHERE user_id = ?`);
  const res = stmt.run(value, userId);
  syncPlant(userId);
  return res;
}

export function dbSavePetCustomization(userId, key, value) {
  const allowedKeys = ['breed', 'accessory'];
  if (!allowedKeys.includes(key)) throw new Error('Invalid pet customization key');
  const stmt = db.prepare(`UPDATE virtual_pets SET ${key} = ? WHERE user_id = ?`);
  const res = stmt.run(value, userId);
  syncPet(userId);
  return res;
}

export function dbChangePetType(userId, newType) {
  const stmt = db.prepare('UPDATE virtual_pets SET pet_type = ?, breed = \'default\' WHERE user_id = ?');
  const res = stmt.run(newType, userId);
  syncPet(userId);
  return res;
}

export function dbRenamePet(userId, newName) {
  const stmt = db.prepare('UPDATE virtual_pets SET pet_name = ? WHERE user_id = ?');
  const res = stmt.run(newName, userId);
  syncPet(userId);
  return res;
}
