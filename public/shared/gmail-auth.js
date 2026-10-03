// gmail-auth.js — Google Sign-In flow ONLY. Structure ready; button stays hidden until ACTIVATED = true.
// ACTIVATION: set ACTIVATED = true below once you've enabled Google provider in Firebase Console → Authentication.

const ACTIVATED = false;

async function signInWithGmail() {
  if (!firebase.auth) throw new Error('Firebase Auth SDK not loaded');
  const provider = new firebase.auth.GoogleAuthProvider();
  const result = await firebase.auth().signInWithPopup(provider);
  return { email: result.user.email, uid: result.user.uid, name: result.user.displayName };
}

function bindGmailButton(buttonEl, onSignedIn) {
  if (!ACTIVATED) { buttonEl.style.display = 'none'; return; }
  buttonEl.style.display = 'flex';
  buttonEl.addEventListener('click', async () => {
    try {
      const user = await signInWithGmail();
      onSignedIn(user);
    } catch (err) {
      window.showToast('Gmail sign-in fail hua', 'error');
    }
  });
}

window.GmailAuth = { bindGmailButton, ACTIVATED };
