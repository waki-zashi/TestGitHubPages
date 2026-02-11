import { state } from "./state.js";
import { scenes } from "./scenes.js";
import { startParticles, stopParticles } from "./particles.js";

const backgroundEl = document.getElementById("background");
const textEl = document.getElementById("text");
const choicesEl = document.getElementById("choices");
const gradientEl = document.getElementById("choice-gradient");
const fadeEl = document.getElementById("fade-layer");
const choiceLeftEl = document.getElementById("choice-left");
const choiceRightEl = document.getElementById("choice-right");
const dialogueBox = document.getElementById("dialogue-box");
const dialogueTextEl = document.getElementById("dialogue-text");

let itemStarParticles = [];
let itemStarFrame = null;

function renderNarration(scene) {
  textEl.innerHTML = "";
  scene.text[state.textIndex].forEach(line => {
    const p = document.createElement("p");
    p.textContent = line;
    textEl.appendChild(p);
  });
}

function renderDialogue(scene) {
  dialogueTextEl.innerHTML = "";
  scene.text[state.textIndex].forEach(line => {
    const p = document.createElement("p");
    p.textContent = line;
    dialogueTextEl.appendChild(p);
  });
}

function renderScene(sceneId, fromHistory = false) {
  if (state.disableMouseChoice) {
    state.disableMouseChoice();
    state.disableMouseChoice = null;
  }

  if (state.choiceTimeout) clearTimeout(state.choiceTimeout);
  if (state.introTimeout) {
    clearTimeout(state.introTimeout);
    state.introTimeout = null;
  }
  if (state.introFadeTimeout) {
    clearTimeout(state.introFadeTimeout);
    state.introFadeTimeout = null;
  }

  const scene = scenes[sceneId];

  if (scene.type === "ending") {
    renderEnding(scene);
    return;
  }

  if (!fromHistory && state.currentScene) {
    state.history.push(state.currentScene);
  }

  state.currentScene = sceneId;
  state.textIndex = 0;
  state.isTextStarted = false;
  state.waitingForChoice = false;
  state.choiceReady = false;
  state.introTimeout = null;

  textEl.innerHTML = "";
  if (dialogueTextEl) {
    dialogueTextEl.innerHTML = "";
  }

  const textBox = document.getElementById("text-box");
  const dialogueBox = document.getElementById("dialogue-box");

  if (textBox) textBox.classList.remove("visible");
  if (dialogueBox) dialogueBox.classList.remove("visible");

  const endingOverlay = document.getElementById("ending-overlay");
  if (endingOverlay) endingOverlay.classList.remove("active");

  if (scene.particles) {
    startParticles(scene.particles);
  } else {
    stopParticles();
  }

  const introOverlay = document.getElementById("intro-overlay");

  // ✅ ВАЖНО: загружаем фон ДО начала сцены
  const bgImage = new Image();
  bgImage.src = scene.background;

  bgImage.onload = () => {
    backgroundEl.style.backgroundImage = `url(${scene.background})`;

    // Только после полной загрузки убираем fade
    fadeEl.classList.add("active");
    setTimeout(() => fadeEl.classList.remove("active"), 50);
  };

  bgImage.onerror = () => {
    backgroundEl.style.backgroundImage = `url(${scene.background})`;
    fadeEl.classList.add("active");
    setTimeout(() => fadeEl.classList.remove("active"), 50);
  };

  if (scene.introImage) {
    if (textBox) {
      textBox.classList.remove("visible");
      textBox.style.display = "none";
    }

    if (introOverlay) {
      const img = document.getElementById("intro-full-image");
      if (img) {
        img.src = scene.introImage;
        introOverlay.classList.add("active");
        introOverlay.style.opacity = "1";
      }

      const showDuration = scene.showDuration || 4500;
      const fadeOutDuration = 500;
      const navIdAtSchedule = state.navId;
      const expectedSceneId = sceneId;

      state.introTimeout = setTimeout(() => {
        if (state.navId !== navIdAtSchedule) return;
        if (state.currentScene !== expectedSceneId) return;

        state.introTimeout = null;
        introOverlay.style.opacity = "0";
        state.introFadeTimeout = setTimeout(() => {
          state.introFadeTimeout = null;
          if (state.navId !== navIdAtSchedule) return;
          if (state.currentScene !== expectedSceneId) return;

          introOverlay.classList.remove("active");
          transitionToScene(scene.next || "scene_2");
        }, fadeOutDuration);
      }, showDuration);
    }

    return;
  }

  if (scene.minigame === "sleep" && !state.sleepGameCompleted) {
    if (textBox) textBox.classList.remove("visible");
    if (dialogueBox) dialogueBox.classList.remove("visible");

    bgImage.onload = () => {
      backgroundEl.style.backgroundImage = `url(${scene.background})`;
      startSleepGame();
    };

    return;
  }

  if (scene.minigame === "dogs" && !state.dogsGameCompleted) {
    startDogsGame();
    return;
  }

  if (scene.minigame === "evidence" && !state.evidenceGameCompleted) {
    if (textBox) textBox.classList.remove("visible");
    if (dialogueBox) dialogueBox.classList.remove("visible");

    bgImage.onload = () => {
      backgroundEl.style.backgroundImage = `url(${scene.background})`;
      startEvidenceGame(scene);
    };

    return;
  }

  if (textBox) {
    textBox.style.display = "block";
    textBox.classList.remove("visible");
  }

  if (introOverlay) {
    introOverlay.classList.remove("active");
    introOverlay.style.opacity = "0";
  }
}

