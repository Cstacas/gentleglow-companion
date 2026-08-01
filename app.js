// App controller for the GentleGlow Companion Screen (Locally Hosted Assets)
document.addEventListener('DOMContentLoaded', () => {
  // 1. Parse URL Parameters
  const params = new URLSearchParams(window.location.search);
  const name = params.get('name') || 'Companion';
  const type = params.get('type') || 'dog';
  const breed = params.get('breed') || 'default';
  const accessory = params.get('acc') || 'none'; // decoration for plants, accessory for pets
  const potStyle = params.get('pot') || 'terracotta'; // plant pot style
  const startingLove = parseInt(params.get('love')) || 0;

  // 2. UI Element Bindings
  const nameLabel = document.getElementById('companion-name');
  const loveLabel = document.getElementById('love-points');
  const spriteWrapper = document.getElementById('sprite-wrapper');
  const spriteImage = document.getElementById('companion-sprite');
  const accessoryOverlay = document.getElementById('equipped-accessory');
  const loveFillBar = document.getElementById('status-bar-love');
  const moodText = document.getElementById('mood-text');

  // Plant Customization Layer Bindings
  const plantContainer = document.getElementById('plant-container');
  const plantSprite = document.getElementById('plant-sprite');
  const plantPot = document.getElementById('plant-pot');
  const plantDecor = document.getElementById('plant-decor');

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

  // Show appropriate layout container
  if (type === 'plant') {
    if (plantContainer) plantContainer.style.display = 'flex';
    if (spriteWrapper) spriteWrapper.style.display = 'none';
    
    // Plant dynamic buttons with emojis
    btnFeed.textContent = 'WATER 💦';
    btnPlay.textContent = 'PRUNE ✂️';
    btnPet.textContent = 'TALK 💬';
  } else {
    if (spriteWrapper) spriteWrapper.style.display = 'flex';
    if (plantContainer) plantContainer.style.display = 'none';
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function updateUI() {
    nameLabel.textContent = name.toUpperCase();
    
    // Customize label based on type
    if (type === 'plant') {
      loveLabel.textContent = `⭐ ${state.lovePoints.toString().padStart(3, '0')}`;
    } else {
      loveLabel.textContent = `❤️ ${state.lovePoints.toString().padStart(3, '0')}`;
    }
    
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
      const isGrown = state.lovePoints >= 100; // Mature at 100 EXP (Stage 1+)
      if (!isGrown) {
        return './images/plant_default_idle.jpg'; // seedling sprout
      }
      
      // Breed specific mature plants
      if (['cactus', 'succulent'].includes(breedClean)) {
        return './images/plant_cactus_idle.jpg';
      }
      if (['bonsai', 'fern', 'bamboo'].includes(breedClean)) {
        return './images/plant_bonsai_idle.jpg';
      }
      return './images/plant_default_idle.jpg'; // default mature plant (glow flower)
    }

    // 2. Pet Assets (Local gif files)
    const finalAction = state.isSleeping ? 'sleep' : actionKey;

    // Direct breed mappings matching exact filenames in public/images/
    if (type === 'dog') {
      if (breedClean === 'corgi') {
        const corgiAction = ['idle', 'feed', 'pet', 'play'].includes(finalAction) ? finalAction : 'idle';
        return `./images/corgi_${corgiAction}.gif`;
      }
      if (['husky', 'shiba', 'pug'].includes(breedClean)) {
        return `./images/dog_${breedClean}_${finalAction}.gif`;
      }
      return `./images/dog_default_${finalAction}.gif`;
    }

    if (type === 'cat') {
      if (breedClean === 'calico') {
        return `./images/calico_${finalAction}.gif`;
      }
      if (breedClean === 'black') {
        return `./images/black_cat_${finalAction}.gif`;
      }
      if (breedClean === 'siamese') {
        return `./images/siamese_cat_${finalAction}.gif`;
      }
      return `./images/cat_default_${finalAction}.gif`;
    }

    if (type === 'rabbit') {
      if (breedClean === 'lop') {
        return `./images/lop_rabbit_${finalAction}.gif`;
      }
      if (breedClean === 'brown') {
        return `./images/brown_rabbit_${finalAction}.gif`;
      }
      return `./images/rabbit_default_${finalAction}.gif`;
    }

    if (type === 'fox') {
      if (breedClean === 'arctic') {
        return `./images/fox_arctic_${finalAction}.gif`;
      }
      if (breedClean === 'silver') {
        return `./images/silver_fox_idle.gif`;
      }
      return `./images/fox_default_${finalAction}.gif`;
    }

    return `./images/dog_default_idle.gif`;
  }

  function renderSprite(actionKey = 'idle') {
    if (type === 'plant') {
      // Plant render logic
      plantSprite.style.backgroundImage = `url('${getLocalAssetUrl()}')`;
      
      // Calculate growth stage scale (0 = sprout, 1 = medium, 2 = mature, 3 = bloomed)
      let scaleVal = 0.55; // default sprout (Stage 0, < 100 EXP)
      if (state.lovePoints >= 500) {
        scaleVal = 1.0;  // Stage 3 Bloomed (>= 500 EXP)
      } else if (state.lovePoints >= 300) {
        scaleVal = 0.9;  // Stage 2 Mature (300-499 EXP)
      } else if (state.lovePoints >= 100) {
        scaleVal = 0.75; // Stage 1 Medium (100-299 EXP)
      }
      plantSprite.style.transform = `scale(${scaleVal})`;
      
      // Load pot and decorations
      if (plantPot) {
        plantPot.className = `plant-pot-layer ${potStyle}`;
      }
      if (plantDecor) {
        plantDecor.className = `plant-decor-layer ${accessory}`; // accessory parameter carries plant.decor!
      }
    } else {
      // Pet render logic
      spriteImage.style.backgroundImage = `url('${getLocalAssetUrl(actionKey)}')`;
      
      if (state.isSleeping) {
        spriteImage.className = 'pet-sprite-sheet sleep';
      } else if (actionKey === 'walk') {
        spriteImage.className = 'pet-sprite-sheet walk';
      } else {
        spriteImage.className = 'pet-sprite-sheet';
      }

      // Render pixel accessory overlay classes
      if (accessoryOverlay) {
        if (accessory !== 'none') {
          accessoryOverlay.className = `accessory-overlay ${accessory}`;
        } else {
          accessoryOverlay.className = 'accessory-overlay none';
        }
      }
    }
  }

  // Wander Loop (Walks back and forth using local walk GIF)
  let currentPosition = 50; 
  let currentScaleX = 1;
  let walkInterval = null;

  function startWandering() {
    if (type === 'plant' || state.isSleeping) return;

    walkInterval = setInterval(() => {
      if (isActionBusy || state.isSleeping) return;

      const newPos = Math.floor(Math.random() * 60) + 20;
      
      const breedClean = breed.toLowerCase();
      const isDogOrFox = (type === 'dog' && breedClean !== 'pug') || type === 'fox';
      if (newPos < currentPosition) {
        // Walking to the left: face left
        currentScaleX = isDogOrFox ? -1 : 1;
      } else {
        // Walking to the right: face right
        currentScaleX = isDogOrFox ? 1 : -1;
      }
      
      spriteImage.style.setProperty('--scale-direction', currentScaleX);
      spriteImage.style.transform = `scaleX(${currentScaleX})`;
      
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

    const activeSprite = type === 'plant' ? plantSprite : spriteImage;

    // Determine default breed facing orientation
    const breedClean = breed.toLowerCase();
    const isDogOrFox = (type === 'dog' && breedClean !== 'pug') || type === 'fox';
    const faceRightScale = isDogOrFox ? 1 : -1;
    const faceLeftScale = isDogOrFox ? -1 : 1;

    // Trigger action-specific overlays and animations
    if (actionName === 'feed' && type !== 'plant') {
      if (foodBowl) foodBowl.classList.add('active');
      
      // Face right (towards the food bowl)
      activeSprite.style.setProperty('--scale-direction', faceRightScale);
      activeSprite.style.transform = `scaleX(${faceRightScale})`;
      activeSprite.style.animation = 'feedWiggle 3s ease-in-out forwards';
    } else if (actionName === 'play' && type !== 'plant') {
      const throwDir = Math.random() > 0.5 ? 'right' : 'left';
      if (toyBall) {
        toyBall.classList.add('active');
        toyBall.classList.add(`throw-${throwDir}`);
      }
      
      // Face initial throw direction
      const initialScale = throwDir === 'right' ? faceRightScale : faceLeftScale;
      const returnScale = throwDir === 'right' ? faceLeftScale : faceRightScale;
      
      activeSprite.style.setProperty('--scale-direction', initialScale);
      activeSprite.style.transform = `scaleX(${initialScale})`;
      activeSprite.style.animation = 'playJump 3s ease-in-out forwards';
      
      if (throwDir === 'right') {
        spriteWrapper.style.left = '78%';
        setTimeout(() => {
          activeSprite.style.setProperty('--scale-direction', returnScale);
          activeSprite.style.transform = `scaleX(${returnScale})`;
          spriteWrapper.style.left = '50%';
        }, 1500);
      } else {
        spriteWrapper.style.left = '22%';
        setTimeout(() => {
          activeSprite.style.setProperty('--scale-direction', returnScale);
          activeSprite.style.transform = `scaleX(${returnScale})`;
          spriteWrapper.style.left = '50%';
        }, 1500);
      }
    } else if (actionName === 'pet' && type !== 'plant') {
      if (petHand) petHand.classList.add('active');
      activeSprite.style.setProperty('--scale-direction', currentScaleX);
      activeSprite.style.transform = `scaleX(${currentScaleX})`;
      activeSprite.style.animation = 'petWobble 3s ease-in-out forwards';
    } else {
      // Plant action wiggles
      activeSprite.style.animation = 'bounce 0.4s 6 ease-in-out';
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

      activeSprite.style.animation = 'none';
      activeSprite.style.setProperty('--scale-direction', 1);
      activeSprite.style.transform = 'scaleX(1)';
      currentScaleX = 1;
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
