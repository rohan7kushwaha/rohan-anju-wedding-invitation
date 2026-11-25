const form = document.getElementById('wishForm');
const storageStatus = document.getElementById('storageStatus');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealObserver = !prefersReducedMotion && 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' })
  : null;

function observeForReveal(element, delay = 0, staggerText = false) {
  if (!revealObserver) return;
  element.classList.add('scroll-reveal');
  element.style.setProperty('--reveal-delay', `${delay}ms`);
  if (staggerText) {
    const staggerInterval = element.matches('.story-section') ? 220 : 85;
    const textElements = element.matches('.invitation-card')
      ? element.querySelectorAll(
        '.invite-btn, .sacred-mark, .shloka, .invitation-script-title, .intro-copy, .person-card h3, .person-card .eyebrow, .person-card p:last-child, .couple-connector'
      )
      : [
        element.querySelector('.eyebrow'),
        element.querySelector('h2'),
        ...element.querySelectorAll('.story-copy > p')
      ].filter(Boolean);

    textElements.forEach((textElement, index) => {
      textElement.classList.add('scroll-reveal-text');
      textElement.style.setProperty('--text-reveal-delay', `${index * staggerInterval}ms`);
    });
  }
  revealObserver.observe(element);
}

if (revealObserver) {
  document.body.classList.add('motion-enabled');
  document.querySelectorAll('.invitation-card, .story-section').forEach(element => observeForReveal(element, 0, true));
  document.querySelectorAll(
    '.scratch-section, .countdown-section, .events-section .section-heading, .blessings-section'
  ).forEach(element => observeForReveal(element));
  observeForReveal(document.querySelector('.blessings-section h2'));
}

function revealElementsInView() {
  if (!revealObserver) return;
  document.querySelectorAll('.scroll-reveal:not(.is-visible)').forEach(element => {
    const bounds = element.getBoundingClientRect();
    if (bounds.top < window.innerHeight * 0.92 && bounds.bottom > 0) {
      element.classList.add('is-visible');
      revealObserver.unobserve(element);
    }
  });
}

window.addEventListener('scroll', revealElementsInView, { passive: true });
window.addEventListener('resize', revealElementsInView);
window.addEventListener('load', revealElementsInView);
window.requestAnimationFrame(revealElementsInView);

let heartEffectsStarted = false;
function createFloatingDecoration(container, delay = 0) {
  const isPetal = Math.random() < 0.35;
  const decoration = document.createElement('span');
  decoration.className = isPetal ? 'floating-petal' : 'floating-heart';
  if (!isPetal) decoration.textContent = '♥';
  decoration.style.left = `${5 + Math.random() * 90}%`;
  decoration.style.animationDelay = `${delay}ms`;
  decoration.style.setProperty('--heart-size', `${1.2 + Math.random() * 0.7}rem`);
  decoration.style.setProperty('--petal-width', `${0.35 + Math.random() * 0.3}rem`);
  decoration.style.setProperty('--petal-height', `${0.5 + Math.random() * 0.35}rem`);
  decoration.style.setProperty('--petal-color', ['#f08094', '#f4a1a7', '#df5474'][Math.floor(Math.random() * 3)]);
  decoration.style.setProperty('--heart-duration', `${6 + Math.random() * 5}s`);
  decoration.style.setProperty('--heart-drift', `${Math.round(Math.random() * 100 - 50)}px`);
  decoration.addEventListener('animationend', () => decoration.remove(), { once: true });
  container.append(decoration);
}

function startHeartEffects() {
  if (prefersReducedMotion || heartEffectsStarted) return;
  heartEffectsStarted = true;
  const heartLayers = [...document.querySelectorAll('[data-hearts]')];
  heartLayers.forEach(layer => {
    for (let index = 0; index < 8; index += 1) {
      createFloatingDecoration(layer, index * 180);
    }
  });
  window.setInterval(() => {
    heartLayers.forEach(layer => createFloatingDecoration(layer));
  }, 750);
}