function skipIntro() {
  const introOverlay = document.getElementById("intro-overlay");
  if (!introOverlay || !introOverlay.classList.contains("active")) return;

  if (state.introTimeout) {
    clearTimeout(state.introTimeout);
    state.introTimeout = null;
  }

  const scene = scenes[state.currentScene];
  const nextScene = scene?.next || "scene_2";
  const fadeOutDuration = 500;

  introOverlay.style.opacity = "0";
  setTimeout(() => {
    introOverlay.classList.remove("active");
    transitionToScene(nextScene);
  }, fadeOutDuration);
}

function nextStep() {
  if (state.isTransitioning) return;
  if (state.sleepGame.active) return;
  if (state.dogsGame.active) return;

  const scene = scenes[state.currentScene];
  if (!scene) return;
  if (!scene || scene.type === "ending") return;

  if (scene.introImage) return;
  if (!scene.text || !scene.text[state.textIndex]) return;

  if (state.isItemShowing) {
    hideItem();

    const scene = scenes[state.currentScene];
    if (scene?.next) {
      transitionToScene(scene.next);
    }
    return;
  }


  // Первый шаг — показываем текст (обычный или диалоговый)
  if (!state.isTextStarted) {
    state.isTextStarted = true;

    const isDialogue = scene.dialogueIndexes?.includes(state.textIndex) ?? false;

    const textBox = document.getElementById("text-box");     // на всякий случай берём заново

    if (isDialogue) {
      dialogueBox?.classList.add("visible");
      textBox?.classList.remove("visible");
      renderDialogue(scene);
    } else {
      textBox?.classList.add("visible");
      dialogueBox?.classList.remove("visible");
      renderNarration(scene);
    }
    return;
  }

  // Последующие шаги — переключаем блоки текста
  if (state.textIndex < scene.text.length - 1) {
    state.textIndex++;

    const isDialogue = scene.dialogueIndexes?.includes(state.textIndex) ?? false;

    const textBox = document.getElementById("text-box");

    if (isDialogue) {
      dialogueBox?.classList.add("visible");
      textBox?.classList.remove("visible");
      renderDialogue(scene);
    } else {
      textBox?.classList.add("visible");
      dialogueBox?.classList.remove("visible");
      renderNarration(scene);
    }
    return;
  }

  // Если текст закончился — идём дальше по обычной логике
  if (state.waitingForChoice && scene.choices) {
    revealChoices(scene);
    return;
  }

  if (scene.choices && !state.choiceReady) {
    showChoicesWithDelay(scene);
    return;
  }

  if (scene.item && !state.isItemShowing) {
    showItem(scene.item);
    return;
  }

  if (scene.next) {
    transitionToScene(scene.next);
  }
}

function goBack() {
  if (state.isTransitioning || state.history.length === 0) return;

  const previousScene = state.history.pop();
  transitionToScene(previousScene, true);
}

function showChoicesWithDelay(scene) {
  state.waitingForChoice = true;
  state.choiceReady = false;

  const delay = scene.choiceDelay ?? 0;

  state.choiceTimeout = setTimeout(() => {
    revealChoices(scene);
  }, delay);
}

