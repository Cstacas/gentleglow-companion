// App controller for the GentleGlow Companion Screen (Locally Hosted Assets)
document.addEventListener('DOMContentLoaded', () => {
  // 1. Parse URL Parameters
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('userId');
  const supabaseKey = params.get('supabaseKey');
  const supabaseUrl = 'https://pypusvqrpunviqbwdrvu.supabase.co';

  let name = params.get('name') || 'Companion';
  let type = params.get('type') || 'dog';
  let breed = params.get('breed') || 'default';
  let accessory = params.get('acc') || 'none'; // decoration for plants, accessory for pets
  let potStyle = params.get('pot') || 'terracotta'; // plant pot style
  let startingLove = parseInt(params.get('love')) || 0;

  // 2. UI Element Bindings
  const nameLabel = document.getElementById('companion-name');
  const loveLabel = document.getElementById('love-points');
  const spriteWrapper = document.getElementById('sprite-wrapper');
  const spriteImage = document.getElementById('companion-sprite');
  const petCharacter = document.getElementById('pet-character-container');
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
      console.warn('Failed to parse save data');
    }
  }

  // Load data from Supabase if userId and supabaseKey are provided
  if (userId && supabaseKey && window.supabase) {
    const { createClient } = window.supabase;
    const client = createClient(supabaseUrl, supabaseKey);

    async function loadSupabaseData() {
      try {
        if (type === 'plant') {
          const { data, error } = await client
            .from('virtual_plants')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (error) throw error;
          if (data) {
            name = data.plant_type || 'Plant';
            breed = data.plant_type || 'default';
            potStyle = data.pot_style || 'terracotta';
            accessory = data.decor || 'none';
            state.lovePoints = data.experience || 0;
            
            // Customize button labels for plants
            if (plantContainer) plantContainer.style.display = 'flex';
            if (spriteWrapper) spriteWrapper.style.display = 'none';
            btnFeed.textContent = 'WATER 💦';
            btnPlay.textContent = 'PRUNE ✂️';
            btnPet.textContent = 'TALK 💬';

            updateUI();
            renderSprite();
          }
        } else {
          const { data, error } = await client
            .from('virtual_pets')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (error) throw error;
          if (data) {
            name = data.pet_name || 'Companion';
            type = data.pet_type || 'dog';
            breed = data.breed || 'default';
            accessory = data.accessory || 'none';
            state.lovePoints = data.love || 0;

            if (spriteWrapper) spriteWrapper.style.display = 'flex';
            if (plantContainer) plantContainer.style.display = 'none';

            updateUI();
            renderSprite();
          }
        }
      } catch (err) {
        console.error('Failed to load from Supabase:', err.message);
      }
    }
    
    loadSupabaseData();
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
    let breedClean = breed.toLowerCase();

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
    if (breedClean === 'default' || breedClean === 'corgi' || breedClean === 'shiba') {
      if (type === 'dog') breedClean = 'golden';
    }
    if (breedClean === 'black' || breedClean === 'siamese') {
      if (type === 'cat') breedClean = 'standard';
    }
    if (breedClean === 'lop') {
      if (type === 'rabbit') breedClean = 'bunny_32pixel';
    }
    if (breedClean === 'default') {
      if (type === 'cat') breedClean = 'standard';
      if (type === 'rabbit') breedClean = 'bunny_32pixel';
      if (type === 'parrot') breedClean = 'red';
    }
    const finalAction = state.isSleeping ? 'sleep' : actionKey;
    return `./images/${type}_${breedClean}_${finalAction}.gif`;
  }

  function renderSprite(actionKey = 'idle') {
    if (type === 'plant') {
      // Plant render logic
      plantSprite.style.backgroundImage = `url('${getLocalAssetUrl()}?v=39')`;
      
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
      spriteImage.style.backgroundImage = `url('${getLocalAssetUrl(actionKey)}?v=39')`;
      
      const sleepZzz = document.getElementById('sleep-zzz');
      if (state.isSleeping) {
        spriteImage.className = 'pet-sprite-sheet sleep';
        if (petCharacter) petCharacter.className = 'pet-character-container sleep';
        if (sleepZzz) sleepZzz.classList.add('active');
      } else if (actionKey === 'walk') {
        spriteImage.className = 'pet-sprite-sheet walk';
        if (petCharacter) petCharacter.className = 'pet-character-container walk';
        if (sleepZzz) sleepZzz.classList.remove('active');
      } else {
        spriteImage.className = 'pet-sprite-sheet idle';
        if (petCharacter) petCharacter.className = 'pet-character-container idle';
        if (sleepZzz) sleepZzz.classList.remove('active');
      }

      // Render pixel accessory overlay classes
      if (accessoryOverlay) {
        if (accessory !== 'none') {
          accessoryOverlay.className = `accessory-overlay ${accessory}`;
          
          const breedClean = breed.toLowerCase();
          const pType = type.toLowerCase();
          
          // Determine breed-specific offsets dynamically
          let leftVal = '50%';
          let topVal = '80px';
          
          if (pType === 'dog') {
            if (breedClean === 'corgi') {
              // Corgis are very short and face right
              if (accessory === 'party' || accessory === 'detective') {
                leftVal = '70%';
                topVal = accessory === 'party' ? '88px' : '97px';
              } else if (accessory === 'glasses') {
                leftVal = '74%';
                topVal = '102px';
              } else {
                leftVal = '68%'; // Shifted forward to neck
                topVal = '104px'; // Shifted up to collar
              }
            } else if (breedClean === 'pug') {
              // Pugs are short and front-facing (centered)
              if (accessory === 'party' || accessory === 'detective') {
                leftVal = '50%';
                topVal = accessory === 'party' ? '82px' : '91px';
              } else if (accessory === 'glasses') {
                leftVal = '50%';
                topVal = '96px';
              } else {
                leftVal = '50%';
                topVal = '104px'; // Shifted up to collar
              }
            } else if (breedClean === 'shiba') {
              // Shibas are medium-short and face right
              if (accessory === 'party' || accessory === 'detective') {
                leftVal = '72%';
                topVal = accessory === 'party' ? '74px' : '83px';
              } else if (accessory === 'glasses') {
                leftVal = '76%';
                topVal = '90px';
              } else {
                leftVal = '70%'; // Shifted forward to neck
                topVal = '96px';  // Shifted up to collar
              }
            } else {
              // Standard tall dogs (golden, husky, pharaoh, etc.) face right
              if (accessory === 'party' || accessory === 'detective') {
                leftVal = '72%';
                topVal = accessory === 'party' ? '67px' : '76px';
              } else if (accessory === 'glasses') {
                leftVal = '78%';
                topVal = '82px';
              } else {
                leftVal = '70%'; // Shifted forward to neck
                topVal = '88px';  // Shifted up to collar
              }
            }
          } else if (pType === 'cat') {
            if (breedClean === 'egypt') {
              // Egyptian cats are sitting and are taller
              if (accessory === 'party' || accessory === 'detective') {
                leftVal = '72%'; // Right facing head
                topVal = accessory === 'party' ? '46px' : '55px';
              } else if (accessory === 'glasses') {
                leftVal = '78%'; // Right facing eyes
                topVal = '68px';
              } else {
                leftVal = '70%'; // Right facing neck
                topVal = '78px';
              }
            } else if (breedClean === 'space') {
              // Space cats have a bulky space helmet
              if (accessory === 'party' || accessory === 'detective') {
                leftVal = '72%'; // Right facing head
                topVal = accessory === 'party' ? '52px' : '61px';
              } else if (accessory === 'glasses') {
                leftVal = '78%'; // Right facing eyes
                topVal = '74px';
              } else {
                leftVal = '70%'; // Right facing neck
                topVal = '88px';
              }
            } else {
              // Standard cats (standard, calico, tiger, batman, retro, pixel) face right
              if (accessory === 'party' || accessory === 'detective') {
                leftVal = '72%'; // Right facing head
                topVal = accessory === 'party' ? '61px' : '70px';
              } else if (accessory === 'glasses') {
                leftVal = '78%', topVal = '76px'; // Right facing eyes
              } else {
                leftVal = '70%'; // Right facing neck
                topVal = '86px';
              }
            }
          } else if (pType === 'rabbit') {
            // Standard rabbits face left (short and ears are high)
            if (accessory === 'party' || accessory === 'detective') {
              leftVal = '28%';
              topVal = accessory === 'party' ? '77px' : '86px';
            } else if (accessory === 'glasses') {
              leftVal = '22%';
              topVal = '90px';
            } else {
              leftVal = '30%'; // Shifted forward to neck
              topVal = '98px';  // Shifted up to collar
            }
          } else if (pType === 'fox') {
            // Standard foxes face right
            if (accessory === 'party' || accessory === 'detective') {
              leftVal = '72%';
              topVal = accessory === 'party' ? '65px' : '74px';
            } else if (accessory === 'glasses') {
              leftVal = '78%';
              topVal = '80px';
            } else {
              leftVal = '70%'; // Shifted forward to neck
              topVal = '88px';  // Shifted up to collar
            }
          } else if (pType === 'parrot') {
            // Standard parrots face left
            if (accessory === 'party' || accessory === 'detective') {
              leftVal = '28%';
              topVal = accessory === 'party' ? '53px' : '62px';
            } else if (accessory === 'glasses') {
              leftVal = '22%';
              topVal = '68px';
            } else {
              leftVal = '30%'; // Shifted forward to neck
              topVal = '76px';  // Shifted up to collar
            }
          } else if (pType === 'turtle') {
            // Standard flat turtles face left
            if (accessory === 'party' || accessory === 'detective') {
              leftVal = '28%';
              topVal = accessory === 'party' ? '95px' : '104px';
            } else if (accessory === 'glasses') {
              leftVal = '22%';
              topVal = '106px';
            } else {
              leftVal = '30%'; // Shifted forward to neck
              topVal = '110px'; // Shifted up to collar
            }
          } else if (pType === 'panda') {
            // Standard pandas (front-facing / centered)
            if (accessory === 'party' || accessory === 'detective') {
              leftVal = '50%';
              topVal = accessory === 'party' ? '65px' : '74px';
            } else if (accessory === 'glasses') {
              leftVal = '50%';
              topVal = '78px';
            } else {
              leftVal = '50%';
              topVal = '88px';  // Shifted up to collar
            }
          } else if (pType === 'ghost') {
            // Standard floating ghosts (front-facing / centered)
            if (accessory === 'party' || accessory === 'detective') {
              leftVal = '50%';
              topVal = accessory === 'party' ? '49px' : '58px';
            } else if (accessory === 'glasses') {
              leftVal = '50%';
              topVal = '64px';
            } else {
              leftVal = '50%';
              topVal = '74px';  // Shifted up to collar
            }
          }
          
          accessoryOverlay.style.left = leftVal;
          accessoryOverlay.style.top = topVal;
        } else {
          accessoryOverlay.className = 'accessory-overlay none';
          accessoryOverlay.style.left = '';
          accessoryOverlay.style.top = '';
        }
      }
    }
  }

  // Wander Loop (Walks back and forth using local walk GIF)