function setStorageStatus(message) {
  storageStatus.textContent = message;
}

const introGate = document.getElementById('introGate');
const launchVideo = document.getElementById('launchVideo');
const launchVideoBackdrop = document.getElementById('launchVideoBackdrop');
const launchVideoStatus = document.getElementById('launchVideoStatus');
const launchJourneyButton = document.getElementById('launchJourneyButton');
const introVideoControls = document.getElementById('introVideoControls');
const continueButton = document.getElementById('continueButton');
const skipLaunchButton = document.getElementById('skipLaunchButton');
const launchMusic = document.getElementById('launchMusic');
const backgroundMusic = document.getElementById('backgroundMusic');
const musicToggle = document.getElementById('musicToggle');
const musicStatus = document.getElementById('musicStatus');
const invitationMusicSource = 'assets/music/invitation.mp3';
let musicPreference = null;
let launchMusicLocked = false;
let launchStarted = false;
const pageContent = [...document.body.children].filter(element =>
  element !== introGate && element !== musicToggle
);

document.body.classList.add('intro-locked');
backgroundMusic.pause();
pageContent.forEach(element => {
  element.inert = true;
  element.setAttribute('aria-hidden', 'true');
});

function showContinue(message) {
  skipLaunchButton.hidden = true;
  launchJourneyButton.hidden = true;
  continueButton.hidden = false;
  launchVideoStatus.textContent = message;
  launchVideoStatus.hidden = false;
}

function playLaunchMusic() {
  if (!launchStarted || launchMusicLocked || introGate.classList.contains('is-dismissed')) return;
  if (!backgroundMusic.paused) backgroundMusic.pause();
  if (!launchMusic.paused) return;
  const playAttempt = launchMusic.play();
  if (playAttempt) {
    playAttempt.catch(error => {
      console.error('Unable to play launch music.', error);
    });
  }
}

function startLaunchJourney() {
  if (launchStarted || launchMusicLocked) return;
  launchStarted = true;
  launchJourneyButton.hidden = true;
  skipLaunchButton.hidden = false;
  musicToggle.hidden = false;
  introVideoControls.classList.remove('intro-video-controls--launch');
  launchVideoStatus.hidden = true;

  const musicAttempt = launchMusic.play();
  if (musicAttempt) {
    musicAttempt.catch(error => {
      console.error('Unable to play launch music.', error);
    });
  }

  if (prefersReducedMotion) {
    showContinue('Opening video skipped because reduced motion is enabled. Open the invitation to continue.');
    return;
  }

  const videoAttempt = launchVideo.play();
  if (videoAttempt) {
    videoAttempt.catch(error => {
      console.error('Unable to play the wedding opening video.', error);
      showContinue('The opening video could not be played. Open the invitation to continue.');
    });
  }
}

launchVideo.addEventListener('play', () => {
  const backdropPlayAttempt = launchVideoBackdrop.play();
  if (backdropPlayAttempt) {
    backdropPlayAttempt.catch(error => {
      console.error('Unable to play the wedding opening backdrop.', error);
    });
  }
});

launchVideo.addEventListener('timeupdate', () => {
  if (launchVideoBackdrop.readyState >= HTMLMediaElement.HAVE_METADATA
      && Math.abs(launchVideoBackdrop.currentTime - launchVideo.currentTime) > 0.35) {
    launchVideoBackdrop.currentTime = launchVideo.currentTime;
  }
});

launchVideo.addEventListener('ended', () => {
  launchVideoBackdrop.pause();
  showContinue('The opening video has finished. Open the invitation to continue.');
});

launchVideo.addEventListener('error', () => {
  launchVideoBackdrop.pause();
  console.error('Unable to load the wedding opening video.', launchVideo.error);
  showContinue('The opening video could not be played. Open the invitation to continue.');
});