function revealChoices(scene) {
  if (state.choiceTimeout) {
    clearTimeout(state.choiceTimeout);
    state.choiceTimeout = null;
  }

  if (state.choiceReady) return;

  state.waitingForChoice = false;
  state.choiceReady = true;

  choiceLeftEl.textContent = scene.choices.left?.label ?? "";
  choiceRightEl.textContent = scene.choices.right?.label ?? "";

  choiceLeftEl.classList.add("active");
  choiceRightEl.classList.add("active");

  enableMouseChoice(scene);
}

function enableMouseChoice(scene) {
  function onMouseMove(e) {
    const half = window.innerWidth / 2;
    if (e.clientX < half) {
      gradientEl.className = "left";
    } else {
      gradientEl.className = "right";
    }
  }

  function onClick(e) {
    const half = window.innerWidth / 2;
    if (e.clientX < half) {
      if (scene.choices.left) {
        disableMouseChoice();
        transitionToScene(scene.choices.left.next);
      }
    } else {
      if (scene.choices.right) {
        disableMouseChoice();
        transitionToScene(scene.choices.right.next);
      }
    }
  }

  function disableMouseChoice() {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("click", onClick);
    gradientEl.className = "";

    choiceLeftEl.classList.remove("active");
    choiceRightEl.classList.remove("active");
  }

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("click", onClick);

  state.disableMouseChoice = disableMouseChoice;
}

function transitionToScene(sceneId, fromHistory = false) {
  // Cancel any pending transition callback so only the latest navigation wins.
  if (state.transitionTimeout) {
    clearTimeout(state.transitionTimeout);
    state.transitionTimeout = null;
  }

  // Bump navigation id so old timers can detect they're stale.
  state.navId = (state.navId ?? 0) + 1;
  const navIdAtSchedule = state.navId;

  state.isTransitioning = true;

  const introOverlay = document.getElementById("intro-overlay");
  if (introOverlay && introOverlay.classList.contains("active")) {
    introOverlay.style.opacity = "0";
    setTimeout(() => {
      introOverlay.classList.remove("active");
    }, 800);
  }

  if (state.introTimeout) {
    clearTimeout(state.introTimeout);
    state.introTimeout = null;
  }
  if (state.introFadeTimeout) {
    clearTimeout(state.introFadeTimeout);
    state.introFadeTimeout = null;
  }

  fadeEl.classList.add("active");

  state.transitionTimeout = setTimeout(() => {
    // If another navigation happened, ignore this callback.
    if (state.navId !== navIdAtSchedule) return;

    state.transitionTimeout = null;
    renderScene(sceneId, fromHistory);
    fadeEl.classList.remove("active");
    state.isTransitioning = false;
  }, 1000);
}

function showIntroImage(src, duration = 1500) {
  const container = document.getElementById("intro-image-container");
  const img = document.getElementById("intro-image");
  
  img.src = src;
  container.style.display = "block";
  
  setTimeout(() => {
    img.style.opacity = "1";
  }, 100);
}

function showItem(item) {
  const overlay = document.getElementById("item-overlay");
  const img = document.getElementById("item-image");
  const aura = document.querySelector(".item-aura");

  img.src = item.image;
  aura.src = item.aura;     // PNG из Figma

  overlay.classList.add("active");
  state.isItemShowing = true;

  startItemStars();
}


function hideItem() {
  document.getElementById("item-overlay")?.classList.remove("active");
  stopItemStars();
  state.isItemShowing = false;
}


function startItemStars() {
  const canvas = document.getElementById("item-stars");
  const ctx = canvas.getContext("2d");

  const size = 300;
  canvas.width = size;
  canvas.height = size;

  itemStarParticles = [];

  function spawn() {
    itemStarParticles.push({
      x: size / 2,
      y: size / 2,
      angle: Math.random() * Math.PI * 2,
      speed: 0.2 + Math.random() * 0.4,   // 🔧 скорость
      radius: 2 + Math.random() * 2,      // 🔧 размер
      life: 100,                          // 🔧 жизнь
      maxLife: 100
    });
  }

  function update() {
    ctx.clearRect(0, 0, size, size);

    if (Math.random() < 0.15) spawn();   // 🔧 частота

    itemStarParticles.forEach(p => {
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      p.life--;

      const alpha = p.life / p.maxLife;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    });

    itemStarParticles = itemStarParticles.filter(p => p.life > 0);

    itemStarFrame = requestAnimationFrame(update);
  }

  update();
}

