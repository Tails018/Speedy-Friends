(() => {
  const stories = {
    'sonic-wars': {
      eyebrow: 'SONIC WARS · HISTORIA DEL TEAM',
      title: 'Sonic Wars',
      image: 'assets/ultimos-momentos/sonic-wars.jpeg',
      number: '01 / 03',
      body: `Dr. Ivo Robonkin, proveniente de Sonic SATAM, descubre la existencia de los multiversos y emprende una búsqueda obsesiva para encontrar formas de eliminar a su propio Sonic. Lo consigue al reunir versiones alternativas y malvadas del erizo.\n\nAnte el descubrimiento, lleva el proyecto mucho más lejos: conquistar otros mundos, derrocar a Sonic y provocar el mayor caos posible mientras satisface a varios de esos erizos oscuros con lo que buscan: destrucción.\n\nSuena a la simpleza de un villano que solo quiere destruir, pero para un héroe que vive con la libertad del mundo, no sería descabellado pensar que existe una libertad inhumana para cometer atrocidades con tal de alimentar el ego y la avaricia.`
    },
    'metal-virus': {
      eyebrow: 'METAL VIRUS RENACIMIENTO · HISTORIA DEL TEAM',
      title: 'Metal Virus Renacimiento',
      image: 'assets/ultimos-momentos/metal-virus.jpeg',
      number: '02 / 03',
      body: `Durante los eventos de X, cuando intentó asimilar tantos mundos para obtener más poder, su derrota a manos de héroes de distintas realidades parecía ser el final. Pero mientras abría portales, zombots infectaban mobianos de esos mundos en silencio.\n\nNo eran zombots cualquiera. Conservaban intelecto, memoria y grados de consciencia inimaginables, y eso llevó a una extinción casi total de las razas mobianas. Cada día quedaban menos seres orgánicos.\n\nEn uno de esos mundos, Sally Acorn, infectada, adquirió consciencia y la capacidad de controlar a otros infectados. En su búsqueda por erradicar toda forma de resistencia reunió un ejército y buscó liberar a Neo Devil Doom, sellado por Mammoth Mogul en un desierto inhóspito.\n\nPero sus planes chocaron con una amenaza mayor: Tails estaba desarrollando una cura. Desde entonces, toda posible esperanza se convirtió en su objetivo prioritario.`
    },
    'execution': {
      eyebrow: 'EXECUTION · HISTORIA DEL TEAM',
      title: 'Execution',
      image: 'assets/ultimos-momentos/execution.jpeg',
      number: '03 / 03',
      body: `Un evento anómalo, fuera de lugar y de toda certeza, simplemente existió sin ser visto ni reconocido. El propio vacío y la oscuridad que siempre habían estado ajenos al mundo de Sonic lograron acceder.\n\nX tomó el lugar de un Sonic clásico y transformó su mundo en un infierno magnífico para él. Después de cansarse de torturar a las pocas almas restantes, descubrió el cosmos de Sonic y decidió expandirse por el multiverso.\n\nEnvió guardianes como conectores entre cada universo, capaces de asimilar mundos enteros para crecer de forma indefinida. El cosmos entero, al que nunca había pertenecido, reclamó a Sonic como propiedad auténtica y convirtió a cada personaje y cada mundo en parte de su espectáculo.\n\nNo era solo una invasión. Era el nacimiento de un escenario absoluto de terror y agonía.`
    }
  };

  const keys = Object.keys(stories);
  const modal = document.getElementById('storyModal');
  const modalImage = document.getElementById('storyModalImage');
  const modalEyebrow = document.getElementById('storyModalEyebrow');
  const modalTitle = document.getElementById('storyModalTitle');
  const modalBody = document.getElementById('storyModalBody');
  const modalCopy = document.getElementById('storyModalCopy');
  const modalProgress = document.getElementById('storyModalProgress');
  const modalCounter = document.getElementById('storyModalCounter');
  const prevButton = document.getElementById('storyPrev');
  const nextButton = document.getElementById('storyNext');
  const scrollHint = document.getElementById('storyScrollHint');
  if (!modal) return;

  let activeKey = keys[0];
  let lastTrigger = null;

  const setProgress = () => {
    const max = modalBody.scrollHeight - modalBody.clientHeight;
    const pct = max > 0 ? Math.min(100, (modalBody.scrollTop / max) * 100) : 100;
    modalProgress.style.width = `${pct}%`;
    scrollHint.textContent = max > 24 && pct < 96 ? 'Desplázate para leer' : 'Fin de la historia';
  };

  const updateNav = () => {
    const index = keys.indexOf(activeKey);
    prevButton.disabled = index <= 0;
    nextButton.disabled = index >= keys.length - 1;
  };

  const openStory = (key, trigger = null) => {
    const story = stories[key];
    if (!story) return;
    activeKey = key;
    lastTrigger = trigger || lastTrigger;
    modalImage.src = story.image;
    modalImage.alt = story.title;
    modalEyebrow.textContent = story.eyebrow;
    modalTitle.textContent = story.title;
    modalCounter.textContent = story.number;
    modalBody.innerHTML = story.body.split(/\n\n/).map(p => `<p>${p}</p>`).join('');
    modalBody.scrollTop = 0;
    modalProgress.style.width = '0%';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('story-modal-open');
    updateNav();
    requestAnimationFrame(() => {
      modal.querySelector('.story-modal-dialog')?.classList.add('shown');
      modalBody.focus?.({preventScroll:true});
      setProgress();
    });
  };

  const closeStory = () => {
    modal.querySelector('.story-modal-dialog')?.classList.remove('shown');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('story-modal-open');
    if (lastTrigger) {
      lastTrigger.focus?.();
      lastTrigger = null;
    }
  };

  const go = direction => {
    const index = keys.indexOf(activeKey);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= keys.length) return;
    openStory(keys[nextIndex], null);
  };

  document.addEventListener('click', event => {
    const button = event.target.closest('.story-read');
    if (button) {
      const card = button.closest('.team-story-card');
      if (card) openStory(card.dataset.story, button);
      return;
    }
    if (event.target.closest('[data-story-close]')) closeStory();
    if (event.target.closest('#storyPrev')) go(-1);
    if (event.target.closest('#storyNext')) go(1);
  });

  modalBody.addEventListener('scroll', setProgress, {passive:true});
  modal.addEventListener('click', event => {
    if (event.target === modal) closeStory();
  });

  document.addEventListener('keydown', event => {
    if (!modal.classList.contains('open')) return;
    if (event.key === 'Escape') closeStory();
    if (event.key === 'ArrowLeft' && !event.altKey && !event.ctrlKey) go(-1);
    if (event.key === 'ArrowRight' && !event.altKey && !event.ctrlKey) go(1);
  });

  document.querySelectorAll('.team-story-card').forEach((card, index) => {
    card.style.setProperty('--story-delay', `${index * 110}ms`);
    card.addEventListener('pointermove', event => {
      if (window.matchMedia('(hover: hover)').matches) {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty('--story-rx', `${(-y * 5).toFixed(2)}deg`);
        card.style.setProperty('--story-ry', `${(x * 7).toFixed(2)}deg`);
      }
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--story-rx', '0deg');
      card.style.setProperty('--story-ry', '0deg');
    });
  });
})();
