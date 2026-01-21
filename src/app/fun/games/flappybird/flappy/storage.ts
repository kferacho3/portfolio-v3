export default class Storage {
  getStorageData() {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem('flappyBirdData');
    return stored ? JSON.parse(stored) : null;
  }

  setStorageData(data: { bestScore: number }) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('flappyBirdData', JSON.stringify(data));
  }
}