function stopItemStars() {
  if (itemStarFrame) {
    cancelAnimationFrame(itemStarFrame);
    itemStarFrame = null;
  }
}

function startSleepGame() {
  const game = state.sleepGame;

  game.active = true;
  game.darkness = 0;
  game.speed = 0.005;
  game.elapsed = 0;

  const overlay = document.getElementById("sleep-game-overlay");
  overlay.style.display = "block";

  const instruction = document.getElementById("sleep-instruction");
  instruction.style.opacity = "1";
  instruction.style.pointerEvents = "none"; // на всякий случай
  document.getElementById("sleep-buttons").style.display = "none";

  loopSleepGame();
}

function loopSleepGame(timestamp) {
  const game = state.sleepGame;
  if (!game.active) return;

  game.elapsed += 16;
  game.darkness += game.speed;

  updateSleepVisuals();

  // ускорение
  game.speed += 0.00002;

  if (game.darkness >= 1) {
    loseSleepGame();
    return;
  }

  if (game.elapsed >= game.duration) {
    winSleepGame();
    return;
  }

  game.raf = requestAnimationFrame(loopSleepGame);
}

function updateSleepVisuals() {
  const game = state.sleepGame;

  const darkness = document.getElementById("sleep-darkness");
  darkness.style.opacity = game.darkness;

  if (game.darkness >= 0.5) {
    const progress = (game.darkness - 0.5) * 2;

    document.getElementById("sleep-eyelid-top")
      .style.transform = `translateY(${(-100 + progress * 100)}%)`;

    document.getElementById("sleep-eyelid-bottom")
      .style.transform = `translateY(${(100 - progress * 100)}%)`;
  }
}

function loseSleepGame() {
  const game = state.sleepGame;
  game.active = false;
  cancelAnimationFrame(game.raf);

  game.attempts++;

  const fail = document.getElementById("sleep-fail");
  fail.style.display = "flex";

  // Показываем кнопки внизу
  document.getElementById("sleep-buttons").style.display = "flex";

  // скрываем инструкцию
  document.getElementById("sleep-instruction").style.opacity = "0";

  // Если уже 2+ попытки — можно оставить только "Пропустить", но пока оставим обе
}

function winSleepGame() {
  const game = state.sleepGame;
  game.active = false;
  cancelAnimationFrame(game.raf);

  state.sleepGameCompleted = true;

  closeSleepGame();

  // после победы запускаем обычный текст сцены
  nextStep();
}

function closeSleepGame() {
  const overlay = document.getElementById("sleep-game-overlay");
  overlay.style.display = "none";

  const instruction = document.getElementById("sleep-instruction");
  instruction.style.opacity = "0";   // ← скрываем

  state.sleepGame.darkness = 0;
  document.getElementById("sleep-darkness").style.opacity = 0;
  document.getElementById("sleep-eyelid-top").style.transform = "translateY(-100%)";
  document.getElementById("sleep-eyelid-bottom").style.transform = "translateY(100%)";

  document.getElementById("sleep-fail").style.display = "none";
  document.getElementById("sleep-buttons").style.display = "none";
  document.getElementById("sleep-fail").style.display = "none";
}

function startDogsGame() {
  const game = state.dogsGame;

  game.active = true;
  game.elapsed = 0;

  game.dogs.forEach(d => d.rage = 0);

  const overlay = document.getElementById("dogs-game-overlay");
  overlay.style.display = "block";

  // Показываем надпись
  const instruction = document.getElementById("dogs-instruction");
  instruction.style.opacity = "1";
  instruction.style.pointerEvents = "none";

  // Скрываем кнопки и fail на старте
  document.getElementById("dogs-buttons").style.display = "none";
  document.getElementById("dogs-fail").style.display = "none";

  loopDogsGame();
}

function loopDogsGame() {
  const game = state.dogsGame;
  if (!game.active) return;

  game.elapsed += 16;

  game.dogs.forEach(dog => {
    dog.rage += game.ragePerSecond * 0.016;
  });

  updateDogsVisuals();

  // проигрыш если кто-то достиг максимума
  if (game.dogs.some(d => d.rage >= game.maxRage)) {
    loseDogsGame();
    return;
  }

  // победа по таймеру
  if (game.elapsed >= game.duration) {
    winDogsGame();
    return;
  }

  game.raf = requestAnimationFrame(loopDogsGame);
}

