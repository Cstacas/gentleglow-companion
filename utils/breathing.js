// Visual breathing indicators generator

function getProgressBar(current, total) {
  const bars = 8;
  const filled = Math.round((current / total) * bars);
  return '`[' + '█'.repeat(filled) + '░'.repeat(bars - filled) + ']`';
}

function getShrinkingProgressBar(current, total) {
  const bars = 8;
  const filled = Math.round(((total - current) / total) * bars);
  return '`[' + '█'.repeat(filled) + '░'.repeat(bars - filled) + ']`';
}

export const breathingConfigurations = {
  box: {
    name: "Box Breathing",
    description: "Ideal for fast stress relief, centering focus, and calming the nervous system.",
    steps: [
      { action: "Inhale", duration: 4, emoji: "💨 🟢", color: "#4caf50", bar: getProgressBar },
      { action: "Hold", duration: 4, emoji: "🧘 🟡", color: "#ffeb3b", bar: () => "`[████████]`" },
      { action: "Exhale", duration: 4, emoji: "🍃 🔵", color: "#2196f3", bar: getShrinkingProgressBar },
      { action: "Hold", duration: 4, emoji: "🧘 🟡", color: "#ffeb3b", bar: () => "`[░░░░░░░░]`" }
    ],
    cycles: 2
  },
  relax: {
    name: "4-7-8 Breathing",
    description: "Highly effective for reducing anxiety, falling asleep, and deep relaxation.",
    steps: [
      { action: "Inhale (Nose)", duration: 4, emoji: "💨 🟢", color: "#4caf50", bar: getProgressBar },
      { action: "Hold", duration: 7, emoji: "🧘 🟡", color: "#ffeb3b", bar: () => "`[████████]`" },
      { action: "Exhale (Mouth)", duration: 8, emoji: "🍃 🔵", color: "#2196f3", bar: getShrinkingProgressBar }
    ],
    cycles: 2
  },
  slow: {
    name: "Slow Breathing",
    description: "A simple, low-pressure breathing rhythm to lower your heart rate.",
    steps: [
      { action: "Inhale", duration: 5, emoji: "💨 🟢", color: "#4caf50", bar: getProgressBar },
      { action: "Exhale", duration: 5, emoji: "🍃 🔵", color: "#2196f3", bar: getShrinkingProgressBar }
    ],
    cycles: 3
  },
  alternate: {
    name: "Alternate Nostril Breathing",
    description: "Centers your thoughts, improves focus, and balances the brain hemispheres.",
    steps: [
      { action: "Inhale Left Nostril (Block Right)", duration: 4, emoji: "👈 🟢", color: "#4caf50", bar: getProgressBar },
      { action: "Hold both nostrils closed", duration: 4, emoji: "🧘 🟡", color: "#ffeb3b", bar: () => "`[████████]`" },
      { action: "Exhale Right Nostril (Block Left)", duration: 4, emoji: "👉 🔵", color: "#2196f3", bar: getShrinkingProgressBar },
      { action: "Inhale Right Nostril (Block Left)", duration: 4, emoji: "👉 🟢", color: "#4caf50", bar: getProgressBar },
      { action: "Hold both nostrils closed", duration: 4, emoji: "🧘 🟡", color: "#ffeb3b", bar: () => "`[████████]`" },
      { action: "Exhale Left Nostril (Block Right)", duration: 4, emoji: "👈 🔵", color: "#2196f3", bar: getShrinkingProgressBar }
    ],
    cycles: 2
  },
  bee: {
    name: "Humming Bee Breath (Bhramari)",
    description: "Soothes the nervous system, quietens racing thoughts, and relieves mental tension.",
    steps: [
      { action: "Inhale deeply through nose", duration: 4, emoji: "💨 🟢", color: "#4caf50", bar: getProgressBar },
      { action: "Hold and relax shoulders", duration: 2, emoji: "🧘 🟡", color: "#ffeb3b", bar: () => "`[████████]`" },
      { action: "Exhale slowly while humming 'Mmm'", duration: 8, emoji: "🐝 🔵", color: "#9c27b0", bar: getShrinkingProgressBar }
    ],
    cycles: 2
  },
  triangle: {
    name: "Triangle Breathing",
    description: "A simple, structured pattern for grounding and stabilizing your breathing pace.",
    steps: [
      { action: "Inhale", duration: 4, emoji: "💨 🟢", color: "#4caf50", bar: getProgressBar },
      { action: "Hold", duration: 4, emoji: "🧘 🟡", color: "#ffeb3b", bar: () => "`[████████]`" },
      { action: "Exhale", duration: 4, emoji: "🍃 🔵", color: "#2196f3", bar: getShrinkingProgressBar }
    ],
    cycles: 3
  }
};

// Build the Breathing progress card Embed
export function buildBreathingEmbed(configName, action, stepTimeRemaining, totalStepTime, emoji, color, barFunc, cycle, totalCycles) {
  const bar = barFunc(totalStepTime - stepTimeRemaining, totalStepTime);
  
  // Create beautiful visual lungs emojis
  let lungs = "🫁";
  if (action.includes("Inhale")) lungs = "😮‍💨 📈";
  else if (action.includes("Hold")) lungs = "🧘 ✊";
  else if (action.includes("Exhale")) lungs = "💨 📉";

  return {
    title: `🧘 Guided Breathing: ${configName}`,
    description: `### **${action}**\n\n# ${emoji} **${stepTimeRemaining}s**\n\n${bar}\n\n*Cycle ${cycle} of ${totalCycles}*`,
    color: parseInt(color.replace("#", ""), 16),
    fields: [
      { name: "Focus", value: lungs, inline: true }
    ],
    footer: { text: "GentleGlow Mental Health Support" }
  };
}
