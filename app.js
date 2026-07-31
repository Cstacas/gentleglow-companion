// App controller for the GentleGlow Companion Screen (Locally Hosted Assets)
document.addEventListener('DOMContentLoaded', () => {
  // 1. Parse URL Parameters
  const params = new URLSearchParams(window.location.search);
  const name = params.get('name') || 'Companion';
  const type = params.get('type') || 'dog';
  const breed = params.get('breed') || 'default';
  const accessory = params.get('acc') || 'none';
  const startingLove = parseInt(params.get('love')) || 0;

  // 2. UI Element Bindings
  const nameLabel = document.getElementById('companion-name');
  const loveLabel = document.getElementById('love-points');
  const spriteWrapper = document.getElementById('sprite-wrapper');
  const spriteImage = document.getElementById('companion-sprite');
  const accessoryOverlay = document.getElementById('equipped-accessory');
  const loveFillBar = document.getElementById('status-bar-love');
  const moodText = document.getElementById('mood-text');

  const btnFeed = document.getElementById('btn-feed');
  const btnPlay = document.getElementById('btn-play');
  const btnPet = document.getElementById('btn-pet');

  // Action Overlay Bindings
  const foodBowl = document.getElementById('food-bowl');
  const toyBall = document.getElementById('toy-ball');
  const petHand = document.getElementById('pet-hand');

  // Casing Theme Selection Bindings
  const toyShell = document.querySelector('.toy-shell');
  const btnTheme = document.getElementById('btn-theme');

  // 3. Local Storage Save Data
  const storageKey = `gentleglow_save_${name.toLowerCase()}`;
  let state = {
    lovePoints: startingLove,
    hunger: 100,
    energy: 100,
    moisture: 100,
    isSleeping: false
  };

  // Load saved state
  const savedState = localStorage.getItem(storageKey);
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      state = { ...state, ...parsed };
    } catch (e) {
      console.error("Could not parse save state:", e);
    }
  }

  // Handle casing theme load and cycling
  const casingThemes = ['pink', 'lavender', 'teal', 'sunflower', 'midnight', 'retro'];
  let currentTheme = localStorage.getItem('gentleglow_casing_theme') || 'pink';
  if (toyShell) {
    toyShell.className = `toy-shell theme-${currentTheme}`;
  }

  if (btnTheme && toyShell) {
    btnTheme.addEventListener('click', () => {
      const currentIndex = casingThemes.indexOf(currentTheme);
      const nextIndex = (currentIndex + 1) % casingThemes.length;
      currentTheme = casingThemes[nextIndex];
      toyShell.className = `toy-shell theme-${currentTheme}`;
      localStorage.setItem('gentleglow_casing_theme', currentTheme);
    });
  }

  const accessoryEmojis = {
    none: '',
    party: '🥳',
    bowtie: '🎀',
    detective: '🕵️',
    glasses: '😎',
    scarf: '🧣',
    fairy: '✨',
    pebbles: '🪨',
    ladybug: '🐞',
    mushrooms: '🍄'
  };

  if (type === 'plant') {
    btnFeed.textContent = 'WATER';
    btnPlay.textContent = 'PRUNE';
    btnPet.textContent = 'TALK';
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function updateUI() {
    nameLabel.textContent = name.toUpperCase();
    loveLabel.textContent = `❤️ ${state.lovePoints.toString().padStart(3, '0')}`;
    
    const maxVal = type === 'plant' ? 500 : 150;
    const fillPercentage = Math.min(100, Math.max(10, Math.ceil((state.lovePoints / maxVal) * 100)));
    loveFillBar.style.width = `${fillPercentage}%`;

    if (type === 'plant') {
      moodText.textContent = state.moisture < 35 ? "Dry 🍂" : "Healthy 🌿";
    } else {
      if (state.isSleeping) {
        moodText.textContent = "Sleeping 💤";
      } else if (state.hunger < 35) {
        moodText.textContent = "Hungry 🍖";
      } else if (state.energy < 25) {
        moodText.textContent = "Tired 🥱";
      } else {
        moodText.textContent = "Peaceful 🧘";
      }
    }
  }

  // Get local image paths for pets and plants
  function getLocalAssetUrl(actionKey = 'idle') {
    const breedClean = breed.toLowerCase();

    // 1. Plant Assets (Static local jpg files)
    if (type === 'plant') {
      const isGrown = state.lovePoints >= 500;
      if (!isGrown) {
        return './images/plant_default_idle.jpg'; // sprout
      }
      // Check if we generated specific mature plant breed file
      if (['bonsai', 'cactus'].includes(breedClean)) {
        return `./images/plant_${breedClean}_idle.jpg`;
      }
      return './images/plant_bonsai_idle.jpg'; // default mature plant
    }

    // 2. Pet Assets (Local gif files)
    let mappedBreed = 'default';
    if (type === 'dog') {
      if (['husky', 'shiba', 'pug'].includes(breedClean)) {
        mappedBreed = breedClean;
      }
    } else if (type === 'fox') {
      if (breedClean === 'arctic') {
        mappedBreed = 'arctic';
      }
    }
    
    // Sleeping state overrides and plays sleep animation
    const finalAction = state.isSleeping ? 'sleep' : actionKey;
    return `./images/${type}_${mappedBreed}_${finalAction}.gif`;
  }

  function renderSprite(actionKey = 'idle') {
    spriteImage.style.backgroundImage = `url('${getLocalAssetUrl(actionKey)}')`;
    
    if (state.isSleeping) {
      spriteImage.className = 'pet-sprite-sheet sleep';
    } else {
      spriteImage.className = 'pet-sprite-sheet';
    }
  }

  function resetAccessory() {
    if (accessory !== 'none' && accessoryEmojis[accessory]) {
      accessoryOverlay.textContent = accessoryEmojis[accessory];
      if (['party', 'detective'].includes(accessory)) {
        accessoryOverlay.style.transform = 'translate(-50%, -100%)';
      } else if (accessory === 'scarf' || accessory === 'bowtie') {
        accessoryOverlay.style.transform = 'translate(-50%, -20%)';
      } else {
        accessoryOverlay.style.transform = 'translate(-50%, -60%)';
      }
    } else {
      accessoryOverlay.textContent = '';
    }
  }

  // Wander Loop (Walks back and forth using local walk GIF)
  let currentPosition = 50; 
  let walkInterval = null;

  function startWandering() {
    if (type === 'plant' || state.isSleeping) return;

    walkInterval = setInterval(() => {
      if (isActionBusy || state.isSleeping) return;

      const newPos = Math.floor(Math.random() * 60) + 20;
      
      let scaleX = 1;
      if (newPos < currentPosition) scaleX = -1;
      spriteImage.style.transform = `scaleX(${scaleX})`;
      
      // Swap to walk gif
      renderSprite('walk');

      currentPosition = newPos;
      spriteWrapper.style.left = `${currentPosition}%`;

      // Return to idle gif after transition finishes (1.5 seconds)
      setTimeout(() => {
        if (!isActionBusy && !state.isSleeping) {
          renderSprite('idle');
        }
      }, 1500);

    }, 8000 + Math.random() * 4000);
  }

  function stopWandering() {
    if (walkInterval) clearInterval(walkInterval);
  }

  // Interactive Actions
  let isActionBusy = false;

  function triggerAction(actionName, emojiOverlay, actionMoodText, actionKey) {
    if (isActionBusy || state.isSleeping) return;
    isActionBusy = true;

    state.lovePoints += 5;
    if (type === 'plant') {
      state.moisture = Math.min(100, state.moisture + 30);
    } else {
      if (actionName === 'feed') state.hunger = Math.min(100, state.hunger + 35);
      if (actionName === 'play') state.energy = Math.min(100, state.energy + 35);
    }
    
    saveState();
    updateUI();

    moodText.textContent = actionMoodText;
    renderSprite(actionKey);

    // Trigger action-specific overlays and animations
    if (actionName === 'feed' && type !== 'plant') {
      if (foodBowl) foodBowl.classList.add('active');
      spriteImage.style.animation = 'feedWiggle 3s ease-in-out forwards';
    } else if (actionName === 'play' && type !== 'plant') {
      const throwDir = Math.random() > 0.5 ? 'right' : 'left';
      if (toyBall) {
        toyBall.classList.add('active');
        toyBall.classList.add(`throw-${throwDir}`);
      }
      spriteImage.style.animation = 'playJump 3s ease-in-out forwards';
      
      // Instinctively turn and run in the direction of the ball!
      // Default pet faces left: scaleX(1) is Left, scaleX(-1) is Right.
      if (throwDir === 'right') {
        spriteImage.style.transform = 'scaleX(-1)'; // Face right
        spriteWrapper.style.left = '78%';
        setTimeout(() => {
          spriteImage.style.transform = 'scaleX(1)'; // Turn left to run back
          spriteWrapper.style.left = '50%';
        }, 1500);
      } else {
        spriteImage.style.transform = 'scaleX(1)'; // Face left
        spriteWrapper.style.left = '22%';
        setTimeout(() => {
          spriteImage.style.transform = 'scaleX(-1)'; // Turn right to run back
          spriteWrapper.style.left = '50%';
        }, 1500);
      }
    } else if (actionName === 'pet' && type !== 'plant') {
      if (petHand) petHand.classList.add('active');
      spriteImage.style.animation = 'petWobble 3s ease-in-out forwards';
    } else {
      // Plant action wiggles
      spriteImage.style.animation = 'bounce 0.4s 6 ease-in-out';
    }

    setTimeout(() => {
      // Reset overlays
      if (foodBowl) foodBowl.classList.remove('active');
      if (toyBall) {
        toyBall.classList.remove('active');
        toyBall.classList.remove('throw-right');
        toyBall.classList.remove('throw-left');
      }
      if (petHand) petHand.classList.remove('active');

      spriteImage.style.animation = 'none';
      spriteImage.style.transform = 'scaleX(1)';
      spriteWrapper.style.left = '50%'; // Keep in center

      renderSprite('idle');
      isActionBusy = false;
      updateUI();
    }, 3000);
  }

  btnFeed.addEventListener('click', () => {
    if (type === 'plant') {
      triggerAction("water", "💧", "Watered! 💦", "idle");
    } else {
      if (state.isSleeping) return;
      triggerAction("feed", "🍖", "Eating... 🦴", "idle");
    }
  });

  btnPlay.addEventListener('click', () => {
    if (type === 'plant') {
      triggerAction("prune", "✂️", "Trimmed! 🌿", "idle");
    } else {
      if (state.isSleeping) return;
      triggerAction("play", "⚽", "Playing! ⚽", "play");
    }
  });

  btnPet.addEventListener('click', () => {
    if (type === 'plant') {
      triggerAction("talk", "💬", "Happy! 🌱", "idle");
    } else {
      if (state.isSleeping) {
        state.isSleeping = false;
        state.energy = Math.min(100, state.energy + 15);
        saveState();
        renderSprite('idle');
        startWandering();
        updateUI();
        return;
      }
      triggerAction("pet", "💖", "Loved! ❤️", "pet");
    }
  });

  // Initial render
  updateUI();
  renderSprite('idle');
  resetAccessory();
  startWandering();

  // Background stat decay (12s)
  setInterval(() => {
    if (type === 'plant') {
      state.moisture = Math.max(0, state.moisture - 1);
    } else {
      if (state.isSleeping) {
        state.energy = Math.min(100, state.energy + 8);
        if (state.energy >= 100) {
          state.isSleeping = false;
          renderSprite('idle');
          startWandering();
        }
      } else {
        state.hunger = Math.max(0, state.hunger - 1);
        state.energy = Math.max(0, state.energy - 1);

        if (state.energy <= 0) {
          state.isSleeping = true;
          stopWandering();
          spriteWrapper.style.left = '50%';
          renderSprite('idle');
        }
      }
    }
    
    saveState();
    updateUI();
  }, 12000);
});