function openInvitation() {
  launchMusicLocked = true;
  introGate.classList.add('is-dismissed');
  launchVideo.pause();
  launchVideoBackdrop.pause();
  launchMusic.pause();
  launchMusic.currentTime = 0;
  const shouldPlayMusic = musicPreference !== false;
  backgroundMusic.src = invitationMusicSource;
  backgroundMusic.load();
  if (shouldPlayMusic) {
    musicPreference = true;
    launchMusic.pause();
    playBackgroundMusic();
  }
  pageContent.forEach(element => {
    element.inert = false;
    element.removeAttribute('aria-hidden');
  });
  document.body.classList.remove('intro-locked');
  document.body.classList.add('invitation-opened');
  startHeartEffects();
  window.requestAnimationFrame(revealElementsInView);
  window.setTimeout(revealElementsInView, 100);
  window.setTimeout(revealElementsInView, 600);
  window.setTimeout(() => introGate.remove(), 550);
}

const inviteButton = document.getElementById('open-invite');
const heartBurst = document.getElementById('burst');
inviteButton.addEventListener('click', event => {
  if (prefersReducedMotion) return;
  const cardBounds = inviteButton.closest('.invitation-card').getBoundingClientRect();
  const buttonBounds = inviteButton.getBoundingClientRect();
  const originX = buttonBounds.left + buttonBounds.width / 2 - cardBounds.left;
  const originY = buttonBounds.top + buttonBounds.height / 2 - cardBounds.top;
  heartBurst.replaceChildren();
  heartBurst.hidden = false;

  for (let index = 0; index < 28; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 45 + Math.random() * 105;
    const isPetal = Math.random() < 0.35;
    const decoration = document.createElement('span');
    decoration.className = isPetal ? 'burst-petal' : 'burst-heart';
    if (!isPetal) decoration.textContent = '♥';
    decoration.style.setProperty('--burst-left', `${originX}px`);
    decoration.style.setProperty('--burst-top', `${originY}px`);
    decoration.style.setProperty('--burst-x', `${Math.cos(angle) * distance}px`);
    decoration.style.setProperty('--burst-y', `${Math.sin(angle) * distance}px`);
    const burstSize = isPetal ? 0.35 + Math.random() * 0.2 : 1.1 + Math.random() * 0.55;
    decoration.style.setProperty('--burst-size', `${burstSize}rem`);
    decoration.style.setProperty('--burst-height', `${burstSize * 1.35}rem`);
    decoration.style.setProperty('--petal-color', ['#f08094', '#f4a1a7', '#df5474'][Math.floor(Math.random() * 3)]);
    decoration.addEventListener('animationend', () => {
      decoration.remove();
      if (heartBurst.childElementCount === 0) heartBurst.hidden = true;
    }, { once: true });
    heartBurst.append(decoration);
  }
});

function updateMusicToggle() {
  const isLaunchPhase = !introGate.classList.contains('is-dismissed');
  const activeMusic = isLaunchPhase ? launchMusic : backgroundMusic;
  const isPlaying = !activeMusic.paused && (isLaunchPhase ? !activeMusic.muted : true);
  musicToggle.classList.toggle('is-muted', !isPlaying);
  musicToggle.classList.toggle('is-playing', isPlaying);
  musicToggle.setAttribute('aria-pressed', String(isPlaying));
  musicToggle.setAttribute('aria-label', isPlaying ? 'Pause music' : 'Play music');
  musicToggle.title = isPlaying ? 'Pause music' : 'Play music';
}

function playBackgroundMusic() {
  launchMusic.pause();
  launchMusic.currentTime = 0;
  const playAttempt = backgroundMusic.play();
  if (playAttempt) {
    playAttempt.catch(error => {
      updateMusicToggle();
      musicStatus.textContent = 'Music could not be played. Check that assets/music/invitation.mp3 exists and is a valid MP3.';
      console.error('Unable to play background music from assets/music/invitation.mp3.', error);
    });
  }
}