let currentPosition = 50; 
let currentScaleX = 1;
let wanderTimeout = null;

function startWandering() {
  if (type === 'plant' || state.isSleeping) return;

  // Schedule next walk in 12 to 24 seconds to let the pet stand still (idle) longer
  const delay = Math.floor(Math.random() * 12000) + 12000;
  wanderTimeout = setTimeout(() => {
    if (isActionBusy || state.isSleeping) {
      startWandering();
      return;
    }

    const newPos = Math.floor(Math.random() * 60) + 20;
    
    const breedClean = breed.toLowerCase();
    const facesRightByDefault = (type === 'dog' && breedClean !== 'pug') || type === 'fox' || type === 'cat';
    if (newPos < currentPosition) {
      // Walking to the left: face left
      currentScaleX = facesRightByDefault ? -1 : 1;
    } else {
      // Walking to the right: face right
      currentScaleX = facesRightByDefault ? 1 : -1;
    }
    
    if (petCharacter) {
      petCharacter.style.setProperty('--scale-direction', currentScaleX);
      petCharacter.style.transform = `scaleX(${currentScaleX})`;
    }
    
    // Swap to walk gif
    renderSprite('walk');

    currentPosition = newPos;
    spriteWrapper.style.left = `${currentPosition}%`;

    // Return to idle gif after transition finishes (1.5 seconds)
    setTimeout(() => {
      if (!isActionBusy && !state.isSleeping) {
        renderSprite('idle');
      }
      startWandering();
    }, 1500);

  }, delay);
}

function stopWandering() {
  if (wanderTimeout) clearTimeout(wanderTimeout);
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

    const activeSprite = type === 'plant' ? plantSprite : petCharacter;

    // Determine default breed facing orientation
    const breedClean = breed.toLowerCase();
    const facesRightByDefault = (type === 'dog' && breedClean !== 'pug') || type === 'fox' || type === 'cat';
    const faceRightScale = facesRightByDefault ? 1 : -1;
    const faceLeftScale = facesRightByDefault ? -1 : 1;

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
      if (petHand) {
        if (breedClean === 'corgi') {
          petHand.classList.add('corgi-pet');
        } else {
          petHand.classList.remove('corgi-pet');
        }
        petHand.classList.add('active');
      }
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
      if (petHand) {
        petHand.classList.remove('active');
        petHand.classList.remove('corgi-pet');
      }

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
      triggerAction("feed", "🍖", "Eating... 🦴", "feed");
    }
  });

  btnPlay.addEventListener('click', () => {
    if (type === 'plant') {
      triggerAction("prune", "✂️", "Pruned! 🌸", "idle");
    } else {
      if (state.isSleeping) return;
      triggerAction("play", "⚽", "Playing! 🥎", "play");
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
