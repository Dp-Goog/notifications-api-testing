/* Add to Home Screen */
let deferredPrompt;
const btnAdd = document.getElementById('butInstall');
btnAdd.addEventListener('click', (e) => {
  // hide our user interface that shows our A2HS button
  btnAdd.setAttribute('disabled', true);
  // Show the prompt
  deferredPrompt.prompt();
  // Wait for the user to respond to the prompt
  deferredPrompt.userChoice.then((resp) => {
    console.log(JSON.stringify(resp));
  });
});

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-info bar from appearing.
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Update UI notify the user they can add to home screen
  btnAdd.removeAttribute('disabled');
});


/* Service Worker */
const swStatusEl = document.getElementById('swStatus');
const swRegisterBtn = document.getElementById('swRegister');
const swUnregisterBtn = document.getElementById('swUnregister');

async function updateSwStatus() {
  if (!('serviceWorker' in navigator)) {
    if (swStatusEl) swStatusEl.textContent = 'Service Workers not supported.';
    return;
  }
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    if (swStatusEl) {
      swStatusEl.textContent = 'Not registered (POST Share Target will fail unless backup-launched)';
    }
    return;
  }
  const state = reg.active
    ? 'active'
    : reg.waiting
    ? 'waiting'
    : reg.installing
    ? 'installing'
    : 'unknown';
  const controlled = navigator.serviceWorker.controller ? 'controlling page' : 'not yet controlling page';
  if (swStatusEl) {
    swStatusEl.textContent = `Registered (state: ${state}, ${controlled}, scope: ${reg.scope})`;
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    console.log('Service Worker Registered', reg.scope);
    await updateSwStatus();
  } catch (err) {
    console.error('Service Worker registration failed:', err);
    if (swStatusEl) swStatusEl.textContent = `Registration failed: ${err.message}`;
  }
}

async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const reg of regs) {
    await reg.unregister();
  }
  console.log('Service Worker Unregistered');
  await updateSwStatus();
}

if (swRegisterBtn) {
  swRegisterBtn.addEventListener('click', registerServiceWorker);
}

if (swUnregisterBtn) {
  swUnregisterBtn.addEventListener('click', unregisterServiceWorker);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', updateSwStatus);
  const params = new URLSearchParams(window.location.search);
  if (params.get('nosw') === '1') {
    console.log('Skipping automatic Service Worker registration (?nosw=1)');
    updateSwStatus();
  } else {
    registerServiceWorker();
  }
}