musicToggle.addEventListener('click', () => {
  if (!introGate.classList.contains('is-dismissed')) {
    musicPreference = launchMusic.paused || launchMusic.muted;
    if (musicPreference) {
      launchMusic.muted = false;
      playLaunchMusic();
    } else {
      launchMusic.pause();
    }
    updateMusicToggle();
    return;
  }

  musicPreference = backgroundMusic.paused;
  if (musicPreference) {
    playBackgroundMusic();
  } else {
    backgroundMusic.pause();
  }
  updateMusicToggle();
});
backgroundMusic.addEventListener('play', () => {
  launchMusic.pause();
  launchMusic.currentTime = 0;
  updateMusicToggle();
});
backgroundMusic.addEventListener('pause', updateMusicToggle);
launchMusic.addEventListener('play', () => {
  updateMusicToggle();
  if (launchMusicLocked) {
    launchMusic.pause();
    launchMusic.currentTime = 0;
  }
});
launchMusic.addEventListener('pause', updateMusicToggle);
backgroundMusic.addEventListener('error', () => {
  musicStatus.textContent = 'Music could not be loaded. Check that assets/music/invitation.mp3 exists and is a valid MP3.';
  console.error('Unable to load background music from assets/music/invitation.mp3.', backgroundMusic.error);
});

launchJourneyButton.addEventListener('click', startLaunchJourney);
continueButton.addEventListener('click', openInvitation);
function seekToLastFrame(video, onSeeked) {
  function seekWhenDurationIsReady() {
    if (video.readyState < HTMLMediaElement.HAVE_METADATA
        || !Number.isFinite(video.duration)
        || video.duration <= 0) {
      return;
    }

    video.removeEventListener('loadedmetadata', seekWhenDurationIsReady);
    video.removeEventListener('durationchange', seekWhenDurationIsReady);
    const lastFrameTime = Math.max(0, video.duration - 0.01);
    if (Math.abs(video.currentTime - lastFrameTime) < 0.001 && !video.seeking) {
      onSeeked();
      return;
    }

    video.addEventListener('seeked', () => {
      video.pause();
      onSeeked();
    }, { once: true });
    video.currentTime = lastFrameTime;
  }

  video.pause();
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA
      && Number.isFinite(video.duration)
      && video.duration > 0) {
    seekWhenDurationIsReady();
    return;
  }

  video.addEventListener('loadedmetadata', seekWhenDurationIsReady);
  video.addEventListener('durationchange', seekWhenDurationIsReady);
}

skipLaunchButton.addEventListener('click', () => {
  skipLaunchButton.hidden = true;
  launchVideoStatus.textContent = 'Skipping the opening video…';
  launchVideoStatus.hidden = false;
  let videosAtLastFrame = 0;
  const revealContinueButton = () => {
    videosAtLastFrame += 1;
    if (videosAtLastFrame === 2) {
      showContinue('Opening video skipped. Open the invitation to continue.');
    }
  };
  seekToLastFrame(launchVideo, revealContinueButton);
  seekToLastFrame(launchVideoBackdrop, revealContinueButton);
});

function formatEventDate(date, options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) {
  if (!date) return 'Date to be announced';
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', options).format(new Date(year, month - 1, day));
}