function updateDogsVisuals() {
  document.querySelectorAll(".dog-zone").forEach((zone, index) => {
    const circle = zone.querySelector(".dog-rage");
    const rage = state.dogsGame.dogs[index].rage;

    const scale = Math.min(rage / state.dogsGame.maxRage, 1);
    circle.style.transform = `scale(${scale})`;
    circle.style.opacity = 0.3 + scale * 0.4;
  });
}

function loseDogsGame() {
  const game = state.dogsGame;
  game.active = false;
  cancelAnimationFrame(game.raf);

  game.attempts++;

  document.getElementById("dogs-fail").style.display = "flex";
  document.getElementById("dogs-buttons").style.display = "flex";

  // Скрываем надпись при проигрыше
  document.getElementById("dogs-instruction").style.opacity = "0";
}

function winDogsGame() {
  const game = state.dogsGame;
  game.active = false;
  cancelAnimationFrame(game.raf);

  state.dogsGameCompleted = true;
  closeDogsGame();
  nextStep();
}

function closeDogsGame() {
  const overlay = document.getElementById("dogs-game-overlay");
  overlay.style.display = "none";

  document.getElementById("dogs-fail").style.display = "none";
  document.getElementById("dogs-buttons").style.display = "none";

  // Скрываем надпись при завершении
  document.getElementById("dogs-instruction").style.opacity = "0";
}

function startEvidenceGame(scene) {
  const game = state.evidenceGame;
  game.active = true;
  game.hotspotsFound = 0;
  game.currentDesc = null;

  const overlay = document.getElementById("evidence-game-overlay");
  overlay.style.display = "block";
  overlay.classList.add("active");

  const instruction = document.getElementById("evidence-instruction");
  instruction.style.opacity = "1";

  const hotspotsContainer = document.getElementById("evidence-hotspots");
  hotspotsContainer.innerHTML = ""; // очистка

  // Пример 5 улик — координаты и описания задавай в сцене или здесь
  const hotspots = scene.evidenceHotspots || [
    { x: "25%", y: "40%", desc: "Выбитая калитка. Её выбили ногой одним точным ударом." },
    { x: "45%", y: "55%", desc: "Множественные грязные следы. Группа преступников шла от посадок." },
    { x: "60%", y: "35%", desc: "Сломанные ветви и листья с кровью. Жертву убили в зарослях." },
    { x: "70%", y: "65%", desc: "Кошелёк и телефон у калитки. Убийцы поняли, что убили не того." },
    { x: "85%", y: "50%", desc: "Приоткрытая дверь гаража. Рядом лежит балаклава." }
  ];

  hotspots.forEach((spot, index) => {
    const el = document.createElement("div");
    el.className = "evidence-hotspot";
    el.style.left = spot.x;
    el.style.top = spot.y;
    el.dataset.index = index;

    el.onclick = () => {
      showEvidenceDesc(spot.desc, index);
    };

    hotspotsContainer.appendChild(el);
  });

  // Показываем надпись
  instruction.style.opacity = "1";
}

function showEvidenceDesc(text, index) {
  const descEl = document.getElementById("evidence-desc");
  const textEl = document.getElementById("evidence-desc-text");

  textEl.textContent = text;
  descEl.style.display = "flex";

  // Удаляем круг
  const hotspot = document.querySelector(`.evidence-hotspot[data-index="${index}"]`);
  if (hotspot) hotspot.remove();

  state.evidenceGame.hotspotsFound++;
  state.evidenceGame.currentDesc = text; // запоминаем, что показываем описание

  // НЕ вызываем win сразу, даже если это последняя
}

function winEvidenceGame() {
  const game = state.evidenceGame;
  game.active = false;

  closeEvidenceGame();
  nextStep(); // показываем обычный текст сцены
}

function closeEvidenceGame() {
  const overlay = document.getElementById("evidence-game-overlay");
  overlay.style.display = "none";
  overlay.classList.remove("active");

  document.getElementById("evidence-desc").style.display = "none";
  document.getElementById("evidence-instruction").style.opacity = "0";

  state.evidenceGameCompleted = true;
}