function initializeJourneyAnimation(section) {
  const path = section.querySelector('.route-path');
  const progressPath = section.querySelector('.route-progress');
  const marker = document.getElementById('routeMarker');
  const pathLength = path.getTotalLength();
  let framePending = false;
  let previousScrollY = window.scrollY;
  let movingBackward = false;

  progressPath.style.strokeDasharray = `${pathLength}`;

  function updateProgress() {
    framePending = false;
    if (window.scrollY < previousScrollY) movingBackward = true;
    else if (window.scrollY > previousScrollY) movingBackward = false;
    previousScrollY = window.scrollY;

    const bounds = section.getBoundingClientRect();
    const progress = prefersReducedMotion
      ? 1
      : Math.max(0, Math.min(1, (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height)));
    const distance = pathLength * progress;
    const point = path.getPointAtLength(distance);
    const tangentDistance = progress >= 1 ? Math.max(0, distance - 1) : Math.min(pathLength, distance + 1);
    const tangent = path.getPointAtLength(tangentDistance);
    const direction = progress >= 1 ? 1 : -1;
    let angle = Math.atan2((point.y - tangent.y) * direction, (point.x - tangent.x) * direction) * 180 / Math.PI - 90;
    if (movingBackward) angle += 180;
    progressPath.style.strokeDashoffset = `${pathLength * (1 - progress)}`;
    marker.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(${angle})`);
  }

  function scheduleProgressUpdate() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(updateProgress);
  }

  if (!prefersReducedMotion) {
    window.addEventListener('scroll', scheduleProgressUpdate, { passive: true });
    window.addEventListener('resize', scheduleProgressUpdate);
  }
  updateProgress();
}

function initializeStoryAnimation(section) {
  const images = [...section.querySelectorAll('.story-art')];
  if (images.length < 2) return;

  let activeImage = 0;
  let cycleTimer = 0;
  let sectionVisible = false;

  function showImage(index) {
    activeImage = index;
    images.forEach((image, index) => {
      const relativePosition = (index - activeImage + images.length) % images.length;
      image.classList.toggle('is-active', relativePosition === 0);
      image.classList.toggle('is-next', relativePosition === 1);
      image.classList.toggle('is-previous', relativePosition === images.length - 1);
    });
  }

  function syncStoryCycle() {
    if (prefersReducedMotion || !sectionVisible || document.hidden) {
      window.clearInterval(cycleTimer);
      cycleTimer = 0;
      return;
    }

    if (cycleTimer) return;
    cycleTimer = window.setInterval(() => {
      showImage((activeImage + 1) % images.length);
    }, 3200);
  }

  showImage(activeImage);
  if (prefersReducedMotion) return;

  document.addEventListener('visibilitychange', syncStoryCycle);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      sectionVisible = entries.some(entry => entry.isIntersecting);
      syncStoryCycle();
    }, { threshold: 0.2 });
    observer.observe(section);
  } else {
    sectionVisible = true;
    syncStoryCycle();
  }
}

const eventVideoObserver = 'IntersectionObserver' in window && !prefersReducedMotion
  ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      if (!entry.isIntersecting) {
        video.pause();
        return;
      }

      const playAttempt = video.play();
      if (playAttempt) {
        playAttempt.catch(error => {
          if (error.name !== 'NotAllowedError') {
            console.error('Unable to autoplay the event video.', error);
          }
        });
      }
    });
  }, { threshold: 0.55 })
  : null;

function renderEvents(events, locationData, weddingEventId) {
  const locations = locationData.locations || {};
  const list = document.getElementById('eventList');
  const routeJourney = document.getElementById('routeJourney');
  routeJourney.hidden = true;
  list.replaceChildren();

  const route = locationData.route;
  if (route) {
    document.getElementById('routeJourneyEyebrow').textContent = route.eyebrow || '';
    document.getElementById('routeJourneyHeading').replaceChildren(
      document.createTextNode(route.headingFrom || route.from || ''),
      Object.assign(document.createElement('span'), { textContent: ' to ' }),
      document.createTextNode(route.headingTo || route.to || '')
    );
    document.getElementById('routeFromLabel').textContent = route.fromLabel || 'From';
    document.getElementById('routeFrom').textContent = route.from || '';
    document.getElementById('routeToLabel').textContent = route.toLabel || 'To';
    document.getElementById('routeTo').textContent = route.to || '';
  }

  events.forEach((event, index) => {
    const card = document.createElement('article');
    card.className = 'event-card';

    const name = document.createElement('h3');
    name.textContent = event.name;

    const date = document.createElement('p');
    date.className = 'event-date';
    date.textContent = event.date
      ? formatEventDate(event.date, { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
      : 'DATE TO BE ANNOUNCED';

    const schedule = document.createElement('p');
    schedule.className = 'event-schedule';
    const weekday = event.date
      ? formatEventDate(event.date, { weekday: 'long' }).toUpperCase()
      : '';
    const time = event.timeLabel
      ? event.timeLabel.toUpperCase()
      : event.time
        ? event.time.toUpperCase()
        : '';
    schedule.textContent = weekday
      ? `${weekday} · ${time || 'TIME TO BE ANNOUNCED'}`
      : time || 'SCHEDULE TO BE ANNOUNCED';

    if (event.video) {
      const video = document.createElement('video');
      video.className = 'event-video';
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      video.muted = true;
      video.loop = true;
      video.setAttribute('aria-label', `${event.name} event video`);
      const source = document.createElement('source');
      source.src = event.video;
      source.type = 'video/mp4';
      video.append(source, 'Your browser does not support local video playback.');
      card.append(name, date, schedule, video);
      if (eventVideoObserver) eventVideoObserver.observe(video);
    } else {
      card.append(name, date, schedule);
    }

    const location = locations[event.locationId];
    const venueBlock = document.createElement('div');
    venueBlock.className = 'event-venue';

    const venueLabel = document.createElement('p');
    venueLabel.className = 'venue-label';
    venueLabel.textContent = 'Venue';

    const venueName = document.createElement('p');
    venueName.className = 'venue-name';
    venueName.textContent = location ? location.name : 'Location to be announced';
    venueBlock.append(venueLabel, venueName);

    if (location && location.addressLine) {
      const address = document.createElement('p');
      address.className = 'venue-address';
      address.textContent = location.addressLine;
      venueBlock.append(address);
    }
    if (location && location.regionLine) {
      const region = document.createElement('p');
      region.className = 'venue-region';
      region.textContent = location.regionLine;
      venueBlock.append(region);
    }

    if (location && location.description) {
      const description = document.createElement('p');
      description.className = 'venue-description';
      description.textContent = location.description;
      venueBlock.append(description);
    }

    if (location && location.mapsUrl) {
      const mapLink = document.createElement('a');
      mapLink.className = 'map-link';
      mapLink.href = location.mapsUrl;
      mapLink.target = '_blank';
      mapLink.rel = 'noopener noreferrer';
      mapLink.textContent = 'View on Maps';
      venueBlock.append(mapLink);
    }

    card.append(venueBlock);
    list.append(card);
    observeForReveal(card, Math.min(index, 3) * 80);
  });

  const weddingIndex = events.findIndex(event => event.id === weddingEventId);
  if (route) {
    if (weddingIndex >= 0) {
      list.children[weddingIndex].before(routeJourney);
    } else {
      list.append(routeJourney);
    }
  }
  if (!route) return;
  routeJourney.hidden = false;
  initializeJourneyAnimation(routeJourney);
}

function renderFamily(members) {
  const titleSuffix = members.page?.titleSuffix || 'Wedding Invitation';
  document.title = `${members.groom.name} & ${members.bride.name} — ${titleSuffix}`;
  document.querySelector('meta[name="description"]').content =
    `Wedding invitation and celebration details for ${members.groom.name} and ${members.bride.name}.`;
  document.getElementById('heroGroomName').textContent = members.groom.name;
  document.getElementById('heroBrideName').textContent = members.bride.name;
  document.getElementById('groomName').textContent = members.groom.name;
  document.getElementById('groomParents').textContent = members.groom.parents.join(' & ');
  document.getElementById('brideName').textContent = members.bride.name;
  document.getElementById('brideParents').textContent = members.bride.parents.join(' & ');
  document.getElementById('footerGroomName').textContent = members.groom.name;
  document.getElementById('footerBrideName').textContent = members.bride.name;
  document.getElementById('wishesCoupleNames').textContent = `${members.groom.name} and ${members.bride.name}`;
  const blessings = document.getElementById('blessingsList');
  blessings.replaceChildren();
  members.blessings.forEach((group, index) => {
    const card = document.createElement('p');
    const relationship = document.createElement('strong');
    const names = document.createElement('div');
    names.className = 'blessing-names';
    relationship.textContent = group.relationship;
    group.names.forEach(line => {
      const lineElement = document.createElement('span');
      lineElement.textContent = line.join(' · ');
      names.append(lineElement);
    });
    card.append(relationship, names);
    blessings.append(card);
    observeForReveal(card, (index + 1) * 180);
  });
}

function renderWeddingDate(wedding) {
  document.getElementById('weddingScratchDate').textContent =
    wedding.date ? formatEventDate(wedding.date, { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase() : 'DATE TO BE ANNOUNCED';

  if (!wedding.date) {
    document.getElementById('days').textContent = '—';
    return;
  }

  const target = new Date(`${wedding.date}T${wedding.time || '00:00'}:00+05:30`).getTime();
  if (!Number.isFinite(target)) throw new Error('Marriage date or time in EventDate.json is invalid.');

  function updateCountdown() {
    const remaining = Math.max(0, target - Date.now());
    const values = {
      days: Math.floor(remaining / 86400000),
      hours: Math.floor((remaining % 86400000) / 3600000),
      minutes: Math.floor((remaining % 3600000) / 60000),
      seconds: Math.floor((remaining % 60000) / 1000)
    };

    Object.entries(values).forEach(([unit, value]) => {
      document.getElementById(unit).textContent = String(value).padStart(2, '0');
    });
  }

  updateCountdown();
  window.setInterval(updateCountdown, 1000);
}

async function loadTemplateData() {
  const basePath = 'assets/event-details/';
  const [eventData, locationData, memberData] = await Promise.all([
    fetch(`${basePath}EventDate.json`, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error(`EventDate.json returned HTTP ${response.status}`);
      return response.json();
    }),
    fetch(`${basePath}Location.json`, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error(`Location.json returned HTTP ${response.status}`);
      return response.json();
    }),
    fetch(`${basePath}Member.json`, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error(`Member.json returned HTTP ${response.status}`);
      return response.json();
    })
  ]);
  const weddingEventId = eventData.weddingEventId;
  if (!weddingEventId) throw new Error('EventDate.json must include weddingEventId.');
  const wedding = eventData.events.find(event => event.id === weddingEventId);
  if (!wedding) throw new Error(`EventDate.json must include an event with id "${weddingEventId}".`);

  renderEvents(eventData.events, locationData, weddingEventId);
  renderFamily(memberData);
  renderWeddingDate(wedding);
  document.getElementById('eventDataStatus').hidden = true;
}

loadTemplateData().catch(error => {
  const status = document.getElementById('eventDataStatus');
  status.textContent =
    'Could not load event details. Open this page through a local web server and check the JSON files.';
  status.hidden = false;
  console.error('Unable to load wedding template data.', error);
});

function initializeScratchCard() {
  const canvas = document.getElementById('scratchFoil');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;

  const bounds = canvas.getBoundingClientRect();
  context.scale(canvas.width / bounds.width, canvas.height / bounds.height);
  context.beginPath();
  context.moveTo(150, 280);
  context.bezierCurveTo(90, 230, 20, 170, 20, 95);
  context.bezierCurveTo(20, 45, 55, 18, 98, 18);
  context.bezierCurveTo(122, 18, 141, 31, 150, 51);
  context.bezierCurveTo(159, 31, 178, 18, 202, 18);
  context.bezierCurveTo(245, 18, 280, 45, 280, 95);
  context.bezierCurveTo(280, 170, 210, 230, 150, 280);
  context.closePath();
  context.clip();
  context.setTransform(1, 0, 0, 1, 0, 0);

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#f4df98');
  gradient.addColorStop(0.5, '#d0a931');
  gradient.addColorStop(1, '#f7e8b3');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fffaf0';
  context.font = 'bold 16px Georgia, serif';
  context.textAlign = 'center';
  context.fillText('Scratch to reveal', canvas.width / 2, canvas.height / 2);

  const initialPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let totalHeartSamples = 0;
  for (let i = 3; i < initialPixels.length; i += 4 * 16) {
    if (initialPixels[i] > 0) totalHeartSamples += 1;
  }

  let isRevealed = false;
  let scratched = 0;
  canvas.addEventListener('pointerdown', event => {
    canvas.setPointerCapture(event.pointerId);
    scratch(event);
  });
  canvas.addEventListener('pointerup', checkReveal);
  canvas.addEventListener('pointermove', event => {
    if (event.buttons !== 1 && event.pointerType !== 'touch') return;
    scratch(event);
    scratched += 1;
    if (scratched % 12 === 0) checkReveal();
  });

  function scratch(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * (canvas.width / bounds.width);
    const y = (event.clientY - bounds.top) * (canvas.height / bounds.height);
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.arc(x, y, 22, 0, Math.PI * 2);
    context.fill();
  }

  function checkReveal() {
    if (isRevealed) return;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let remaining = 0;
    for (let i = 3; i < pixels.length; i += 4 * 16) {
      if (pixels[i] > 0) remaining += 1;
    }
    if (remaining < totalHeartSamples * 0.42) {
      isRevealed = true;
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.parentElement.classList.add('is-revealed');
      celebrateScratchReveal();
    }
  }

  function celebrateScratchReveal() {
    if (prefersReducedMotion) return;
    const section = canvas.closest('.scratch-section');
    const layer = section.querySelector('.scratch-celebration');
    const sectionBounds = section.getBoundingClientRect();
    const heartBounds = canvas.parentElement.getBoundingClientRect();
    const originX = heartBounds.left + heartBounds.width / 2 - sectionBounds.left;
    const originY = heartBounds.top + heartBounds.height / 2 - sectionBounds.top;

    for (let index = 0; index < 18; index += 1) {
      const angle = (Math.PI * 2 * index) / 18 + (Math.random() - 0.5) * 0.28;
      const distance = 90 + Math.random() * 100;
      const particle = document.createElement('span');
      const isStar = index % 2 === 0;

      particle.className = `scratch-celebration-item${isStar ? ' scratch-celebration-item--star' : ''}`;
      particle.textContent = isStar ? '✦' : '♥';
      particle.addEventListener('animationend', () => particle.remove(), { once: true });
      particle.style.setProperty('--origin-x', `${originX}px`);
      particle.style.setProperty('--origin-y', `${originY}px`);
      particle.style.setProperty('--burst-x', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--burst-y', `${Math.sin(angle) * distance - 25}px`);
      particle.style.setProperty('--burst-rotation', `${Math.round(Math.random() * 90 - 45)}deg`);
      particle.style.setProperty('--celebration-size', `${0.65 + Math.random() * 0.75}rem`);
      particle.style.setProperty('--celebration-delay', `${Math.random() * 120}ms`);
      layer.appendChild(particle);
    }
  }
}

initializeScratchCard();
initializeStoryAnimation(document.querySelector('.story-section'));

form.addEventListener('submit', async event => {
  event.preventDefault();
  const name = document.getElementById('guestName').value.trim();
  const city = document.getElementById('guestCity').value.trim();
  const message = document.getElementById('guestBlessing').value.trim();
  const submitButton = form.querySelector('button[type="submit"]');
  if (!name || !message) {
    setStorageStatus('Please add your name and wish.');
    return;
  }

  submitButton.disabled = true;
  setStorageStatus('Sending your wish…');
  try {
    const response = await fetch('/api/wishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, city, message })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed with status ${response.status}.`);

    form.reset();
    setStorageStatus('Thank you! Your wish has been received.');
  } catch (error) {
    console.error('Unable to submit the wedding wish.', error);
    setStorageStatus('Your wish could not be saved right now. Please try again.');
  } finally {
    submitButton.disabled = false;
  }
});