function renderEnding(scene) {
  backgroundEl.style.backgroundImage = `url(${scene.background})`;
  backgroundEl.style.backgroundColor = "";
  textEl.innerHTML = "";
  choicesEl.innerHTML = "";

  const textBox = document.getElementById("text-box");
  const dialogueBox = document.getElementById("dialogue-box");
  if (textBox) textBox.classList.remove("visible");
  if (dialogueBox) dialogueBox.classList.remove("visible");

  // 🔹 ВАЖНО: particles теперь условные
  if (scene.particles) {
    startParticles(scene.particles);
  } else {
    stopParticles();
  }

  const overlay = document.getElementById("ending-overlay");
  const frameImg = document.getElementById("ending-frame-image");
  const returnBtn = document.getElementById("ending-return-btn");
  const returnBtnImg = document.getElementById("ending-return-btn-img");

  frameImg.src = scene.endingFrame || "";
  returnBtnImg.src = scene.returnButton || "";

  returnBtn.onclick = () => {
    overlay.classList.remove("active");
    returnBtn.blur();
    restartGame();
  };

  overlay.classList.add("active");
}

function restartGame() {
  // Invalidate all pending async navigation
  state.currentScene = null;

  state.navId = (state.navId ?? 0) + 1;

  // Reset core state
  state.currentScene = "scene_1";
  state.textIndex = 0;
  state.waitingForChoice = false;
  state.choiceReady = false;
  state.isTextStarted = false;
  state.history = [];

  state.introTimeout = null;
  state.introFadeTimeout = null;
  state.transitionTimeout = null;
  state.isTransitioning = false;

  state.sleepGameCompleted = false;
  state.sleepGame.attempts = 0;

  // Turn off particles and mouse choice
  stopParticles();

  if (state.disableMouseChoice) {
    state.disableMouseChoice();
    state.disableMouseChoice = null;
  }

  // Hide ending overlay just in case
  document.getElementById("ending-overlay")?.classList.remove("active");

  // Start first scene cleanly
  transitionToScene("scene_1", true);
}


document.addEventListener("keydown", (e) => {
  if (state.sleepGame.active) {
    if (e.key === " ") {
      e.preventDefault();

      // Уменьшаем темноту
      state.sleepGame.darkness = Math.max(0, state.sleepGame.darkness - 0.2);

      // Пульсация надписи
      const instruction = document.getElementById("sleep-instruction");
      instruction.classList.remove("pulse"); // сбрасываем, если анимация уже шла
      void instruction.offsetWidth;          // ← трюк для перезапуска анимации (force reflow)
      instruction.classList.add("pulse");

      return;
    }
    return; // блокируем остальные клавиши
  }

  if (state.evidenceGame.active && document.getElementById("evidence-desc").style.display === "flex") {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();

      const descEl = document.getElementById("evidence-desc");
      descEl.style.display = "none";

      // Если это была последняя улика — завершаем игру
      if (state.evidenceGame.hotspotsFound >= 5) {
        winEvidenceGame();
      }

      return;
    }
    return; // блокируем другие клавиши во время описания
  }

  const endingOverlay = document.getElementById("ending-overlay");
  if (endingOverlay?.classList.contains("active")) return;

  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();

    const introOverlay = document.getElementById("intro-overlay");
    if (introOverlay?.classList.contains("active")) {
      skipIntro();
    } else {
      nextStep();
    }
  }

  if (e.key === "Backspace") {
    e.preventDefault();
    goBack();
  }
});

document.getElementById("sleep-restart-btn").onclick = () => {
  // Полностью закрываем игру
  closeSleepGame();

  // Перезапускаем мини-игру напрямую
  transitionToScene(state.currentScene, true);
};

document.getElementById("sleep-skip-btn").onclick = () => {
  state.sleepGameCompleted = true;
  closeSleepGame();
  nextStep();
};

document.querySelectorAll(".dog-zone").forEach((zone, index) => {
  zone.addEventListener("click", () => {
    if (!state.dogsGame.active) return;

    const dog = state.dogsGame.dogs[index];
    dog.rage = Math.max(0, dog.rage - state.dogsGame.clickReduce);

    // Пульсация надписи при каждом клике
    const instruction = document.getElementById("dogs-instruction");
    instruction.classList.remove("pulse");
    void instruction.offsetWidth;          // force reflow для перезапуска анимации
    instruction.classList.add("pulse");
  });
});

document.getElementById("dogs-restart-btn").onclick = () => {
  document.getElementById("dogs-fail").style.display = "none";
  startDogsGame();
};

document.getElementById("dogs-skip-btn").onclick = () => {
  state.dogsGameCompleted = true;
  closeDogsGame();
  nextStep();
};

// restartGame();
transitionToScene(state.currentScene);
